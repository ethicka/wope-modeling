import { useState, useMemo } from 'react';
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

  const set = (k, v) => setCustomParams({ ...customParams, [k]: v });

  // If revenue-neutral, auto-calibrate base to match FY26 actual total
  const effectiveBase = useMemo(() => {
    if (!revenueNeutral) return p.customBase;
    return calibrateRevenueNeutralBase({ ...p, customBase: undefined });
  }, [revenueNeutral, p.povertyExponent, p.idfWeight, p.tbiWeight, p.useFreeLunchAsPoverty, p.spedAddon, p.securityAddon]);

  const effectiveParams = { ...p, customBase: revenueNeutral ? effectiveBase : p.customBase };

  const results = compared.map(k => {
    const d = DISTRICTS[k];
    if (!d) return null;
    const cd = CUSTOM_DATA[k];
    if (!cd) return null;
    const custom = runCustomFormula(d, cd, effectiveParams);
    return { key: k, ...d, cd, custom };
  }).filter(Boolean);

  // Statewide redistribution (computed only when revenue-neutral is on, memoized)
  const redist = useMemo(() => {
    if (!revenueNeutral) return null;
    return calcStatewideRedistribution(effectiveParams);
  }, [revenueNeutral, effectiveBase, p.povertyExponent, p.idfWeight, p.tbiWeight, p.useFreeLunchAsPoverty, p.spedAddon, p.securityAddon]);

  const compData = results.map(r => ({
    name: r.short,
    sfra: (revenueNeutral ? r.custom.sfraCapped : r.custom.sfraUncapped) / 1e6,
    custom: r.custom.totalCustom / 1e6,
    color: r.color,
  }));

  const ppData = results.map(r => ({
    name: r.short,
    sfra: (revenueNeutral ? r.custom.sfraCapped : r.custom.sfraUncapped) / r.enr.total,
    custom: r.custom.perPupil,
    color: r.color,
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 14, color: "#c49aea", fontWeight: 600 }}>Custom Aid Formula</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Pill active={revenueNeutral} onClick={() => setRevenueNeutral(!revenueNeutral)} color={revenueNeutral ? "#22c55e" : "#9333ea"}>
              {revenueNeutral ? "Revenue Neutral ON" : "Revenue Neutral"}
            </Pill>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#8a7898", lineHeight: 1.6 }}>
          Model an alternative need-based formula. Like SFRA, this subtracts Local Fair Share from a need-based adequacy budget:
        </div>
        <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 18, color: "#d8b4fe", margin: "10px 0", padding: "10px 16px", background: "#12110e", borderRadius: 8, border: "1px solid #2a2030", display: "inline-block" }}>
          Aid = max(0, Need - LFS) + Categoricals
        </div>
        <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 14, color: "#a87ade", margin: "4px 0 0 16px" }}>
          where Need = Base × (1 + Poverty{p.povertyExponent !== 1 ? <sup style={{fontSize:10}}>{p.povertyExponent.toFixed(1)}</sup> : ""} × IDF × TBI) × Enrollment
        </div>
        {revenueNeutral && (
          <div style={{ fontSize: 12, color: "#22c55e", marginTop: 8, padding: "6px 10px", background: "#0a1a0e", borderRadius: 6, border: "1px solid #1a3a20" }}>
            Revenue-neutral mode: Base auto-calibrated to <strong>${effectiveBase.toLocaleString()}/pupil</strong> so total statewide custom aid = total FY26 actual aid ($11.4B). Compared against FY26 actual (capped).
          </div>
        )}
        {!revenueNeutral && (
          <div style={{ fontSize: 11, color: "#6a5878", marginTop: 6 }}>
            Categoricals (SpEd, Security, Transportation) use actual SFRA allocations. Compared against <strong>uncapped</strong> SFRA formula.
          </div>
        )}
      </div>

      {/* Formula component sliders */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Base amount */}
        <div style={sliderStyle(revenueNeutral || p.customBase !== CUSTOM_DEFAULTS.customBase)}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={labelStyle(revenueNeutral || p.customBase !== CUSTOM_DEFAULTS.customBase)}>
              Base Per Pupil ($){revenueNeutral ? " — auto-calibrated" : ""}
            </span>
            <span style={valStyle(true)}>${(revenueNeutral ? effectiveBase : p.customBase).toLocaleString()}</span>
          </div>
          {!revenueNeutral && (
            <>
              <input type="range" min={5000} max={25000} step={250} value={p.customBase}
                onChange={e => set("customBase", +e.target.value)} style={{ width: "100%", accentColor: "#9333ea" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#5a4868" }}><span>$5,000</span><span>$25,000</span></div>
            </>
          )}
          {revenueNeutral && (
            <div style={{ fontSize: 11, color: "#22c55e", lineHeight: 1.4 }}>
              Locked: adjusts automatically so total statewide aid = $11.4B. Change other sliders to see how the base recalibrates.
            </div>
          )}
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
        <Pill active={false} onClick={() => { setCustomParams({}); setRevenueNeutral(false); }} color="#6a5878">Reset All</Pill>
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
              <tr style={{ borderBottom: "1px solid #2a2820", background: "#1f1a28" }}>
                <td style={{ padding: 8, color: "#c49aea", fontWeight: 600 }}>Need Multiplier (Pov x IDF x TBI)</td>
                {results.map(r => <td key={r.key} style={{ textAlign: "center", padding: 8, color: "#d8b4fe", fontWeight: 700, fontSize: 15 }}>
                  {r.custom.needMultiplier.toFixed(4)}
                </td>)}
              </tr>
              <tr style={{ borderBottom: "1px solid #1f1e18" }}>
                <td style={{ padding: 8, color: "#8a8778" }}>Core Need (adequacy)</td>
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
        {results.map(r => {
          const cmpLabel = revenueNeutral ? "FY26 actual" : "uncapped SFRA";
          const cmpDelta = revenueNeutral ? r.custom.changeFy26 : r.custom.changeSfra;
          const cmpPct = revenueNeutral ? r.custom.changeFy26Pct : r.custom.changeSfraPct;
          const cmpBase = revenueNeutral ? r.custom.sfraCapped : r.custom.sfraUncapped;
          return (
            <div key={r.key} style={{ flex: 1, minWidth: 210, padding: 16, background: "#1a1914", borderRadius: 12, border: `1px solid ${r.color}30`, borderLeft: `3px solid ${r.color}` }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: r.color, fontFamily: "'Instrument Serif', serif" }}>{r.name}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#6a6758", textTransform: "uppercase" }}>{revenueNeutral ? "FY26 Actual" : "SFRA (uncapped)"}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#8a8778", fontFamily: "'Instrument Serif', serif" }}>{fmt(cmpBase)}</div>
                  <div style={{ fontSize: 11, color: "#6a6758" }}>{fmt(cmpBase / r.enr.total)}/pupil</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#9333ea", textTransform: "uppercase" }}>Custom</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#d8b4fe", fontFamily: "'Instrument Serif', serif" }}>{fmt(r.custom.totalCustom)}</div>
                  <div style={{ fontSize: 11, color: "#9a7abe" }}>{fmt(r.custom.perPupil)}/pupil</div>
                </div>
              </div>
              <div style={{ marginTop: 8, padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: cmpDelta > 0 ? "#1a2818" : cmpDelta < -100000 ? "#2a1414" : "#1a1914",
                color: cmpDelta > 0 ? "#34d399" : cmpDelta < -100000 ? "#f87171" : "#8a8778" }}>
                vs {cmpLabel}: {cmpDelta >= 0 ? "+" : ""}{fmt(cmpDelta)} ({fmtPct(cmpPct)})
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
          <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Total Aid ($M)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={compData} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
              <XAxis dataKey="name" tick={{ fill: "#8a8778", fontSize: 12 }} axisLine={false} />
              <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 13 }} formatter={(v) => `$${v.toFixed(1)}M`} />
              <Bar dataKey="sfra" fill="#4a4838" radius={[3,3,0,0]} barSize={18} name={revenueNeutral ? "FY26 Actual" : "SFRA (uncapped)"} />
              <Bar dataKey="custom" radius={[3,3,0,0]} barSize={18} name="Custom Formula">
                {compData.map((e, i) => <Cell key={i} fill={e.color} opacity={0.7} />)}
              </Bar>
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
          <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Per Pupil Aid ($)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ppData} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
              <XAxis dataKey="name" tick={{ fill: "#8a8778", fontSize: 12 }} axisLine={false} />
              <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 13 }} formatter={(v) => `$${v.toFixed(0)}`} />
              <Bar dataKey="sfra" fill="#4a4838" radius={[3,3,0,0]} barSize={18} name={revenueNeutral ? "FY26 Actual" : "SFRA (uncapped)"} />
              <Bar dataKey="custom" radius={[3,3,0,0]} barSize={18} name="Custom Formula">
                {ppData.map((e, i) => <Cell key={i} fill={e.color} opacity={0.7} />)}
              </Bar>
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Statewide redistribution summary (revenue-neutral mode) */}
      {revenueNeutral && redist && (
        <div style={{ padding: 20, background: "#0a1a0e", borderRadius: 12, border: "1px solid #1a3a20", marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "#22c55e", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Statewide Redistribution (all {redist.results.length} districts)
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <StatCard label="Total Budget" value={fmt(redist.totalFy26)} sub="FY26 actual = Custom total" color="#22c55e" />
            <StatCard label="Districts Gain" value={redist.gainers.toString()} sub="receive more under custom" color="#34d399" />
            <StatCard label="Districts Lose" value={redist.losers.toString()} sub="receive less under custom" color="#f87171" />
            <StatCard label="Roughly Flat" value={redist.flat.toString()} sub="change < $100K" color="#8a8778" />
          </div>

          {/* Top gainers and losers tables */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: "#34d399", fontWeight: 600, marginBottom: 8 }}>Top 10 Gainers</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1a3a20" }}>
                    <th style={{ textAlign: "left", padding: 4, color: "#4a6a50" }}>District</th>
                    <th style={{ textAlign: "right", padding: 4, color: "#4a6a50" }}>FRL</th>
                    <th style={{ textAlign: "right", padding: 4, color: "#4a6a50" }}>Change</th>
                    <th style={{ textAlign: "right", padding: 4, color: "#4a6a50" }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {redist.topGainers.map(r => (
                    <tr key={r.key} style={{ borderBottom: "1px solid #0a2010" }}>
                      <td style={{ padding: 4, color: "#a0d0a8" }}>{r.name}</td>
                      <td style={{ textAlign: "right", padding: 4, color: "#6a9a70" }}>{(r.frl*100).toFixed(0)}%</td>
                      <td style={{ textAlign: "right", padding: 4, color: "#34d399", fontWeight: 600 }}>+{fmt(r.deltaFy26)}</td>
                      <td style={{ textAlign: "right", padding: 4, color: "#34d399" }}>+{r.deltaFy26Pct.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#f87171", fontWeight: 600, marginBottom: 8 }}>Top 10 Losers</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #3a1a1a" }}>
                    <th style={{ textAlign: "left", padding: 4, color: "#6a4a4a" }}>District</th>
                    <th style={{ textAlign: "right", padding: 4, color: "#6a4a4a" }}>FRL</th>
                    <th style={{ textAlign: "right", padding: 4, color: "#6a4a4a" }}>Change</th>
                    <th style={{ textAlign: "right", padding: 4, color: "#6a4a4a" }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {redist.topLosers.map(r => (
                    <tr key={r.key} style={{ borderBottom: "1px solid #200a0a" }}>
                      <td style={{ padding: 4, color: "#d0a0a0" }}>{r.name}</td>
                      <td style={{ textAlign: "right", padding: 4, color: "#9a6a6a" }}>{(r.frl*100).toFixed(0)}%</td>
                      <td style={{ textAlign: "right", padding: 4, color: "#f87171", fontWeight: 600 }}>{fmt(r.deltaFy26)}</td>
                      <td style={{ textAlign: "right", padding: 4, color: "#f87171" }}>{r.deltaFy26Pct.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ fontSize: 11, color: "#4a6a50", marginTop: 12, lineHeight: 1.6 }}>
            <strong style={{ color: "#6a9a70" }}>Note:</strong> Districts appearing as "losers" are often those propped up by SFRA growth caps — they currently receive more than the SFRA formula says they should because aid can't drop more than 3%/year. A need-based formula without historical inertia redistributes those dollars to genuinely underfunded districts. Some results are affected by data quality issues (FRL underreporting under Community Eligibility Provision, income estimation errors).
          </div>
        </div>
      )}

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
                  <strong style={{ color: "#a89aca" }}>Methodology:</strong> Both custom and SFRA baseline are <em>uncapped</em> formula outputs (no growth caps). Try <strong style={{ color: "#22c55e" }}>Revenue Neutral</strong> mode to see how the same $11.4B would be redistributed.
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
          <p>• <strong style={{ color: "#d8b4fe" }}>Revenue Neutral</strong> mode auto-calibrates the base so total statewide custom aid equals total FY26 actual ($11.4B). Change the poverty exponent, IDF weight, or TBI weight to see how redistribution shifts — the base recalibrates to keep the total constant.</p>
          <p>• <strong style={{ color: "#d8b4fe" }}>Poverty Exponent {'>'} 1</strong> makes the formula progressive: districts with 80% poverty get disproportionately more than those at 40%.</p>
          <p>• <strong style={{ color: "#d8b4fe" }}>Tax Burden Index</strong> is capped at 0.5-2.0 due to income estimation data quality limitations. Some districts have unreliable income estimates that would otherwise produce extreme TBI values.</p>
          <p>• <strong style={{ color: "#d8b4fe" }}>Data Quality Caveat:</strong> Some high-poverty urban districts (Camden, East Orange) show lower FRL rates than expected because they use Community Eligibility Provision where all students get free lunch but individual FRL counts aren't reported. This affects the custom formula's poverty-based allocations.</p>
          <p>• <strong style={{ color: "#d8b4fe" }}>Categoricals</strong> (SpEd, Security, Transportation) use actual SFRA-allocated amounts — these are state-set pass-throughs not affected by the custom formula.</p>
        </div>
      </div>
    </div>
  );
}
