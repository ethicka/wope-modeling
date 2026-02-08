import { FORMULA } from '../data/formula-params.js';
import { CUSTOM_DEFAULTS, CUSTOM_DATA } from '../data/custom-formula-data.js';
import { DISTRICTS } from '../data/districts.js';
import { runFormula } from './sfra-formula.js';

// TBI bounds: minimum 1.0 so it only rewards effort, never penalizes.
// Districts with TBI < 1.0 either have low effort (wealthy, already handled by LFS)
// or unreliable income data (poor cities). Either way, penalizing hurts equity.
const TBI_MIN = 1.0;
const TBI_MAX = 2.0;

// CEP (Community Eligibility Provision) correction: districts where all students
// get free meals but individual FRL counts aren't reported, causing artificially
// low atRiskPct. For DFG "A" districts with FRL below threshold, use DFG-A average.
const CEP_FRL_THRESHOLD = 0.60; // DFG-A districts below this are likely CEP-affected
const CEP_FRL_FLOOR = 0.79;     // Average FRL% for DFG-A districts with correct data

/** Compute custom formula for a single district */
export function runCustomFormula(d, cd, params = {}) {
  const p = { ...CUSTOM_DEFAULTS, ...params };
  const base = p.customBase;
  const enrollment = d.enr.total;

  // Choose poverty metric, with CEP correction for DFG-A districts
  let povertyRate = p.useFreeLunchAsPoverty ? d.atRiskPct : cd.povertyRate;
  const cepCorrected = p.useFreeLunchAsPoverty && d.dfg === 'A' && d.atRiskPct < CEP_FRL_THRESHOLD;
  if (cepCorrected) povertyRate = CEP_FRL_FLOOR;

  // Build the compound need multiplier (with TBI capped)
  const idf = 1.0 + (cd.incomeDiversityFactor - 1.0) * p.idfWeight;
  const tbiRaw = 1.0 + (cd.taxBurdenIndex - 1.0) * p.tbiWeight;
  const tbi = Math.min(TBI_MAX, Math.max(TBI_MIN, tbiRaw));
  const povertyFactor = Math.pow(povertyRate, p.povertyExponent);

  // Core need: Base × (1 + PovertyFactor × IDF × TBI) × Enrollment × GCA
  // GCA adjusts for regional cost-of-living (county-level)
  const gca = d.gca || 1.0;
  const needMultiplier = povertyFactor * idf * tbi;
  const coreNeed = base * (1.0 + needMultiplier) * enrollment * gca;

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
    coreNeed, coreAid, lfs, needMultiplier, gca,
    spedAid, secAid, transAid,
    totalCustom, perPupil,
    povertyRate, idf, tbi, tbiRaw, povertyFactor, cepCorrected,
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

/** Binary search for a base PP where total statewide custom = total FY26 actual */
export function calibrateRevenueNeutralBase(params = {}) {
  const totalFy26 = Object.values(DISTRICTS).reduce((s, d) =>
    s + d.fy26Detail.eq + d.fy26Detail.sped + d.fy26Detail.sec + d.fy26Detail.trans, 0);

  let lo = 2000, hi = 30000;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const p = { ...CUSTOM_DEFAULTS, ...params, customBase: mid };
    let total = 0;
    for (const [key, d] of Object.entries(DISTRICTS)) {
      const cd = CUSTOM_DATA[key];
      if (!cd || !d.enr.total) continue;
      const r = runCustomFormula(d, cd, p);
      total += r.totalCustom;
    }
    if (total > totalFy26) hi = mid;
    else lo = mid;
  }
  return { base: Math.round((lo + hi) / 2), targetTotal: totalFy26 };
}

/** Run all 558 districts and return redistribution analysis */
export function calcStatewideRedistribution(params = {}) {
  const results = [];
  let totalCustom = 0, totalFy26 = 0, totalSfraUncapped = 0;

  for (const [key, d] of Object.entries(DISTRICTS)) {
    const cd = CUSTOM_DATA[key];
    if (!cd || !d.enr.total) continue;
    const r = runCustomFormula(d, cd, params);
    const fy26Actual = d.fy26Detail.eq + d.fy26Detail.sped + d.fy26Detail.sec + d.fy26Detail.trans;
    const changeFy26 = r.totalCustom - fy26Actual;
    const changeSfra = r.totalCustom - r.sfraUncapped;
    const floorCapBonus = fy26Actual - r.sfraUncapped; // how much FY26 actual exceeds uncapped formula
    results.push({
      key, name: d.name, short: d.short, county: d.county,
      enrollment: d.enr.total, atRiskPct: r.povertyRate, gca: d.gca,
      cepCorrected: r.cepCorrected,
      custom: r.totalCustom, fy26Actual, sfraUncapped: r.sfraUncapped,
      changeFy26, changeFy26Pct: fy26Actual > 0 ? (changeFy26 / fy26Actual) * 100 : 0,
      changeSfra, changeSfraPct: r.sfraUncapped > 0 ? (changeSfra / r.sfraUncapped) * 100 : 0,
      floorCapBonus,
      perPupilCustom: r.perPupil,
      perPupilFy26: fy26Actual / d.enr.total,
      perPupilChange: r.perPupil - fy26Actual / d.enr.total,
    });
    totalCustom += r.totalCustom;
    totalFy26 += fy26Actual;
    totalSfraUncapped += r.sfraUncapped;
  }

  // Sort by change vs uncapped SFRA (apples-to-apples formula comparison)
  results.sort((a, b) => b.changeSfra - a.changeSfra);
  const gainers = results.filter(r => r.changeSfra > 0);
  const losers = results.filter(r => r.changeSfra < 0).reverse();

  return {
    results, gainers, losers,
    totalCustom, totalFy26, totalSfraUncapped,
    netChange: totalCustom - totalFy26,
    netChangeSfra: totalCustom - totalSfraUncapped,
    districtCount: results.length,
    gainerCount: gainers.length,
    loserCount: losers.length,
    totalGains: gainers.reduce((s, r) => s + r.changeSfra, 0),
    totalLosses: losers.reduce((s, r) => s + r.changeSfra, 0),
  };
}
