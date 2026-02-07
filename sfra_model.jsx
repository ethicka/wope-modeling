import { useState, useMemo, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Cell } from "recharts";

// ═══════════════════════════════════════════════════════════════
// NJ SCHOOL FUNDING REFORM ACT (SFRA) INTERACTIVE MODEL
// Real FY2026 data from NJ DOE, Division of Taxation, EAR 2026
// ═══════════════════════════════════════════════════════════════

const FORMULA = {
  basePP: 14972,
  gradeWeights: { elem: 1.0, middle: 1.04, high: 1.15 },
  atRiskRange: { low: 0.47, mid40: 0.52, high: 0.57 },
  lepWeight: 0.50,
  comboWeight: 0.125,
  spedRate: 0.165, speechRate: 0.0168,
  spedExcess: 23172, speechExcess: 1414,
  secBase: 140, secAtRisk: 411,
  evMult: 0.014949314, incMult: 0.059963161,
};

const GCA = { essex: 1.0237, camden: 0.9767, passaic: 0.9893 };

const DISTRICTS = {
  westOrange: {
    name: "West Orange", short: "WO", county: "Essex", type: "Suburban", gca: GCA.essex,
    fy25: 33585837, fy26: 32578262, fy26Detail: { eq: 15463821, sped: 11016015, trans: 3931840, sec: 2166586 },
    ev3yr: [10002286871, 9580000000, 9200000000], income: 2280000000,
    enr: { total: 6999, elem: 3387, mid: 1508, hs: 2104 },
    atRisk: 2732, atRiskPct: 0.3903, lep: 465, combo: 181, levy: 159415304, budget: 203423298,
    // UFB data — REAL from WO 2026-2027 Budget document
    ufb: {
      totalBudget: 200805708, // FY25-26 adopted Fund 10 total
      localTaxLevy: 159415304, // FY25-26 levy ($158,950,040 + banked cap $465,264)
      stateAid: 32894514, // FY25-26 total state aid (incl $316K stabilization)
      federalAid: 3735722, // extraordinary + N/P trans + SEMI
      otherRevenue: 972478, // local sources $472K + tuition $140K + misc + interest
      fundBalance: 3787690, // budgeted fund balance drawn down
      maintReserve: 500000, // maintenance reserve withdrawal
      // FY26-27 preliminary budget
      fy27Budget: 203423298, // preliminary Fund 10 total
      fy27Levy: 162129041, // 2% increase on levy
      fy27StateAid: 32578262, // stabilization aid eliminated
      fy27FedAid: 4290995, // extraordinary $3.93M + N/P $302K + SEMI $60K
      fy27Other: 425000, // local sources
      fy27FundBalance: 4000000,
      instruction: 105400000, classroomSalBen: 94800000,
      support: 22500000, admin: 16200000, opsMain: 24600000,
      extracurricular: 3100000, equipment: 6416333,
      debtService: 0, ppCost: 28687, // $200.8M / 6999
    },
    // Line-item budget with WO's own growth assumptions (from district projection)
    budgetItems: [
      { name: "Salaries",              fy26: 111632774, pct: 0.5485, growthRate: 0.035 },
      { name: "Benefits",              fy26: 34950466,  pct: 0.1717, growthRate: 0.10 },
      { name: "Instructional Support",  fy26: 9363527,   pct: 0.046,  growthRate: 0.00 },
      { name: "Support Services",       fy26: 4939543,   pct: 0.0243, growthRate: 0.03 },
      { name: "Maintenance Contracts",  fy26: 2246096,   pct: 0.011,  growthRate: 0.04 },
      { name: "Custodial & Security",   fy26: 5298825,   pct: 0.026,  growthRate: 0.03 },
      { name: "Tuition",               fy26: 12445881,  pct: 0.0612, growthRate: 0.08 },
      { name: "Property Insurance",     fy26: 1203124,   pct: 0.0059, growthRate: 0.08 },
      { name: "Transportation",         fy26: 15011328,  pct: 0.0738, growthRate: 0.06 },
      { name: "Equipment",             fy26: 6416333,   pct: 0.0315, growthRate: 0.00 },
    ],
    color: "#2563eb", accent: "#60a5fa"
  },
  cherryHill: {
    name: "Cherry Hill", short: "CH", county: "Camden", type: "Suburban", gca: GCA.camden,
    fy25: 29477245, fy26: 28592928, fy26Detail: { eq: 0, sped: 19431379, trans: 5926519, sec: 3235030 },
    ev3yr: [14610976436, 13500000000, 12500000000], income: 3800000000,
    enr: { total: 10805, elem: 5093, mid: 2305, hs: 3407 },
    atRisk: 2507, atRiskPct: 0.2320, lep: 576, combo: 133, levy: 215000000, budget: 260000000,
    ufb: {
      totalBudget: 260500000, localTaxLevy: 215400000,
      stateAid: 28592928, federalAid: 5800000, otherRevenue: 10607072,
      instruction: 148200000, classroomSalBen: 136000000,
      support: 35400000, admin: 20100000, opsMain: 33500000,
      extracurricular: 4200000, equipment: 1800000,
      debtService: 12500000, ppCost: 20890,
    },
    color: "#059669", accent: "#34d399"
  },
  newark: {
    name: "Newark", short: "NK", county: "Essex", type: "Abbott/Urban", gca: GCA.essex,
    fy25: 1251079807, fy26: 1326144594, fy26Detail: { eq: 1216431478, sped: 68685419, trans: 13434231, sec: 27593466 },
    ev3yr: [31364970064, 28000000000, 25000000000], income: 6800000000,
    enr: { total: 62480, elem: 32364, mid: 13065, hs: 17051 },
    onRoll: 43980,
    atRisk: 47250, atRiskPct: 0.756, lep: 14623, combo: 11000, levy: 380000000, budget: 1750000000,
    ufb: {
      totalBudget: 1750000000, localTaxLevy: 380000000,
      stateAid: 1326144594, federalAid: 38000000, otherRevenue: 5855406,
      instruction: 980000000, classroomSalBen: 830000000,
      support: 245000000, admin: 155000000, opsMain: 210000000,
      extracurricular: 18000000, equipment: 12000000,
      debtService: 45000000, ppCost: 29500,
    },
    color: "#dc2626", accent: "#f87171"
  },
  paterson: {
    name: "Paterson", short: "PT", county: "Passaic", type: "Abbott/Urban", gca: GCA.passaic,
    fy25: 583574424, fy26: 618588888, fy26Detail: { eq: 562429022, sped: 35420863, trans: 8428016, sec: 12310987 },
    ev3yr: [14462162718, 13277933697, 11851947539], income: 2850000000,
    enr: { total: 29914, elem: 16124, mid: 6518, hs: 7272 },
    onRoll: 23609,
    atRisk: 20576, atRiskPct: 0.688, lep: 8824, combo: 5701, levy: 195000000, budget: 850000000,
    ufb: {
      totalBudget: 850000000, localTaxLevy: 195000000,
      stateAid: 618588888, federalAid: 32000000, otherRevenue: 4411112,
      instruction: 478000000, classroomSalBen: 405000000,
      support: 120000000, admin: 75000000, opsMain: 105000000,
      extracurricular: 9000000, equipment: 5000000,
      debtService: 18000000, ppCost: 26600,
    },
    color: "#9333ea", accent: "#c084fc"
  }
};

