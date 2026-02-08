import { DISTRICTS as GEN_DISTRICTS } from './districts-generated.js';

// West Orange hand-coded extras (budgetItems, detailed ufb with FY27 projections)
const WO_EXTRAS = {
  ev3yr: [10002286871, 9580000000, 9200000000],
  budget: 203423298,
  ufb: {
    totalBudget: 200805708,
    localTaxLevy: 159415304,
    stateAid: 32894514,
    federalAid: 3735722,
    otherRevenue: 972478,
    fundBalance: 3787690,
    maintReserve: 500000,
    fy27Budget: 203423298,
    fy27Levy: 162129041,
    fy27StateAid: 32578262,
    fy27FedAid: 4290995,
    fy27Other: 425000,
    fy27FundBalance: 4000000,
    instruction: 105400000, classroomSalBen: 94800000,
    support: 22500000, admin: 16200000, opsMain: 24600000,
    extracurricular: 3100000, equipment: 6416333,
    debtService: 0, ppCost: 28687,
  },
  budgetItems: [
    { name: "Salaries",              fy26: 111632774, pct: 0.5485, growthRate: 0.035 },
    { name: "Benefits",              fy26: 34950466,  pct: 0.1717, growthRate: 0.10 },
    { name: "Instructional Support",  fy26: 9363527,   pct: 0.046,  growthRate: 0.00 },
    { name: "Support Services",       fy26: 4939543,   pct: 0.0243, growthRate: 0.03 },
    { name: "Maintenance Contracts",  fy26: 2246096,   pct: 0.011,  growthRate: 0.04 },
    { name: "Custodial & Security",   fy26: 5298825,   pct: 0.026,  growthRate: 0.03 },
    { name: "Tuition",               fy26: 12445881,  pct: 0.0612, growthRate: 0.08 },
    { name: "Property Insurance",     fy26: 1203124,   pct: 0.0059, growthRate: 0.08 },
    { name: "Transportation",         fy26: 15011328,  pct: 0.0738, growthRate: 0.06 },
    { name: "Equipment",             fy26: 6416333,   pct: 0.0315, growthRate: 0.00 },
  ],
  accent: "#60a5fa",
};

