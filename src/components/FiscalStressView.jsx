import { useState, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell, ReferenceLine } from "recharts";
import { DISTRICTS } from '../data/districts.js';
import { scoreAllDistricts, scoreDistrict, LEVEL_COLORS, SEVERITY_COLORS } from '../engine/fiscal-stress.js';
import { fmt } from '../utils/format.js';
import Tip from './ui/Tip.jsx';
import DistrictSearch from './ui/DistrictSearch.jsx';

const SORT_OPTIONS = [
  { key: "totalScore", label: "Stress Score" },
  { key: "fbPctOfBudget", label: "Fund Balance" },
  { key: "adequacyGapPct", label: "Adequacy Gap" },
  { key: "esserPct", label: "ESSER Exposure" },
  { key: "eqTaxRate", label: "Tax Rate" },
];

const LEVEL_FILTERS = ["all", "severe", "elevated", "moderate", "low"];

const PAGE_SIZE = 25;

export default function FiscalStressView({ compared, addCompared, removeCompared, overrides }) {
  const [sortBy, setSortBy] = useState("totalScore");
  const [levelFilter, setLevelFilter] = useState("all");
  const [countyFilter, setCountyFilter] = useState("");
  const [page, setPage] = useState(0);

  // Score all districts once
  const allScored = useMemo(() => scoreAllDistricts(DISTRICTS, overrides), [overrides]);

  // Build county list
  const counties = useMemo(() => {
    const set = new Set(allScored.map(r => r.district.county));
    return [...set].sort();
  }, [allScored]);

  // Filter & sort
  const filtered = useMemo(() => {
    let list = allScored;
    if (levelFilter !== "all") list = list.filter(r => r.stress.level === levelFilter);
    if (countyFilter) list = list.filter(r => r.district.county === countyFilter);
    // Re-sort
    list = [...list].sort((a, b) => {
      if (sortBy === "totalScore") return b.stress.totalScore - a.stress.totalScore;
      if (sortBy === "aidChangePct") return a.stress.aidChangePct - b.stress.aidChangePct; // most negative first
      if (sortBy === "adequacyGapPct") return b.stress.adequacyGapPct - a.stress.adequacyGapPct;
      if (sortBy === "fbPctOfBudget") return a.stress.fbPctOfBudget - b.stress.fbPctOfBudget; // lowest first = most stressed
      if (sortBy === "esserPct") return b.stress.esserPct - a.stress.esserPct;
      if (sortBy === "eqTaxRate") return b.stress.eqTaxRate - a.stress.eqTaxRate;
      return 0;
    });
    return list;
  }, [allScored, levelFilter, countyFilter, sortBy]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Statewide summary stats
  const summary = useMemo(() => {
    const levels = { severe: 0, elevated: 0, moderate: 0, low: 0 };
    let totalScore = 0;
    allScored.forEach(r => { levels[r.stress.level]++; totalScore += r.stress.totalScore; });
    return { levels, avgScore: totalScore / allScored.length, total: allScored.length };
  }, [allScored]);

  // Compared districts detail
  const comparedResults = useMemo(() => {
    return compared.map(key => {
      const d = DISTRICTS[key];
      if (!d || !d.enr || !d.enr.total) return null;
      const stress = scoreDistrict(d, overrides, key);
      stress.key = key;
      return { key, district: d, stress };
    }).filter(Boolean);
  }, [compared, overrides]);

  // Detail districts (those with hand-coded fiscal stress history)
  const detailDistricts = comparedResults.filter(r => r.district.fiscalStress);

  // Districts with real fund balance data from fiscal-stress-generated.js
  const fbDistricts = comparedResults.filter(r => r.stress.fundBalance);

  // ── Universal chart data (works for ALL districts) ──
  // Indicator score comparison (grouped bar)
  const indicatorCompareData = useMemo(() => {
    if (comparedResults.length === 0) return null;
    return ["fund-balance", "spend-above", "esser-cliff", "tax-exhaustion"].map(id => {
      const labels = { "fund-balance": "Fund Bal.", "spend-above": "Over Adequacy", "esser-cliff": "ESSER Cliff", "tax-exhaustion": "Tax Capacity" };
      const row = { indicator: labels[id] };
      comparedResults.forEach(r => {
        const ind = r.stress.indicators.find(i => i.id === id);
        row[r.district.short || r.key] = ind ? ind.score : 0;
      });
      return row;
    });
  }, [comparedResults]);

  // Budget breakdown comparison (stacked bar)
  const budgetBreakdownData = useMemo(() => {
    if (comparedResults.length === 0) return null;
    return comparedResults.map(r => {
      const d = r.district;
      const u = d.ufb || {};
      const budget = u.totalBudget || d.budget || 1;
      return {
        name: d.short || d.name.split(" ")[0],
        "Local Tax Levy": (u.localTaxLevy || d.levy || 0) / 1e6,
        "State Aid": (u.stateAid || d.fy26 || 0) / 1e6,
        "Adequacy (SFRA)": r.stress.formula.adequacy / 1e6,
        budget: budget / 1e6,
        color: d.color,
      };
    });
  }, [comparedResults]);

  // EV trend (3 years, all districts have ev3yr)
  const evTrendData = useMemo(() => {
    if (comparedResults.length === 0) return null;
    return ["EV Yr 1", "EV Yr 2", "EV Yr 3"].map((yr, i) => {
      const row = { year: yr };
      comparedResults.forEach(r => {
        row[r.district.short || r.key] = (r.district.ev3yr[2 - i] || 0) / 1e9; // oldest first
      });
      return row;
    });
  }, [comparedResults]);

  // Fund balance trend (universal — from generated fiscal data)
  const fbTrendData = useMemo(() => {
    if (fbDistricts.length === 0) return null;
    // Get union of all years across compared districts
    const allYears = new Set();
    fbDistricts.forEach(r => {
      Object.keys(r.stress.fundBalance).forEach(y => allYears.add(Number(y)));
    });
    const years = [...allYears].sort();
    if (years.length < 2) return null;
    return years.map(yr => {
      const row = { year: `FY${String(yr).slice(2)}` };
      fbDistricts.forEach(r => {
        const bal = r.stress.fundBalance[yr] || 0;
        const budget = r.district.ufb?.totalBudget || r.district.budget || 1;
        row[r.district.short || r.key] = (bal / budget) * 100;
      });
      return row;
    });
  }, [fbDistricts]);

  // ESSER allocation breakdown (universal — from generated fiscal data)
  const esserData = useMemo(() => {
    const esserDistricts = comparedResults.filter(r => r.stress.esserAlloc?.total > 0);
    if (esserDistricts.length === 0) return null;
    return esserDistricts.map(r => ({
      name: r.district.short || r.district.name.split(" ")[0],
      "ESSER I": (r.stress.esserAlloc.i || 0) / 1e6,
      "ESSER II": (r.stress.esserAlloc.ii || 0) / 1e6,
      "ARP ESSER III": (r.stress.esserAlloc.iii || 0) / 1e6,
      color: r.district.color,
    }));
  }, [comparedResults]);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20, padding: 16, background: "linear-gradient(135deg, #1a1418, #141012)", borderRadius: 12, border: "1px solid #3a2028" }}>
        <div style={{ fontSize: 14, color: "#e88a8a", fontWeight: 600, marginBottom: 4 }}>
          <Tip term="FSI">Fiscal Stress</Tip> Dashboard — {allScored.length} Districts
        </div>
        <div style={{ fontSize: 12, color: "#9a7878", lineHeight: 1.6 }}>
          Identifies districts showing structural fiscal warning signs — not to blame administrators, but to reveal where the funding system itself forces impossible choices. Every district is scored on declining fund balance, spending above adequacy, ESSER cliff exposure, and tax capacity exhaustion. Uses real NJ DOE data including audited fund balances (FY18–FY26) and actual ESSER I/II/III allocations.
        </div>
      </div>

      {/* ── Statewide Summary ────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 140, padding: "14px 18px", background: "#1a1914", borderRadius: 10, border: "1px solid #2a2820" }}>
          <div style={{ fontSize: 11, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Avg Stress Score</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#e2e0d6", fontFamily: "'Instrument Serif', serif" }}>{summary.avgScore.toFixed(0)}</div>
          <div style={{ fontSize: 11, color: "#5a5848" }}>/ 100 across {summary.total} districts</div>
        </div>
        {Object.entries(summary.levels).map(([level, count]) => (
          <div key={level} style={{ flex: 1, minWidth: 120, padding: "14px 18px", background: "#1a1914", borderRadius: 10, border: `1px solid ${LEVEL_COLORS[level]}25` }}>
            <div style={{ fontSize: 11, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{level}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: LEVEL_COLORS[level], fontFamily: "'Instrument Serif', serif" }}>{count}</div>
            <div style={{ fontSize: 11, color: "#5a5848" }}>{((count / summary.total) * 100).toFixed(0)}% of districts</div>
          </div>
        ))}
      </div>

      {/* ── Compared District Cards ──────────────────────── */}
      {comparedResults.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em" }}>Comparing:</span>
            {comparedResults.map(r => {
              const d = r.district;
              return (
                <span key={r.key} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "4px 10px", borderRadius: 20, fontSize: 12,
                  background: `${d.color}20`, border: `1px solid ${d.color}40`,
                  color: d.color, fontWeight: 600,
                }}>
                  {d.short || d.name.slice(0, 4)}
                  <span onClick={() => removeCompared(r.key)} style={{ cursor: "pointer", opacity: 0.6, fontWeight: 400, marginLeft: 2 }} title="Remove">x</span>
                </span>
              );
            })}
            {compared.length < 8 && (
              <div style={{ flex: 1, maxWidth: 300 }}>
                <DistrictSearch onSelect={key => { if (!compared.includes(key)) addCompared(key); }} placeholder="+ Add district..." />
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            {comparedResults.map(r => {
              const lc = LEVEL_COLORS[r.stress.level];
              const d = r.district;
              return (
                <div key={r.key} style={{
                  flex: 1, minWidth: 200, padding: 16, background: "#1a1914",
                  borderRadius: 12, border: `1px solid ${lc}30`, borderTop: `3px solid ${lc}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: d.color, fontFamily: "'Instrument Serif', serif" }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: "#6a6758", marginTop: 2 }}>{d.county} Co. · {d.type}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 26, fontWeight: 700, color: lc, fontFamily: "'Instrument Serif', serif" }}>{r.stress.totalScore}</div>
                      <div style={{ fontSize: 10, color: "#6a6758" }}>/ 100</div>
                    </div>
                  </div>
                  <div style={{
                    display: "inline-block", marginTop: 6, padding: "2px 8px",
                    borderRadius: 20, fontSize: 10, fontWeight: 600,
                    background: `${lc}18`, color: lc, textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>
                    {r.stress.level} stress
                  </div>
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                    {r.stress.indicators.map(ind => (
                      <div key={ind.id}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#8a8778", marginBottom: 2 }}>
                          <span>{ind.label}</span>
                          <span style={{ color: SEVERITY_COLORS[ind.severity], fontWeight: 600 }}>{ind.score}/{ind.max}</span>
                        </div>
                        <div style={{ height: 3, background: "#2a2820", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{
                            width: `${(ind.score / ind.max) * 100}%`, height: "100%",
                            background: SEVERITY_COLORS[ind.severity], borderRadius: 2,
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Charts (for ALL compared districts) ── */}
      {comparedResults.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          {/* Indicator Score Comparison */}
          {indicatorCompareData && (
            <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
              <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                Stress Indicator Breakdown
              </div>
              <div style={{ fontSize: 11, color: "#5a5848", marginBottom: 12 }}>Score per indicator (0–25 each)</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={indicatorCompareData} margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
                  <XAxis dataKey="indicator" tick={{ fill: "#6a6758", fontSize: 10 }} axisLine={false} interval={0} />
                  <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 25]} />
                  <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 12 }}
                    formatter={v => `${v}/25`} />
                  {comparedResults.map(r => (
                    <Bar key={r.key} dataKey={r.district.short || r.key} fill={r.district.color} opacity={0.8} name={r.district.name} />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Budget vs Adequacy + Revenue Sources */}
          {budgetBreakdownData && (
            <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
              <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                Revenue Sources vs Adequacy ($M)
              </div>
              <div style={{ fontSize: 11, color: "#5a5848", marginBottom: 12 }}>Local levy + state aid vs SFRA adequacy budget</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={budgetBreakdownData} margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
                  <XAxis dataKey="name" tick={{ fill: "#6a6758", fontSize: 10 }} axisLine={false} />
                  <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 12 }}
                    formatter={v => `$${v.toFixed(1)}M`} />
                  <Bar dataKey="Local Tax Levy" fill="#3b82f6" stackId="rev" opacity={0.8} />
                  <Bar dataKey="State Aid" fill="#8b5cf6" stackId="rev" opacity={0.8} />
                  <Bar dataKey="Adequacy (SFRA)" fill="#ef444440" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 2" />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Equalized Value Trend (3 years) */}
          {evTrendData && (
            <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
              <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                Equalized Valuation Trend ($B)
              </div>
              <div style={{ fontSize: 11, color: "#5a5848", marginBottom: 12 }}>3-year property value trajectory — flat or declining = eroding tax base</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={evTrendData} margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
                  <XAxis dataKey="year" tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 12 }}
                    formatter={v => `$${v.toFixed(2)}B`} />
                  {comparedResults.map(r => (
                    <Line key={r.key} type="monotone" dataKey={r.district.short || r.key} stroke={r.district.color}
                      strokeWidth={2} dot={{ r: 3, fill: r.district.color }} name={r.district.name} />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* FY25→FY26 Aid Change Comparison */}
          <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
            <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              State Aid Change FY25 → FY26
            </div>
            <div style={{ fontSize: 11, color: "#5a5848", marginBottom: 12 }}>Year-over-year state aid trajectory</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={comparedResults.map(r => ({
                name: r.district.short || r.district.name.split(" ")[0],
                change: r.stress.aidChangePct,
                color: r.district.color,
              }))} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
                <XAxis dataKey="name" tick={{ fill: "#6a6758", fontSize: 10 }} axisLine={false} />
                <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 12 }}
                  formatter={v => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`} />
                <ReferenceLine y={0} stroke="#6a6758" strokeDasharray="4 4" />
                <Bar dataKey="change" name="Aid Change %">
                  {comparedResults.map(r => (
                    <Cell key={r.key} fill={r.stress.aidChangePct < 0 ? "#ef4444" : "#22c55e"} opacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Fund Balance Trend (universal — from NJ DOE UFB data) */}
          {fbTrendData && (
            <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
              <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                Fund Balance as % of Budget
              </div>
              <div style={{ fontSize: 11, color: "#5a5848", marginBottom: 12 }}>Unrestricted surplus FY18–FY26 — declining reserves signal structural deficit</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={fbTrendData} margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
                  <XAxis dataKey="year" tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 12 }}
                    formatter={v => `${v.toFixed(1)}%`} />
                  <ReferenceLine y={2} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "2% min", fill: "#ef4444", fontSize: 10, position: "right" }} />
                  {fbDistricts.map(r => (
                    <Line key={r.key} type="monotone" dataKey={r.district.short || r.key} stroke={r.district.color}
                      strokeWidth={2} dot={{ r: 3, fill: r.district.color }} name={r.district.name} />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ESSER Allocation Breakdown (universal — from NJ DOE data) */}
          {esserData && (
            <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
              <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                <Tip term="ESSER">ESSER</Tip> Allocations ($M)
              </div>
              <div style={{ fontSize: 11, color: "#5a5848", marginBottom: 12 }}>Total federal relief allocation — now expired, creating fiscal cliff</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={esserData} margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
                  <XAxis dataKey="name" tick={{ fill: "#6a6758", fontSize: 10 }} axisLine={false} />
                  <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 12 }}
                    formatter={v => `$${v.toFixed(2)}M`} />
                  <Bar dataKey="ESSER I" fill="#60a5fa" stackId="esser" opacity={0.8} />
                  <Bar dataKey="ESSER II" fill="#818cf8" stackId="esser" opacity={0.8} />
                  <Bar dataKey="ARP ESSER III" fill="#c084fc" stackId="esser" opacity={0.8} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Statewide Ranking Table ──────────────────────── */}
      <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Statewide Fiscal Stress Ranking
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {/* Level filter pills */}
            {LEVEL_FILTERS.map(lf => (
              <button key={lf} onClick={() => { setLevelFilter(lf); setPage(0); }} style={{
                padding: "4px 10px", borderRadius: 20, border: "none", fontSize: 11, fontWeight: 600,
                background: levelFilter === lf ? (lf === "all" ? "#4a4838" : `${LEVEL_COLORS[lf]}30`) : "transparent",
                color: levelFilter === lf ? (lf === "all" ? "#e2e0d6" : LEVEL_COLORS[lf]) : "#6a6758",
                cursor: "pointer", textTransform: "capitalize",
              }}>{lf === "all" ? `All (${allScored.length})` : `${lf} (${summary.levels[lf]})`}</button>
            ))}
            <span style={{ color: "#2a2820" }}>|</span>
            {/* County filter */}
            <select value={countyFilter} onChange={e => { setCountyFilter(e.target.value); setPage(0); }} style={{
              padding: "4px 8px", borderRadius: 6, border: "1px solid #2a2820",
              background: "#12110e", color: "#8a8778", fontSize: 11, cursor: "pointer",
            }}>
              <option value="">All Counties</option>
              {counties.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {/* Sort */}
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
              padding: "4px 8px", borderRadius: 6, border: "1px solid #2a2820",
              background: "#12110e", color: "#8a8778", fontSize: 11, cursor: "pointer",
            }}>
              {SORT_OPTIONS.map(s => <option key={s.key} value={s.key}>Sort: {s.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#5a5848", marginBottom: 10 }}>
          {filtered.length} districts · Page {page + 1} of {pageCount} · Click row to add to comparison
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #2a2820" }}>
                <th style={{ textAlign: "left", padding: "6px 8px", color: "#6a6758", fontWeight: 500, width: 30 }}>#</th>
                <th style={{ textAlign: "left", padding: "6px 8px", color: "#6a6758", fontWeight: 500 }}>District</th>
                <th style={{ textAlign: "left", padding: "6px 8px", color: "#6a6758", fontWeight: 500 }}>County</th>
                <th style={{ textAlign: "center", padding: "6px 8px", color: "#6a6758", fontWeight: 500 }}>Score</th>
                <th style={{ textAlign: "center", padding: "6px 8px", color: "#6a6758", fontWeight: 500 }}>Level</th>
                <th style={{ textAlign: "right", padding: "6px 8px", color: "#6a6758", fontWeight: 500 }}>Fund Bal</th>
                <th style={{ textAlign: "right", padding: "6px 8px", color: "#6a6758", fontWeight: 500 }}>Adeq. Gap</th>
                <th style={{ textAlign: "right", padding: "6px 8px", color: "#6a6758", fontWeight: 500 }}>ESSER</th>
                <th style={{ textAlign: "right", padding: "6px 8px", color: "#6a6758", fontWeight: 500 }}>Tax Rate</th>
              </tr>
            </thead>
            <tbody>
              {pageData.map((r, i) => {
                const s = r.stress;
                const d = r.district;
                const rank = page * PAGE_SIZE + i + 1;
                const isCompared = compared.includes(r.key);
                return (
                  <tr key={r.key}
                    onClick={() => { if (!isCompared && compared.length < 8) addCompared(r.key); }}
                    style={{
                      borderBottom: "1px solid #1f1e18",
                      cursor: isCompared ? "default" : "pointer",
                      background: isCompared ? `${d.color}08` : "transparent",
                    }}
                    onMouseEnter={e => { if (!isCompared) e.currentTarget.style.background = "#1f1e18"; }}
                    onMouseLeave={e => { if (!isCompared) e.currentTarget.style.background = "transparent"; else e.currentTarget.style.background = `${d.color}08`; }}
                  >
                    <td style={{ padding: "6px 8px", color: "#5a5848", fontSize: 11 }}>{rank}</td>
                    <td style={{ padding: "6px 8px", color: isCompared ? d.color : "#e2e0d6", fontWeight: isCompared ? 600 : 400 }}>
                      {d.name}
                      {isCompared && <span style={{ marginLeft: 4, fontSize: 9, color: d.color, opacity: 0.6 }}>comparing</span>}
                    </td>
                    <td style={{ padding: "6px 8px", color: "#8a8778", fontSize: 11 }}>{d.county}</td>
                    <td style={{ textAlign: "center", padding: "6px 8px" }}>
                      <span style={{ fontWeight: 700, color: LEVEL_COLORS[s.level] }}>{s.totalScore}</span>
                    </td>
                    <td style={{ textAlign: "center", padding: "6px 8px" }}>
                      <span style={{
                        display: "inline-block", padding: "1px 6px", borderRadius: 10,
                        fontSize: 10, fontWeight: 600, textTransform: "capitalize",
                        background: `${LEVEL_COLORS[s.level]}18`, color: LEVEL_COLORS[s.level],
                      }}>{s.level}</span>
                    </td>
                    <td style={{ textAlign: "right", padding: "6px 8px", color: s.fbPctOfBudget < 2 ? "#ef4444" : s.fbPctOfBudget < 4 ? "#f59e0b" : "#22c55e", fontSize: 11 }}>
                      {s.fbPctOfBudget.toFixed(1)}%
                    </td>
                    <td style={{ textAlign: "right", padding: "6px 8px", color: s.adequacyGapPct > 0 ? "#f59e0b" : "#22c55e", fontSize: 11 }}>
                      {s.adequacyGapPct > 0 ? "+" : ""}{s.adequacyGapPct.toFixed(1)}%
                    </td>
                    <td style={{ textAlign: "right", padding: "6px 8px", color: s.esserPct > 5 ? "#ef4444" : s.esserPct > 2 ? "#f59e0b" : "#8a8778", fontSize: 11 }}>
                      {s.esserPct > 0 ? `${s.esserPct.toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ textAlign: "right", padding: "6px 8px", color: s.eqTaxRate > 1.5 ? "#ef4444" : s.eqTaxRate > 1.0 ? "#f59e0b" : "#8a8778", fontSize: 11 }}>
                      {s.eqTaxRate.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pageCount > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 12 }}>
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
              style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #2a2820", background: "#12110e", color: page === 0 ? "#3a3830" : "#8a8778", fontSize: 11, cursor: page === 0 ? "default" : "pointer" }}>
              Prev
            </button>
            {Array.from({ length: Math.min(pageCount, 7) }, (_, i) => {
              let p;
              if (pageCount <= 7) p = i;
              else if (page < 3) p = i;
              else if (page > pageCount - 4) p = pageCount - 7 + i;
              else p = page - 3 + i;
              return (
                <button key={p} onClick={() => setPage(p)} style={{
                  padding: "4px 8px", borderRadius: 6, border: "1px solid #2a2820",
                  background: p === page ? "#4a4838" : "#12110e",
                  color: p === page ? "#e2e0d6" : "#6a6758",
                  fontSize: 11, cursor: "pointer", minWidth: 28,
                }}>{p + 1}</button>
              );
            })}
            <button onClick={() => setPage(Math.min(pageCount - 1, page + 1))} disabled={page >= pageCount - 1}
              style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #2a2820", background: "#12110e", color: page >= pageCount - 1 ? "#3a3830" : "#8a8778", fontSize: 11, cursor: page >= pageCount - 1 ? "default" : "pointer" }}>
              Next
            </button>
          </div>
        )}
      </div>

      {/* ── Comparison Detail Table ──────────────────────── */}
      {comparedResults.length > 0 && (
        <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820", marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Indicator Detail — Compared Districts
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #2a2820" }}>
                  <th style={{ textAlign: "left", padding: 8, color: "#6a6758", fontWeight: 500 }}>Metric</th>
                  {comparedResults.map(r => <th key={r.key} style={{ textAlign: "right", padding: 8, color: r.district.color, fontWeight: 600 }}>{r.district.short || r.district.name.slice(0, 4)}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Composite Stress Score", fn: r => <span style={{ color: LEVEL_COLORS[r.stress.level], fontWeight: 700 }}>{r.stress.totalScore} / 100</span> },
                  { label: "Stress Level", fn: r => <span style={{ color: LEVEL_COLORS[r.stress.level], fontWeight: 600, textTransform: "capitalize" }}>{r.stress.level}</span> },
                  { label: "sep" },
                  ...["fund-balance", "spend-above", "esser-cliff", "tax-exhaustion"].map(id => ({
                    label: null, id,
                    fn: r => {
                      const ind = r.stress.indicators.find(i => i.id === id);
                      if (!ind) return "—";
                      return (
                        <div style={{ textAlign: "right" }}>
                          <span style={{ color: SEVERITY_COLORS[ind.severity], fontWeight: 600 }}>{ind.score}/{ind.max}</span>
                          <div style={{ fontSize: 10, color: "#6a6758", marginTop: 2 }}>{ind.metric}</div>
                        </div>
                      );
                    },
                    getLabel: () => {
                      const labels = { "fund-balance": "Declining Fund Balance", "spend-above": "Spending Above Adequacy", "esser-cliff": "ESSER Cliff Exposure", "tax-exhaustion": "Tax Capacity Exhaustion" };
                      return labels[id];
                    },
                  })),
                  { label: "sep" },
                  { label: "FY26 State Aid", fn: r => fmt(r.district.fy26) },
                  { label: "FY25→FY26 Aid Change", fn: r => {
                    const chg = r.district.fy25 > 0 ? ((r.district.fy26 - r.district.fy25) / r.district.fy25) * 100 : 0;
                    return <span style={{ color: chg < 0 ? "#ef4444" : "#22c55e" }}>{chg >= 0 ? "+" : ""}{chg.toFixed(1)}%</span>;
                  }},
                  { label: "Budget", fn: r => fmt(r.district.ufb?.totalBudget || r.district.budget) },
                  { label: "SFRA Adequacy", fn: r => fmt(r.stress.formula.adequacy) },
                  { label: "Total ESSER", fn: r => r.stress.esserAlloc?.total > 0 ? fmt(r.stress.esserAlloc.total) : '—' },
                  { label: "ESSER % of Budget (annual)", fn: r => r.stress.esserPct > 0 ? `${r.stress.esserPct.toFixed(1)}%` : '—' },
                  { label: "Fund Balance % of Budget", fn: r => `${r.stress.fbPctOfBudget.toFixed(1)}%` },
                  { label: "Eq. Tax Rate", fn: r => `${r.stress.eqTaxRate.toFixed(3)}%` },
                  { label: "Enrollment", fn: r => r.district.enr.total.toLocaleString() },
                  { label: "At-Risk %", fn: r => `${(r.district.atRiskPct * 100).toFixed(1)}%` },
                ].map((row, i) => {
                  if (row.label === "sep") return <tr key={i}><td colSpan={comparedResults.length + 1} style={{ height: 4, background: "#1f1e18" }}></td></tr>;
                  const label = row.getLabel ? row.getLabel() : row.label;
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid #1f1e18" }}>
                      <td style={{ padding: "7px 10px", color: "#8a8778" }}>{label}</td>
                      {comparedResults.map(r => <td key={r.key} style={{ textAlign: "right", padding: "7px 10px", color: "#e2e0d6" }}>{row.fn(r)}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
            <li>Health benefit costs rise 8–10% per year while state aid caps limit increases to 2–3%</li>
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
