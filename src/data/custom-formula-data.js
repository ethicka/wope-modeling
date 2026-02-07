export const STATEWIDE_TAX_BURDEN_PCT = 0.0457;

export const CUSTOM_DATA = {
  westOrange: {
    medianIncome: 112000, povertyRate: 0.064,
    incomeDiversityFactor: 1.22,
    taxBurdenPct: 0.0699,
  },
  cherryHill: {
    medianIncome: 105000, povertyRate: 0.048,
    incomeDiversityFactor: 1.15,
    taxBurdenPct: 0.0566,
  },
  newark: {
    medianIncome: 37000, povertyRate: 0.263,
    incomeDiversityFactor: 1.42,
    taxBurdenPct: 0.0528,
  },
  paterson: {
    medianIncome: 38000, povertyRate: 0.278,
    incomeDiversityFactor: 1.38,
    taxBurdenPct: 0.0684,
  },
};

// Pre-compute statewide-scaled Tax Burden Index
Object.keys(CUSTOM_DATA).forEach(k => {
  CUSTOM_DATA[k].taxBurdenIndex = CUSTOM_DATA[k].taxBurdenPct / STATEWIDE_TAX_BURDEN_PCT;
});

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
