import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell } from "recharts";
import { DISTRICTS } from '../data/districts.js';
import { runFormula } from '../engine/sfra-formula.js';
import { fmt, fmtPct } from '../utils/format.js';
import Tip from './ui/Tip.jsx';
import { ComparisonBar } from './ui/DistrictSearch.jsx';

export default function BudgetView({ compared, addCompared, removeCompared, overrides }) {
  const [budgetYear, setBudgetYear] = useState("fy26");
  const hasOverrides = Object.keys(overrides).length > 0;
  const isFy27 = budgetYear === "fy27";

  const results = compared.map(k => [k, DISTRICTS[k]]).filter(([, d]) => d).map(([k, d]) => {
    const rBase = runFormula(d);
    const rScen = runFormula(d, overrides);
    const u = d.ufb;

    let fy27Budget, fy27Levy, fy27StateAid;
    if (d.ufb.fy27Budget) {
      fy27Budget = d.ufb.fy27Budget;
      fy27Levy = d.ufb.fy27Levy;
      fy27StateAid = d.ufb.fy27StateAid;
    } else if (d.budgetItems) {
      fy27Budget = d.budgetItems.reduce((s, item) => s + item.fy26 * (1 + item.growthRate), 0);
      fy27Levy = d.ufb.localTaxLevy * 1.02;
      fy27StateAid = d.ufb.stateAid;
    } else {
      fy27Budget = d.ufb.totalBudget * 1.05;
      fy27Levy = d.ufb.localTaxLevy * 1.02;
      fy27StateAid = d.ufb.stateAid;
    }

    const activeBudget = isFy27 ? fy27Budget : d.ufb.totalBudget;
    const activeLevy = isFy27 ? fy27Levy : d.ufb.localTaxLevy;
    const activeStateAid = isFy27 ? fy27StateAid : d.ufb.stateAid;
    const activeFedAid = isFy27 ? (d.ufb.fy27FedAid || d.ufb.federalAid) : d.ufb.federalAid;
    const activeOther = isFy27 ? (d.ufb.fy27Other || d.ufb.otherRevenue) : d.ufb.otherRevenue;
    const activeFundBal = isFy27 ? (d.ufb.fy27FundBalance || 0) : (d.ufb.fundBalance || 0);

    const adequacyGap = rScen.adequacy - activeBudget;
    const levyNeededScenario = activeBudget - rScen.totalFormula - activeFedAid - activeOther - activeFundBal;
    const levyDeltaScenario = levyNeededScenario - activeLevy;
    const levyPctIncScenario = (levyDeltaScenario / activeLevy) * 100;
    const avgEV = (d.ev3yr[0] + d.ev3yr[1] + d.ev3yr[2]) / 3;
    const eqTaxRate = (activeLevy / avgEV) * 100;
    const eqTaxRateScenario = (levyNeededScenario / avgEV) * 100;
    const stateShare = activeStateAid / activeBudget * 100;
    const localShare = activeLevy / activeBudget * 100;
    const fedShare = activeFedAid / activeBudget * 100;
    const ppCost = activeBudget / d.enr.total;
    return { key: k, ...d, r: rScen, rBase, u, adequacyGap, levyNeededScenario, levyDeltaScenario, levyPctIncScenario, avgEV, eqTaxRate, eqTaxRateScenario, stateShare, localShare, fedShare, activeBudget, activeLevy, activeStateAid, activeFedAid, activeOther, activeFundBal, ppCost, fy27Budget };
  });

  const revData = results.map(r => ({
    name: r.short, state: r.stateShare, local: r.localShare, federal: r.fedShare, other: 100 - r.stateShare - r.localShare - r.fedShare,
  }));

  const gapData = results.map(r => ({
    name: r.short,
    adequacy: r.r.adequacy / 1e6,
    budget: r.activeBudget / 1e6,
    stateAid: r.r.totalFormula / 1e6,
    lfs: r.r.lfs / 1e6,
    color: r.color,
  }));

  return (
    <div>
      <ComparisonBar compared={compared} districts={DISTRICTS} onRemove={removeCompared} onAdd={addCompared} />
      <div style={{ marginBottom: 20, padding: 16, background: "linear-gradient(135deg, #1a1420, #141018)", borderRadius: 12, border: "1px solid #2a2040" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 14, color: "#a89aca", fontWeight: 600, marginBottom: 4 }}>📊 Budget Analysis (<Tip term="UFB">UFB</Tip> vs <Tip term="SFRA">SFRA</Tip> Formula)</div>
            <div style={{ fontSize: 12, color: "#7a6898", lineHeight: 1.5 }}>
              Compares actual district budgets against <Tip term="SFRA">SFRA</Tip> adequacy calculations. {isFy27 ? "FY26-27 uses projected budgets with category-specific growth rates." : "FY25-26 uses adopted operating budgets from NJ DOE."}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setBudgetYear("fy26")} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #3a2850", background: !isFy27 ? "#a89aca" : "transparent", color: !isFy27 ? "#12110e" : "#7a6898", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>FY25-26</button>
            <button onClick={() => setBudgetYear("fy27")} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #3a2850", background: isFy27 ? "#a89aca" : "transparent", color: isFy27 ? "#12110e" : "#7a6898", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>FY26-27 (proj.)</button>
          </div>
        </div>
      </div>

      {/* Revenue mix stacked bars */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
          <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Revenue Share (%)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revData} layout="vertical" margin={{ left: 30, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
              <XAxis type="number" tick={{ fill: "#6a6758", fontSize: 11 }} domain={[0, 100]} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#8a8778", fontSize: 12 }} axisLine={false} />
              <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 13 }} formatter={v => `${v.toFixed(1)}%`} />
              <Bar dataKey="state" stackId="a" fill="#c4b98a" name="State Aid" />
              <Bar dataKey="local" stackId="a" fill="#4a9868" name="Local Tax Levy" />
              <Bar dataKey="federal" stackId="a" fill="#6878a8" name="Federal Aid" />
              <Bar dataKey="other" stackId="a" fill="#4a4838" name="Other" radius={[0,3,3,0]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
          <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Adequacy vs Actual Budget ($M)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={gapData} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
              <XAxis dataKey="name" tick={{ fill: "#8a8778", fontSize: 12 }} axisLine={false} />
              <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 13 }} formatter={v => `$${v.toFixed(1)}M`} />
              <Bar dataKey="adequacy" fill="#c4b98a" radius={[3,3,0,0]} barSize={16} name="SFRA Adequacy" />
              <Bar dataKey="budget" fill="#6a6758" radius={[3,3,0,0]} barSize={16} name="Actual Budget">
                {gapData.map((e, i) => <Cell key={i} fill={e.color} opacity={0.5} />)}
              </Bar>
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed comparison table */}
      <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Budget vs Formula Comparison</div>
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
                { label: <><Tip term="UFB">UFB</Tip> {isFy27 ? "Projected" : "Adopted"} Operating Budget</>, fn: r => fmt(r.activeBudget) },
                { label: "  ↳ Local Tax Levy", fn: r => fmt(r.activeLevy) },
                { label: "  ↳ State Aid (actual)", fn: r => fmt(r.activeStateAid) },
                { label: "  ↳ Federal/Extraordinary Aid", fn: r => fmt(r.activeFedAid) },
                { label: "  ↳ Other Revenue", fn: r => fmt(r.activeOther) },
                { label: "  ↳ Fund Balance / Reserves", fn: r => fmt(r.activeFundBal) },
                { label: "sep" },
                { label: <><Tip term="SFRA">SFRA</Tip> Formula Adequacy Budget</>, fn: r => fmt(r.r.adequacy) },
                { label: <><Tip term="LFS">Local Fair Share</Tip> (formula)</>, fn: r => fmt(r.r.lfs) },
                { label: <><Tip term="EqAid">Equalization Aid</Tip> (formula)</>, fn: r => fmt(r.r.eqAid) },
                { label: "Formula Total Aid (w/ caps)", fn: r => fmt(r.r.totalFormula) },
                { label: "sep" },
                { label: "Adequacy – Budget (gap)", fn: r => {
                  const g = r.adequacyGap;
                  return <span style={{ color: g >= 0 ? "#34d399" : "#f87171", fontWeight: 600 }}>{g >= 0 ? "+" : ""}{fmt(g)}</span>;
                }},
                { label: <>Budget <Tip term="PP">Per Pupil</Tip></>, fn: r => fmt(r.ppCost) },
                { label: <>Adequacy <Tip term="PP">Per Pupil</Tip></>, fn: r => fmt(r.r.adequacy / r.enr.total) },
                { label: "sep" },
                { label: "Eq. School Tax Rate", fn: r => `${r.eqTaxRate.toFixed(3)}%` },
                { label: "State Revenue Share", fn: r => `${r.stateShare.toFixed(1)}%` },
                { label: "Local Revenue Share", fn: r => `${r.localShare.toFixed(1)}%` },
                { label: "sep" },
                { label: hasOverrides ? "Levy if scenario state aid" : "Levy (current budget)", fn: r => fmt(r.levyNeededScenario) },
                { label: "Levy Δ from current", fn: r => {
                  return <span style={{ color: r.levyDeltaScenario >= 0 ? "#f87171" : "#34d399", fontWeight: 600 }}>{r.levyDeltaScenario >= 0 ? "+" : ""}{fmt(r.levyDeltaScenario)} ({fmtPct(r.levyPctIncScenario)})</span>;
                }},
                { label: "Eq. Tax Rate (scenario)", fn: r => `${r.eqTaxRateScenario.toFixed(3)}%` },
              ].map((row, i) => {
                if (row.label === "sep") return <tr key={i}><td colSpan={results.length + 1} style={{ height: 4, background: "#1f1e18" }}></td></tr>;
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

      {/* Key insight cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        {results.map(r => {
          const overUnder = r.activeBudget > r.r.adequacy;
          return (
            <div key={r.key} style={{ flex: 1, minWidth: 210, padding: 16, background: "#1a1914", borderRadius: 12, border: `1px solid ${r.color}30`, borderLeft: `3px solid ${r.color}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: r.color, fontFamily: "'Instrument Serif', serif" }}>{r.name}</div>
              <div style={{ fontSize: 11, color: "#6a6758", margin: "4px 0" }}>{r.type}</div>
              <div style={{ fontSize: 12, color: "#8a8778", lineHeight: 1.6, marginTop: 8 }}>
                <div>Budget is <strong style={{ color: overUnder ? "#fbbf24" : "#34d399" }}>{overUnder ? "above" : "below"}</strong> adequacy by <strong>{fmt(Math.abs(r.adequacyGap))}</strong></div>
                <div>State covers <strong>{r.stateShare.toFixed(0)}%</strong>, local covers <strong>{r.localShare.toFixed(0)}%</strong></div>
                <div>Eq. tax rate: <strong>{r.eqTaxRate.toFixed(3)}%</strong></div>
                {hasOverrides && r.levyDeltaScenario > 1000000 && <div style={{ marginTop: 4, color: "#f87171" }}>⚠ Under this scenario, would need <strong>{fmtPct(r.levyPctIncScenario)}</strong> levy increase</div>}
                {hasOverrides && r.levyDeltaScenario < -1000000 && <div style={{ marginTop: 4, color: "#34d399" }}>✓ Under this scenario, levy could decrease <strong>{fmt(Math.abs(r.levyDeltaScenario))}</strong></div>}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: 16, background: "#141018", borderRadius: 12, border: "1px solid #2a2040" }}>
        <div style={{ fontSize: 12, color: "#7a6898", lineHeight: 1.6 }}>
          <strong style={{ color: "#a89aca" }}>How to read this:</strong> The <Tip term="UFB">UFB</Tip> total budget is the actual adopted operating budget (from NJ DOE User Friendly Budget data). The <Tip term="SFRA">SFRA</Tip> adequacy budget is what the formula says the district <em>needs</em>. When the budget exceeds adequacy, the district is spending above what the state formula deems adequate (common in wealthy suburban districts). When adequacy exceeds budget, the district may be underfunding its students relative to the formula's benchmarks. The "Levy needed if no cap" row calculates what the local tax levy would need to be to cover budget minus (state aid + federal aid + other revenue) — showing the implicit tax burden if the state's 2% levy cap were removed.
        </div>
      </div>
    </div>
  );
}