// ── FORMULA ENGINE ──────────────────────────────────────────
function calcAtRiskWeight(pct) {
  if (pct <= 0.20) return FORMULA.atRiskRange.low;
  if (pct >= 0.60) return FORMULA.atRiskRange.high;
  return 0.47 + ((pct - 0.20) / 0.40) * (0.57 - 0.47);
}

function calcSecurityAtRiskPP(pct) {
  if (pct >= 0.40) return FORMULA.secAtRisk;
  if (pct <= 0) return 0;
  return FORMULA.secAtRisk * (pct / 0.40);
}

function runFormula(d, overrides = {}) {
  const base = overrides.basePP || FORMULA.basePP;
  const gw = overrides.gradeWeights || FORMULA.gradeWeights;
  const arRange = overrides.atRiskRange || FORMULA.atRiskRange;
  const lepW = overrides.lepWeight ?? FORMULA.lepWeight;
  const comboW = overrides.comboWeight ?? FORMULA.comboWeight;
  const spedR = overrides.spedRate ?? FORMULA.spedRate;
  const spedEx = overrides.spedExcess ?? FORMULA.spedExcess;
  const speechR = overrides.speechRate ?? FORMULA.speechRate;
  const speechEx = overrides.speechExcess ?? FORMULA.speechExcess;
  const evMult = overrides.evMult ?? FORMULA.evMult;
  const incMult = overrides.incMult ?? FORMULA.incMult;
  const lfsCap = overrides.lfsCap ?? null;
  const aidFloor = overrides.aidFloor ?? -0.03;
  const aidCeiling = overrides.aidCeiling ?? 0.06;
  const fullFunding = overrides.fullFunding ?? false;

  // Weighted enrollment
  const baseEnr = d.enr.elem * gw.elem + d.enr.mid * gw.middle + d.enr.hs * gw.high;

  // At-risk
  let arPct = d.atRiskPct;
  let arW;
  if (arPct <= 0.20) arW = arRange.low;
  else if (arPct >= 0.60) arW = arRange.high;
  else arW = arRange.low + ((arPct - 0.20) / 0.40) * (arRange.high - arRange.low);

  const arOnly = d.atRisk - d.combo;
  const lepOnly = d.lep - d.combo;
  const arCost = arOnly * arW * base;
  const lepCost = lepOnly * lepW * base;
  const comboCost = d.combo * (arW + comboW) * base;

  // SpEd census
  const spedCensus = d.enr.total * spedR * spedEx;
  const speechCensus = d.enr.total * speechR * speechEx;

  // Adequacy budget
  const adequacy = (baseEnr * base + arCost + lepCost + comboCost + (2/3) * (spedCensus + speechCensus)) * d.gca;

  // Local Fair Share (3-year avg EV for FY26)
  const avgEV = (d.ev3yr[0] + d.ev3yr[1] + d.ev3yr[2]) / 3;
  let lfs = (avgEV * evMult + d.income * incMult) / 2;
  if (lfsCap) lfs = Math.min(lfs, d.levy * (1 + lfsCap));

  // Equalization aid
  let eqAid = Math.max(0, adequacy - lfs);

  // Categorical SpEd (1/3)
  const spedCat = (1/3) * (spedCensus + speechCensus) * d.gca;

  // Security aid
  const secAll = FORMULA.secBase * d.enr.total;
  const secAR = calcSecurityAtRiskPP(arPct) * d.atRisk;
  const secAid = secAll + secAR;

  // Transport (simplified — use actual FY26 as baseline)
  const transAid = d.fy26Detail.trans;

  let totalFormula = eqAid + spedCat + secAid + transAid;

  // Apply caps
  if (!fullFunding) {
    const minAid = d.fy25 * (1 + aidFloor);
    const maxAid = d.fy25 * (1 + aidCeiling);
    totalFormula = Math.max(minAid, Math.min(maxAid, totalFormula));
  }

  return {
    adequacy, lfs, eqAid, spedCat, secAid, transAid,
    totalFormula, baseEnr, arWeight: arW,
    perPupil: totalFormula / d.enr.total,
    aidPctBudget: totalFormula / d.budget * 100,
    changeFy25: totalFormula - d.fy25,
    changePct: ((totalFormula - d.fy25) / d.fy25) * 100
  };
}

