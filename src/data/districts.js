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

// Default comparison set (original 4 districts)
export const DEFAULT_COMPARED = ['westOrange', 'cherryHill', 'newark', 'paterson'];

// All district keys sorted by name
export const DISTRICT_LIST = Object.entries(DISTRICTS)
  .map(([key, d]) => ({ key, name: d.name, county: d.county, type: d.type, dfg: d.dfg, short: d.short }))
  .sort((a, b) => a.name.localeCompare(b.name));
