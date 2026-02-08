import { FORMULA } from '../data/formula-params.js';
import { CUSTOM_DEFAULTS } from '../data/custom-formula-data.js';
import { calcSecurityAtRiskPP } from './sfra-formula.js';

export function runCustomFormula(d, cd, params = {}) {
  const p = { ...CUSTOM_DEFAULTS, ...params };
  const base = p.customBase;
  const enrollment = d.enr.total;

  // Choose poverty metric
  const povertyRate = p.useFreeLunchAsPoverty ? d.atRiskPct : cd.povertyRate;

  // Build the compound multiplier
  const idf = 1.0 + (cd.incomeDiversityFactor - 1.0) * p.idfWeight;
  const tbi = 1.0 + (cd.taxBurdenIndex - 1.0) * p.tbiWeight;
  const povertyFactor = Math.pow(povertyRate, p.povertyExponent);

  // Core need: Base × (1 + PovertyFactor × IDF × TBI) × Enrollment
  // This computes an "adequacy" budget — what the district needs — weighted by need factors.
  // The poverty/IDF/TBI multipliers add to a base of 1.0, so every district gets at least
  // base × enrollment, with high-need districts getting more.
  const needMultiplier = povertyFactor * idf * tbi;
  const coreNeed = base * (1.0 + needMultiplier) * enrollment;

  // Subtract Local Fair Share — same as SFRA: districts that can fund themselves get less aid.
  // LFS = (avg3yrEV × evMult + aggregateIncome × incMult) / 2
  const avgEV = (d.ev3yr[0] + d.ev3yr[1] + d.ev3yr[2]) / 3;
  const evMult = FORMULA.evMult;
  const incMult = FORMULA.incMult;
  let lfs = (avgEV * evMult + d.income * incMult) / 2;

  // Core equalization: need minus local capacity (floored at 0)
  const coreAid = Math.max(0, coreNeed - lfs);

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
    coreNeed, coreAid, lfs, needMultiplier,
    spedAdd, secAdd, transAid: d.fy26Detail.trans,
    totalCustom, perPupil,
    povertyRate, idf, tbi, povertyFactor,
    aidPctBudget: totalCustom / d.budget * 100,
    changeFy25: totalCustom - d.fy25,
    changePct: ((totalCustom - d.fy25) / d.fy25) * 100,
    changeSfra: totalCustom - d.fy26,
    changeSfraPct: ((totalCustom - d.fy26) / d.fy26) * 100,
  };
}
