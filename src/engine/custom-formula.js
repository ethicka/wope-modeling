import { FORMULA } from '../data/formula-params.js';
import { CUSTOM_DEFAULTS } from '../data/custom-formula-data.js';
import { runFormula } from './sfra-formula.js';

export function runCustomFormula(d, cd, params = {}) {
  const p = { ...CUSTOM_DEFAULTS, ...params };
  const base = p.customBase;
  const enrollment = d.enr.total;

  // Choose poverty metric
  const povertyRate = p.useFreeLunchAsPoverty ? d.atRiskPct : cd.povertyRate;

  // Build the compound need multiplier
  const idf = 1.0 + (cd.incomeDiversityFactor - 1.0) * p.idfWeight;
  const tbi = 1.0 + (cd.taxBurdenIndex - 1.0) * p.tbiWeight;
  const povertyFactor = Math.pow(povertyRate, p.povertyExponent);

  // Core need: Base × (1 + PovertyFactor × IDF × TBI) × Enrollment
  // Every district gets at least base × enrollment, with high-need districts getting more.
  const needMultiplier = povertyFactor * idf * tbi;
  const coreNeed = base * (1.0 + needMultiplier) * enrollment;

  // Subtract Local Fair Share — same as SFRA: districts that can fund themselves get less aid.
  const avgEV = (d.ev3yr[0] + d.ev3yr[1] + d.ev3yr[2]) / 3;
  const lfs = (avgEV * FORMULA.evMult + d.income * FORMULA.incMult) / 2;

  // Core equalization: need minus local capacity (floored at 0)
  const coreAid = Math.max(0, coreNeed - lfs);

  // Categoricals: use actual SFRA allocations (state-set pass-throughs, not part of custom formula)
  const spedAid = p.spedAddon ? d.fy26Detail.sped : 0;
  const secAid = p.securityAddon ? d.fy26Detail.sec : 0;
  const transAid = d.fy26Detail.trans;

  const totalCustom = coreAid + spedAid + secAid + transAid;
  const perPupil = totalCustom / enrollment;

  // Run uncapped SFRA for apples-to-apples comparison (both are formula outputs without caps)
  const sfraNoCap = runFormula(d, { fullFunding: true });
  const sfraUncapped = sfraNoCap.totalFormula;

  // Also get capped SFRA for real-world context
  const sfraCapped = runFormula(d);

  return {
    coreNeed, coreAid, lfs, needMultiplier,
    spedAid, secAid, transAid,
    totalCustom, perPupil,
    povertyRate, idf, tbi, povertyFactor,
    aidPctBudget: totalCustom / d.budget * 100,
    // Primary comparison: vs uncapped SFRA formula (apples-to-apples)
    sfraUncapped,
    changeSfra: totalCustom - sfraUncapped,
    changeSfraPct: ((totalCustom - sfraUncapped) / sfraUncapped) * 100,
    // Secondary: vs capped FY26 actual
    sfraCapped: sfraCapped.totalFormula,
    changeFy26: totalCustom - sfraCapped.totalFormula,
    changeFy26Pct: ((totalCustom - sfraCapped.totalFormula) / sfraCapped.totalFormula) * 100,
    // Vs prior year
    changeFy25: totalCustom - d.fy25,
    changeFy25Pct: ((totalCustom - d.fy25) / d.fy25) * 100,
  };
}
