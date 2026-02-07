import { useMemo } from 'react';
import { DISTRICTS } from '../data/districts.js';
import { runFormula } from '../engine/sfra-formula.js';
import { fmt, fmtNum } from '../utils/format.js';
import Tip from './ui/Tip.jsx';
import StatCard from './ui/StatCard.jsx';

export default function FiscalView({ overrides }) {
  const allDistricts = useMemo(() => Object.entries(DISTRICTS), []);
  const totalEnrollment = useMemo(() => allDistricts.reduce((s, [, d]) => s + d.enr.total, 0), [allDistricts]);

  const { baseline, scenario, results } = useMemo(() => {
    let bl = 0, sc = 0;
    const res = allDistricts.map(([k, d]) => {
      const b = runFormula(d);
      const s = runFormula(d, overrides);
      bl += b.totalFormula;
      sc += s.totalFormula;
      return { key: k, ...d, baseline: b, scenario: s, delta: s.totalFormula - b.totalFormula };
    });
    return { baseline: bl, scenario: sc, results: res };
  }, [allDistricts, overrides]);

  const delta = scenario - baseline;
  const scenarioActive = Object.keys(overrides).length > 0;

  // Group by type for aggregate view
  const byType = useMemo(() => {
    const groups = {};
    results.forEach(r => {
      const t = r.type || 'K-12';
      if (!groups[t]) groups[t] = { type: t, count: 0, enrollment: 0, baselineAid: 0, scenarioAid: 0, delta: 0 };
      groups[t].count++;
      groups[t].enrollment += r.enr.total;
      groups[t].baselineAid += r.baseline.totalFormula;
      groups[t].scenarioAid += r.scenario.totalFormula;
      groups[t].delta += r.delta;
    });
    return Object.values(groups).sort((a, b) => b.enrollment - a.enrollment);
  }, [results]);

  // Top gainers and losers
  const sorted = useMemo(() => [...results].sort((a, b) => b.delta - a.delta), [results]);
  const topGainers = sorted.slice(0, 10);
  const topLosers = sorted.slice(-10).reverse();

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label={<>{fmtNum(allDistricts.length)}-District Baseline</>} value={fmt(baseline)} sub={<>FY26 current law · {fmtNum(totalEnrollment)} students</>} />
        <StatCard label="Scenario Total" value={fmt(scenario)} sub={scenarioActive ? `Delta: ${fmt(delta)}` : "No changes"} color={delta > 0 ? "#34d399" : delta < 0 ? "#f87171" : "#e2e0d6"} />
        <StatCard label="Per Pupil (avg)" value={fmt(baseline / totalEnrollment)} sub="baseline formula aid" />
        <StatCard label={<>Official FY26 <Tip term="SFRA">SFRA</Tip> Aid</>} value="$12.1B" sub="GBM total formula aid" />
      </div>

      {/* By district type */}
      <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Impact by District Type</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #2a2820" }}>
                <th style={{ textAlign: "left", padding: 8, color: "#6a6758" }}>Type</th>
                <th style={{ textAlign: "right", padding: 8, color: "#6a6758" }}>Districts</th>
                <th style={{ textAlign: "right", padding: 8, color: "#6a6758" }}>Enrollment</th>
                <th style={{ textAlign: "right", padding: 8, color: "#6a6758" }}>Baseline Aid</th>
                {scenarioActive && <th style={{ textAlign: "right", padding: 8, color: "#6a6758" }}>Scenario Aid</th>}
                {scenarioActive && <th style={{ textAlign: "right", padding: 8, color: "#6a6758" }}>Delta</th>}
                <th style={{ textAlign: "right", padding: 8, color: "#6a6758" }}>Aid/Pupil</th>
              </tr>
            </thead>
            <tbody>
              {byType.map(g => (
                <tr key={g.type} style={{ borderBottom: "1px solid #1f1e18" }}>
                  <td style={{ padding: 8, color: "#c4b98a", fontWeight: 600 }}>{g.type}</td>
                  <td style={{ textAlign: "right", padding: 8, color: "#e2e0d6" }}>{g.count}</td>
                  <td style={{ textAlign: "right", padding: 8, color: "#e2e0d6" }}>{fmtNum(g.enrollment)}</td>
                  <td style={{ textAlign: "right", padding: 8, color: "#e2e0d6" }}>{fmt(g.baselineAid)}</td>
                  {scenarioActive && <td style={{ textAlign: "right", padding: 8, color: "#e2e0d6" }}>{fmt(g.scenarioAid)}</td>}
                  {scenarioActive && <td style={{ textAlign: "right", padding: 8, color: g.delta >= 0 ? "#34d399" : "#f87171", fontWeight: 600 }}>{g.delta >= 0 ? "+" : ""}{fmt(g.delta)}</td>}
                  <td style={{ textAlign: "right", padding: 8, color: "#e2e0d6" }}>{fmt(g.baselineAid / g.enrollment)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: "2px solid #2a2820" }}>
                <td style={{ padding: 8, color: "#c4b98a", fontWeight: 700 }}>TOTAL</td>
                <td style={{ textAlign: "right", padding: 8, color: "#e2e0d6", fontWeight: 700 }}>{allDistricts.length}</td>
                <td style={{ textAlign: "right", padding: 8, color: "#e2e0d6", fontWeight: 700 }}>{fmtNum(totalEnrollment)}</td>
                <td style={{ textAlign: "right", padding: 8, color: "#e2e0d6", fontWeight: 700 }}>{fmt(baseline)}</td>
                {scenarioActive && <td style={{ textAlign: "right", padding: 8, color: "#e2e0d6", fontWeight: 700 }}>{fmt(scenario)}</td>}
                {scenarioActive && <td style={{ textAlign: "right", padding: 8, color: delta >= 0 ? "#34d399" : "#f87171", fontWeight: 700 }}>{delta >= 0 ? "+" : ""}{fmt(delta)}</td>}
                <td style={{ textAlign: "right", padding: 8, color: "#e2e0d6", fontWeight: 700 }}>{fmt(baseline / totalEnrollment)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Top gainers / losers */}
      {scenarioActive && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div style={{ padding: 20, background: "#1a2518", borderRadius: 12, border: "1px solid #2a3820" }}>
            <div style={{ fontSize: 13, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Top 10 Gainers</div>
            {topGainers.map(r => (
              <div key={r.key} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1f2a18", fontSize: 12 }}>
                <span style={{ color: "#8a8778" }}>{r.name} <span style={{ color: "#6a6758", fontSize: 10 }}>{r.county}</span></span>
                <span style={{ color: "#34d399", fontWeight: 600 }}>+{fmt(r.delta)}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: 20, background: "#2a1a14", borderRadius: 12, border: "1px solid #3a2820" }}>
            <div style={{ fontSize: 13, color: "#f87171", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Top 10 Losers</div>
            {topLosers.map(r => (
              <div key={r.key} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #2a1a14", fontSize: 12 }}>
                <span style={{ color: "#8a8778" }}>{r.name} <span style={{ color: "#6a6758", fontSize: 10 }}>{r.county}</span></span>
                <span style={{ color: "#f87171", fontWeight: 600 }}>{fmt(r.delta)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
        <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Key Policy Findings</div>
        <div style={{ fontSize: 13, color: "#8a8778", lineHeight: 1.8 }}>
          {!scenarioActive ? (
            <div>
              <p style={{ color: "#c4b98a", fontWeight: 600, marginBottom: 8 }}>Current SFRA/S-2 Status (FY2026) — {allDistricts.length} Districts:</p>
              <p>• This model covers {fmtNum(totalEnrollment)} students across {allDistricts.length} districts in all 21 NJ counties.</p>
              <p>• FY25 was the first year all districts reached 100% funding. FY26 sees deficits return due to fiscal constraints.</p>
              <p>• The -3% loss floor protects overaided districts while the +6% ceiling constrains gains for underfunded districts.</p>
              <p>• The 10% jump in statewide Adequacy Budget (to $29.9B) raised Local Fair Shares, not state aid, for most districts.</p>
              <p style={{ marginTop: 12, color: "#6a6758", fontSize: 11, fontStyle: "italic" }}>Adjust formula parameters in the Formula Editor tab to model reform scenarios.</p>
            </div>
          ) : (
            <div>
              <p style={{ color: "#c4b98a", fontWeight: 600, marginBottom: 8 }}>Scenario Analysis ({allDistricts.length} districts):</p>
              {overrides.fullFunding && <p>• <strong style={{color:"#34d399"}}>Full funding</strong> removes the -3%/+6% caps. High-need urban districts gain substantially; wealthy suburban districts may see larger losses.</p>}
              {overrides.lfsCap && <p>• <strong style={{color:"#60a5fa"}}><Tip term="LFS">LFS</Tip> cap at {(overrides.lfsCap*100)}%</strong> limits how fast local responsibility grows. Benefits districts with rapidly appreciating property values.</p>}
              {overrides.atRiskRange && <p>• <strong style={{color:"#fbbf24"}}>Enhanced at-risk weights</strong> ({overrides.atRiskRange.low}–{overrides.atRiskRange.high}) direct more adequacy funding to high-poverty concentrations.</p>}
              <p>• Statewide cost impact: <strong style={{color: delta > 0 ? "#34d399" : "#f87171"}}>{fmt(delta)}</strong> across all {allDistricts.length} districts.</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 12, background: "#12110e", borderRadius: 8, border: "1px solid #1f1e18" }}>
        <div style={{ fontSize: 10, color: "#4a4838", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
          <strong>Data Sources:</strong> FY2026 State Aid — NJ DOE GBM District Details (Feb 2025). Equalized Valuations — NJ Division of Taxation Estimated Tax Rates FY26.
          Formula parameters — Educational Adequacy Report 2026. Enrollment — NJ DOE Fall Enrollment Report 2024-25
          (enrollment_2425.xlsx: total, grade-band, Free/Reduced Lunch, Multilingual Learners). GCA — NJ DOE Geographic Cost Adjustment FY14.
          Combo (at-risk intersection LEP) students estimated via probabilistic overlap.
          Aggregate income estimated from levy and tax burden ratios. This model is for educational/analytical purposes and may not perfectly
          replicate official state calculations due to data gaps in ASSA micro-data.
        </div>
      </div>
    </div>
  );
}
