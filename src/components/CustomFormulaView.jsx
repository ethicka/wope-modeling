import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell } from "recharts";
import { DISTRICTS } from '../data/districts.js';
import { CUSTOM_DATA, CUSTOM_DEFAULTS } from '../data/custom-formula-data.js';
import { runCustomFormula, calibrateRevenueNeutralBase, calcStatewideRedistribution } from '../engine/custom-formula.js';
import { fmt, fmtPct, fmtNum } from '../utils/format.js';
import Pill from './ui/Pill.jsx';
import Tip from './ui/Tip.jsx';
import StatCard from './ui/StatCard.jsx';
import { ComparisonBar } from './ui/DistrictSearch.jsx';

export default function CustomFormulaView({ compared, addCompared, removeCompared, customParams, setCustomParams }) {
  const p = { ...CUSTOM_DEFAULTS, ...customParams };
  const [revenueNeutral, setRevenueNeutral] = useState(false);
  const [showRedist, setShowRedist] = useState(false);

  const set = (k, v) => setCustomParams({ ...customParams, [k]: v });

  // Revenue-neutral: calibrate base so total custom = total FY26
  const rnBase = useMemo(() => {
    if (!revenueNeutral) return null;
    const paramsForCalib = { ...p };
    delete paramsForCalib.customBase; // let calibration find it
    return calibrateRevenueNeutralBase(paramsForCalib);
  }, [revenueNeutral, p.povertyExponent, p.idfWeight, p.tbiWeight, p.useFreeLunchAsPoverty, p.spedAddon, p.securityAddon]);

  const effectiveBase = revenueNeutral && rnBase ? rnBase.base : p.customBase;
  const effectiveParams = { ...p, customBase: effectiveBase };

  const results = compared.map(k => {
    const d = DISTRICTS[k];
    if (!d) return null;
    const cd = CUSTOM_DATA[k];
    if (!cd) return null;
    const custom = runCustomFormula(d, cd, effectiveParams);
    return { key: k, ...d, cd, custom };
  }).filter(Boolean);

  // Redistribution analysis (only computed when toggle is on)
  const redist = useMemo(() => {
    if (!showRedist) return null;
    return calcStatewideRedistribution(effectiveParams);
  }, [showRedist, effectiveBase, p.povertyExponent, p.idfWeight, p.tbiWeight, p.useFreeLunchAsPoverty, p.spedAddon, p.securityAddon]);

  const compData = results.map(r => ({
    name: r.short, sfra: r.custom.sfraUncapped / 1e6, custom: r.custom.totalCustom / 1e6, color: r.color,
  }));

  const ppData = results.map(r => ({
    name: r.short, sfra: r.custom.sfraUncapped / r.enr.total, custom: r.custom.perPupil, color: r.color,
  }));

  const sliderStyle = (isDiff) => ({
    padding: 14, background: isDiff ? "#1a1420" : "#1a1914", borderRadius: 10,
    border: `1px solid ${isDiff ? "#4a2a60" : "#2a2820"}`, transition: "all 0.3s"
  });

  const labelStyle = (isDiff) => ({ fontSize: 12, color: isDiff ? "#c49aea" : "#8a8778", fontWeight: isDiff ? 600 : 400 });
  const valStyle = (isDiff) => ({ fontSize: 14, fontWeight: 700, color: isDiff ? "#d8b4fe" : "#e2e0d6", fontFamily: "'Instrument Serif', serif" });

  return (
    <div>
      <ComparisonBar compared={compared} districts={DISTRICTS} onRemove={removeCompared} onAdd={addCompared} />
      {/* Header explanation */}
      <div style={{ marginBottom: 20, padding: 16, background: "linear-gradient(135deg, #201428, #1a1914)", borderRadius: 12, border: "1px solid #3a2848" }}>
        <div style={{ fontSize: 14, color: "#c49aea", fontWeight: 600, marginBottom: 6 }}>Custom Aid Formula</div>
        <div style={{ fontSize: 12, color: "#8a7898", lineHeight: 1.6 }}>
          Model an alternative need-based formula. Like SFRA, this subtracts Local Fair Share from a need-based adequacy budget, adjusted for regional cost of living:
        </div>
        <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 18, color: "#d8b4fe", margin: "10px 0", padding: "10px 16px", background: "#12110e", borderRadius: 8, border: "1px solid #2a2030", display: "inline-block" }}>
          Aid = max(0, Need - LFS) + Categoricals
        </div>
        <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 14, color: "#a87ade", margin: "4px 0 0 16px" }}>
          where Need = Base × (1 + Poverty{p.povertyExponent !== 1 ? <sup style={{fontSize:10}}>{p.povertyExponent.toFixed(1)}</sup> : ""} × IDF × TBI) × Enrollment × <span style={{ color: "#4ade80" }}>GCA</span>
        </div>
        <div style={{ fontSize: 11, color: "#6a5878", marginTop: 6 }}>
          <span style={{ color: "#4ade80" }}>GCA</span> = Geographic Cost Adjustment (county-level cost-of-living multiplier from SFRA). Categoricals use actual SFRA allocations.
        </div>
      </div>

      {/* Revenue-neutral toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <Pill active={revenueNeutral} onClick={() => { setRevenueNeutral(!revenueNeutral); if (!revenueNeutral) setShowRedist(true); }} color="#f59e0b">
          {revenueNeutral ? "Revenue-Neutral ON" : "Revenue-Neutral Mode"}
        </Pill>
        {revenueNeutral && rnBase && (
          <span style={{ fontSize: 13, color: "#f59e0b", fontFamily: "'Instrument Serif', serif" }}>
            Calibrated base: <strong>${rnBase.base.toLocaleString()}</strong> (target: {fmt(rnBase.targetTotal)})
          </span>
        )}
        {revenueNeutral && (
          <Pill active={showRedist} onClick={() => setShowRedist(!showRedist)} color="#9333ea">
            {showRedist ? "Hide" : "Show"} Statewide Redistribution
          </Pill>
        )}
      </div>

      {/* Formula component sliders */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Base amount */}
        <div style={sliderStyle(!revenueNeutral && p.customBase !== CUSTOM_DEFAULTS.customBase)}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={labelStyle(!revenueNeutral && p.customBase !== CUSTOM_DEFAULTS.customBase)}>
              Base Per Pupil ($) {revenueNeutral && <span style={{ fontSize: 10, color: "#f59e0b" }}>(auto-calibrated)</span>}
            </span>
            <span style={valStyle(!revenueNeutral && p.customBase !== CUSTOM_DEFAULTS.customBase)}>${effectiveBase.toLocaleString()}</span>
          </div>
          <input type="range" min={5000} max={25000} step={250} value={revenueNeutral ? effectiveBase : p.customBase}
            onChange={e => set("customBase", +e.target.value)} disabled={revenueNeutral}
            style={{ width: "100%", accentColor: revenueNeutral ? "#f59e0b" : "#9333ea", opacity: revenueNeutral ? 0.5 : 1 }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#5a4868" }}><span>$5,000</span><span>$25,000</span></div>
        </div>

        {/* Poverty exponent */}
        <div style={sliderStyle(p.povertyExponent !== 1.0)}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={labelStyle(p.povertyExponent !== 1.0)}>Poverty Rate Exponent</span>
            <span style={valStyle(p.povertyExponent !== 1.0)}>{p.povertyExponent.toFixed(2)}</span>
          </div>
          <input type="range" min={0.5} max={2.0} step={0.05} value={p.povertyExponent}
            onChange={e => set("povertyExponent", +e.target.value)} style={{ width: "100%", accentColor: "#9333ea" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#5a4868" }}>
            <span>0.50 (compress)</span><span>1.0 (linear)</span><span>2.0 (progressive)</span>
          </div>
        </div>

        {/* IDF weight */}
        <div style={sliderStyle(p.idfWeight !== 1.0)}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={labelStyle(p.idfWeight !== 1.0)}><Tip term="IDF">Income Diversity Factor</Tip> Weight</span>
            <span style={valStyle(p.idfWeight !== 1.0)}>{p.idfWeight.toFixed(2)}</span>
          </div>
          <input type="range" min={0} max={2.0} step={0.05} value={p.idfWeight}
            onChange={e => set("idfWeight", +e.target.value)} style={{ width: "100%", accentColor: "#9333ea" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#5a4868" }}>
            <span>0 (ignore)</span><span>1.0 (full)</span><span>2.0 (amplify)</span>
          </div>
        </div>

        {/* TBI weight */}
        <div style={sliderStyle(p.tbiWeight !== 1.0)}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={labelStyle(p.tbiWeight !== 1.0)}><Tip term="TBI">Tax Burden Index</Tip> Weight</span>
            <span style={valStyle(p.tbiWeight !== 1.0)}>{p.tbiWeight.toFixed(2)}</span>
          </div>
          <input type="range" min={0} max={2.0} step={0.05} value={p.tbiWeight}
            onChange={e => set("tbiWeight", +e.target.value)} style={{ width: "100%", accentColor: "#9333ea" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#5a4868" }}>
            <span>0 (ignore)</span><span>1.0 (full)</span><span>2.0 (amplify)</span>
          </div>
        </div>

        {/* Poverty source toggle */}
        <div style={{ padding: 14, background: "#1a1914", borderRadius: 10, border: "1px solid #2a2820", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 12, color: "#8a8778", marginBottom: 8 }}>Poverty Metric Source</div>
          <div style={{ display: "flex", gap: 6 }}>
            <Pill active={p.useFreeLunchAsPoverty} onClick={() => set("useFreeLunchAsPoverty", true)} color="#9333ea">Free/Reduced Lunch %</Pill>
            <Pill active={!p.useFreeLunchAsPoverty} onClick={() => set("useFreeLunchAsPoverty", false)} color="#9333ea">Census Poverty Rate</Pill>
          </div>
        </div>
      </div>

      {/* Toggle add-ons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <Pill active={p.spedAddon} onClick={() => set("spedAddon", !p.spedAddon)} color="#9333ea">
          {p.spedAddon ? "+" : "-"} SpEd Categorical (actual SFRA)
        </Pill>
        <Pill active={p.securityAddon} onClick={() => set("securityAddon", !p.securityAddon)} color="#9333ea">
          {p.securityAddon ? "+" : "-"} Security Aid (actual SFRA)
        </Pill>
        <Pill active={false} onClick={() => { setCustomParams({}); setRevenueNeutral(false); setShowRedist(false); }} color="#6a5878">Reset All</Pill>
      </div>

      {/* Per-district factor cards */}
      <div style={{ marginBottom: 20, padding: 16, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
        <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>District Factor Values</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #2a2820" }}>
                <th style={{ textAlign: "left", padding: 8, color: "#6a6758", fontWeight: 500 }}>Factor</th>
                {results.map(r => <th key={r.key} style={{ textAlign: "center", padding: 8, color: r.color, fontWeight: 600 }}>{r.short}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #1f1e18" }}>
                <td style={{ padding: 8, color: "#8a8778" }}>Poverty Rate ({p.useFreeLunchAsPoverty ? <Tip term="FRL">F/R Lunch</Tip> : "Census"})</td>
                {results.map(r => <td key={r.key} style={{ textAlign: "center", padding: 8, color: "#e2e0d6", fontWeight: 600 }}>{(r.custom.povertyRate * 100).toFixed(1)}%</td>)}
              </tr>
              <tr style={{ borderBottom: "1px solid #1f1e18" }}>
                <td style={{ padding: 8, color: "#8a8778" }}>Poverty Factor (rate<sup>{p.povertyExponent !== 1 ? p.povertyExponent.toFixed(1) : ""}</sup>)</td>
                {results.map(r => <td key={r.key} style={{ textAlign: "center", padding: 8, color: "#d8b4fe", fontWeight: 600 }}>{r.custom.povertyFactor.toFixed(4)}</td>)}
              </tr>
              <tr style={{ borderBottom: "1px solid #1f1e18" }}>
                <td style={{ padding: 8, color: "#8a8778" }}><Tip term="IDF">Income Diversity Factor</Tip>{p.idfWeight !== 1.0 ? " (raw)" : ""}</td>
                {results.map(r => <td key={r.key} style={{ textAlign: "center", padding: 8, color: "#e2e0d6" }}>{r.cd.incomeDiversityFactor.toFixed(2)}</td>)}
              </tr>
              {p.idfWeight !== 1.0 && (
                <tr style={{ borderBottom: "1px solid #1f1e18" }}>
                  <td style={{ padding: 8, color: "#8a8778" }}><Tip term="IDF">IDF</Tip> (weighted x{p.idfWeight.toFixed(2)})</td>
                  {results.map(r => <td key={r.key} style={{ textAlign: "center", padding: 8, color: "#d8b4fe", fontWeight: 600 }}>{r.custom.idf.toFixed(3)}</td>)}
                </tr>
              )}
              <tr style={{ borderBottom: "1px solid #1f1e18" }}>
                <td style={{ padding: 8, color: "#8a8778" }}><Tip term="TBI">Tax Burden Index</Tip> (capped 0.5-2.0)</td>
                {results.map(r => <td key={r.key} style={{ textAlign: "center", padding: 8, color: "#e2e0d6" }}>
                  {r.custom.tbi.toFixed(3)}{r.custom.tbiRaw !== r.custom.tbi ? <span style={{color:"#f59e0b",fontSize:10}}> cap</span> : ""}
                </td>)}
              </tr>
              {p.tbiWeight !== 1.0 && (
                <tr style={{ borderBottom: "1px solid #1f1e18" }}>
                  <td style={{ padding: 8, color: "#8a8778" }}>TBI (weighted x{p.tbiWeight.toFixed(2)})</td>
                  {results.map(r => <td key={r.key} style={{ textAlign: "center", padding: 8, color: "#d8b4fe", fontWeight: 600 }}>{r.custom.tbi.toFixed(3)}</td>)}
                </tr>
              )}
              <tr style={{ borderBottom: "1px solid #1f1e18" }}>
                <td style={{ padding: 8, color: "#4ade80" }}><Tip term="GCA">Geographic Cost Adj.</Tip> (county COL)</td>
                {results.map(r => <td key={r.key} style={{ textAlign: "center", padding: 8, color: "#4ade80", fontWeight: 600 }}>
                  {r.custom.gca.toFixed(4)} <span style={{ fontSize: 10, color: "#6a8768" }}>{r.county}</span>
                </td>)}
              </tr>
              <tr style={{ borderBottom: "1px solid #2a2820", background: "#1f1a28" }}>
                <td style={{ padding: 8, color: "#c49aea", fontWeight: 600 }}>Need Multiplier (Pov x IDF x TBI)</td>
                {results.map(r => <td key={r.key} style={{ textAlign: "center", padding: 8, color: "#d8b4fe", fontWeight: 700, fontSize: 15 }}>
                  {r.custom.needMultiplier.toFixed(4)}
                </td>)}
              </tr>
              <tr style={{ borderBottom: "1px solid #1f1e18" }}>
                <td style={{ padding: 8, color: "#8a8778" }}>Core Need (adequacy × GCA)</td>
                {results.map(r => <td key={r.key} style={{ textAlign: "center", padding: 8, color: "#e2e0d6" }}>{fmt(r.custom.coreNeed)}</td>)}
              </tr>
              <tr style={{ borderBottom: "1px solid #1f1e18" }}>
                <td style={{ padding: 8, color: "#8a8778" }}><Tip term="LFS">Local Fair Share</Tip></td>
                {results.map(r => <td key={r.key} style={{ textAlign: "center", padding: 8, color: "#e2e0d6" }}>{fmt(r.custom.lfs)}</td>)}
              </tr>
              <tr style={{ borderBottom: "1px solid #2a2820", background: "#1f1a28" }}>
                <td style={{ padding: 8, color: "#c49aea", fontWeight: 600 }}>Core Aid (Need - LFS)</td>
                {results.map(r => <td key={r.key} style={{ textAlign: "center", padding: 8, color: "#d8b4fe", fontWeight: 700 }}>{fmt(r.custom.coreAid)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Side-by-side comparison: SFRA vs Custom */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        {results.map(r => (
          <div key={r.key} style={{ flex: 1, minWidth: 210, padding: 16, background: "#1a1914", borderRadius: 12, border: `1px solid ${r.color}30`, borderLeft: `3px solid ${r.color}` }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: r.color, fontFamily: "'Instrument Serif', serif" }}>{r.name}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: "#6a6758", textTransform: "uppercase" }}>SFRA (uncapped)</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#8a8778", fontFamily: "'Instrument Serif', serif" }}>{fmt(r.custom.sfraUncapped)}</div>
                <div style={{ fontSize: 11, color: "#6a6758" }}>{fmt(r.custom.sfraUncapped / r.enr.total)}/pupil</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#9333ea", textTransform: "uppercase" }}>Custom{revenueNeutral ? " (RN)" : ""}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#d8b4fe", fontFamily: "'Instrument Serif', serif" }}>{fmt(r.custom.totalCustom)}</div>
                <div style={{ fontSize: 11, color: "#9a7abe" }}>{fmt(r.custom.perPupil)}/pupil</div>
              </div>
            </div>
            <div style={{ marginTop: 8, padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: r.custom.changeSfra > 0 ? "#1a2818" : r.custom.changeSfra < -100000 ? "#2a1414" : "#1a1914",
              color: r.custom.changeSfra > 0 ? "#34d399" : r.custom.changeSfra < -100000 ? "#f87171" : "#8a8778" }}>
              vs uncapped SFRA: {r.custom.changeSfra >= 0 ? "+" : ""}{fmt(r.custom.changeSfra)} ({fmtPct(r.custom.changeSfraPct)})
            </div>
            {revenueNeutral && Math.abs(r.custom.changeFy26) > 1000 && (
              <div style={{ marginTop: 4, padding: "3px 8px", borderRadius: 6, fontSize: 11,
                color: r.custom.changeFy26 > 0 ? "#34d399" : "#f87171" }}>
                vs FY26 actual: {r.custom.changeFy26 >= 0 ? "+" : ""}{fmt(r.custom.changeFy26)} ({fmtPct(r.custom.changeFy26Pct)})
              </div>
            )}
            {!revenueNeutral && Math.abs(r.custom.changeFy26) > 1000 && (
              <div style={{ marginTop: 4, padding: "3px 8px", borderRadius: 6, fontSize: 11, color: "#6a6758" }}>
                vs FY26 actual: {r.custom.changeFy26 >= 0 ? "+" : ""}{fmt(r.custom.changeFy26)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Redistribution summary — only in revenue-neutral mode */}
      {revenueNeutral && showRedist && redist && (
        <div style={{ marginBottom: 20, padding: 20, background: "#1a1420", borderRadius: 12, border: "1px solid #f59e0b30" }}>
          <div style={{ fontSize: 14, color: "#f59e0b", fontWeight: 600, marginBottom: 12, fontFamily: "'Instrument Serif', serif" }}>
            Statewide Redistribution Analysis (Revenue-Neutral)
          </div>

          {/* Summary stats */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <StatCard label="Total FY26 Actual" value={fmt(redist.totalFy26)} sub={`${redist.districtCount} districts`} />
            <StatCard label="Total Custom" value={fmt(redist.totalCustom)} sub={`Net: ${fmt(redist.netChange)}`} color={Math.abs(redist.netChange) < 1e6 ? "#4ade80" : "#f59e0b"} />
            <StatCard label="Gainers" value={redist.gainerCount} sub={`+${fmt(redist.totalGains)}`} color="#34d399" />
            <StatCard label="Losers" value={redist.loserCount} sub={fmt(redist.totalLosses)} color="#f87171" />
          </div>

          {/* Top gainers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: "#34d399", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Top 10 Gainers</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #2a2820" }}>
                    <th style={{ textAlign: "left", padding: 6, color: "#6a6758" }}>District</th>
                    <th style={{ textAlign: "right", padding: 6, color: "#6a6758" }}>GCA</th>
                    <th style={{ textAlign: "right", padding: 6, color: "#6a6758" }}>FRL%</th>
                    <th style={{ textAlign: "right", padding: 6, color: "#6a6758" }}>Change</th>
                    <th style={{ textAlign: "right", padding: 6, color: "#6a6758" }}>$/Pupil</th>
                  </tr>
                </thead>
                <tbody>
                  {redist.gainers.slice(0, 10).map(r => (
                    <tr key={r.key} style={{ borderBottom: "1px solid #1f1e18" }}>
                      <td style={{ padding: 6, color: "#e2e0d6", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</td>
                      <td style={{ textAlign: "right", padding: 6, color: "#4ade80" }}>{r.gca.toFixed(3)}</td>
                      <td style={{ textAlign: "right", padding: 6, color: "#d8b4fe" }}>{(r.atRiskPct * 100).toFixed(0)}%</td>
                      <td style={{ textAlign: "right", padding: 6, color: "#34d399", fontWeight: 600 }}>+{fmt(r.change)}</td>
                      <td style={{ textAlign: "right", padding: 6, color: "#34d399" }}>+${Math.round(r.perPupilChange).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#f87171", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Top 10 Losers</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #2a2820" }}>
                    <th style={{ textAlign: "left", padding: 6, color: "#6a6758" }}>District</th>
                    <th style={{ textAlign: "right", padding: 6, color: "#6a6758" }}>GCA</th>
                    <th style={{ textAlign: "right", padding: 6, color: "#6a6758" }}>FRL%</th>
                    <th style={{ textAlign: "right", padding: 6, color: "#6a6758" }}>Change</th>
                    <th style={{ textAlign: "right", padding: 6, color: "#6a6758" }}>$/Pupil</th>
                  </tr>
                </thead>
                <tbody>
                  {redist.losers.slice(0, 10).map(r => (
                    <tr key={r.key} style={{ borderBottom: "1px solid #1f1e18" }}>
                      <td style={{ padding: 6, color: "#e2e0d6", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</td>
                      <td style={{ textAlign: "right", padding: 6, color: "#4ade80" }}>{r.gca.toFixed(3)}</td>
                      <td style={{ textAlign: "right", padding: 6, color: "#d8b4fe" }}>{(r.atRiskPct * 100).toFixed(0)}%</td>
                      <td style={{ textAlign: "right", padding: 6, color: "#f87171", fontWeight: 600 }}>{fmt(r.change)}</td>
                      <td style={{ textAlign: "right", padding: 6, color: "#f87171" }}>${Math.round(r.perPupilChange).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ fontSize: 11, color: "#8a7898", marginTop: 12, lineHeight: 1.6 }}>
            Revenue-neutral redistributes the same ${fmt(redist.totalFy26)} total pot. GCA-weighted need means districts in higher-cost counties (Essex {(DISTRICTS.newark?.gca || 1.0237).toFixed(3)}, Hudson 1.034, Morris 1.018) get more per pupil than those in lower-cost areas (Cape May 0.943, Warren 0.966).
          </div>
        </div>
      )}

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
          <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Total Aid: SFRA (uncapped) vs Custom ($M)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={compData} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
              <XAxis dataKey="name" tick={{ fill: "#8a8778", fontSize: 12 }} axisLine={false} />
              <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 13 }} formatter={(v) => `$${v.toFixed(1)}M`} />
              <Bar dataKey="sfra" fill="#4a4838" radius={[3,3,0,0]} barSize={18} name="SFRA (uncapped)" />
              <Bar dataKey="custom" radius={[3,3,0,0]} barSize={18} name="Custom Formula">
                {compData.map((e, i) => <Cell key={i} fill={e.color} opacity={0.7} />)}
              </Bar>
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
          <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Per Pupil Aid: SFRA (uncapped) vs Custom ($)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ppData} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
              <XAxis dataKey="name" tick={{ fill: "#8a8778", fontSize: 12 }} axisLine={false} />
              <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 13 }} formatter={(v) => `$${v.toFixed(0)}`} />
              <Bar dataKey="sfra" fill="#4a4838" radius={[3,3,0,0]} barSize={18} name="SFRA (uncapped)" />
              <Bar dataKey="custom" radius={[3,3,0,0]} barSize={18} name="Custom Formula">
                {ppData.map((e, i) => <Cell key={i} fill={e.color} opacity={0.7} />)}
              </Bar>
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Statewide fiscal impact (non-revenue-neutral mode) */}
      {!revenueNeutral && (
        <div style={{ padding: 20, background: "#1a1420", borderRadius: 12, border: "1px solid #2a2040", marginTop: 16 }}>
          <div style={{ fontSize: 13, color: "#c49aea", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Est. Statewide Fiscal Impact</div>
          {(() => {
            const sfraTotal = results.reduce((s, r) => s + r.custom.sfraUncapped, 0);
            const customTotal = results.reduce((s, r) => s + r.custom.totalCustom, 0);
            const sampleDelta = customTotal - sfraTotal;
            const statewide = 12100000000;
            const scaleFactor = statewide / sfraTotal;
            const estDelta = sampleDelta * scaleFactor;
            const pctChange = (sampleDelta / sfraTotal) * 100;
            return (
              <div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                  <StatCard label={`${results.length}-District SFRA (uncapped)`} value={fmt(sfraTotal)} sub="formula without caps" />
                  <StatCard label={`${results.length}-District Custom`} value={fmt(customTotal)} sub={`Delta: ${fmt(sampleDelta)} (${fmtPct(pctChange)})`} color={sampleDelta > 0 ? "#d8b4fe" : "#f87171"} />
                  <StatCard label="Est. Statewide Impact" value={fmt(estDelta)} sub="scaled from comparison set" color="#c4b98a" />
                  <StatCard label="New Est. State Budget" value={fmt(statewide + estDelta)} sub="from $12.1B baseline" />
                </div>
                <div style={{ fontSize: 12, color: "#7a6898", lineHeight: 1.6 }}>
                  <strong style={{ color: "#a89aca" }}>Methodology:</strong> Both custom and SFRA baseline are <em>uncapped</em> formula outputs (no growth caps). The statewide estimate scales the sample delta by the ratio of statewide aid ($12.1B) to the sample SFRA baseline. Add more districts to improve the estimate.
                  {pctChange > 5 && <span style={{ color: "#f59e0b", display: "block", marginTop: 6 }}>A {fmtPct(pctChange)} increase would require significant new revenue or reallocation.</span>}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Fiscal note */}
      <div style={{ padding: 16, background: "#1a1420", borderRadius: 12, border: "1px solid #2a2040", marginTop: 16 }}>
        <div style={{ fontSize: 13, color: "#c49aea", fontWeight: 600, marginBottom: 8 }}>Formula Behavior Notes</div>
        <div style={{ fontSize: 12, color: "#8a7898", lineHeight: 1.7 }}>
          <p>• <strong style={{ color: "#4ade80" }}>Geographic Cost Adjustment (GCA)</strong> scales the need calculation by county-level cost-of-living. Essex County (1.024) costs ~10% more than Cape May (0.943). This means Newark needs more base funding per pupil than a district in a lower-cost area for the same purchasing power.</p>
          <p>• <strong style={{ color: "#d8b4fe" }}>Poverty Exponent {'>'} 1</strong> makes the formula progressive: districts with 80% poverty get disproportionately more than those at 40%. At exponent 2.0, a district at 80% poverty receives 4x the weight of one at 40%.</p>
          <p>• <strong style={{ color: "#d8b4fe" }}>Income Diversity Factor</strong> rewards districts with heterogeneous income distributions, recognizing that income inequality within a district creates service delivery challenges.</p>
          <p>• <strong style={{ color: "#d8b4fe" }}>Tax Burden Index</strong> accounts for effort: districts taxing themselves more relative to income (TBI {'>'} 1.0) receive more aid. Capped at 0.5-2.0 due to income estimation data quality limitations.</p>
          <p>• Like SFRA, this formula subtracts <strong style={{ color: "#d8b4fe" }}>Local Fair Share</strong> from the need-based adequacy budget. Wealthy districts with high EV and income get little or no core aid because their LFS exceeds their need.</p>
          <p>• <strong style={{ color: "#d8b4fe" }}>Categoricals</strong> (SpEd, Security, Transportation) use actual SFRA-allocated amounts — these are state-set pass-throughs not affected by the custom formula.</p>
          {revenueNeutral && <p>• <strong style={{ color: "#f59e0b" }}>Revenue-Neutral Mode</strong> auto-calibrates the base PP so total statewide aid equals total FY26 actual ({rnBase ? fmt(rnBase.targetTotal) : "~$11.4B"}). This redistributes existing dollars based on the formula's need weights + GCA, without increasing the overall budget.</p>}
          <p>• Comparison is against <strong style={{ color: "#d8b4fe" }}>uncapped SFRA</strong> — what the formula says each district should get, without growth caps. This is an apples-to-apples comparison since the custom formula also has no caps.</p>
        </div>
      </div>
    </div>
  );
}
