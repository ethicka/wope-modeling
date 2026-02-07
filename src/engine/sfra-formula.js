import { FORMULA } from '../data/formula-params.js';

export function calcAtRiskWeight(pct) {
  if (pct <= 0.20) return FORMULA.atRiskRange.low;
  if (pct >= 0.60) return FORMULA.atRiskRange.high;
  return 0.47 + ((pct - 0.20) / 0.40) * (0.57 - 0.47);
}

export function calcSecurityAtRiskPP(pct) {
  if (pct >= 0.40) return FORMULA.secAtRisk;
  if (pct <= 0) return 0;
  return FORMULA.secAtRisk * (pct / 0.40);
}

export function runFormula(d, overrides = {}) {
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
