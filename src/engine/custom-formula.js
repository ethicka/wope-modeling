import { FORMULA } from '../data/formula-params.js';
import { DISTRICTS } from '../data/districts.js';
import { CUSTOM_DATA, CUSTOM_DEFAULTS } from '../data/custom-formula-data.js';
import { runFormula } from './sfra-formula.js';

// Cap TBI to prevent bad income estimates from dominating
const TBI_MIN = 0.5;
const TBI_MAX = 2.0;

/** Compute custom formula for a single district */
export function runCustomFormula(d, cd, params = {}) {
  const p = { ...CUSTOM_DEFAULTS, ...params };
  const base = p.customBase;
  const enrollment = d.enr.total;

  // Choose poverty metric
  const povertyRate = p.useFreeLunchAsPoverty ? d.atRiskPct : cd.povertyRate;

  // Build the compound need multiplier (with TBI capped)
  const idf = 1.0 + (cd.incomeDiversityFactor - 1.0) * p.idfWeight;
  const tbiRaw = 1.0 + (cd.taxBurdenIndex - 1.0) * p.tbiWeight;
  const tbi = Math.min(TBI_MAX, Math.max(TBI_MIN, tbiRaw));
  const povertyFactor = Math.pow(povertyRate, p.povertyExponent);

  // Core need: Base × (1 + PovertyFactor × IDF × TBI) × Enrollment
  const needMultiplier = povertyFactor * idf * tbi;
  const coreNeed = base * (1.0 + needMultiplier) * enrollment;

  // Subtract Local Fair Share
  const avgEV = (d.ev3yr[0] + d.ev3yr[1] + d.ev3yr[2]) / 3;
  const lfs = (avgEV * FORMULA.evMult + d.income * FORMULA.incMult) / 2;

  // Core equalization: need minus local capacity (floored at 0)
  const coreAid = Math.max(0, coreNeed - lfs);

  // Categoricals: use actual SFRA allocations (state-set pass-throughs)
  const spedAid = p.spedAddon ? d.fy26Detail.sped : 0;
  const secAid = p.securityAddon ? d.fy26Detail.sec : 0;
  const transAid = d.fy26Detail.trans;

  const totalCustom = coreAid + spedAid + secAid + transAid;
  const perPupil = totalCustom / enrollment;

  // Run uncapped SFRA for apples-to-apples comparison
  const sfraNoCap = runFormula(d, { fullFunding: true });
  const sfraUncapped = sfraNoCap.totalFormula;
  const sfraCapped = runFormula(d);

  return {
    coreNeed, coreAid, lfs, needMultiplier,
    spedAid, secAid, transAid,
    totalCustom, perPupil,
    povertyRate, idf, tbi, tbiRaw, povertyFactor,
    aidPctBudget: totalCustom / d.budget * 100,
    sfraUncapped,
    changeSfra: totalCustom - sfraUncapped,
    changeSfraPct: sfraUncapped > 0 ? ((totalCustom - sfraUncapped) / sfraUncapped) * 100 : 0,
    sfraCapped: sfraCapped.totalFormula,
    changeFy26: totalCustom - sfraCapped.totalFormula,
    changeFy26Pct: sfraCapped.totalFormula > 0 ? ((totalCustom - sfraCapped.totalFormula) / sfraCapped.totalFormula) * 100 : 0,
    changeFy25: totalCustom - d.fy25,
    changeFy25Pct: d.fy25 > 0 ? ((totalCustom - d.fy25) / d.fy25) * 100 : 0,
  };
}

/**
 * Find the base per pupil that makes total custom aid = target total statewide.
 * Uses binary search across all districts.
 */
export function calibrateRevenueNeutralBase(params = {}, target = null) {
  const p = { ...CUSTOM_DEFAULTS, ...params };
  const entries = Object.entries(DISTRICTS);

  // Default target: sum of all FY26 actual aid
  if (target === null) {
    target = entries.reduce((s, [, d]) => s + d.fy26, 0);
  }

  function calcTotal(basePP) {
    let total = 0;
    for (const [key, d] of entries) {
      const cd = CUSTOM_DATA[key];
      if (!cd) continue;
      const povertyRate = p.useFreeLunchAsPoverty ? d.atRiskPct : cd.povertyRate;
      const idf = 1.0 + (cd.incomeDiversityFactor - 1.0) * p.idfWeight;
      const tbiRaw = 1.0 + (cd.taxBurdenIndex - 1.0) * p.tbiWeight;
      const tbi = Math.min(TBI_MAX, Math.max(TBI_MIN, tbiRaw));
      const povertyFactor = Math.pow(povertyRate, p.povertyExponent);
      const needMultiplier = povertyFactor * idf * tbi;
      const coreNeed = basePP * (1.0 + needMultiplier) * d.enr.total;
      const avgEV = (d.ev3yr[0] + d.ev3yr[1] + d.ev3yr[2]) / 3;
      const lfs = (avgEV * FORMULA.evMult + d.income * FORMULA.incMult) / 2;
      const coreAid = Math.max(0, coreNeed - lfs);
      const cats = (p.spedAddon ? d.fy26Detail.sped : 0) + (p.securityAddon ? d.fy26Detail.sec : 0) + d.fy26Detail.trans;
      total += coreAid + cats;
    }
    return total;
  }

  let lo = 1000, hi = 40000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (calcTotal(mid) < target) lo = mid;
    else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}

/**
 * Run custom formula across ALL districts and return redistribution analysis.
 */
export function calcStatewideRedistribution(params = {}) {
  const p = { ...CUSTOM_DEFAULTS, ...params };
  const entries = Object.entries(DISTRICTS);

  let totalCustom = 0;
  let totalFy26 = 0;
  let totalSfraUncapped = 0;
  const results = [];

  for (const [key, d] of entries) {
    const cd = CUSTOM_DATA[key];
    if (!cd) continue;
    const r = runCustomFormula(d, cd, p);
    totalCustom += r.totalCustom;
    totalFy26 += d.fy26;
    totalSfraUncapped += r.sfraUncapped;

    results.push({
      key, name: d.name, short: d.short, county: d.county,
      frl: d.atRiskPct, enrollment: d.enr.total, dfg: d.dfg,
      customTotal: r.totalCustom,
      customPP: r.perPupil,
      fy26: d.fy26,
      fy26PP: d.fy26 / d.enr.total,
      sfraUncapped: r.sfraUncapped,
      deltaFy26: r.totalCustom - d.fy26,
      deltaFy26Pct: d.fy26 > 0 ? ((r.totalCustom - d.fy26) / d.fy26) * 100 : 0,
      deltaSfra: r.changeSfra,
      deltaSfraPct: r.changeSfraPct,
    });
  }

  results.sort((a, b) => b.deltaFy26 - a.deltaFy26);
  const gainers = results.filter(r => r.deltaFy26 > 100000);
  const losers = results.filter(r => r.deltaFy26 < -100000);
  const flat = results.filter(r => Math.abs(r.deltaFy26) <= 100000);

  return {
    totalCustom, totalFy26, totalSfraUncapped,
    deltaTotal: totalCustom - totalFy26,
    results,
    gainers: gainers.length,
    losers: losers.length,
    flat: flat.length,
    topGainers: results.slice(0, 10),
    topLosers: results.slice(-10).reverse(),
  };
}
