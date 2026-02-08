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
    // IDF: proxy for income diversity within the district
    // Higher in mixed-income districts (moderate FRL), lower in uniformly wealthy or uniformly poor
    // Calibrated to match hand-coded values: WO(39%FRL)=1.22, CH(23%)=1.15, NK(76%)=1.42, PT(69%)=1.38
    // Urban high-poverty districts tend to have more income diversity (1.3-1.5)
    // Wealthy suburbs with low FRL tend to be more homogeneous (1.05-1.15)
    // Mixed suburbs (moderate FRL) fall in between (1.15-1.25)
    let idf;
    if (povertyRate >= 0.50) {
      // High-poverty: more diversity due to income stratification (1.30-1.50)
      idf = 1.30 + (povertyRate - 0.50) * 0.40;
    } else if (povertyRate >= 0.25) {
      // Mixed: moderate diversity (1.15-1.30)
      idf = 1.15 + (povertyRate - 0.25) * 0.60;
    } else {
      // Low-poverty: more homogeneous (1.00-1.15)
      idf = 1.00 + povertyRate * 0.60;
    }
    idf = Math.round(Math.min(1.50, Math.max(1.00, idf)) * 100) / 100;
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
  spedAddon: true,
  securityAddon: true,
};