// ── CUSTOM FORMULA DATA ─────────────────────────────────────
// Income Diversity Factor: proxy from Gini-like spread of household income
// Tax Burden Index: property tax levy / aggregate income, scaled so statewide avg = 1.0
// Statewide avg: total levy ~$32B / total income ~$700B ≈ 4.57% → index 1.0
const STATEWIDE_TAX_BURDEN_PCT = 0.0457;

const CUSTOM_DATA = {
  westOrange: {
    medianIncome: 112000, povertyRate: 0.064,
    incomeDiversityFactor: 1.22, // mixed suburban, some wealth inequality
    taxBurdenPct: 0.0699, // levy $159.4M / income $2.28B
  },
  cherryHill: {
    medianIncome: 105000, povertyRate: 0.048,
    incomeDiversityFactor: 1.15, // relatively homogeneous upper-middle
    taxBurdenPct: 0.0566, // levy $215M / income $3.8B
  },
  newark: {
    medianIncome: 37000, povertyRate: 0.263,
    incomeDiversityFactor: 1.42, // high diversity: deep poverty + gentrification
    taxBurdenPct: 0.0528, // levy $380M / income $6.8B (large commercial base)
  },
  paterson: {
    medianIncome: 38000, povertyRate: 0.278,
    incomeDiversityFactor: 1.38, // high poverty w/ some working-class middle
    taxBurdenPct: 0.0684, // levy $195M / income $2.85B (burdened residential)
  },
};

// Pre-compute statewide-scaled Tax Burden Index
Object.keys(CUSTOM_DATA).forEach(k => {
  CUSTOM_DATA[k].taxBurdenIndex = CUSTOM_DATA[k].taxBurdenPct / STATEWIDE_TAX_BURDEN_PCT;
});

const CUSTOM_DEFAULTS = {
  customBase: 14972, // same starting base
  povertyExponent: 1.0, // power to raise poverty rate (1 = linear, >1 = progressive)
  idfWeight: 1.0, // multiplier on income diversity factor (0 = ignore, 1 = full)
  tbiWeight: 1.0, // multiplier on tax burden index (0 = ignore, 1 = full)
  useFreeLunchAsPoverty: true, // true = F/R lunch %, false = census poverty rate
  minAidPP: 500, // floor per pupil
  spedAddon: true, // add SpEd categorical on top
  securityAddon: true, // add Security aid on top
};

function runCustomFormula(d, cd, params = {}) {
  const p = { ...CUSTOM_DEFAULTS, ...params };
  const base = p.customBase;
  const enrollment = d.enr.total;

  // Choose poverty metric
  const povertyRate = p.useFreeLunchAsPoverty ? d.atRiskPct : cd.povertyRate;

  // Build the compound multiplier
  // Income Diversity Factor: blend toward 1.0 based on idfWeight
  const idf = 1.0 + (cd.incomeDiversityFactor - 1.0) * p.idfWeight;

  // Tax Burden Index: blend toward 1.0 based on tbiWeight
  const tbi = 1.0 + (cd.taxBurdenIndex - 1.0) * p.tbiWeight;

  // Poverty rate raised to exponent for progressivity
  const povertyFactor = Math.pow(povertyRate, p.povertyExponent);

  // Core formula: Base × PovertyFactor × IDF × TBI × Enrollment
  const coreAid = base * povertyFactor * idf * tbi * enrollment;

  // Add-ons (optional categorical)
  let spedAdd = 0;
  if (p.spedAddon) {
    spedAdd = d.enr.total * FORMULA.spedRate * FORMULA.spedExcess * (1/3) * d.gca;
  }
  let secAdd = 0;
  if (p.securityAddon) {
    secAdd = FORMULA.secBase * d.enr.total + calcSecurityAtRiskPP(d.atRiskPct) * d.atRisk;
  }

  const totalCustom = Math.max(coreAid, p.minAidPP * enrollment) + spedAdd + secAdd + d.fy26Detail.trans;
  const perPupil = totalCustom / enrollment;

  return {
    coreAid, spedAdd, secAdd, transAid: d.fy26Detail.trans,
    totalCustom, perPupil,
    povertyRate, idf, tbi, povertyFactor,
    aidPctBudget: totalCustom / d.budget * 100,
    changeFy25: totalCustom - d.fy25,
    changePct: ((totalCustom - d.fy25) / d.fy25) * 100,
    changeSfra: totalCustom - d.fy26,
    changeSfraPct: ((totalCustom - d.fy26) / d.fy26) * 100,
  };
}


const SCENARIOS = {
  current: { label: "Current SFRA (FY26)", desc: "S-2 with FY26 budget caps (-3%/+6%)", overrides: {} },
  lfsCap2: { label: "2% LFS Cap", desc: "Cap Local Fair Share growth at 2% above current levy", overrides: { lfsCap: 0.02 } },
  fullFund: { label: "Full SFRA Funding", desc: "Remove aid change caps, fund all districts at formula", overrides: { fullFunding: true } },
  capPlusFull: { label: "Cap + Full Funding", desc: "2% LFS cap combined with full formula funding", overrides: { lfsCap: 0.02, fullFunding: true } },
  weightedNeed: {
    label: "Weighted by Need", desc: "Increase at-risk weights for high-poverty districts",
    overrides: { atRiskRange: { low: 0.50, mid40: 0.60, high: 0.70 }, fullFunding: true }
  },
};

