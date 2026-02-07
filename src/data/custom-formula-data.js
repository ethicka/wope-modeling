import { DISTRICTS } from './districts.js';

export const STATEWIDE_TAX_BURDEN_PCT = 0.0457;

// Hand-coded data for original 4 districts (census-sourced)
const HAND_CODED = {
  westOrange: { medianIncome: 112000, povertyRate: 0.064, incomeDiversityFactor: 1.22, taxBurdenPct: 0.0699 },
  cherryHill: { medianIncome: 105000, povertyRate: 0.048, incomeDiversityFactor: 1.15, taxBurdenPct: 0.0566 },
  newark:     { medianIncome: 37000,  povertyRate: 0.263, incomeDiversityFactor: 1.42, taxBurdenPct: 0.0528 },
  paterson:   { medianIncome: 38000,  povertyRate: 0.278, incomeDiversityFactor: 1.38, taxBurdenPct: 0.0684 },
};

// Auto-generate CUSTOM_DATA for all districts
export const CUSTOM_DATA = {};

for (const [key, d] of Object.entries(DISTRICTS)) {
  if (HAND_CODED[key]) {
    CUSTOM_DATA[key] = { ...HAND_CODED[key] };
  } else {
    // Estimate from available data
    const estMedianIncome = d.income > 0 && d.enr.total > 0
      ? Math.round(d.income / (d.enr.total * 1.1)) // ~1.1 students per household
      : 80000;
    const povertyRate = d.atRiskPct; // Use FRL as proxy
    // IDF: higher for districts with more diverse income (proxy: moderate poverty = more diversity)
    const idf = 1.0 + Math.min(0.5, povertyRate * (1 - povertyRate) * 4);
    const taxBurdenPct = d.income > 0 ? d.levy / d.income : STATEWIDE_TAX_BURDEN_PCT;

    CUSTOM_DATA[key] = {
      medianIncome: estMedianIncome,
      povertyRate,
      incomeDiversityFactor: Math.round(idf * 100) / 100,
      taxBurdenPct: Math.round(taxBurdenPct * 10000) / 10000,
    };
  }
  CUSTOM_DATA[key].taxBurdenIndex = CUSTOM_DATA[key].taxBurdenPct / STATEWIDE_TAX_BURDEN_PCT;
}

export const CUSTOM_DEFAULTS = {
  customBase: 14972,
  povertyExponent: 1.0,
  idfWeight: 1.0,
  tbiWeight: 1.0,
  useFreeLunchAsPoverty: true,
  minAidPP: 500,
  spedAddon: true,
  securityAddon: true,
};
