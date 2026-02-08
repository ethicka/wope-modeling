import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell, ReferenceLine } from "recharts";
import { DISTRICTS } from '../data/districts.js';
import { runFormula } from '../engine/sfra-formula.js';
import { fmt, fmtPct } from '../utils/format.js';
import Tip from './ui/Tip.jsx';

/* ── Stress scoring engine ──────────────────────────────────── */

function scoreDistrict(d, formula) {
  const fs = d.fiscalStress;
  const indicators = [];

  // 1. Declining fund balance
  const fbHistory = fs.fundBalanceHistory;
  const fbStart = fbHistory[0].pctBudget;
  const fbEnd = fbHistory[fbHistory.length - 1].pctBudget;
  const fbDecline = fbStart - fbEnd;
  const fbBelowMin = fbEnd < 2.0; // NJ recommended minimum ~2%
  const fbScore = Math.min(25, (fbDecline / 5) * 20 + (fbBelowMin ? 5 : 0));
  indicators.push({
    id: "fund-balance",
    label: "Declining Fund Balance",
    score: Math.round(fbScore),
    max: 25,
    severity: fbScore > 15 ? "critical" : fbScore > 8 ? "warning" : "stable",
    detail: `Reserve fell from ${fbStart.toFixed(1)}% to ${fbEnd.toFixed(1)}% of budget over 5 years`,
    metric: `${fbEnd.toFixed(1)}% of budget`,
    threshold: "2.0% minimum recommended",
  });

  // 2. Spending above adequacy
  const adequacyGap = d.ufb.totalBudget - formula.adequacy;
  const gapPct = (adequacyGap / formula.adequacy) * 100;
  // Positive gap = spending above adequacy (structural pressure)
  const spendScore = adequacyGap > 0
    ? Math.min(25, (gapPct / 20) * 25)
    : 0;
  indicators.push({
    id: "spend-above",
    label: "Spending Above Adequacy",
    score: Math.round(spendScore),
    max: 25,
    severity: spendScore > 15 ? "critical" : spendScore > 8 ? "warning" : "stable",
    detail: adequacyGap > 0
      ? `Budget exceeds SFRA adequacy by ${fmt(adequacyGap)} (${gapPct.toFixed(1)}%)`
      : `Budget is ${fmt(Math.abs(adequacyGap))} below SFRA adequacy`,
    metric: adequacyGap > 0 ? `+${fmt(adequacyGap)} over` : `${fmt(Math.abs(adequacyGap))} under`,
    threshold: "0% = spending at adequacy",
  });

  // 3. Revenue growth < cost growth
  const growthGap = fs.costGrowthRate - fs.revenueGrowthRate;
  const growthScore = Math.min(25, (growthGap / 4) * 25);
  indicators.push({
    id: "growth-gap",
    label: "Revenue–Cost Growth Gap",
    score: Math.round(Math.max(0, growthScore)),
    max: 25,
    severity: growthGap > 2.5 ? "critical" : growthGap > 1.0 ? "warning" : "stable",
    detail: `Costs growing ${fs.costGrowthRate.toFixed(1)}%/yr vs revenue ${fs.revenueGrowthRate.toFixed(1)}%/yr (gap: ${growthGap.toFixed(1)}pp)`,
    metric: `${growthGap.toFixed(1)}pp gap`,
    threshold: "0pp = balanced growth",
  });

  // 4. ESSER dependency / cliff exposure
  const esserCliff = fs.esser.cliffExposure;
  const cliffPct = (esserCliff / d.ufb.totalBudget) * 100;
  const esserScore = Math.min(25, (cliffPct / 6) * 25);
  indicators.push({
    id: "esser-cliff",
    label: "ESSER Cliff Exposure",
    score: Math.round(esserScore),
    max: 25,
    severity: esserScore > 15 ? "critical" : esserScore > 8 ? "warning" : "stable",
    detail: `${fmt(esserCliff)} in recurring costs were ESSER-funded (${fs.esser.positionsFundedByEsser} positions)`,
    metric: `${cliffPct.toFixed(1)}% of budget`,
    threshold: "0% = no ESSER dependency",
  });

  const totalScore = indicators.reduce((s, i) => s + i.score, 0);
  const maxScore = indicators.reduce((s, i) => s + i.max, 0);

  return {
    indicators,
    totalScore,
    maxScore,
    level: totalScore >= 65 ? "severe" : totalScore >= 40 ? "elevated" : totalScore >= 20 ? "moderate" : "low",
  };
}

const LEVEL_COLORS = {
  severe: "#ef4444",
  elevated: "#f59e0b",
  moderate: "#eab308",
  low: "#22c55e",
};
const SEVERITY_COLORS = { critical: "#ef4444", warning: "#f59e0b", stable: "#22c55e" };

