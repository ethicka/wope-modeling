import { runFormula } from './sfra-formula.js';

/**
 * Fiscal Stress scoring engine — works for ANY NJ district.
 *
 * Computes a 0–100 composite score from 4 indicators (0–25 each):
 *   1. Declining State Aid    — FY25→FY26 aid trajectory
 *   2. Spending Above Adequacy — budget exceeds SFRA formula adequacy
 *   3. Structural Revenue Gap  — total revenue < total budget (fund balance proxy)
 *   4. Federal Aid Dependency  — federal revenue as % of budget (ESSER proxy)
 *
 * Districts with detailed `fiscalStress` data get enriched descriptions.
 */

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export function scoreDistrict(d, overrides = {}) {
  const formula = runFormula(d, overrides);
  const u = d.ufb || {};
  const budget = u.totalBudget || d.budget || 1;
  const fs = d.fiscalStress; // may be undefined for most districts

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
    detail: adequacyGap > 0
      ? `Budget exceeds SFRA adequacy by ${gapPct.toFixed(1)}%`
      : `Budget is ${Math.abs(gapPct).toFixed(1)}% below SFRA adequacy`,
    metric: `${adequacyGap > 0 ? "+" : ""}${gapPct.toFixed(1)}%`,
    raw: gapPct,
  });

  // ── 3. Structural Revenue Gap ───────────────────────────────
  // Total identifiable revenue vs budget — gap = implicit fund balance usage
  const totalRevenue = (u.localTaxLevy || 0) + (u.stateAid || 0) + (u.federalAid || 0) + (u.otherRevenue || 0);
  const revGap = budget - totalRevenue;
  const revGapPct = budget > 0 ? (revGap / budget) * 100 : 0;
  // If detailed data available, use actual revenue-cost growth gap instead
  let growthGapDetail, growthGapMetric;
  if (fs && fs.revenueGrowthRate != null) {
    const gap = fs.costGrowthRate - fs.revenueGrowthRate;
    growthGapDetail = `Costs growing ${fs.costGrowthRate.toFixed(1)}%/yr vs revenue ${fs.revenueGrowthRate.toFixed(1)}%/yr (gap: ${gap.toFixed(1)}pp)`;
    growthGapMetric = `${gap.toFixed(1)}pp`;
  } else {
    growthGapDetail = revGap > 0
      ? `Revenue shortfall of ${revGapPct.toFixed(1)}% of budget — implies fund balance drawdown`
      : `Revenue covers budget with ${Math.abs(revGapPct).toFixed(1)}% surplus`;
    growthGapMetric = `${revGapPct.toFixed(1)}%`;
  }
  const gapScore = clamp((revGapPct / 8) * 25, 0, 25);
  indicators.push({
    id: "growth-gap",
    label: "Revenue–Cost Gap",
    score: Math.round(gapScore),
    max: 25,
    severity: gapScore > 15 ? "critical" : gapScore > 8 ? "warning" : "stable",
    detail: growthGapDetail,
    metric: growthGapMetric,
    raw: revGapPct,
  });

  // ── 4. Federal Aid Dependency (ESSER proxy) ─────────────────
  const fedAid = u.federalAid || 0;
  const fedPct = budget > 0 ? (fedAid / budget) * 100 : 0;
  // Districts with >5% federal aid share had significant ESSER exposure
  let esserDetail, esserMetric;
  if (fs && fs.esser) {
    const cliffPct = (fs.esser.cliffExposure / budget) * 100;
    esserDetail = `${fs.esser.positionsFundedByEsser} ESSER-funded positions; ${cliffPct.toFixed(1)}% of budget in recurring cliff exposure`;
    esserMetric = `${cliffPct.toFixed(1)}%`;
  } else {
    esserDetail = fedPct > 0.5
      ? `Federal aid is ${fedPct.toFixed(1)}% of budget — higher shares indicate ESSER dependency risk`
      : `Minimal federal aid exposure (${fedPct.toFixed(2)}% of budget)`;
    esserMetric = `${fedPct.toFixed(1)}%`;
  }
  const esserScore = clamp((fedPct / 6) * 25, 0, 25);
  indicators.push({
    id: "esser-cliff",
    label: "Federal/ESSER Dependency",
    score: Math.round(esserScore),
    max: 25,
    severity: esserScore > 15 ? "critical" : esserScore > 8 ? "warning" : "stable",
    detail: esserDetail,
    metric: esserMetric,
    raw: fedPct,
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
    revGapPct,
    fedPct,
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
