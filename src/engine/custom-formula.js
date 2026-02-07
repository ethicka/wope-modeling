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