/* ── Component ──────────────────────────────────────────────── */

export default function FiscalStressView({ overrides }) {
  const results = Object.entries(DISTRICTS).map(([k, d]) => {
    const formula = runFormula(d, overrides);
    const stress = scoreDistrict(d, formula);
    return { key: k, ...d, formula, stress };
  });

  // Fund balance trend chart data
  const fbTrendData = DISTRICTS.westOrange.fiscalStress.fundBalanceHistory.map((_, i) => {
    const row = { year: DISTRICTS.westOrange.fiscalStress.fundBalanceHistory[i].year };
    results.forEach(r => {
      row[r.short] = r.fiscalStress.fundBalanceHistory[i].pctBudget;
    });
    return row;
  });

  // Budget vs revenue gap chart data
  const gapTrendData = results[0].fiscalStress.budgetHistory.map((_, i) => {
    const row = { year: results[0].fiscalStress.budgetHistory[i].year };
    results.forEach(r => {
      const bh = r.fiscalStress.budgetHistory[i];
      row[`${r.short}_gap`] = ((bh.budget - bh.revenue) / bh.budget) * 100;
    });
    return row;
  });

  // ESSER spend-down timeline
  const esserYears = ["FY21", "FY22", "FY23", "FY24", "FY25"];
  const esserData = esserYears.map((yr, i) => {
    const fyKey = `fy2${1 + i}`;
    const row = { year: yr };
    results.forEach(r => {
      row[r.short] = (r.fiscalStress.esser.spent[fyKey] || 0) / 1e6;
    });
    return row;
  });

  // Composite score bar data
  const scoreData = results.map(r => ({
    name: r.short,
    score: r.stress.totalScore,
    color: LEVEL_COLORS[r.stress.level],
    level: r.stress.level,
  }));

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20, padding: 16, background: "linear-gradient(135deg, #1a1418, #141012)", borderRadius: 12, border: "1px solid #3a2028" }}>
        <div style={{ fontSize: 14, color: "#e88a8a", fontWeight: 600, marginBottom: 4 }}>
          <Tip term="FSI">Fiscal Stress</Tip> Dashboard
        </div>
        <div style={{ fontSize: 12, color: "#9a7878", lineHeight: 1.6 }}>
          Identifies districts showing structural fiscal warning signs — not to blame administrators, but to reveal where the funding system itself forces impossible choices. A district can do everything "right" and still face a fiscal cliff when federal funds expire, costs outpace revenue, and state aid caps prevent adequate funding.
        </div>
      </div>

      {/* Composite Score Cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {results.map(r => {
          const lc = LEVEL_COLORS[r.stress.level];
          return (
            <div key={r.key} style={{
              flex: 1, minWidth: 220, padding: 18, background: "#1a1914",
              borderRadius: 12, border: `1px solid ${lc}30`, borderTop: `3px solid ${lc}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: r.color, fontFamily: "'Instrument Serif', serif" }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: "#6a6758", marginTop: 2 }}>{r.type}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: lc, fontFamily: "'Instrument Serif', serif" }}>
                    {r.stress.totalScore}
                  </div>
                  <div style={{ fontSize: 10, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em" }}>/ {r.stress.maxScore}</div>
                </div>
              </div>
              <div style={{
                display: "inline-block", marginTop: 8, padding: "3px 10px",
                borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: `${lc}18`, color: lc, textTransform: "uppercase", letterSpacing: "0.06em",
              }}>
                {r.stress.level} stress
              </div>
              {/* Mini indicator bars */}
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {r.stress.indicators.map(ind => (
                  <div key={ind.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#8a8778", marginBottom: 2 }}>
                      <span>{ind.label}</span>
                      <span style={{ color: SEVERITY_COLORS[ind.severity], fontWeight: 600 }}>{ind.score}/{ind.max}</span>
                    </div>
                    <div style={{ height: 4, background: "#2a2820", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{
                        width: `${(ind.score / ind.max) * 100}%`, height: "100%",
                        background: SEVERITY_COLORS[ind.severity], borderRadius: 2,
                        transition: "width 0.3s",
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Composite score bar chart */}
      <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820", marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
          Composite <Tip term="FSI">Fiscal Stress Index</Tip> (0–100)
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={scoreData} layout="vertical" margin={{ left: 30, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: "#6a6758", fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: "#8a8778", fontSize: 12 }} axisLine={false} />
            <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 13 }}
              formatter={(v, _, entry) => [`${v} / 100`, `Stress: ${entry.payload.level}`]} />
            <ReferenceLine x={40} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Elevated", fill: "#f59e0b", fontSize: 10, position: "top" }} />
            <ReferenceLine x={65} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Severe", fill: "#ef4444", fontSize: 10, position: "top" }} />
            <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20}>
              {scoreData.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Indicator Deep Dives ─────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>

        {/* Fund Balance Trend */}
        <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
          <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
            Fund Balance as % of Budget
          </div>
          <div style={{ fontSize: 11, color: "#5a5848", marginBottom: 12 }}>Declining reserves signal structural deficit — districts draw down savings to avoid cuts</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={fbTrendData} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
              <XAxis dataKey="year" tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 8]} unit="%" />
              <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 12 }}
                formatter={v => `${v.toFixed(1)}%`} />
              <ReferenceLine y={2} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "2% minimum", fill: "#ef4444", fontSize: 10, position: "right" }} />
              {results.map(r => (
                <Line key={r.short} type="monotone" dataKey={r.short} stroke={r.color}
                  strokeWidth={2} dot={{ r: 3, fill: r.color }} name={r.name} />
              ))}
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Budget–Revenue Gap Trend */}
        <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
          <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
            Budget–Revenue Gap (% of Budget)
          </div>
          <div style={{ fontSize: 11, color: "#5a5848", marginBottom: 12 }}>Growing gap = costs rising faster than available revenue, forcing fund balance drawdowns</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={gapTrendData} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
              <XAxis dataKey="year" tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 12 }}
                formatter={v => `${v.toFixed(2)}%`} />
              <ReferenceLine y={0} stroke="#4a4838" />
              {results.map(r => (
                <Line key={r.short} type="monotone" dataKey={`${r.short}_gap`} stroke={r.color}
                  strokeWidth={2} dot={{ r: 3, fill: r.color }} name={r.name} />
              ))}
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ESSER Spend-Down */}
        <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
          <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
            <Tip term="ESSER">ESSER</Tip> Spending by Year ($M)
          </div>
          <div style={{ fontSize: 11, color: "#5a5848", marginBottom: 12 }}>Federal relief funds that masked structural deficits — now expired</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={esserData} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
              <XAxis dataKey="year" tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 12 }}
                formatter={v => `$${v.toFixed(1)}M`} />
              {results.map(r => (
                <Bar key={r.short} dataKey={r.short} fill={r.color} opacity={0.8} name={r.name} />
              ))}
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ESSER Cliff Exposure */}
        <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
          <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
            <Tip term="ESSER">ESSER</Tip> Cliff: Recurring Costs at Risk
          </div>
          <div style={{ fontSize: 11, color: "#5a5848", marginBottom: 12 }}>Positions and programs funded by one-time federal money that districts must now absorb or cut</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {results.map(r => {
              const es = r.fiscalStress.esser;
              const cliffPct = (es.cliffExposure / r.ufb.totalBudget) * 100;
              return (
                <div key={r.key} style={{ padding: 12, background: "#12110e", borderRadius: 8, border: `1px solid ${r.color}25` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: r.color }}>{r.short}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: cliffPct > 3 ? "#ef4444" : cliffPct > 1 ? "#f59e0b" : "#22c55e" }}>
                      {fmt(es.cliffExposure)}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8a8778" }}>
                    <span>{es.positionsFundedByEsser} positions at risk</span>
                    <span>{cliffPct.toFixed(1)}% of budget</span>
                  </div>
                  <div style={{ height: 4, background: "#2a2820", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                    <div style={{
                      width: `${Math.min(cliffPct * 10, 100)}%`, height: "100%",
                      background: cliffPct > 3 ? "#ef4444" : cliffPct > 1 ? "#f59e0b" : "#22c55e",
                      borderRadius: 2,
                    }} />
                  </div>
                  <div style={{ fontSize: 10, color: "#5a5848", marginTop: 6, lineHeight: 1.4 }}>
                    {es.usedFor.join(" · ")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detailed indicator breakdown table */}
      <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
          Indicator Detail
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #2a2820" }}>
                <th style={{ textAlign: "left", padding: 8, color: "#6a6758", fontWeight: 500 }}>Metric</th>
                {results.map(r => <th key={r.key} style={{ textAlign: "right", padding: 8, color: r.color, fontWeight: 600 }}>{r.short}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Composite Stress Score", fn: r => <span style={{ color: LEVEL_COLORS[r.stress.level], fontWeight: 700 }}>{r.stress.totalScore} / {r.stress.maxScore}</span> },
                { label: "Stress Level", fn: r => <span style={{ color: LEVEL_COLORS[r.stress.level], fontWeight: 600, textTransform: "capitalize" }}>{r.stress.level}</span> },
                { label: "sep" },
                { label: "Fund Balance (current)", fn: r => fmt(r.fiscalStress.fundBalanceHistory[4].balance) },
                { label: "Fund Balance % of Budget", fn: r => {
                  const pct = r.fiscalStress.fundBalanceHistory[4].pctBudget;
                  return <span style={{ color: pct < 2 ? "#ef4444" : pct < 4 ? "#f59e0b" : "#22c55e" }}>{pct.toFixed(1)}%</span>;
                }},
                { label: "Fund Balance 5yr Change", fn: r => {
                  const delta = r.fiscalStress.fundBalanceHistory[4].pctBudget - r.fiscalStress.fundBalanceHistory[0].pctBudget;
                  return <span style={{ color: delta < 0 ? "#ef4444" : "#22c55e", fontWeight: 600 }}>{delta > 0 ? "+" : ""}{delta.toFixed(1)}pp</span>;
                }},
                { label: "sep" },
                { label: "Budget vs SFRA Adequacy", fn: r => {
                  const gap = r.ufb.totalBudget - r.formula.adequacy;
                  return <span style={{ color: gap > 0 ? "#f59e0b" : "#22c55e" }}>{gap > 0 ? "+" : ""}{fmt(gap)}</span>;
                }},
                { label: "sep" },
                { label: "Revenue Growth (avg %/yr)", fn: r => `${r.fiscalStress.revenueGrowthRate.toFixed(1)}%` },
                { label: "Cost Growth (avg %/yr)", fn: r => `${r.fiscalStress.costGrowthRate.toFixed(1)}%` },
                { label: "Growth Gap", fn: r => {
                  const gap = r.fiscalStress.costGrowthRate - r.fiscalStress.revenueGrowthRate;
                  return <span style={{ color: gap > 2 ? "#ef4444" : gap > 1 ? "#f59e0b" : "#22c55e", fontWeight: 600 }}>{gap.toFixed(1)}pp</span>;
                }},
                { label: "sep" },
                { label: "ESSER Total Allocation", fn: r => fmt(r.fiscalStress.esser.totalAllocation) },
                { label: "ESSER Cliff Exposure", fn: r => <span style={{ color: "#ef4444", fontWeight: 600 }}>{fmt(r.fiscalStress.esser.cliffExposure)}</span> },
                { label: "Positions at Risk", fn: r => r.fiscalStress.esser.positionsFundedByEsser },
                { label: "Cliff as % of Budget", fn: r => {
                  const pct = (r.fiscalStress.esser.cliffExposure / r.ufb.totalBudget) * 100;
                  return <span style={{ color: pct > 3 ? "#ef4444" : pct > 1 ? "#f59e0b" : "#22c55e" }}>{pct.toFixed(2)}%</span>;
                }},
              ].map((row, i) => {
                if (row.label === "sep") return <tr key={i}><td colSpan={5} style={{ height: 4, background: "#1f1e18" }}></td></tr>;
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #1f1e18" }}>
                    <td style={{ padding: "7px 10px", color: "#8a8778" }}>{row.label}</td>
                    {results.map(r => <td key={r.key} style={{ textAlign: "right", padding: "7px 10px", color: "#e2e0d6" }}>{row.fn(r)}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Narrative framing */}
      <div style={{ padding: 16, background: "#141012", borderRadius: 12, border: "1px solid #3a2028" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#e88a8a", marginBottom: 8 }}>
          The system, not the superintendent
        </div>
        <div style={{ fontSize: 12, color: "#9a7878", lineHeight: 1.7 }}>
          <p style={{ margin: "0 0 8px" }}>
            When a district shows fiscal stress, the instinct is to ask "who mismanaged the budget?" But these indicators tell a different story. Consider a district where:
          </p>
          <ul style={{ margin: "0 0 8px", paddingLeft: 20 }}>
            <li>Health benefit costs rise 8–10% per year while the state aid cap limits increases to 2–3%</li>
            <li>Special education tuition for out-of-district placements grows 6–8% annually with no dedicated funding increase</li>
            <li>The 2% levy cap means property tax revenue cannot keep pace with contractually obligated salary increases</li>
            <li>Federal <Tip term="ESSER">ESSER</Tip> funds — used to hire counselors, reading specialists, and intervention staff — expired in September 2024, creating an overnight budget hole</li>
          </ul>
          <p style={{ margin: 0 }}>
            In this environment, <strong style={{ color: "#e8a8a8" }}>every administrator faces the same math</strong>: costs that compound faster than revenue. The question isn't whether cuts happen — it's which students lose services first. Fiscal stress is a <em>policy design problem</em>, not a <em>management competence problem</em>.
          </p>
        </div>
      </div>
    </div>
  );
}
