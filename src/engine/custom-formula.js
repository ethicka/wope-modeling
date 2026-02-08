import { FORMULA } from '../data/formula-params.js';
import { CUSTOM_DEFAULTS } from '../data/custom-formula-data.js';
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