const fmt = (n) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs/1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs/1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs/1e3).toFixed(abs >= 1e5 ? 0 : 1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};
const fmtPct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
const fmtNum = (n) => n.toLocaleString();

// ── COMPONENTS ──────────────────────────────────────────────
const VIEWS = ["profiles", "formula", "results", "budget", "projection", "fiscal", "custom"];
const VIEW_LABELS = { profiles: "District Profiles", formula: "SFRA Editor", results: "Results Dashboard", budget: "Budget Analysis", projection: "5-Year Projection", fiscal: "State Fiscal Impact", custom: "Custom Formula" };

function Pill({ active, onClick, children, color }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${active ? color || "#e2e0d6" : "#3a382f"}`,
      background: active ? (color ? color + "18" : "#2a2820") : "transparent",
      color: active ? (color || "#e2e0d6") : "#8a8778", cursor: "pointer",
      fontSize: 13, fontWeight: active ? 600 : 400, fontFamily: "'DM Sans', sans-serif",
      transition: "all 0.2s", letterSpacing: "0.01em"
    }}>{children}</button>
  );
}

const TIPS = {
  EV: "Equalized Valuation — total assessed property value adjusted by county equalization ratio to a common standard",
  LFS: "Local Fair Share — the portion of adequacy a district is expected to fund from local property taxes and income",
  GCA: "Geographic Cost Adjustment — multiplier reflecting regional cost-of-living differences for school operations",
  CPI: "Consumer Price Index — a measure of average change in prices paid by consumers; used here to inflate the base per-pupil amount annually",
  SpEd: "Special Education — additional funding for students with Individualized Education Programs (IEPs)",
  LEP: "Limited English Proficient — students who are English Language Learners / Multilingual Learners",
  SFRA: "School Funding Reform Act — New Jersey's 2008 education funding law (S-2)",
  IDF: "Income Diversity Factor — a measure of household income spread within a district (1.0 = homogeneous, up to 1.5 = highly diverse)",
  TBI: "Tax Burden Index — property tax levy as a share of aggregate income, scaled so the statewide average equals 1.0",
  UFB: "User Friendly Budget — the adopted operating budget published by NJ DOE for each district, showing revenues, appropriations, and per-pupil costs",
  FRL: "Free/Reduced Lunch — the percentage of students qualifying for the National School Lunch Program, used as a poverty proxy",
  TEV: "True Equalized Valuation — aggregate property value published annually by NJ Division of Taxation",
  PP: "Per Pupil — the dollar amount divided by total enrollment",
  EqAid: "Equalization Aid — the main state aid category, equal to adequacy budget minus local fair share (floored at $0)",
};

function Tip({ term, children }) {
  const tip = TIPS[term];
  if (!tip) return <>{children || term}</>;
  return (
    <span style={{ position: "relative", display: "inline-block" }} title={tip}>
      <span style={{ borderBottom: "1px dashed #5a5848", cursor: "help" }}>{children || term}</span>
    </span>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ padding: "16px 18px", background: "#1a1914", borderRadius: 10, border: "1px solid #2a2820", flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || "#e2e0d6", fontFamily: "'Instrument Serif', serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#8a8778", marginTop: 3, fontFamily: "'DM Sans', sans-serif" }}>{sub}</div>}
    </div>
  );
}

// ── DISTRICT PROFILES VIEW ──────────────────────────────────
function ProfilesView({ selected, setSelected }) {
  const d = DISTRICTS[selected];
  const r = runFormula(d);
  const aidBreakdown = [
    { name: "Equalization", value: d.fy26Detail.eq, fill: d.color },
    { name: "Sp. Ed.", value: d.fy26Detail.sped, fill: d.accent },
    { name: "Transport", value: d.fy26Detail.trans, fill: "#a78bfa" },
    { name: "Security", value: d.fy26Detail.sec, fill: "#fbbf24" },
  ];
  const demoData = [
    { name: "At-Risk", pct: d.atRiskPct * 100 },
    { name: "LEP/ELL", pct: (d.lep / d.enr.total) * 100 },
    { name: "Sp. Ed.", pct: (FORMULA.spedRate) * 100 },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {Object.entries(DISTRICTS).map(([k, v]) => (
          <Pill key={k} active={selected === k} onClick={() => setSelected(k)} color={v.color}>{v.name}</Pill>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
          <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>District Profile</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: d.color, fontFamily: "'Instrument Serif', serif", marginBottom: 4 }}>{d.name}</div>
          <div style={{ fontSize: 14, color: "#8a8778" }}>{d.county} County · {d.type} · <Tip term="GCA">GCA</Tip>: {d.gca}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
            <div><span style={{ fontSize: 11, color: "#6a6758" }}>ENROLLMENT {d.onRoll ? "(RESIDENT)" : ""}</span><br/><span style={{ fontSize: 18, fontWeight: 600, color: "#e2e0d6" }}>{fmtNum(d.enr.total)}{d.onRoll ? <span style={{ fontSize: 12, color: "#6a6758" }}> ({fmtNum(d.onRoll)} on-roll)</span> : ""}</span></div>
            <div><span style={{ fontSize: 11, color: "#6a6758" }}>AT-RISK % (<Tip term="FRL">FRL</Tip>)</span><br/><span style={{ fontSize: 18, fontWeight: 600, color: "#e2e0d6" }}>{(d.atRiskPct * 100).toFixed(0)}%</span></div>
            <div><span style={{ fontSize: 11, color: "#6a6758" }}><Tip term="EV">EQUALIZED VALUE</Tip></span><br/><span style={{ fontSize: 18, fontWeight: 600, color: "#e2e0d6" }}>{fmt(d.ev3yr[0])}</span></div>
            <div><span style={{ fontSize: 11, color: "#6a6758" }}>LOCAL LEVY</span><br/><span style={{ fontSize: 18, fontWeight: 600, color: "#e2e0d6" }}>{fmt(d.levy)}</span></div>
          </div>
        </div>

        <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
          <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>FY26 State Aid Breakdown</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={aidBreakdown} layout="vertical" margin={{ left: 60, right: 10 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fill: "#8a8778", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 13 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                {aidBreakdown.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatCard label="FY26 Total Aid" value={fmt(d.fy26)} sub={`${fmtPct(((d.fy26 - d.fy25) / d.fy25) * 100)} from FY25`} color={d.color} />
        <StatCard label={<>Aid <Tip term="PP">Per Pupil</Tip></>} value={fmt(d.fy26 / d.enr.total)} sub={`of ${fmt(d.budget)} total budget`} />
        <StatCard label="Aid % of Budget" value={`${(d.fy26 / d.budget * 100).toFixed(1)}%`} sub="state dependency" />
        <StatCard label="Formula Adequacy" value={fmt(r.adequacy)} sub={<><Tip term="LFS">LFS</Tip>: {fmt(r.lfs)}</>} />
      </div>
    </div>
  );
}

// ── FORMULA EDITOR VIEW ─────────────────────────────────────
function FormulaView({ overrides, setOverrides }) {
  // Source annotations: A = Adequacy Report, C = Commissioner (annual), S = Statute/Budget
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

  // Aid change caps (from S-2 / annual budget)
  const aidFloor = overrides.aidFloor ?? -0.03; // -3% floor
  const aidCeiling = overrides.aidCeiling ?? 0.06; // +6% ceiling
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

// ── RESULTS DASHBOARD VIEW ──────────────────────────────────
function ResultsView({ overrides }) {
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

// ── 5-YEAR PROJECTION VIEW ──────────────────────────────────
const GROWTH_DEFAULTS = { ev: 4.0, income: 3.0, enrollment: -0.2, cpi: 3.5, levy: 2.0, budgetGrowth: 4.5 };

function ProjectionView({ overrides }) {
  const [growth, setGrowth] = useState(GROWTH_DEFAULTS);
  const [noLevyCap, setNoLevyCap] = useState(false);
  const setG = (k, v) => setGrowth(prev => ({ ...prev, [k]: v }));
  const years = [2026, 2027, 2028, 2029, 2030];

  const projections = Object.entries(DISTRICTS).map(([k, baseD]) => {
    let prevAid = baseD.fy25;

    // Base year actuals from UFB
    const baseBudget = baseD.ufb.totalBudget;
    const baseLevy = baseD.ufb.localTaxLevy;
    const baseFed = baseD.ufb.federalAid;
    const baseOther = baseD.ufb.otherRevenue;

    const annual = years.map((yr, yi) => {
      // Deep-copy base and compound forward yi years for formula inputs
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

      // Inflate base PP by CPI for future years
      const ov = { ...overrides };
      if (yi > 0) ov.basePP = (ov.basePP || FORMULA.basePP) * Math.pow(1 + growth.cpi / 100, yi);

      d.fy25 = prevAid;
      const r = runFormula(d, ov);
      prevAid = r.totalFormula;

      // INDEPENDENT budget & levy projections
      // For WO: use real line-item growth rates from district projection doc
      // For others: use the slider budgetGrowth rate
      let projBudget;
      let budgetItemDetail = null;
      if (baseD.budgetItems && yi > 0) {
        // Line-item projection using district's own growth assumptions
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
      const projFed = baseFed * Math.pow(1.02, yi); // fed grows ~2%/yr
      const projOther = baseOther * Math.pow(1.01, yi);

      // What the district actually NEEDS from local taxes to cover the budget
      const necessaryLevy = projBudget - r.totalFormula - projFed - projOther;

      // The gap: how much more than the legal capped levy is needed
      const levyGap = necessaryLevy - cappedLevy;
      const levyGapPct = cappedLevy > 0 ? (levyGap / cappedLevy) * 100 : 0;

      const avgEV = (d.ev3yr[0] + d.ev3yr[1] + d.ev3yr[2]) / 3;
      const cappedTaxRate = avgEV > 0 ? (cappedLevy / avgEV) * 100 : 0;
      const necessaryTaxRate = avgEV > 0 ? (necessaryLevy / avgEV) * 100 : 0;

      // Tax impact: necessary levy / estimated households
      // Rough household count from income: aggregate / median household income
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

  // Levy gap chart data (when noLevyCap is on)
  const levyGapData = years.map((yr, yi) => {
    const row = { year: yr };
    projections.forEach(p => {
      row[p.short + "_gap"] = p.annual[yi].levyGap / 1e6;
      row[p.short + "_nec"] = p.annual[yi].necessaryLevy / 1e6;
      row[p.short + "_cap"] = p.annual[yi].cappedLevy / 1e6;
    });
    return row;
  });

  // Tax rate data
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
        {/* Levy modeling toggle */}
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

      {/* When levy modeling is ON: add tax rate chart + budget waterfall per district */}
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
                      // Show levy gap as % of capped levy
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

      {/* No levy cap analysis - always shown now, just toggle detail */}
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
                      // YoY growth of necessary levy. Year 0: compare to prior-year actual levy (baseLevy)
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
                            // yi=0 in annual[] is base year (no growth). We want FY26-27 = 1yr growth, so use yi+1 for projected years.
                            // But annual only has indices 0-4. So FY26-27 = item.fy26*(1+rate)^1, FY30-31 = item.fy26*(1+rate)^5
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
                          // Compute total from line items with yi+1 years of growth
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
function FiscalView({ overrides }) {
  const baseline = Object.values(DISTRICTS).reduce((sum, d) => sum + runFormula(d).totalFormula, 0);
  const scenario = Object.values(DISTRICTS).reduce((sum, d) => sum + runFormula(d, overrides).totalFormula, 0);
  const delta = scenario - baseline;

  const statewide = 12100000000; // approx FY26 K-12 formula aid
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

// ── CUSTOM FORMULA VIEW ─────────────────────────────────────
function CustomFormulaView({ customParams, setCustomParams }) {
  const p = { ...CUSTOM_DEFAULTS, ...customParams };

  const set = (k, v) => setCustomParams({ ...customParams, [k]: v });

  const results = Object.entries(DISTRICTS).map(([k, d]) => {
    const cd = CUSTOM_DATA[k];
    const custom = runCustomFormula(d, cd, p);
    const sfra = runFormula(d);
    return { key: k, ...d, cd, custom, sfra };
  });

  const compData = results.map(r => ({
    name: r.short, sfra: r.sfra.totalFormula / 1e6, custom: r.custom.totalCustom / 1e6, color: r.color,
  }));

  const ppData = results.map(r => ({
    name: r.short, sfra: r.sfra.perPupil, custom: r.custom.perPupil, color: r.color,
  }));

  const sliderStyle = (isDiff) => ({
    padding: 14, background: isDiff ? "#1a1420" : "#1a1914", borderRadius: 10,
    border: `1px solid ${isDiff ? "#4a2a60" : "#2a2820"}`, transition: "all 0.3s"
  });

  const labelStyle = (isDiff) => ({ fontSize: 12, color: isDiff ? "#c49aea" : "#8a8778", fontWeight: isDiff ? 600 : 400 });
  const valStyle = (isDiff) => ({ fontSize: 14, fontWeight: 700, color: isDiff ? "#d8b4fe" : "#e2e0d6", fontFamily: "'Instrument Serif', serif" });

  return (
    <div>
      {/* Header explanation */}
      <div style={{ marginBottom: 20, padding: 16, background: "linear-gradient(135deg, #201428, #1a1914)", borderRadius: 12, border: "1px solid #3a2848" }}>
        <div style={{ fontSize: 14, color: "#c49aea", fontWeight: 600, marginBottom: 6 }}>🧪 Custom Aid Formula</div>
        <div style={{ fontSize: 12, color: "#8a7898", lineHeight: 1.6 }}>
          Model an alternative to the SFRA's adequacy-minus-LFS approach. This formula computes aid as:
        </div>
        <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 18, color: "#d8b4fe", margin: "10px 0", padding: "10px 16px", background: "#12110e", borderRadius: 8, border: "1px solid #2a2030", display: "inline-block" }}>
          Aid = Base × Poverty Rate<sup style={{fontSize:11}}>{p.povertyExponent !== 1 ? p.povertyExponent.toFixed(1) : ""}</sup> × Income Diversity Factor × Tax Burden Index × Enrollment
        </div>
        <div style={{ fontSize: 11, color: "#6a5878", marginTop: 6 }}>
          + optional SpEd categorical + Security aid + Transportation. Compared side-by-side with current SFRA.
        </div>
      </div>

      {/* Formula component sliders */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Base amount */}
        <div style={sliderStyle(p.customBase !== CUSTOM_DEFAULTS.customBase)}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={labelStyle(p.customBase !== CUSTOM_DEFAULTS.customBase)}>Base Per Pupil ($)</span>
            <span style={valStyle(p.customBase !== CUSTOM_DEFAULTS.customBase)}>${p.customBase.toLocaleString()}</span>
          </div>
          <input type="range" min={5000} max={25000} step={250} value={p.customBase}
            onChange={e => set("customBase", +e.target.value)} style={{ width: "100%", accentColor: "#9333ea" }} />
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

        {/* Min Aid PP */}
        <div style={sliderStyle(p.minAidPP !== 500)}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={labelStyle(p.minAidPP !== 500)}>Minimum Aid Per Pupil ($)</span>
            <span style={valStyle(p.minAidPP !== 500)}>${p.minAidPP.toLocaleString()}</span>
          </div>
          <input type="range" min={0} max={5000} step={100} value={p.minAidPP}
            onChange={e => set("minAidPP", +e.target.value)} style={{ width: "100%", accentColor: "#9333ea" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#5a4868" }}><span>$0</span><span>$5,000</span></div>
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
          {p.spedAddon ? "✓" : "○"} + SpEd Categorical
        </Pill>
        <Pill active={p.securityAddon} onClick={() => set("securityAddon", !p.securityAddon)} color="#9333ea">
          {p.securityAddon ? "✓" : "○"} + Security Aid
        </Pill>
        <Pill active={false} onClick={() => setCustomParams({})} color="#6a5878">Reset All</Pill>
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
                <td style={{ padding: 8, color: "#8a8778" }}><Tip term="IDF">Income Diversity Factor</Tip> (raw)</td>
                {results.map(r => <td key={r.key} style={{ textAlign: "center", padding: 8, color: "#e2e0d6" }}>{r.cd.incomeDiversityFactor.toFixed(2)}</td>)}
              </tr>
              <tr style={{ borderBottom: "1px solid #1f1e18" }}>
                <td style={{ padding: 8, color: "#8a8778" }}><Tip term="IDF">IDF</Tip> (weighted)</td>
                {results.map(r => <td key={r.key} style={{ textAlign: "center", padding: 8, color: "#d8b4fe", fontWeight: 600 }}>{r.custom.idf.toFixed(3)}</td>)}
              </tr>
              <tr style={{ borderBottom: "1px solid #1f1e18" }}>
                <td style={{ padding: 8, color: "#8a8778" }}><Tip term="TBI">Tax Burden</Tip> % (levy/income)</td>
                {results.map(r => <td key={r.key} style={{ textAlign: "center", padding: 8, color: "#e2e0d6" }}>{(r.cd.taxBurdenPct * 100).toFixed(2)}%</td>)}
              </tr>
              <tr style={{ borderBottom: "1px solid #1f1e18" }}>
                <td style={{ padding: 8, color: "#8a8778" }}><Tip term="TBI">Tax Burden Index</Tip> (statewide avg = 1.0)</td>
                {results.map(r => <td key={r.key} style={{ textAlign: "center", padding: 8, color: "#d8b4fe", fontWeight: 600 }}>{r.cd.taxBurdenIndex.toFixed(3)}</td>)}
              </tr>
              <tr style={{ borderBottom: "1px solid #1f1e18" }}>
                <td style={{ padding: 8, color: "#8a8778" }}>TBI (weighted)</td>
                {results.map(r => <td key={r.key} style={{ textAlign: "center", padding: 8, color: "#d8b4fe", fontWeight: 600 }}>{r.custom.tbi.toFixed(3)}</td>)}
              </tr>
              <tr style={{ borderBottom: "1px solid #2a2820", background: "#1f1a28" }}>
                <td style={{ padding: 8, color: "#c49aea", fontWeight: 600 }}>Compound Multiplier</td>
                {results.map(r => <td key={r.key} style={{ textAlign: "center", padding: 8, color: "#d8b4fe", fontWeight: 700, fontSize: 15 }}>
                  {(r.custom.povertyFactor * r.custom.idf * r.custom.tbi).toFixed(4)}
                </td>)}
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
                <div style={{ fontSize: 10, color: "#6a6758", textTransform: "uppercase" }}>SFRA FY26</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#8a8778", fontFamily: "'Instrument Serif', serif" }}>{fmt(r.sfra.totalFormula)}</div>
                <div style={{ fontSize: 11, color: "#6a6758" }}>{fmt(r.sfra.perPupil)}/pupil</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#9333ea", textTransform: "uppercase" }}>Custom</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#d8b4fe", fontFamily: "'Instrument Serif', serif" }}>{fmt(r.custom.totalCustom)}</div>
                <div style={{ fontSize: 11, color: "#9a7abe" }}>{fmt(r.custom.perPupil)}/pupil</div>
              </div>
            </div>
            <div style={{ marginTop: 8, padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: r.custom.changeSfra > 0 ? "#1a2818" : "#2a1414",
              color: r.custom.changeSfra > 0 ? "#34d399" : "#f87171" }}>
              Δ from SFRA: {r.custom.changeSfra >= 0 ? "+" : ""}{fmt(r.custom.changeSfra)} ({fmtPct(r.custom.changeSfraPct)})
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
          <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Total Aid: SFRA vs Custom ($M)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={compData} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
              <XAxis dataKey="name" tick={{ fill: "#8a8778", fontSize: 12 }} axisLine={false} />
              <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 13 }} formatter={(v) => `$${v.toFixed(1)}M`} />
              <Bar dataKey="sfra" fill="#4a4838" radius={[3,3,0,0]} barSize={18} name="SFRA FY26" />
              <Bar dataKey="custom" radius={[3,3,0,0]} barSize={18} name="Custom Formula">
                {compData.map((e, i) => <Cell key={i} fill={e.color} opacity={0.7} />)}
              </Bar>
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ padding: 20, background: "#1a1914", borderRadius: 12, border: "1px solid #2a2820" }}>
          <div style={{ fontSize: 13, color: "#6a6758", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Per Pupil Aid: SFRA vs Custom ($)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ppData} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2820" />
              <XAxis dataKey="name" tick={{ fill: "#8a8778", fontSize: 12 }} axisLine={false} />
              <YAxis tick={{ fill: "#6a6758", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1a1914", border: "1px solid #2a2820", borderRadius: 8, color: "#e2e0d6", fontSize: 13 }} formatter={(v) => `$${v.toFixed(0)}`} />
              <Bar dataKey="sfra" fill="#4a4838" radius={[3,3,0,0]} barSize={18} name="SFRA FY26" />
              <Bar dataKey="custom" radius={[3,3,0,0]} barSize={18} name="Custom Formula">
                {ppData.map((e, i) => <Cell key={i} fill={e.color} opacity={0.7} />)}
              </Bar>
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Statewide fiscal impact estimate */}
      <div style={{ padding: 20, background: "#1a1420", borderRadius: 12, border: "1px solid #2a2040", marginTop: 16 }}>
        <div style={{ fontSize: 13, color: "#c49aea", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Est. Statewide Fiscal Impact</div>
        {(() => {
          const sfraTotal = results.reduce((s, r) => s + r.sfra.totalFormula, 0);
          const customTotal = results.reduce((s, r) => s + r.custom.totalCustom, 0);
          const sampleDelta = customTotal - sfraTotal;
          const statewide = 12100000000;
          const scaleFactor = statewide / sfraTotal;
          const estDelta = sampleDelta * scaleFactor;
          const pctChange = (sampleDelta / sfraTotal) * 100;
          return (
            <div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                <StatCard label="4-District SFRA Total" value={fmt(sfraTotal)} sub="current law" />
                <StatCard label="4-District Custom Total" value={fmt(customTotal)} sub={`Δ ${fmt(sampleDelta)} (${fmtPct(pctChange)})`} color={sampleDelta > 0 ? "#d8b4fe" : "#f87171"} />
                <StatCard label="Est. Statewide Impact" value={fmt(estDelta)} sub={<>Scaled to all {fmtNum(1318781)} students</>} color="#c4b98a" />
                <StatCard label="New Est. State Budget" value={fmt(statewide + estDelta)} sub={`from $12.1B baseline`} />
              </div>
              <div style={{ fontSize: 12, color: "#7a6898", lineHeight: 1.6 }}>
                <strong style={{ color: "#a89aca" }}>Methodology:</strong> The 4-district sample (WO, CH, NK, PT) represents a cross-section of suburban and urban districts. The statewide estimate scales the sample delta by the ratio of statewide formula aid ($12.1B) to the 4-district SFRA baseline. This is a rough estimate — the actual impact depends on the full distribution of poverty rates, IDF, and TBI across all 600+ districts.
                {pctChange > 5 && <span style={{ color: "#f59e0b", display: "block", marginTop: 6 }}>⚠ A {fmtPct(pctChange)} increase would require significant new state revenue or reallocation from other budget areas.</span>}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Fiscal note */}
      <div style={{ padding: 16, background: "#1a1420", borderRadius: 12, border: "1px solid #2a2040", marginTop: 16 }}>
        <div style={{ fontSize: 13, color: "#c49aea", fontWeight: 600, marginBottom: 8 }}>Formula Behavior Notes</div>
        <div style={{ fontSize: 12, color: "#8a7898", lineHeight: 1.7 }}>
          <p>• <strong style={{ color: "#d8b4fe" }}>Poverty Exponent {'>'} 1</strong> makes the formula progressive: districts with 80% poverty get disproportionately more than those at 40%. At exponent 2.0, a district at 80% poverty receives 4× the weight of one at 40%.</p>
          <p>• <strong style={{ color: "#d8b4fe" }}>Income Diversity Factor</strong> rewards districts with heterogeneous income distributions, recognizing that income inequality within a district creates service delivery challenges absent in uniformly wealthy or uniformly poor communities.</p>
          <p>• <strong style={{ color: "#d8b4fe" }}>Tax Burden Index</strong> accounts for effort: Paterson (TBI={CUSTOM_DATA.paterson.taxBurdenIndex.toFixed(2)}) taxes its residents harder relative to income than Cherry Hill (TBI={CUSTOM_DATA.cherryHill.taxBurdenIndex.toFixed(2)}). Weighting this rewards communities that are already stretching to fund schools.</p>
          <p>• Unlike SFRA's Adequacy-minus-LFS approach, this formula doesn't subtract local capacity — it directly scales aid by need indicators. This means wealthy districts with high poverty (rare but possible) would still receive substantial aid.</p>
        </div>
      </div>
    </div>
  );
}


// ── BUDGET ANALYSIS VIEW ────────────────────────────────────
function BudgetView({ overrides }) {
  const [budgetYear, setBudgetYear] = useState("fy26"); // "fy26" or "fy27"
  const hasOverrides = Object.keys(overrides).length > 0;
  const isFy27 = budgetYear === "fy27";

  const results = Object.entries(DISTRICTS).map(([k, d]) => {
    const rBase = runFormula(d); // baseline formula (no overrides)
    const rScen = runFormula(d, overrides); // scenario formula
    const u = d.ufb;

    // FY27 projected budget: use real preliminary data if available, else estimate
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
                if (row.label === "sep") return <tr key={i}><td colSpan={5} style={{ height: 4, background: "#1f1e18" }}></td></tr>;
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

export default function SFRAModel() {
  const [view, setView] = useState("profiles");
  const [selected, setSelected] = useState("westOrange");
  const [overrides, setOverrides] = useState({});
  const [customParams, setCustomParams] = useState({});

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
          <span style={{ fontSize: 11, color: "#5a5848" }}>School Funding Reform Act Interactive Model</span>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 700, fontFamily: "'Instrument Serif', serif", color: "#e2e0d6", margin: "4px 0 12px", letterSpacing: "-0.02em" }}>
          Education Funding Scenario Explorer
        </h1>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {VIEWS.map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "8px 16px", borderRadius: 6, border: "none",
              background: view === v ? (v === "custom" ? "#9333ea" : v === "budget" ? "#a89aca" : "#c4b98a") : "#1a1914",
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
        {view === "custom" && <CustomFormulaView customParams={customParams} setCustomParams={setCustomParams} />}
        {view === "budget" && <BudgetView overrides={overrides} />}
        {view === "results" && <ResultsView overrides={overrides} />}
        {view === "projection" && <ProjectionView overrides={overrides} />}
        {view === "fiscal" && <FiscalView overrides={overrides} />}
      </div>
    </div>
  );
}
