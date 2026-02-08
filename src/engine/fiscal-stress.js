import { runFormula } from './sfra-formula.js';

/**
 * Fiscal Stress scoring engine — works for ANY NJ district.
 *
 * Computes a 0–100 composite score from 4 indicators (0–25 each):
 *   1. Declining State Aid     — FY25→FY26 aid trajectory
 *   2. Spending Above Adequacy — budget exceeds SFRA formula adequacy
 *   3. State Aid Dependency    — state aid as % of budget (vulnerability to state decisions)
 *   4. Tax Capacity Exhaustion — equalized tax rate vs capacity (how hard the district is already taxing)
 *
 * Districts with detailed `fiscalStress` data get enriched descriptions
 * including fund balance history, ESSER detail, and revenue/cost growth rates.
 */

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export function scoreDistrict(d, overrides = {}) {
  const formula = runFormula(d, overrides);
  const u = d.ufb || {};
  const budget = u.totalBudget || d.budget || 1;
  const fs = d.fiscalStress; // detailed data for focal districts only

  const indicators = [];

  // ── 1. Declining State Aid ──────────────────────────────────
  const aidChange = d.fy25 > 0 ? ((d.fy26 - d.fy25) / d.fy25) * 100 : 0;
  // Losing >6% of aid in one year = max score; gaining aid = 0
  const aidScore = clamp((-aidChange / 6) * 25, 0, 25);
  indicators.push({
    id: "aid-decline",
    label: "Declining State Aid",
    score: Math.round(aidScore),
    max: 25,
    severity: aidScore > 15 ? "critical" : aidScore > 8 ? "warning" : "stable",
    detail: fs
      ? `Aid changed ${aidChange >= 0 ? "+" : ""}${aidChange.toFixed(1)}% (FY25→FY26). Reserve at ${fs.fundBalanceHistory[fs.fundBalanceHistory.length - 1].pctBudget.toFixed(1)}% of budget.`
      : `State aid changed ${aidChange >= 0 ? "+" : ""}${aidChange.toFixed(1)}% from FY25 to FY26`,
    metric: `${aidChange >= 0 ? "+" : ""}${aidChange.toFixed(1)}%`,
    raw: aidChange,
  });

  // ── 2. Spending Above Adequacy ──────────────────────────────
  const adequacyGap = budget - formula.adequacy;
  const gapPct = formula.adequacy > 0 ? (adequacyGap / formula.adequacy) * 100 : 0;
  const spendScore = adequacyGap > 0 ? clamp((gapPct / 20) * 25, 0, 25) : 0;
  indicators.push({
    id: "spend-above",
    label: "Spending Above Adequacy",
    score: Math.round(spendScore),
    max: 25,
    severity: spendScore > 15 ? "critical" : spendScore > 8 ? "warning" : "stable",
    detail: fs
      ? `Budget exceeds adequacy by ${gapPct.toFixed(1)}%. Costs growing ${fs.costGrowthRate.toFixed(1)}%/yr vs revenue ${fs.revenueGrowthRate.toFixed(1)}%/yr.`
      : adequacyGap > 0
        ? `Budget exceeds SFRA adequacy by ${gapPct.toFixed(1)}%`
        : `Budget is ${Math.abs(gapPct).toFixed(1)}% below SFRA adequacy`,
    metric: `${adequacyGap > 0 ? "+" : ""}${gapPct.toFixed(1)}%`,
    raw: gapPct,
  });

  // ── 3. State Aid Dependency ─────────────────────────────────
  // Districts with >70% of budget from state aid are extremely vulnerable
  // to state funding decisions — a single legislative change can devastate them.
  const stateAid = u.stateAid || d.fy26 || 0;
  const stateDepPct = budget > 0 ? (stateAid / budget) * 100 : 0;
  // Scale: 40% = starts scoring, 90% = max score
  const depScore = clamp(((stateDepPct - 40) / 50) * 25, 0, 25);
  let depDetail;
  if (fs && fs.esser) {
    const cliffPct = (fs.esser.cliffExposure / budget) * 100;
    depDetail = `State aid is ${stateDepPct.toFixed(0)}% of budget. Additionally, ${fs.esser.positionsFundedByEsser} ESSER-funded positions at risk (${cliffPct.toFixed(1)}% cliff exposure).`;
  } else {
    depDetail = stateDepPct > 70
      ? `State aid is ${stateDepPct.toFixed(0)}% of budget — a single state funding decision could force massive cuts`
      : stateDepPct > 40
        ? `State aid is ${stateDepPct.toFixed(0)}% of budget — moderate vulnerability to state funding shifts`
        : `State aid is only ${stateDepPct.toFixed(0)}% of budget — primarily locally funded`;
  }
  indicators.push({
    id: "state-dependency",
    label: "State Aid Dependency",
    score: Math.round(depScore),
    max: 25,
    severity: depScore > 15 ? "critical" : depScore > 8 ? "warning" : "stable",
    detail: depDetail,
    metric: `${stateDepPct.toFixed(0)}%`,
    raw: stateDepPct,
  });

  // ── 4. Tax Capacity Exhaustion ──────────────────────────────
  // Equalized school tax rate: levy / EV. Higher = less room to raise local revenue.
  // NJ average is ~1.0–1.2%. Districts above 1.5% are tapped out.
  // Districts with very LOW rates but high state dependency (like Newark at 0.56%)
  // score low here — their stress shows up in indicator 3 instead.
  const avgEV = (d.ev3yr[0] + d.ev3yr[1] + d.ev3yr[2]) / 3;
  const levy = u.localTaxLevy || d.levy || 0;
  const eqTaxRate = avgEV > 0 ? (levy / avgEV) * 100 : 0;
  // Also compare actual levy to formula's LFS — if levy >> LFS, overtaxing
  const levyVsLfs = formula.lfs > 0 ? (levy / formula.lfs) * 100 : 100;
  // Composite: high tax rate + overtaxing vs LFS
  const taxScore = clamp(
    ((eqTaxRate - 1.0) / 1.5) * 15 + // tax rate component (1.0% threshold, 2.5% = max)
    ((Math.max(0, levyVsLfs - 100)) / 80) * 10, // overtaxing component (>100% of LFS)
    0, 25
  );
  let taxDetail;
  if (fs) {
    const fbEnd = fs.fundBalanceHistory[fs.fundBalanceHistory.length - 1];
    taxDetail = `Eq. tax rate ${eqTaxRate.toFixed(3)}%, levy is ${levyVsLfs.toFixed(0)}% of formula LFS. Fund balance at ${fbEnd.pctBudget.toFixed(1)}% of budget.`;
  } else {
    taxDetail = eqTaxRate > 1.5
      ? `Eq. tax rate ${eqTaxRate.toFixed(3)}% (high) — levy is ${levyVsLfs.toFixed(0)}% of formula LFS, limited room for local increases`
      : `Eq. tax rate ${eqTaxRate.toFixed(3)}% — levy is ${levyVsLfs.toFixed(0)}% of formula LFS`;
  }
  indicators.push({
    id: "tax-exhaustion",
    label: "Tax Capacity Exhaustion",
    score: Math.round(taxScore),
    max: 25,
    severity: taxScore > 15 ? "critical" : taxScore > 8 ? "warning" : "stable",
    detail: taxDetail,
    metric: `${eqTaxRate.toFixed(2)}%`,
    raw: eqTaxRate,
  });

  const totalScore = indicators.reduce((s, ind) => s + ind.score, 0);

  return {
    key: null, // set by caller
    indicators,
    totalScore,
    maxScore: 100,
    level: totalScore >= 65 ? "severe" : totalScore >= 40 ? "elevated" : totalScore >= 20 ? "moderate" : "low",
    formula,
    hasDetail: !!fs,
    // Quick-access metrics for table sorting
    aidChangePct: aidChange,
    adequacyGapPct: gapPct,
    stateDepPct,
    eqTaxRate,
  };
}

export const LEVEL_COLORS = {
  severe: "#ef4444",
  elevated: "#f59e0b",
  moderate: "#eab308",
  low: "#22c55e",
};

export const SEVERITY_COLORS = { critical: "#ef4444", warning: "#f59e0b", stable: "#22c55e" };

/**
 * Score ALL districts and return sorted by stress score descending.
 */
export function scoreAllDistricts(districts, overrides = {}) {
  return Object.entries(districts)
    .filter(([, d]) => d.enr && d.enr.total > 0 && d.ufb)
    .map(([key, d]) => {
      const stress = scoreDistrict(d, overrides);
      stress.key = key;
      return { key, district: d, stress };
    })
    .sort((a, b) => b.stress.totalScore - a.stress.totalScore);
}
