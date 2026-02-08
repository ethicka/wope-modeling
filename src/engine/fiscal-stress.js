import { runFormula } from './sfra-formula.js';
import { FISCAL_DATA } from '../data/fiscal-stress-generated.js';

/**
 * Fiscal Stress scoring engine — works for ANY NJ district.
 *
 * Computes a 0–100 composite score from 4 indicators (0–25 each):
 *   1. Declining Fund Balance  — FY2018→FY2026 unrestricted surplus trend
 *   2. Spending Above Adequacy — budget exceeds SFRA formula adequacy
 *   3. ESSER Cliff Exposure    — total ESSER allocation as % of budget (now expired)
 *   4. Tax Capacity Exhaustion — equalized tax rate vs capacity
 *
 * Uses real ESSER allocations and audited fund balance data from NJ DOE.
 */

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export function scoreDistrict(d, overrides = {}, distKey = null) {
  const formula = runFormula(d, overrides);
  const u = d.ufb || {};
  const budget = u.totalBudget || d.budget || 1;
  const fs = d.fiscalStress; // hand-coded detail for focal districts
  const fd = distKey ? FISCAL_DATA[distKey] : null; // generated fiscal data

  const indicators = [];

  // ── 1. Declining Fund Balance ─────────────────────────────────
  // Use real fund balance history from UFB recap data (all districts)
  const fb = fd?.fundBalance || {};
  const fbYears = Object.keys(fb).map(Number).sort();
  let fbDeclineScore = 0;
  let fbPctOfBudget = null;
  let fbTrend = null;

  if (fbYears.length >= 3) {
    // Current fund balance as % of budget
    const latestFb = fb[fbYears[fbYears.length - 1]] || 0;
    fbPctOfBudget = (latestFb / budget) * 100;

    // Calculate trend: compare recent 3-year avg to earlier 3-year avg
    const recentYrs = fbYears.slice(-3);
    const earlyYrs = fbYears.slice(0, Math.min(3, fbYears.length - 3));
    const recentAvg = recentYrs.reduce((s, y) => s + (fb[y] || 0), 0) / recentYrs.length;
    const earlyAvg = earlyYrs.length > 0
      ? earlyYrs.reduce((s, y) => s + (fb[y] || 0), 0) / earlyYrs.length
      : recentAvg;

    // Trend: negative = declining reserves
    fbTrend = earlyAvg > 0 ? ((recentAvg - earlyAvg) / earlyAvg) * 100 : 0;

    // Score: low current balance + declining trend = high stress
    // Current balance component (0-15): below 2% of budget is critical
    const balComponent = clamp(((5 - fbPctOfBudget) / 5) * 15, 0, 15);
    // Trend component (0-10): declining >30% from peak = max
    const trendComponent = fbTrend < 0 ? clamp((-fbTrend / 50) * 10, 0, 10) : 0;
    fbDeclineScore = balComponent + trendComponent;
  } else if (fs?.fundBalanceHistory) {
    // Fallback to hand-coded data for focal districts
    const hist = fs.fundBalanceHistory;
    fbPctOfBudget = hist[hist.length - 1].pctBudget;
    const first = hist[0].pctBudget;
    fbTrend = ((fbPctOfBudget - first) / Math.max(first, 0.1)) * 100;
    const balComponent = clamp(((5 - fbPctOfBudget) / 5) * 15, 0, 15);
    const trendComponent = fbTrend < 0 ? clamp((-fbTrend / 50) * 10, 0, 10) : 0;
    fbDeclineScore = balComponent + trendComponent;
  }

  indicators.push({
    id: "fund-balance",
    label: "Declining Fund Balance",
    score: Math.round(fbDeclineScore),
    max: 25,
    severity: fbDeclineScore > 15 ? "critical" : fbDeclineScore > 8 ? "warning" : "stable",
    detail: fbPctOfBudget !== null
      ? `Unrestricted surplus is ${fbPctOfBudget.toFixed(1)}% of budget${fbTrend !== null ? ` (${fbTrend >= 0 ? "+" : ""}${fbTrend.toFixed(0)}% trend)` : ''}`
      : 'No fund balance data available',
    metric: fbPctOfBudget !== null ? `${fbPctOfBudget.toFixed(1)}%` : '—',
    raw: fbPctOfBudget || 0,
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

  // ── 3. ESSER Cliff Exposure ────────────────────────────────
  // Total ESSER allocation (I + II + III) as % of budget — these funds are now
  // EXPIRED. Districts that had high ESSER dependency face a fiscal cliff.
  const esser = fd?.esser || (fs?.esser ? {
    total: (fs.esser.total || 0),
    i: 0, ii: 0, iii: 0,
  } : null);
  const esserTotal = esser?.total || 0;
  // Annualized: ESSER was spread over ~4 years (FY21-FY24), so annual impact ≈ total/4
  const esserAnnual = esserTotal / 4;
  const esserPct = budget > 0 ? (esserAnnual / budget) * 100 : 0;
  // Districts where annualized ESSER was >5% of budget had severe dependency
  const esserScore = clamp((esserPct / 8) * 25, 0, 25);
  let esserDetail;
  if (fs?.esser) {
    esserDetail = `Total ESSER: $${(esserTotal / 1e6).toFixed(1)}M (${esserPct.toFixed(1)}% annual). ${fs.esser.positionsFundedByEsser} positions funded. Used for: ${fs.esser.usedFor.join(', ')}`;
  } else if (esserTotal > 0) {
    esserDetail = `Total ESSER allocation: $${(esserTotal / 1e6).toFixed(1)}M (~${esserPct.toFixed(1)}% of budget annually). These funds expired Sept 2024.`;
  } else {
    esserDetail = 'No ESSER allocation data available';
  }
  indicators.push({
    id: "esser-cliff",
    label: "ESSER Cliff Exposure",
    score: Math.round(esserScore),
    max: 25,
    severity: esserScore > 15 ? "critical" : esserScore > 8 ? "warning" : "stable",
    detail: esserDetail,
    metric: esserTotal > 0 ? `$${(esserTotal / 1e6).toFixed(1)}M` : '—',
    raw: esserPct,
  });

  // ── 4. Tax Capacity Exhaustion ──────────────────────────────
  const avgEV = (d.ev3yr[0] + d.ev3yr[1] + d.ev3yr[2]) / 3;
  const levy = u.localTaxLevy || d.levy || 0;
  const eqTaxRate = avgEV > 0 ? (levy / avgEV) * 100 : 0;
  const levyVsLfs = formula.lfs > 0 ? (levy / formula.lfs) * 100 : 100;
  const taxScore = clamp(
    ((eqTaxRate - 1.0) / 1.5) * 15 +
    ((Math.max(0, levyVsLfs - 100)) / 80) * 10,
    0, 25
  );
  indicators.push({
    id: "tax-exhaustion",
    label: "Tax Capacity Exhaustion",
    score: Math.round(taxScore),
    max: 25,
    severity: taxScore > 15 ? "critical" : taxScore > 8 ? "warning" : "stable",
    detail: eqTaxRate > 1.5
      ? `Eq. tax rate ${eqTaxRate.toFixed(3)}% (high) — levy is ${levyVsLfs.toFixed(0)}% of formula LFS, limited room for local increases`
      : `Eq. tax rate ${eqTaxRate.toFixed(3)}% — levy is ${levyVsLfs.toFixed(0)}% of formula LFS`,
    metric: `${eqTaxRate.toFixed(2)}%`,
    raw: eqTaxRate,
  });

  const totalScore = indicators.reduce((s, ind) => s + ind.score, 0);

  return {
    key: null,
    indicators,
    totalScore,
    maxScore: 100,
    level: totalScore >= 65 ? "severe" : totalScore >= 40 ? "elevated" : totalScore >= 20 ? "moderate" : "low",
    formula,
    hasDetail: !!fs,
    hasFiscalData: !!fd,
    // Quick-access metrics for table sorting
    aidChangePct: d.fy25 > 0 ? ((d.fy26 - d.fy25) / d.fy25) * 100 : 0,
    adequacyGapPct: gapPct,
    esserPct,
    eqTaxRate,
    fbPctOfBudget: fbPctOfBudget || 0,
    // Expose data for charts
    fundBalance: fd?.fundBalance || null,
    esserAlloc: esser,
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
      const stress = scoreDistrict(d, overrides, key);
      stress.key = key;
      return { key, district: d, stress };
    })
    .sort((a, b) => b.stress.totalScore - a.stress.totalScore);
}
