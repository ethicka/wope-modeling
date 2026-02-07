import { GCA } from './formula-params.js';

export const DISTRICTS = {
  westOrange: {
    name: "West Orange", short: "WO", county: "Essex", type: "Suburban", gca: GCA.essex,
    fy25: 33585837, fy26: 32578262, fy26Detail: { eq: 15463821, sped: 11016015, trans: 3931840, sec: 2166586 },
    ev3yr: [10002286871, 9580000000, 9200000000], income: 2280000000,
    enr: { total: 6999, elem: 3387, mid: 1508, hs: 2104 },
    atRisk: 2732, atRiskPct: 0.3903, lep: 465, combo: 181, levy: 159415304, budget: 203423298,
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
    color: "#2563eb", accent: "#60a5fa"
  },
  cherryHill: {
    name: "Cherry Hill", short: "CH", county: "Camden", type: "Suburban", gca: GCA.camden,
    fy25: 29477245, fy26: 28592928, fy26Detail: { eq: 0, sped: 19431379, trans: 5926519, sec: 3235030 },
    ev3yr: [14610976436, 13500000000, 12500000000], income: 3800000000,
    enr: { total: 10805, elem: 5093, mid: 2305, hs: 3407 },
    atRisk: 2507, atRiskPct: 0.2320, lep: 576, combo: 133, levy: 215000000, budget: 260000000,
    ufb: {
      totalBudget: 260500000, localTaxLevy: 215400000,
      stateAid: 28592928, federalAid: 5800000, otherRevenue: 10607072,
      instruction: 148200000, classroomSalBen: 136000000,
      support: 35400000, admin: 20100000, opsMain: 33500000,
      extracurricular: 4200000, equipment: 1800000,
      debtService: 12500000, ppCost: 20890,
    },
    color: "#059669", accent: "#34d399"
  },
  newark: {
    name: "Newark", short: "NK", county: "Essex", type: "Abbott/Urban", gca: GCA.essex,
    fy25: 1251079807, fy26: 1326144594, fy26Detail: { eq: 1216431478, sped: 68685419, trans: 13434231, sec: 27593466 },
    ev3yr: [31364970064, 28000000000, 25000000000], income: 6800000000,
    enr: { total: 62480, elem: 32364, mid: 13065, hs: 17051 },
    onRoll: 43980,
    atRisk: 47250, atRiskPct: 0.756, lep: 14623, combo: 11000, levy: 380000000, budget: 1750000000,
    ufb: {
      totalBudget: 1750000000, localTaxLevy: 380000000,
      stateAid: 1326144594, federalAid: 38000000, otherRevenue: 5855406,
      instruction: 980000000, classroomSalBen: 830000000,
      support: 245000000, admin: 155000000, opsMain: 210000000,
      extracurricular: 18000000, equipment: 12000000,
      debtService: 45000000, ppCost: 29500,
    },
    color: "#dc2626", accent: "#f87171"
  },
  paterson: {
    name: "Paterson", short: "PT", county: "Passaic", type: "Abbott/Urban", gca: GCA.passaic,
    fy25: 583574424, fy26: 618588888, fy26Detail: { eq: 562429022, sped: 35420863, trans: 8428016, sec: 12310987 },
    ev3yr: [14462162718, 13277933697, 11851947539], income: 2850000000,
    enr: { total: 29914, elem: 16124, mid: 6518, hs: 7272 },
    onRoll: 23609,
    atRisk: 20576, atRiskPct: 0.688, lep: 8824, combo: 5701, levy: 195000000, budget: 850000000,
    ufb: {
      totalBudget: 850000000, localTaxLevy: 195000000,
      stateAid: 618588888, federalAid: 32000000, otherRevenue: 4411112,
      instruction: 478000000, classroomSalBen: 405000000,
      support: 120000000, admin: 75000000, opsMain: 105000000,
      extracurricular: 9000000, equipment: 5000000,
      debtService: 18000000, ppCost: 26600,
    },
    color: "#9333ea", accent: "#c084fc"
  }
};
