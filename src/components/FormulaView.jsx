import { FORMULA, SCENARIOS } from '../data/formula-params.js';
import { fmtNum } from '../utils/format.js';
import Pill from './ui/Pill.jsx';
import Tip from './ui/Tip.jsx';

export default function FormulaView({ overrides, setOverrides }) {
  const sliders = [
    { key: "basePP", label: <>Base <Tip term="PP">Per Pupil</Tip> ($)</>, min: 10000, max: 20000, step: 100, def: FORMULA.basePP,
      source: "A", note: "Set by Education Adequacy Report. Jumped 10%+ in 2026 catching up on missed inflation." },
    { key: "arLow", label: "At-Risk Weight (Low ≤20%)", min: 0.30, max: 0.80, step: 0.01, def: FORMULA.atRiskRange.low,
      source: "A", note: "Derived from adequacy study's cost-of-need analysis. Tiered by district poverty concentration." },
    { key: "arHigh", label: "At-Risk Weight (High ≥60%)", min: 0.40, max: 0.90, step: 0.01, def: FORMULA.atRiskRange.high,
      source: "A", note: "Higher weight for concentrated poverty districts. The gap between low/high tiers is a key equity lever." },
    { key: "lepWeight", label: <><Tip term="LEP">LEP</Tip>/ELL Weight</>, min: 0.25, max: 0.80, step: 0.01, def: FORMULA.lepWeight,
      source: "A", note: "Additional cost weight for Limited English Proficient students. Set by adequacy study." },
    { key: "spedExcess", label: <><Tip term="SpEd">SpEd</Tip> Excess Cost ($)</>, min: 15000, max: 35000, step: 500, def: FORMULA.spedExcess,
      source: "A", note: "Excess cost above base PP for special education. State funds 1/3 of this as categorical aid." },
    { key: "evMult", label: <><Tip term="EV">EV</Tip> Multiplier (×1000)</>, min: 8, max: 22, step: 0.5, def: FORMULA.evMult * 1000,
      source: "C", note: "Adjusted annually by Commissioner to balance available Equalization Aid. Rose from ~12 to 14.5 in FY26." },
    { key: "incMult", label: "Income Multiplier (×1000)", min: 30, max: 80, step: 1, def: FORMULA.incMult * 1000,
      source: "C", note: "Adjusted annually alongside EV multiplier. When state underfunds formula, both rise → higher LFS → less aid." },
  ];

  const SOURCE_BADGE = {
    A: { label: "ADEQUACY REPORT", color: "#8ac478", bg: "#1a2818" },
    C: { label: "COMMISSIONER (annual)", color: "#f59e0b", bg: "#1a1808" },
    S: { label: "STATUTE / BUDGET", color: "#60a5fa", bg: "#14182a" },
  };

  const getValue = (k) => {
    if (k === "arLow") return overrides.atRiskRange?.low ?? FORMULA.atRiskRange.low;
    if (k === "arHigh") return overrides.atRiskRange?.high ?? FORMULA.atRiskRange.high;
    if (k === "evMult") return (overrides.evMult ?? FORMULA.evMult) * 1000;
    if (k === "incMult") return (overrides.incMult ?? FORMULA.incMult) * 1000;
    return overrides[k] ?? FORMULA[k] ?? sliders.find(s => s.key === k).def;
  };

  const handleChange = (k, v) => {
    const next = { ...overrides };
    if (k === "arLow") {
      next.atRiskRange = { ...(next.atRiskRange || FORMULA.atRiskRange), low: v, mid40: v + (v + ((next.atRiskRange?.high ?? FORMULA.atRiskRange.high) - v) / 2 - v), high: next.atRiskRange?.high ?? FORMULA.atRiskRange.high };
    } else if (k === "arHigh") {
      next.atRiskRange = { ...(next.atRiskRange || FORMULA.atRiskRange), high: v, low: next.atRiskRange?.low ?? FORMULA.atRiskRange.low };
    } else if (k === "evMult") {
      next.evMult = v / 1000;
    } else if (k === "incMult") {
      next.incMult = v / 1000;
    } else {
      next[k] = v;
    }
    setOverrides(next);
  };

  const aidFloor = overrides.aidFloor ?? -0.03;
  const aidCeiling = overrides.aidCeiling ?? 0.06;
  const capsOff = overrides.fullFunding;

  return (
    <div>
      <div style={{ marginBottom: 20, padding: 16, background: "linear-gradient(135deg, #2a2820, #1a1914)", borderRadius: 12, border: "1px solid #3a382f" }}>
        <div style={{ fontSize: 14, color: "#c4b98a", fontWeight: 600, marginBottom: 4 }}>⚙ Formula Parameter Editor</div>
        <div style={{ fontSize: 12, color: "#8a8778", lineHeight: 1.5 }}>
          Adjust SFRA formula inputs to test reform scenarios. Changes reflect in real-time across all views.
          <span style={{ display: "inline-flex", gap: 8, marginLeft: 8 }}>
            {Object.entries(SOURCE_BADGE).map(([k, b]) => (
              <span key={k} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: b.bg, color: b.color, border: `1px solid ${b.color}40` }}>{b.label}</span>
            ))}
          </span>
        </div>
      </div>

      {/* Cap controls */}
      <div style={{ marginBottom: 16, padding: 14, background: "#14182a", borderRadius: 10, border: "1px solid #2a3050" }}>
        <div style={{ fontSize: 12, color: "#60a5fa", fontWeight: 600, marginBottom: 8 }}>
          Aid Change Caps <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "#14182a", color: "#60a5fa", border: "1px solid #2a3050", marginLeft: 4 }}>STATUTE / BUDGET</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Pill active={capsOff} onClick={() => setOverrides({ ...overrides, fullFunding: !overrides.fullFunding })} color="#059669">
            {capsOff ? "✓" : "○"} No Caps (full formula funding)
          </Pill>
          {!capsOff && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#8a8aba" }}>Loss floor:</span>
                <select value={aidFloor} onChange={e => setOverrides({ ...overrides, aidFloor: parseFloat(e.target.value) })}
                  style={{ background: "#1a1a2a", color: "#e2e0d6", border: "1px solid #3a3850", borderRadius: 6, padding: "3px 6px", fontSize: 12 }}>
                  <option value={0}>0% (no protection)</option>
                  <option value={-0.01}>-1%</option>
                  <option value={-0.02}>-2%</option>
                  <option value={-0.03}>-3% (current S-2)</option>
                  <option value={-0.05}>-5%</option>
                  <option value={-0.10}>-10%</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#8a8aba" }}>Gain ceiling:</span>
                <select value={aidCeiling} onChange={e => setOverrides({ ...overrides, aidCeiling: parseFloat(e.target.value) })}
                  style={{ background: "#1a1a2a", color: "#e2e0d6", border: "1px solid #3a3850", borderRadius: 6, padding: "3px 6px", fontSize: 12 }}>
                  <option value={0.04}>+4%</option>
                  <option value={0.06}>+6% (current S-2)</option>
                  <option value={0.10}>+10%</option>
                  <option value={0.15}>+15%</option>
                  <option value={1.00}>Uncapped gains</option>
                </select>
              </div>
            </>
          )}
          <div style={{ borderLeft: "1px solid #3a3850", height: 24, margin: "0 4px" }} />
          <Pill active={overrides.lfsCap === 0.02} onClick={() => setOverrides({ ...overrides, lfsCap: overrides.lfsCap === 0.02 ? null : 0.02 })} color="#2563eb">
            {overrides.lfsCap === 0.02 ? "✓" : "○"} 2% <Tip term="LFS">LFS</Tip> Cap
          </Pill>
        </div>
        <div style={{ fontSize: 10, color: "#5a5a8a", marginTop: 6 }}>
          The -3% loss floor protects overaided districts at the expense of underfunded ones. The +6% ceiling slows aid growth for high-need districts. Both are set annually in the state budget.
        </div>
      </div>

      {/* Scenario presets */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setOverrides({})} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #3a382f", background: Object.keys(overrides).length === 0 ? "#c4b98a" : "transparent", color: Object.keys(overrides).length === 0 ? "#12110e" : "#8a8778", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Reset to FY26</button>
        {Object.entries(SCENARIOS).map(([k, s]) => (
          <button key={k} onClick={() => setOverrides(s.overrides)} title={s.desc}
            style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #3a382f", background: "transparent", color: "#8a8778", fontSize: 12, cursor: "pointer" }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Sliders with annotations */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {sliders.map((s) => {
          const val = getValue(s.key);
          const isDiff = Math.abs(val - s.def) > (s.step || 0.001);
          const badge = SOURCE_BADGE[s.source];
          return (
            <div key={s.key} style={{ padding: 14, background: isDiff ? "#2a2510" : "#1a1914", borderRadius: 10, border: `1px solid ${isDiff ? "#5a4a20" : "#2a2820"}`, transition: "all 0.3s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div>
                  <span style={{ fontSize: 12, color: isDiff ? "#c4b98a" : "#8a8778", fontWeight: isDiff ? 600 : 400 }}>{s.label}</span>
                  <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 3, background: badge.bg, color: badge.color, border: `1px solid ${badge.color}30`, marginLeft: 6, verticalAlign: "middle" }}>{badge.label}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: isDiff ? "#e8d48a" : "#e2e0d6", fontFamily: "'Instrument Serif', serif" }}>
                  {s.key.includes("Mult") || s.key.includes("Weight") || s.key.startsWith("ar") ? val.toFixed(s.key.includes("Mult") ? 1 : 2) : fmtNum(val)}
                </span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={val}
                onChange={(e) => handleChange(s.key, parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: isDiff ? "#c4b98a" : "#4a4838" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#5a5848", marginTop: 2 }}>
                <span>{s.key.includes("Mult") ? s.min.toFixed(1) : s.min.toLocaleString()}</span>
                <span>{s.key.includes("Mult") ? s.max.toFixed(1) : s.max.toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 10, color: "#5a5848", marginTop: 6, lineHeight: 1.4, fontStyle: "italic" }}>{s.note}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
