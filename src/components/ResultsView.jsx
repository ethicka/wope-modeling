import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell } from "recharts";
import { DISTRICTS } from '../data/districts.js';
import { runFormula } from '../engine/sfra-formula.js';
import { fmt, fmtPct } from '../utils/format.js';
import Tip from './ui/Tip.jsx';

export default function ResultsView({ overrides }) {
  const results = Object.entries(DISTRICTS).map(([k, d]) => ({
    key: k, ...d, ...runFormula(d, overrides), baseline: runFormula(d),
  }));

  const compData = results.map(r => ({
    name: r.short,
    current: r.baseline.totalFormula / 1e6,
    scenario: r.totalFormula / 1e6,
    color: r.color,
  }));

  const perPupilData = results.map(r => ({
    name: r.short,
    current: r.baseline.perPupil,
    scenario: r.perPupil,
    color: r.color,
  }));

  const hasChanges = Object.keys(overrides).length > 0;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        {results.map(r => (
          <div key={r.key} style={{ flex: 1, minWidth: 200, padding: 16, background: "#1a1914", borderRadius: 12, border: `1px solid ${r.color}30`, borderLeft: `3px solid ${r.color}` }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: r.color, fontFamily: "'Instrument Serif', serif" }}>{r.name}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#e2e0d6", fontFamily: "'Instrument Serif', serif", margin: "6px 0" }}>{fmt(r.totalFormula)}</div>
            <div style={{ fontSize: 12, color: r.changePct >= 0 ? "#34d399" : "#f87171" }}>
              {fmtPct(r.changePct)} from FY25 ({fmt(Math.abs(r.changeFy25))})
            </div>
            <div style={{ fontSize: 11, color: "#6a6758", marginTop: 4 }}>{fmt(r.perPupil)}/pupil · {r.aidPctBudget.toFixed(1)}% of budget</div>
            {hasChanges && (
              <div style={{ fontSize: 11, color: "#c4b98a", marginTop: 6, padding: "4px 8px", background: "#2a2510", borderRadius: 6 }}>
                Δ from baseline: {fmt(r.totalFormula - r.baseline.totalFormula)}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
          <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Total Aid Comparison ($M)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={compData} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
              <XAxis dataKey="name" tick={{ fill: "#8a8778", fontSize: 12 }} axisLine={false} />
              <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 13 }} formatter={(v) => `$${v.toFixed(1)}M`} />
              <Bar dataKey="current" fill="#4a4838" radius={[3,3,0,0]} barSize={20} name="FY26 Baseline" />
              {hasChanges && <Bar dataKey="scenario" radius={[3,3,0,0]} barSize={20} name="Scenario">
                {compData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
          <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Aid Per Pupil ($)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={perPupilData} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
              <XAxis dataKey="name" tick={{ fill: "#8a8778", fontSize: 12 }} axisLine={false} />
              <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 13 }} formatter={(v) => `$${v.toFixed(0)}`} />
              <Bar dataKey="current" fill="#4a4838" radius={[3,3,0,0]} barSize={20} name="FY26 Baseline" />
              {hasChanges && <Bar dataKey="scenario" radius={[3,3,0,0]} barSize={20} name="Scenario">
                {perPupilData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 16, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
        <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Formula Detail Comparison</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #2a2820" }}>
                <th style={{ textAlign: "left", padding: "8px 10px", color: "#6a6758", fontWeight: 500 }}>Metric</th>
                {results.map(r => <th key={r.key} style={{ textAlign: "right", padding: "8px 10px", color: r.color, fontWeight: 600 }}>{r.short}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Adequacy Budget", fn: r => fmt(r.adequacy) },
                { label: <><Tip term="LFS">Local Fair Share</Tip></>, fn: r => fmt(r.lfs) },
                { label: <><Tip term="EqAid">Equalization Aid</Tip></>, fn: r => fmt(r.eqAid) },
                { label: <><Tip term="SpEd">SpEd</Tip> Categorical</>, fn: r => fmt(r.spedCat) },
                { label: "Security Aid", fn: r => fmt(r.secAid) },
                { label: "Total (w/ caps)", fn: r => fmt(r.totalFormula) },
                { label: "Δ from FY25", fn: r => <span style={{ color: r.changePct >= 0 ? "#34d399" : "#f87171" }}>{fmtPct(r.changePct)}</span> },
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #1f1e18" }}>
                  <td style={{ padding: "7px 10px", color: "#8a8778" }}>{row.label}</td>
                  {results.map(r => <td key={r.key} style={{ textAlign: "right", padding: "7px 10px", color: "#e2e0d6" }}>{row.fn(r)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
