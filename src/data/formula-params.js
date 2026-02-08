export const FORMULA = {
  basePP: 14972,
  gradeWeights: { elem: 1.0, middle: 1.04, high: 1.15 },
  atRiskRange: { low: 0.47, mid40: 0.52, high: 0.57 },
  lepWeight: 0.50,
  comboWeight: 0.125,
  spedRate: 0.165, speechRate: 0.0168,
  spedExcess: 23172, speechExcess: 1414,
  secBase: 140, secAtRisk: 411,
  evMult: 0.014949314, incMult: 0.059963161,
};

export const GCA = {
  atlantic: 0.9693, bergen: 1.0051, burlington: 0.9848, camden: 0.9767,
  capemay: 0.9429, cumberland: 0.9530, essex: 1.0237, gloucester: 0.9703,
  hudson: 1.0341, hunterdon: 1.0084, mercer: 1.0087, middlesex: 1.0046,
  monmouth: 0.9953, morris: 1.0179, ocean: 0.9678, passaic: 0.9893,
  salem: 0.9703, somerset: 1.0355, sussex: 0.9873, union: 1.0182, warren: 0.9660,
};

export const SCENARIOS = {
  current: { label: "Current SFRA (FY26)", desc: "S-2 with FY26 budget caps (-3%/+6%)", overrides: {} },
  lfsCap2: { label: "2% LFS Cap", desc: "Cap Local Fair Share growth at 2% above current levy", overrides: { lfsCap: 0.02 } },
  fullFund: { label: "Full SFRA Funding", desc: "Remove aid change caps, fund all districts at formula", overrides: { fullFunding: true } },
  capPlusFull: { label: "Cap + Full Funding", desc: "2% LFS cap combined with full formula funding", overrides: { lfsCap: 0.02, fullFunding: true } },
  weightedNeed: {
    label: "Weighted by Need", desc: "Increase at-risk weights for high-poverty districts",
    overrides: { atRiskRange: { low: 0.50, mid40: 0.60, high: 0.70 }, fullFunding: true }
  },
};

export const GROWTH_DEFAULTS = { ev: 4.0, income: 3.0, enrollment: -0.2, cpi: 3.5, levy: 2.0, budgetGrowth: 4.5 };

export const VIEWS = ["profiles", "formula", "results", "budget", "projection", "fiscal", "stress", "custom"];
export const VIEW_LABELS = { profiles: "District Profiles", formula: "SFRA Editor", results: "Results Dashboard", budget: "Budget Analysis", projection: "5-Year Projection", fiscal: "State Fiscal Impact", stress: "Fiscal Stress", custom: "Custom Formula" };
