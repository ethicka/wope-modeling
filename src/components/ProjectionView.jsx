import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend, CartesianGrid } from "recharts";
import { DISTRICTS } from '../data/districts.js';
import { FORMULA, GROWTH_DEFAULTS } from '../data/formula-params.js';
import { CUSTOM_DATA } from '../data/custom-formula-data.js';
import { runFormula } from '../engine/sfra-formula.js';
import { fmt, fmtPct } from '../utils/format.js';
import Pill from './ui/Pill.jsx';
import Tip from './ui/Tip.jsx';

export default function ProjectionView({ overrides }) {
  const [growth, setGrowth] = useState(GROWTH_DEFAULTS);
  const [noLevyCap, setNoLevyCap] = useState(false);
  const setG = (k, v) => setGrowth(prev => ({ ...prev, [k]: v }));
  const years = [2026, 2027, 2028, 2029, 2030];

  const projections = Object.entries(DISTRICTS).map(([k, baseD]) => {
    let prevAid = baseD.fy25;

    const baseBudget = baseD.ufb.totalBudget;
    const baseLevy = baseD.ufb.localTaxLevy;
    const baseFed = baseD.ufb.federalAid;
    const baseOther = baseD.ufb.otherRevenue;

    const annual = years.map((yr, yi) => {
      const d = {
        ...baseD,
        enr: { ...baseD.enr },
        ev3yr: [...baseD.ev3yr],
        income: baseD.income,
        levy: baseD.levy,
        budget: baseD.budget,
        atRisk: baseD.atRisk,
        lep: baseD.lep,
        combo: baseD.combo,
        fy26Detail: { ...baseD.fy26Detail },
      };

      for (let i = 0; i < yi; i++) {
        const gEnr = 1 + growth.enrollment / 100;
        d.enr = { total: Math.round(d.enr.total * gEnr), elem: Math.round(d.enr.elem * gEnr), mid: Math.round(d.enr.mid * gEnr), hs: Math.round(d.enr.hs * gEnr) };
        d.atRisk = Math.round(d.atRisk * 1.005);
        d.atRiskPct = d.enr.total > 0 ? d.atRisk / d.enr.total : d.atRiskPct;
        d.lep = Math.round(d.lep * 1.01);
        d.combo = Math.round(d.combo * 1.01);
        d.ev3yr = d.ev3yr.map(v => v * (1 + growth.ev / 100));
        d.income = d.income * (1 + growth.income / 100);
        d.levy = d.levy * (1 + growth.levy / 100);
        d.budget = d.budget * (1 + growth.budgetGrowth / 100);
        d.fy26Detail = { ...d.fy26Detail, trans: d.fy26Detail.trans * (1 + growth.cpi / 100) };
      }

      const ov = { ...overrides };
      if (yi > 0) ov.basePP = (ov.basePP || FORMULA.basePP) * Math.pow(1 + growth.cpi / 100, yi);

      d.fy25 = prevAid;
      const r = runFormula(d, ov);
      prevAid = r.totalFormula;

      let projBudget;
      let budgetItemDetail = null;
      if (baseD.budgetItems && yi > 0) {
        budgetItemDetail = baseD.budgetItems.map(item => ({
          name: item.name,
          fy26: item.fy26,
          projected: item.fy26 * Math.pow(1 + item.growthRate, yi),
          growthRate: item.growthRate,
          increase: item.fy26 * Math.pow(1 + item.growthRate, yi) - item.fy26,
        }));
        projBudget = budgetItemDetail.reduce((sum, item) => sum + item.projected, 0);
      } else if (baseD.budgetItems && yi === 0) {
        budgetItemDetail = baseD.budgetItems.map(item => ({
          name: item.name, fy26: item.fy26, projected: item.fy26, growthRate: item.growthRate, increase: 0,
        }));
        projBudget = baseBudget;
      } else {
        projBudget = baseBudget * Math.pow(1 + growth.budgetGrowth / 100, yi);
      }

      const cappedLevy = baseLevy * Math.pow(1 + growth.levy / 100, yi);
      const projFed = baseFed * Math.pow(1.02, yi);
      const projOther = baseOther * Math.pow(1.01, yi);

      const necessaryLevy = projBudget - r.totalFormula - projFed - projOther;
      const levyGap = necessaryLevy - cappedLevy;
      const levyGapPct = cappedLevy > 0 ? (levyGap / cappedLevy) * 100 : 0;

      const avgEV = (d.ev3yr[0] + d.ev3yr[1] + d.ev3yr[2]) / 3;
      const cappedTaxRate = avgEV > 0 ? (cappedLevy / avgEV) * 100 : 0;
      const necessaryTaxRate = avgEV > 0 ? (necessaryLevy / avgEV) * 100 : 0;

      const estHouseholds = baseD.income / (CUSTOM_DATA[k]?.medianIncome || 70000);
      const cappedTaxPerHH = cappedLevy / estHouseholds;
      const necessaryTaxPerHH = necessaryLevy / estHouseholds;

      return {
        year: yr, ...r, enrTotal: d.enr.total,
        projBudget, cappedLevy, necessaryLevy,
        levyGap, levyGapPct,
        cappedTaxRate, necessaryTaxRate,
        cappedTaxPerHH, necessaryTaxPerHH,
        projFed, projOther, budgetItemDetail,
      };
    });
    return { key: k, name: baseD.name, short: baseD.short, color: baseD.color, annual, baseLevy };
  });

  const chartData = years.map((yr, yi) => {
    const row = { year: yr };
    projections.forEach(p => { row[p.short] = p.annual[yi].totalFormula / 1e6; });
    return row;
  });

  const ppData = years.map((yr, yi) => {
    const row = { year: yr };
    projections.forEach(p => { row[p.short] = p.annual[yi].perPupil; });
    return row;
  });

  const levyGapData = years.map((yr, yi) => {
    const row = { year: yr };
    projections.forEach(p => {
      row[p.short + "_gap"] = p.annual[yi].levyGap / 1e6;
      row[p.short + "_nec"] = p.annual[yi].necessaryLevy / 1e6;
      row[p.short + "_cap"] = p.annual[yi].cappedLevy / 1e6;
    });
    return row;
  });

  const taxRateData = years.map((yr, yi) => {
    const row = { year: yr };
    projections.forEach(p => {
      row[p.short + "_capped"] = p.annual[yi].cappedTaxRate;
      row[p.short + "_needed"] = p.annual[yi].necessaryTaxRate;
    });
    return row;
  });

  const gSliders = [
    { key: "ev", label: <><Tip term="EV">EV</Tip> Growth (%/yr)</>, min: -2, max: 10, step: 0.5 },
    { key: "income", label: "Income Growth (%/yr)", min: -2, max: 8, step: 0.5 },
    { key: "enrollment", label: "Enrollment Δ (%/yr)", min: -3, max: 3, step: 0.1 },
    { key: "cpi", label: <><Tip term="CPI">CPI</Tip> / Base PP Inflation (%/yr)</>, min: 0, max: 8, step: 0.25 },
    { key: "levy", label: "Levy Cap (%/yr)", min: 0, max: 5, step: 0.25 },
    { key: "budgetGrowth", label: "Budget Growth (%/yr)", min: 1, max: 8, step: 0.25 },
  ];

  return (
    <div>
      {/* Adjustable Assumptions Panel */}
      <div style={{ marginBottom: 20, padding: 16, background: "linear-gradient(135deg, #1a2014, #1a1914)", borderRadius: 12, border: "1px solid #2a3820" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 14, color: "#8ac478", fontWeight: 600 }}>Projection Assumptions</div>
            <div style={{ fontSize: 11, color: "#6a8758", marginTop: 2 }}>Adjust growth rates to model different economic scenarios. Changes recalculate all 5 years.</div>
          </div>
          <button onClick={() => { setGrowth(GROWTH_DEFAULTS); setNoLevyCap(false); }} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #3a5828", background: "transparent", color: "#6a8758", fontSize: 11, cursor: "pointer" }}>Reset All</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {gSliders.map(s => {
            const val = growth[s.key];
            const isDiff = Math.abs(val - GROWTH_DEFAULTS[s.key]) > 0.01;
            return (
              <div key={s.key} style={{ padding: 10, background: isDiff ? "#1a2810" : "#12160e", borderRadius: 8, border: `1px solid ${isDiff ? "#3a5828" : "#1f2a18"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: isDiff ? "#8ac478" : "#5a7848", fontWeight: isDiff ? 600 : 400 }}>{s.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isDiff ? "#a8e890" : "#8ac478", fontFamily: "'Instrument Serif', serif" }}>{val > 0 ? "+" : ""}{val.toFixed(s.step < 0.5 ? 2 : 1)}%</span>
                </div>
                <input type="range" min={s.min} max={s.max} step={s.step} value={val}
                  onChange={e => setG(s.key, parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#8ac478" }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
          <Pill active={noLevyCap} onClick={() => setNoLevyCap(!noLevyCap)} color="#f59e0b">
            {noLevyCap ? "✓" : "○"} Model Without Levy Cap
          </Pill>
          {noLevyCap && <span style={{ fontSize: 11, color: "#8a7838" }}>Showing what levy each town would need to actually pay for its budget</span>}
        </div>
      </div>

      {/* Standard aid charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
          <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Total State Aid Trajectory ($M)</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
              <XAxis dataKey="year" tick={{ fill: "#8a8778", fontSize: 12 }} axisLine={false} />
              <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 13 }} formatter={(v) => `$${v.toFixed(1)}M`} />
              {projections.map(p => <Line key={p.short} type="monotone" dataKey={p.short} stroke={p.color} strokeWidth={2.5} dot={{ r: 4 }} />)}
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
          <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            {noLevyCap ? "Necessary Levy vs Capped Levy ($M)" : <>Aid <Tip term="PP">Per Pupil</Tip> Trajectory ($)</>}
          </div>
          <ResponsiveContainer width="100%" height={240}>
            {noLevyCap ? (
              <BarChart data={levyGapData} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
                <XAxis dataKey="year" tick={{ fill: "#8a8778", fontSize: 12 }} axisLine={false} />
                <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 13 }} formatter={(v) => `$${v.toFixed(1)}M`} />
                {projections.map(p => <Bar key={p.short} dataKey={p.short + "_nec"} fill={p.color} opacity={0.8} barSize={10} name={p.short + " Necessary"} />)}
                {projections.map(p => <Bar key={p.short + "c"} dataKey={p.short + "_cap"} fill={p.color} opacity={0.3} barSize={10} name={p.short + " Capped"} />)}
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </BarChart>
            ) : (
              <LineChart data={ppData} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
                <XAxis dataKey="year" tick={{ fill: "#8a8778", fontSize: 12 }} axisLine={false} />
                <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 13 }} formatter={(v) => `$${v.toFixed(0)}`} />
                {projections.map(p => <Line key={p.short} type="monotone" dataKey={p.short} stroke={p.color} strokeWidth={2.5} dot={{ r: 4 }} />)}
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* When levy modeling is ON */}
      {noLevyCap && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div style={{ padding: 20, background: "#1a1810", borderRadius: 12, border: "1px solid #3a3018" }}>
            <div style={{ fontSize: 13, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Levy Gap Trajectory ($M)</div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={levyGapData} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
                <XAxis dataKey="year" tick={{ fill: "#8a8778", fontSize: 12 }} axisLine={false} />
                <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#1a1810", border: "1px solid #3a3018", borderRadius: 8, color: "#e2e0d6", fontSize: 13 }} formatter={(v) => `$${v.toFixed(1)}M`} />
                {projections.map(p => <Line key={p.short} type="monotone" dataKey={p.short + "_gap"} stroke={p.color} strokeWidth={2.5} dot={{ r: 4 }} name={p.short + " Gap"} />)}
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 10, color: "#6a5838", marginTop: 6 }}>Positive = levy needed above cap. Negative = state aid covers more than budget needs.</div>
          </div>

          <div style={{ padding: 20, background: "#1a1810", borderRadius: 12, border: "1px solid #3a3018" }}>
            <div style={{ fontSize: 13, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Equalized Tax Rate: Capped vs Necessary</div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={taxRateData} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
                <XAxis dataKey="year" tick={{ fill: "#8a8778", fontSize: 12 }} axisLine={false} />
                <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(1)}%`} />
                <Tooltip contentStyle={{ background: "#1a1810", border: "1px solid #3a3018", borderRadius: 8, color: "#e2e0d6", fontSize: 13 }} formatter={(v) => `${v.toFixed(3)}%`} />
                {projections.map(p => <Line key={p.short + "n"} type="monotone" dataKey={p.short + "_needed"} stroke={p.color} strokeWidth={2.5} dot={{ r: 4 }} name={p.short + " Needed"} />)}
                {projections.map(p => <Line key={p.short + "c"} type="monotone" dataKey={p.short + "_capped"} stroke={p.color} strokeWidth={1.5} strokeDasharray="5 5" dot={false} name={p.short + " Capped"} opacity={0.5} />)}
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 10, color: "#6a5838", marginTop: 6 }}>Dashed = capped rate. Solid = rate needed to fund full budget.</div>
          </div>
        </div>
      )}

      {/* Heatmap table */}
      <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
        <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
          {noLevyCap ? "Budget Funding Gap by Year" : "Year-over-Year Change Heatmap"}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #2a2820" }}>
                <th style={{ textAlign: "left", padding: 8, color: "#6a6758" }}>District</th>
                {years.map(y => <th key={y} style={{ textAlign: "center", padding: 8, color: "#6a6758" }}>{y}</th>)}
                <th style={{ textAlign: "center", padding: 8, color: "#6a6758" }}>{noLevyCap ? "2030 Gap" : "5yr Δ"}</th>
              </tr>
            </thead>
            <tbody>
              {projections.map(p => (
                <tr key={p.key} style={{ borderBottom: "1px solid #1f1e18" }}>
                  <td style={{ padding: 8, color: p.color, fontWeight: 600 }}>{p.name}</td>
                  {p.annual.map((a, i) => {
                    if (noLevyCap) {
                      const pct = a.cappedLevy > 0 ? (a.levyGap / a.cappedLevy) * 100 : 0;
                      const bg = pct > 10 ? "#3a1414" : pct > 0 ? "#2a1a14" : pct > -5 ? "#1a2518" : "#1a3020";
                      const fg = pct > 0 ? "#f87171" : "#34d399";
                      return <td key={i} style={{ textAlign: "center", padding: 8, background: bg, color: fg, fontWeight: 600, borderRadius: 4 }}>
                        {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
                      </td>;
                    } else {
                      const pct = i === 0 ? a.changePct : ((a.totalFormula - p.annual[i-1].totalFormula) / p.annual[i-1].totalFormula) * 100;
                      const bg = pct > 3 ? "#1a3020" : pct > 0 ? "#1a2518" : pct > -3 ? "#2a1a14" : "#3a1414";
                      const fg = pct > 0 ? "#34d399" : "#f87171";
                      return <td key={i} style={{ textAlign: "center", padding: 8, background: bg, color: fg, fontWeight: 600, borderRadius: 4 }}>{fmtPct(pct)}</td>;
                    }
                  })}
                  <td style={{ textAlign: "center", padding: 8, fontWeight: 700, color: "#c4b98a" }}>
                    {noLevyCap
                      ? fmt(p.annual[4].levyGap)
                      : fmt(p.annual[4].totalFormula - p.annual[0].totalFormula)
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* No levy cap analysis */}
      {noLevyCap && (
        <div style={{ marginTop: 16, padding: 20, background: "#1a1810", borderRadius: 12, border: "1px solid #3a3018" }}>
          <div style={{ fontSize: 13, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>⚠ Levy Cap vs Real Budget Pressure</div>
          <div style={{ fontSize: 11, color: "#8a7838", marginBottom: 16 }}>
            Budgets grow at {growth.budgetGrowth.toFixed(1)}%/yr (contracts, benefits, inflation). The legal levy cap is {growth.levy.toFixed(1)}%/yr. State aid is formula-driven. What levy would you actually need to pay the bills?
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #3a3018" }}>
                  <th style={{ textAlign: "left", padding: 8, color: "#8a7838", minWidth: 180 }}>District / Year</th>
                  {years.map(y => <th key={y} style={{ textAlign: "center", padding: 8, color: "#8a7838" }}>{y}</th>)}
                </tr>
              </thead>
              <tbody>
                {projections.flatMap(p => [
                  <tr key={p.key + "-budget"} style={{ borderTop: "2px solid " + p.color + "40" }}>
                    <td style={{ padding: "8px 8px 4px", color: p.color, fontWeight: 700, fontSize: 13 }}>{p.name}</td>
                    <td colSpan={5}></td>
                  </tr>,
                  <tr key={p.key + "-b"} style={{ borderBottom: "1px solid #2a2818" }}>
                    <td style={{ padding: "4px 8px 4px 16px", color: "#8a8778" }}>Projected Budget</td>
                    {p.annual.map((a, i) => (
                      <td key={i} style={{ textAlign: "center", padding: 4, color: "#e2e0d6" }}>{fmt(a.projBudget)}</td>
                    ))}
                  </tr>,
                  <tr key={p.key + "-sa"} style={{ borderBottom: "1px solid #2a2818" }}>
                    <td style={{ padding: "4px 8px 4px 16px", color: "#8a8778" }}>Formula State Aid</td>
                    {p.annual.map((a, i) => (
                      <td key={i} style={{ textAlign: "center", padding: 4, color: "#c4b98a" }}>{fmt(a.totalFormula)}</td>
                    ))}
                  </tr>,
                  <tr key={p.key + "-cl"} style={{ borderBottom: "1px solid #2a2818" }}>
                    <td style={{ padding: "4px 8px 4px 16px", color: "#8a8778" }}>Capped Levy ({growth.levy}%/yr)</td>
                    {p.annual.map((a, i) => (
                      <td key={i} style={{ textAlign: "center", padding: 4, color: "#6a8758" }}>{fmt(a.cappedLevy)}</td>
                    ))}
                  </tr>,
                  <tr key={p.key + "-nl"} style={{ borderBottom: "1px solid #2a2818", background: "#1a1508" }}>
                    <td style={{ padding: "4px 8px 4px 16px", color: "#f59e0b", fontWeight: 600 }}>Necessary Levy</td>
                    {p.annual.map((a, i) => (
                      <td key={i} style={{ textAlign: "center", padding: 4, color: "#f59e0b", fontWeight: 700 }}>{fmt(a.necessaryLevy)}</td>
                    ))}
                  </tr>,
                  <tr key={p.key + "-li"} style={{ borderBottom: "1px solid #2a2818", background: "#1a1508" }}>
                    <td style={{ padding: "4px 8px 4px 16px", color: "#f59e0b" }}>↳ Levy increase needed</td>
                    {p.annual.map((a, i) => {
                      const prevLevy = i === 0 ? p.baseLevy : p.annual[i - 1].necessaryLevy;
                      const pctInc = prevLevy > 0 ? ((a.necessaryLevy - prevLevy) / prevLevy) * 100 : 0;
                      const isHigh = pctInc > 3;
                      return <td key={i} style={{ textAlign: "center", padding: 4, color: isHigh ? "#f87171" : pctInc > 2 ? "#fbbf24" : "#34d399", fontWeight: 700, fontSize: 13 }}>
                        {pctInc > 0 ? "+" : ""}{pctInc.toFixed(1)}%
                        <div style={{ fontSize: 9, color: "#8a7838", fontWeight: 400 }}>vs 2% cap</div>
                      </td>;
                    })}
                  </tr>,
                  <tr key={p.key + "-gap"} style={{ borderBottom: "1px solid #2a2818" }}>
                    <td style={{ padding: "4px 8px 4px 16px", color: "#8a7838" }}>Gap (above cap)</td>
                    {p.annual.map((a, i) => {
                      const g = a.levyGap;
                      return <td key={i} style={{ textAlign: "center", padding: 4, color: g > 0 ? "#f87171" : "#34d399", fontWeight: 600 }}>
                        {g > 0 ? "+" : ""}{fmt(g)}
                      </td>;
                    })}
                  </tr>,
                  <tr key={p.key + "-tr"} style={{ borderBottom: "1px solid #2a2818" }}>
                    <td style={{ padding: "4px 8px 4px 16px", color: "#8a7838" }}>Eq. Tax Rate (capped → needed)</td>
                    {p.annual.map((a, i) => (
                      <td key={i} style={{ textAlign: "center", padding: 4, color: "#e2e0d6", fontSize: 11 }}>
                        {a.cappedTaxRate.toFixed(2)}% → <span style={{ color: a.necessaryTaxRate > a.cappedTaxRate * 1.1 ? "#f87171" : "#e2e0d6", fontWeight: 600 }}>{a.necessaryTaxRate.toFixed(2)}%</span>
                      </td>
                    ))}
                  </tr>,
                  <tr key={p.key + "-hh"} style={{ borderBottom: "1px solid #1f1e18" }}>
                    <td style={{ padding: "4px 8px 4px 16px", color: "#8a7838" }}>Tax per household (capped → needed)</td>
                    {p.annual.map((a, i) => (
                      <td key={i} style={{ textAlign: "center", padding: 4, color: "#e2e0d6", fontSize: 11 }}>
                        ${Math.round(a.cappedTaxPerHH).toLocaleString()} → <span style={{ color: a.necessaryTaxPerHH > a.cappedTaxPerHH * 1.05 ? "#f87171" : "#e2e0d6", fontWeight: 600 }}>${Math.round(a.necessaryTaxPerHH).toLocaleString()}</span>
                      </td>
                    ))}
                  </tr>,
                ])}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 16, fontSize: 12, color: "#8a7838", lineHeight: 1.6 }}>
            <strong style={{ color: "#f59e0b" }}>What this shows:</strong> The "Necessary Levy" is what each town would have to raise in property taxes to actually pay for its projected budget, after subtracting state formula aid and federal/other revenue. The "Gap" is how much that exceeds the legally capped levy. For <strong>West Orange</strong>, the budget is projected using real line-item growth rates from the district's own projections (salaries +3.5%, benefits +10%, tuition +8%, etc.). Other districts use the slider rate. The levy cap only allows ~{growth.levy}% growth — that gap compounds every year. Districts balance budgets by cutting programs, deferring maintenance, drawing down surplus, or going to voters for cap overrides.
          </div>

          {/* WO Line-Item Detail */}
          {(() => {
            const woProj = projections.find(p => p.key === "westOrange");
            if (!woProj) return null;
            return (
              <div style={{ marginTop: 16, padding: 16, background: "#141810", borderRadius: 10, border: "1px solid #2a3820" }}>
                <div style={{ fontSize: 13, color: "#2563eb", fontWeight: 700, marginBottom: 4 }}>West Orange — Line-Item Budget Projection</div>
                <div style={{ fontSize: 11, color: "#6a8758", marginBottom: 12 }}>Source: WO district budget projections (FY25-26 actuals with category-specific growth assumptions)</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #2a3820" }}>
                        <th style={{ textAlign: "left", padding: 6, color: "#6a8758" }}>Category</th>
                        <th style={{ textAlign: "right", padding: 6, color: "#6a8758" }}>FY25-26</th>
                        <th style={{ textAlign: "center", padding: 6, color: "#6a8758" }}>Growth</th>
                        {[2026,2027,2028,2029,2030].map(y => <th key={y} style={{ textAlign: "right", padding: 6, color: "#6a8758" }}>FY{y.toString().slice(2)}-{(y+1).toString().slice(2)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {woProj.annual[0].budgetItemDetail && woProj.annual[0].budgetItemDetail.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #1f2a18" }}>
                          <td style={{ padding: "5px 6px", color: "#8ac478", fontWeight: item.name === "Benefits" || item.name === "Salaries" ? 600 : 400 }}>{item.name}</td>
                          <td style={{ textAlign: "right", padding: "5px 6px", color: "#e2e0d6" }}>{fmt(item.fy26)}</td>
                          <td style={{ textAlign: "center", padding: "5px 6px", color: item.growthRate >= 0.08 ? "#f87171" : item.growthRate >= 0.03 ? "#fbbf24" : "#6a8758", fontWeight: 600 }}>{(item.growthRate * 100).toFixed(1)}%</td>
                          {[0,1,2,3,4].map(yi => {
                            const projected = item.fy26 * Math.pow(1 + item.growthRate, yi + 1);
                            return <td key={yi} style={{ textAlign: "right", padding: "5px 6px", color: "#e2e0d6" }}>{fmt(projected)}</td>;
                          })}
                        </tr>
                      ))}
                      <tr style={{ borderTop: "2px solid #2a3820" }}>
                        <td style={{ padding: "6px", color: "#f59e0b", fontWeight: 700 }}>TOTAL</td>
                        <td style={{ textAlign: "right", padding: 6, color: "#f59e0b", fontWeight: 700 }}>{fmt(woProj.annual[0].projBudget)}</td>
                        <td></td>
                        {[0,1,2,3,4].map(yi => {
                          const total = DISTRICTS.westOrange.budgetItems.reduce((s, item) => s + item.fy26 * Math.pow(1 + item.growthRate, yi + 1), 0);
                          return <td key={yi} style={{ textAlign: "right", padding: 6, color: "#f59e0b", fontWeight: 700 }}>{fmt(total)}</td>;
                        })}
                      </tr>
                      <tr>
                        <td style={{ padding: "6px", color: "#8a7838" }}>Capped Levy</td>
                        <td style={{ textAlign: "right", padding: 6, color: "#6a8758" }}>{fmt(woProj.annual[0].cappedLevy)}</td>
                        <td></td>
                        {[0,1,2,3,4].map(yi => (
                          <td key={yi} style={{ textAlign: "right", padding: 6, color: "#6a8758" }}>{fmt(DISTRICTS.westOrange.levy * Math.pow(1 + growth.levy / 100, yi + 1))}</td>
                        ))}
                      </tr>
                      <tr>
                        <td style={{ padding: "6px", color: "#8a7838" }}>State Aid</td>
                        <td style={{ textAlign: "right", padding: 6, color: "#c4b98a" }}>{fmt(woProj.annual[0].totalFormula)}</td>
                        <td></td>
                        {[0,1,2,3,4].map(yi => (
                          <td key={yi} style={{ textAlign: "right", padding: 6, color: "#c4b98a" }}>{fmt(woProj.annual[yi].totalFormula)}</td>
                        ))}
                      </tr>
                      <tr style={{ borderTop: "2px solid #3a1414" }}>
                        <td style={{ padding: "6px", color: "#f87171", fontWeight: 700 }}>DEFICIT (Gap)</td>
                        <td style={{ textAlign: "right", padding: 6, color: woProj.annual[0].levyGap > 0 ? "#f87171" : "#34d399", fontWeight: 700 }}>{fmt(woProj.annual[0].levyGap)}</td>
                        <td></td>
                        {[0,1,2,3,4].map(yi => {
                          const totalBudget = DISTRICTS.westOrange.budgetItems.reduce((s, item) => s + item.fy26 * Math.pow(1 + item.growthRate, yi + 1), 0);
                          const cappedLevy = DISTRICTS.westOrange.levy * Math.pow(1 + growth.levy / 100, yi + 1);
                          const stateAid = woProj.annual[yi].totalFormula;
                          const gap = totalBudget - cappedLevy - stateAid - (DISTRICTS.westOrange.ufb.federalAid + DISTRICTS.westOrange.ufb.otherRevenue);
                          return <td key={yi} style={{ textAlign: "right", padding: 6, color: gap > 0 ? "#f87171" : "#34d399", fontWeight: 700 }}>{fmt(gap)}</td>;
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: "#6a5838", lineHeight: 1.5 }}>
                  WO's circled $12.5M deficit for FY26-27 comes from benefits (+10%), tuition out-of-district (+8%), and transportation (+6%) growing far faster than the 2% levy cap. Salaries alone at 54.85% of the budget with 3.5% step increases add ~$3.9M/yr. This structural deficit compounds — by 2030 the gap could exceed ${fmt(woProj.annual[4].levyGap)} unless state aid increases or programs are cut.
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
