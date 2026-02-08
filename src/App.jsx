import { useState } from "react";
import { VIEWS, VIEW_LABELS } from './data/formula-params.js';
import { DEFAULT_COMPARED } from './data/districts.js';
import ProfilesView from './components/ProfilesView.jsx';
import FormulaView from './components/FormulaView.jsx';
import ResultsView from './components/ResultsView.jsx';
import BudgetView from './components/BudgetView.jsx';
import ProjectionView from './components/ProjectionView.jsx';
import FiscalView from './components/FiscalView.jsx';
import FiscalStressView from './components/FiscalStressView.jsx';
import CustomFormulaView from './components/CustomFormulaView.jsx';

export default function SFRAModel() {
  const [view, setView] = useState("profiles");
  const [selected, setSelected] = useState("westOrange");
  const [compared, setCompared] = useState(DEFAULT_COMPARED);
  const [overrides, setOverrides] = useState({});
  const [customParams, setCustomParams] = useState({});

  const addCompared = (key) => setCompared(prev => prev.includes(key) ? prev : [...prev, key].slice(0, 8));
  const removeCompared = (key) => setCompared(prev => prev.filter(k => k !== key));

  return (
    <div style={{
      minHeight: "100vh", background: "#12110e", color: "#e2e0d6",
      fontFamily: "'DM Sans', sans-serif", padding: "0"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        padding: "28px 32px 20px", borderBottom: "1px solid #2a2820",
        background: "linear-gradient(180deg, #1a1914 0%, #12110e 100%)"
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "#c4b98a", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>NJ SFRA</span>
          <span style={{ fontSize: 11, color: "#3a382f" }}>|</span>
          <span style={{ fontSize: 11, color: "#5a5848" }}>School Funding Reform Act Interactive Model — 558 Districts</span>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 700, fontFamily: "'Instrument Serif', serif", color: "#e2e0d6", margin: "4px 0 12px", letterSpacing: "-0.02em" }}>
          Education Funding Scenario Explorer
        </h1>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {VIEWS.map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "8px 16px", borderRadius: 6, border: "none",
              background: view === v ? (v === "custom" ? "#9333ea" : v === "stress" ? "#e88a8a" : v === "budget" ? "#a89aca" : "#c4b98a") : "#1a1914",
              color: view === v ? "#12110e" : "#8a8778",
              fontSize: 13, fontWeight: view === v ? 700 : 500,
              cursor: "pointer", transition: "all 0.15s",
              fontFamily: "'DM Sans', sans-serif"
            }}>{VIEW_LABELS[v]}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "24px 32px", maxWidth: 1100 }}>
        {view === "profiles" && <ProfilesView selected={selected} setSelected={setSelected} />}
        {view === "formula" && <FormulaView overrides={overrides} setOverrides={setOverrides} />}
        {view === "custom" && <CustomFormulaView compared={compared} addCompared={addCompared} removeCompared={removeCompared} customParams={customParams} setCustomParams={setCustomParams} />}
        {view === "budget" && <BudgetView compared={compared} addCompared={addCompared} removeCompared={removeCompared} overrides={overrides} />}
        {view === "results" && <ResultsView compared={compared} addCompared={addCompared} removeCompared={removeCompared} overrides={overrides} />}
        {view === "projection" && <ProjectionView compared={compared} addCompared={addCompared} removeCompared={removeCompared} overrides={overrides} />}
        {view === "fiscal" && <FiscalView overrides={overrides} />}
        {view === "stress" && <FiscalStressView overrides={overrides} />}
      </div>
    </div>
  );
}