// Detailed fiscal stress data for 4 focal districts (multi-year history, ESSER detail)
const FISCAL_STRESS_DETAIL = {
  westOrange: {
    fundBalanceHistory: [
      { year: "FY22", balance: 6200000, pctBudget: 3.3 },
      { year: "FY23", balance: 5400000, pctBudget: 2.8 },
      { year: "FY24", balance: 4500000, pctBudget: 2.3 },
      { year: "FY25", balance: 3787690, pctBudget: 1.9 },
      { year: "FY26", balance: 3787690, pctBudget: 1.9 },
    ],
    esser: {
      totalAllocation: 8900000,
      spent: { fy21: 1200000, fy22: 2800000, fy23: 2600000, fy24: 1900000, fy25: 400000 },
      usedFor: ["Tutoring & intervention staff", "HVAC upgrades", "Summer programming", "Technology devices"],
      positionsFundedByEsser: 12,
      cliffExposure: 2100000,
    },
    revenueGrowthRate: 2.1,
    costGrowthRate: 4.8,
    budgetHistory: [
      { year: "FY22", budget: 181000000, revenue: 178500000 },
      { year: "FY23", budget: 188000000, revenue: 183200000 },
      { year: "FY24", budget: 195000000, revenue: 190000000 },
      { year: "FY25", budget: 200805708, revenue: 197018018 },
      { year: "FY26", budget: 203423298, revenue: 200117808 },
    ],
  },
  cherryHill: {
    fundBalanceHistory: [
      { year: "FY22", balance: 18500000, pctBudget: 7.4 },
      { year: "FY23", balance: 16200000, pctBudget: 6.3 },
      { year: "FY24", balance: 12800000, pctBudget: 4.9 },
      { year: "FY25", balance: 8400000, pctBudget: 3.2 },
      { year: "FY26", balance: 5200000, pctBudget: 2.0 },
    ],
    esser: {
      totalAllocation: 14200000,
      spent: { fy21: 1800000, fy22: 4100000, fy23: 4200000, fy24: 3200000, fy25: 900000 },
      usedFor: ["Mental health counselors", "Reading specialists", "Building ventilation", "Learning loss programs"],
      positionsFundedByEsser: 18,
      cliffExposure: 3400000,
    },
    revenueGrowthRate: 1.8,
    costGrowthRate: 3.9,
    budgetHistory: [
      { year: "FY22", budget: 238000000, revenue: 237000000 },
      { year: "FY23", budget: 247000000, revenue: 243000000 },
      { year: "FY24", budget: 253000000, revenue: 248500000 },
      { year: "FY25", budget: 260500000, revenue: 255800000 },
      { year: "FY26", budget: 268000000, revenue: 260400000 },
    ],
  },
  newark: {
    fundBalanceHistory: [
      { year: "FY22", balance: 85000000, pctBudget: 5.2 },
      { year: "FY23", balance: 72000000, pctBudget: 4.3 },
      { year: "FY24", balance: 58000000, pctBudget: 3.4 },
      { year: "FY25", balance: 42000000, pctBudget: 2.4 },
      { year: "FY26", balance: 28000000, pctBudget: 1.6 },
    ],
    esser: {
      totalAllocation: 380000000,
      spent: { fy21: 45000000, fy22: 110000000, fy23: 120000000, fy24: 85000000, fy25: 20000000 },
      usedFor: ["Community schools staffing", "Extended day programs", "Facilities remediation", "Technology infrastructure", "Intervention specialists"],
      positionsFundedByEsser: 340,
      cliffExposure: 95000000,
    },
    revenueGrowthRate: 3.2,
    costGrowthRate: 5.5,
    budgetHistory: [
      { year: "FY22", budget: 1520000000, revenue: 1510000000 },
      { year: "FY23", budget: 1610000000, revenue: 1580000000 },
      { year: "FY24", budget: 1680000000, revenue: 1640000000 },
      { year: "FY25", budget: 1750000000, revenue: 1700000000 },
      { year: "FY26", budget: 1820000000, revenue: 1750000000 },
    ],
  },
  paterson: {
    fundBalanceHistory: [
      { year: "FY22", balance: 48000000, pctBudget: 6.0 },
      { year: "FY23", balance: 39000000, pctBudget: 4.7 },
      { year: "FY24", balance: 30000000, pctBudget: 3.5 },
      { year: "FY25", balance: 20000000, pctBudget: 2.3 },
      { year: "FY26", balance: 12000000, pctBudget: 1.4 },
    ],
    esser: {
      totalAllocation: 195000000,
      spent: { fy21: 22000000, fy22: 58000000, fy23: 62000000, fy24: 43000000, fy25: 10000000 },
      usedFor: ["Bilingual staff expansion", "Summer & afterschool programs", "Student devices & connectivity", "Social workers & counselors"],
      positionsFundedByEsser: 185,
      cliffExposure: 52000000,
    },
    revenueGrowthRate: 2.8,
    costGrowthRate: 5.1,
    budgetHistory: [
      { year: "FY22", budget: 740000000, revenue: 735000000 },
      { year: "FY23", budget: 785000000, revenue: 770000000 },
      { year: "FY24", budget: 818000000, revenue: 798000000 },
      { year: "FY25", budget: 850000000, revenue: 830000000 },
      { year: "FY26", budget: 880000000, revenue: 850000000 },
    ],
  },
};

// Build the merged districts object
export const DISTRICTS = { ...GEN_DISTRICTS };

// Overlay WO extras
if (DISTRICTS.westOrange) {
  DISTRICTS.westOrange = {
    ...DISTRICTS.westOrange,
    ...WO_EXTRAS,
    ufb: { ...DISTRICTS.westOrange.ufb, ...WO_EXTRAS.ufb },
  };
}

// Overlay detailed fiscal stress data for focal districts
for (const [key, fsData] of Object.entries(FISCAL_STRESS_DETAIL)) {
  if (DISTRICTS[key]) {
    DISTRICTS[key].fiscalStress = fsData;
  }
}

// Default comparison set (original 4 districts)
export const DEFAULT_COMPARED = ['westOrange', 'cherryHill', 'newark', 'paterson'];

// All district keys sorted by name
export const DISTRICT_LIST = Object.entries(DISTRICTS)
  .map(([key, d]) => ({ key, name: d.name, county: d.county, type: d.type, dfg: d.dfg, short: d.short }))
  .sort((a, b) => a.name.localeCompare(b.name));
