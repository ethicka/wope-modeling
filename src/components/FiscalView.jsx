import { DISTRICTS } from '../data/districts.js';
import { runFormula } from '../engine/sfra-formula.js';
import { fmt, fmtNum } from '../utils/format.js';
import Tip from './ui/Tip.jsx';
import StatCard from './ui/StatCard.jsx';

export default function FiscalView({ overrides }) {
  const baseline = Object.values(DISTRICTS).reduce((sum, d) => sum + runFormula(d).totalFormula, 0);
  const scenario = Object.values(DISTRICTS).reduce((sum, d) => sum + runFormula(d, overrides).totalFormula, 0);
  const delta = scenario - baseline;

  const statewide = 12100000000;
  const scaleFactor = statewide / baseline;
  const estStateDelta = delta * scaleFactor;

  const results = Object.entries(DISTRICTS).map(([k, d]) => {
    const b = runFormula(d);
    const s = runFormula(d, overrides);
    return { key: k, ...d, baseline: b, scenario: s, delta: s.totalFormula - b.totalFormula };
  });

  const scenarioSummary = Object.keys(overrides).length > 0;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="4-District Baseline" value={fmt(baseline)} sub="FY26 current law" />
        <StatCard label="4-District Scenario" value={fmt(scenario)} sub={scenarioSummary ? `Δ ${fmt(delta)}` : "No changes"} color={delta > 0 ? "#34d399" : delta < 0 ? "#f87171" : "#e2e0d6"} />
        <StatCard label="Est. Statewide Impact" value={fmt(estStateDelta)} sub={<>Scaled from 4-district sample to all {fmtNum(1318781)} students</>} color="#c4b98a" />
        <StatCard label={<>Statewide K-12 <Tip term="SFRA">SFRA</Tip> Aid</>} value="$12.1B" sub="FY2026 total formula aid" />
      </div>

      <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Impact by District Type</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {results.map(r => {
            const d = r.delta;
            const bg = d > 1000000 ? "linear-gradient(135deg, #1a3020, #1a2518)" : d > 0 ? "#1a2518" : d > -1000000 ? "#2a1a14" : "linear-gradient(135deg, #3a1414, #2a1a14)";
            return (
              <div key={r.key} style={{ padding: 16, background: bg, borderRadius: 10, border: `1px solid ${r.color}30`, textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: r.color, fontFamily: "'Instrument Serif', serif" }}>{r.name}</div>
                <div style={{ fontSize: 11, color: "#6a6758", margin: "4px 0" }}>{r.type}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: d >= 0 ? "#34d399" : "#f87171", fontFamily: "'Instrument Serif', serif" }}>
                  {d >= 0 ? "+" : ""}{fmt(d)}
                </div>
                <div style={{ fontSize: 11, color: "#8a8778", marginTop: 4 }}>
                  {fmt(d / r.enr.total)}/pupil
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
        <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Key Policy Findings</div>
        <div style={{ fontSize: 13, color: "#8a8778", lineHeight: 1.8 }}>
          {Object.keys(overrides).length === 0 ? (
            <div>
              <p style={{ color: "#c4b98a", fontWeight: 600, marginBottom: 8 }}>Current SFRA/S-2 Status (FY2026):</p>
              <p>• FY25 was the first year all districts reached 100% funding. FY26 sees deficits return due to fiscal constraints.</p>
              <p>• The -3% loss floor protects 191 overaided districts (total surplus $396M) while 282 districts are underfunded (deficit $383M).</p>
              <p>• Newark alone has a $37M formula deficit despite being the largest aid recipient in the state.</p>
              <p>• West Orange and Cherry Hill both hit the -3% floor — their growing property wealth pushes Local Fair Share above adequacy.</p>
              <p>• The 10% jump in statewide Adequacy Budget (to $29.9B) raised Local Fair Shares, not state aid, for most districts.</p>
              <p style={{ marginTop: 12, color: "#6a6758", fontSize: 11, fontStyle: "italic" }}>Adjust formula parameters in the Formula Editor tab to model reform scenarios.</p>
            </div>
          ) : (
            <div>
              <p style={{ color: "#c4b98a", fontWeight: 600, marginBottom: 8 }}>Scenario Analysis:</p>
              {overrides.fullFunding && <p>• <strong style={{color:"#34d399"}}>Full funding</strong> removes the -3%/+6% caps. High-need urban districts gain substantially; wealthy suburban districts may see larger losses.</p>}
              {overrides.lfsCap && <p>• <strong style={{color:"#60a5fa"}}><Tip term="LFS">LFS</Tip> cap at {(overrides.lfsCap*100)}%</strong> limits how fast local responsibility grows. Benefits districts with rapidly appreciating property values.</p>}
              {overrides.atRiskRange && <p>• <strong style={{color:"#fbbf24"}}>Enhanced at-risk weights</strong> ({overrides.atRiskRange.low}–{overrides.atRiskRange.high}) direct more adequacy funding to high-poverty concentrations.</p>}
              <p>• Estimated statewide cost impact: <strong style={{color: estStateDelta > 0 ? "#34d399" : "#f87171"}}>{fmt(estStateDelta)}</strong> (scaled estimate).</p>
              <p>• Net redistribution: Suburban districts {results.filter(r => r.type === "Suburban").reduce((s,r) => s + r.delta, 0) > 0 ? "gain" : "lose"} {fmt(Math.abs(results.filter(r => r.type === "Suburban").reduce((s,r) => s + r.delta, 0)))}; Urban districts {results.filter(r => r.type !== "Suburban").reduce((s,r) => s + r.delta, 0) > 0 ? "gain" : "lose"} {fmt(Math.abs(results.filter(r => r.type !== "Suburban").reduce((s,r) => s + r.delta, 0)))}.</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 12, background: "#12110e", borderRadius: 8, border: "1px solid #1f1e18" }}>
        <div style={{ fontSize: 10, color: "#4a4838", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
          <strong>Data Sources:</strong> FY2026 State Aid — NJ DOE GBM District Details (Feb 2025). Equalized Valuations — NJ Division of Taxation TEV 2023–2025.
          Formula parameters — Educational Adequacy Report 2026. LFS multipliers — NJ Ed Report analysis. Enrollment — NJ DOE Fall Enrollment Report 2024-25
          (enrollment_2425.xlsx: total, grade-band, Free/Reduced Lunch, Multilingual Learners). Combo (at-risk ∩ LEP) students estimated via probabilistic overlap.
          Aggregate income and local levy are estimates derived from formula back-calculation. This model is for educational/analytical purposes and may not perfectly
          replicate official state calculations due to data gaps in ASSA micro-data.
        </div>
      </div>
    </div>
  );
}
