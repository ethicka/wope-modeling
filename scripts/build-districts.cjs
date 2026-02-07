#!/usr/bin/env node
/**
 * ETL Script: Build all-district data from NJ DOE source files
 *
 * Sources:
 *   - FY26_GBM_District_Details.xlsx  → FY25/FY26 aid totals, aid components
 *   - enrollment_2425.xlsx (District)  → enrollment by grade, FRL%, ML%
 *   - esttax26.csv                     → equalized valuations, levy
 *   - rev26.csv                        → revenue detail (levy, state aid, federal, etc.)
 *   - gca2014.pdf (hardcoded)          → GCA factors by county
 *   - DFG2000.xlsx                     → District Factor Groups
 *
 * Output: src/data/districts.js
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const RAW = path.join(__dirname, 'data-raw');

// ══════════════════════════════════════════════════════════════
// 1. GCA factors by county (from gca2014.pdf — FY14 Revised values)
// ══════════════════════════════════════════════════════════════
const GCA_BY_COUNTY = {
  'Atlantic':    0.9693,
  'Bergen':      1.0051,
  'Burlington':  0.9848,
  'Camden':      0.9767,
  'Cape May':    0.9429,
  'Cumberland':  0.9530,
  'Essex':       1.0237,
  'Gloucester':  0.9703,
  'Hudson':      1.0341,
  'Hunterdon':   1.0084,
  'Mercer':      1.0087,
  'Middlesex':   1.0046,
  'Monmouth':    0.9953,
  'Morris':      1.0179,
  'Ocean':       0.9678,
  'Passaic':     0.9893,
  'Salem':       0.9703,
  'Somerset':    1.0355,
  'Sussex':      0.9873,
  'Union':       1.0182,
  'Warren':      0.9660,
};

// ══════════════════════════════════════════════════════════════
// 2. Parse GBM District Details → aid totals
// ══════════════════════════════════════════════════════════════
console.log('Parsing GBM District Details...');
const gbmWb = XLSX.readFile(path.join(RAW, 'FY26_GBM_District_Details.xlsx'));
const gbmWs = gbmWb.Sheets[gbmWb.SheetNames[0]];
const gbmData = XLSX.utils.sheet_to_json(gbmWs, { header: 1 });

const gbmDistricts = {};
for (let i = 5; i < gbmData.length; i++) {
  const row = gbmData[i];
  if (!row[0] || row[0] === 'State' || row[0] === 'Total') break;
  const county = row[0];
  const distCode = String(row[1]).padStart(4, '0');
  const name = row[2];
  const key = `${county}_${distCode}`;
  gbmDistricts[key] = {
    county,
    distCode,
    name,
    fy25: row[3] || 0,
    fy26: row[12] || 0,
    fy26Detail: {
      eq: row[4] || 0,
      adequacyAid: row[5] || 0,
      schoolChoice: row[6] || 0,
      trans: row[7] || 0,
      sped: row[8] || 0,
      sec: row[9] || 0,
      vocStab: row[10] || 0,
      military: row[11] || 0,
    },
    aidDiff: row[13] || 0,
    aidPctDiff: row[14] || 0,
  };
}
console.log(`  → ${Object.keys(gbmDistricts).length} districts from GBM`);

// ══════════════════════════════════════════════════════════════
// 3. Parse Fall Enrollment → grade-band enrollment, FRL%, ML%
// ══════════════════════════════════════════════════════════════
console.log('Parsing Fall Enrollment...');
const enrWb = XLSX.readFile(path.join(RAW, 'enrollment_2425.xlsx'));
const enrWs = enrWb.Sheets['District'];
const enrData = XLSX.utils.sheet_to_json(enrWs, { header: 1 });

const enrollmentByDist = {};
for (let i = 3; i < enrData.length; i++) {
  const row = enrData[i];
  if (!row[0]) continue;
  const countyCode = String(row[0]).padStart(2, '0');
  const countyName = row[1];
  const distCode = String(row[2]).padStart(4, '0');
  const total = row[4] || 0;

  // Grade-band: sum grade columns
  // PK half(19) + PK full(21) + K half(23) + K full(25) + 1st(27) + 2nd(29) + 3rd(31) + 4th(33) + 5th(35) = elem
  // 6th(37) + 7th(39) + 8th(41) = mid
  // 9th(43) + 10th(45) + 11th(47) + 12th(49) = hs
  const pkH = row[19] || 0;
  const pkF = row[21] || 0;
  const kH = row[23] || 0;
  const kF = row[25] || 0;
  const g1 = row[27] || 0;
  const g2 = row[29] || 0;
  const g3 = row[31] || 0;
  const g4 = row[33] || 0;
  const g5 = row[35] || 0;
  const g6 = row[37] || 0;
  const g7 = row[39] || 0;
  const g8 = row[41] || 0;
  const g9 = row[43] || 0;
  const g10 = row[45] || 0;
  const g11 = row[47] || 0;
  const g12 = row[49] || 0;

  const elem = pkH + pkF + kH + kF + g1 + g2 + g3 + g4 + g5;
  const mid = g6 + g7 + g8;
  const hs = g9 + g10 + g11 + g12;

  // FRL = Free Lunch count(51) + Reduced Lunch count(53)
  const freeLunch = row[51] || 0;
  const reducedLunch = row[53] || 0;
  const frl = freeLunch + reducedLunch;
  const frlPct = total > 0 ? frl / total : 0;

  // Multilingual Learners count(55)
  const ml = row[55] || 0;

  const key = `${countyName}_${distCode}`;
  enrollmentByDist[key] = {
    total, elem, mid, hs,
    freeLunch, reducedLunch, frl, frlPct,
    ml,
    countyCode,
  };
}
console.log(`  → ${Object.keys(enrollmentByDist).length} districts from enrollment`);

// ══════════════════════════════════════════════════════════════
// 4. Parse esttax26.csv → equalized valuations
// ══════════════════════════════════════════════════════════════
console.log('Parsing estimated tax rates (EV data)...');
const taxLines = fs.readFileSync(path.join(RAW, 'esttax26.csv'), 'utf-8').split('\n');
const taxHeader = taxLines[0];

// Each row: county_id, county_name, district_id, district_name, reg_district_id, muniflag, reg_name,
//   gen_fun_sch_levy(7), strwo_entv(8), strwo_entv_dt2(9), strwo_gfst_rate(10),
//   total_sch_levy(11), strwi_entv(12), strwi_entv_dt2(13), strwi_tst_rate(14),
//   gen_fun_sch_levy2(15), es_strwo_entv(16), ...
// strwo_entv = equalized valuation (without personal property/railroad)
// We need to aggregate multi-municipality districts

const evByDist = {};
for (let i = 1; i < taxLines.length; i++) {
  const line = taxLines[i]?.trim();
  if (!line) continue;
  // Parse CSV with potential quoted fields
  const cols = parseCSVLine(line);
  const countyName = cols[1]?.replace(/"/g, '').trim();
  const distCode = String(cols[2]?.replace(/"/g, '').trim()).padStart(4, '0');
  const distName = cols[3]?.replace(/"/g, '').trim();
  const genFundLevy = parseFloat(cols[7]) || 0;
  const totalLevy = parseFloat(cols[11]) || 0;
  // Use Equalization Table EV (cols 16/20) — closest to TEV used in SFRA LFS calc
  const estrwoEev = parseFloat(cols[16]) || 0;   // EV from equalization table (without railroad)
  const estrwiEev = parseFloat(cols[20]) || 0;   // EV from equalization table (with railroad)
  // Fallback to school tax rate EV if equalization table not available
  const evWithout = parseFloat(cols[8]) || 0;

  const key = `${countyName}_${distCode}`;
  if (!evByDist[key]) {
    evByDist[key] = {
      genFundLevy: 0, totalLevy: 0,
      ev: 0, evEqTable: 0, distName
    };
  }
  // Aggregate for multi-municipality districts
  evByDist[key].genFundLevy += genFundLevy;
  evByDist[key].totalLevy += totalLevy;
  evByDist[key].ev += evWithout;
  evByDist[key].evEqTable += (estrwiEev || estrwoEev || evWithout);
}
console.log(`  → ${Object.keys(evByDist).length} districts from tax data`);

// ══════════════════════════════════════════════════════════════
// 5. Parse rev26.csv → revenue detail
// ══════════════════════════════════════════════════════════════
console.log('Parsing revenue data...');
const revLines = fs.readFileSync(path.join(RAW, 'rev26.csv'), 'utf-8').split('\n');

// Key line numbers from UFB:
// 114 = Total Tax Levy
// 460 = Equalization Aid
// 420 = Transportation Aid
// 440 = Special Education Aid
// 470 = Security Aid
// 570 = Total Federal Sources (Fund 10)
// ~980 = Grand Total Revenue (varies)
// We'll capture specific revenue lines per district

const revByDist = {};
for (let i = 1; i < revLines.length; i++) {
  const line = revLines[i]?.trim();
  if (!line) continue;
  const cols = parseCSVLine(line);
  const countyName = cols[1]?.replace(/"/g, '').trim();
  const distCode = String(cols[2]?.replace(/"/g, '').trim()).padStart(4, '0');
  const lineNo = parseInt(cols[4]);
  const amount3 = parseFloat(cols[9]) || 0; // amount_3 = FY25-26 budget year

  const key = `${countyName}_${distCode}`;
  if (!revByDist[key]) revByDist[key] = {};

  // Map key revenue line numbers
  switch (lineNo) {
    case 114: revByDist[key].totalTaxLevy = amount3; break;
    case 460: revByDist[key].equalizationAid = amount3; break;
    case 420: revByDist[key].transAid = amount3; break;
    case 440: revByDist[key].spedAid = amount3; break;
    case 470: revByDist[key].securityAid = amount3; break;
    case 570: revByDist[key].federalAid = amount3; break;
    case 510: revByDist[key].totalStateAid = amount3; break;
    case 800: revByDist[key].totalBudget = amount3; break;
  }
}
console.log(`  → ${Object.keys(revByDist).length} districts from revenue`);

// ══════════════════════════════════════════════════════════════
// 6. Parse DFG → District Factor Groups
// ══════════════════════════════════════════════════════════════
console.log('Parsing DFG data...');
const dfgWb = XLSX.readFile(path.join(RAW, 'DFG2000.xlsx'));
const dfgWs = dfgWb.Sheets[dfgWb.SheetNames[0]];
const dfgData = XLSX.utils.sheet_to_json(dfgWs, { header: 1 });

const dfgByDist = {};
// Row 0 = header, data starts at row 1
// Cols: 0=CountyCode, 1=CountyName, 2=DistCode, 3=DistName, 4=2000 DFG, 5=1990 DFG
for (let i = 1; i < dfgData.length; i++) {
  const row = dfgData[i];
  if (!row || row[1] == null) continue;
  const countyName = String(row[1]).trim();
  const distCode = String(row[2] || '').padStart(4, '0');
  const dfg = row[4] || '';
  const key = `${countyName}_${distCode}`;
  if (dfg) dfgByDist[key] = String(dfg).trim();
}
console.log(`  → ${Object.keys(dfgByDist).length} districts from DFG`);

// ══════════════════════════════════════════════════════════════
// 7. Merge everything → district objects
// ══════════════════════════════════════════════════════════════
console.log('\nMerging data...');

// Color palette for districts
const COUNTY_COLORS = {
  'Atlantic': '#2563eb', 'Bergen': '#059669', 'Burlington': '#dc2626',
  'Camden': '#9333ea', 'Cape May': '#f59e0b', 'Cumberland': '#06b6d4',
  'Essex': '#4f46e5', 'Gloucester': '#10b981', 'Hudson': '#ef4444',
  'Hunterdon': '#8b5cf6', 'Mercer': '#14b8a6', 'Middlesex': '#f97316',
  'Monmouth': '#3b82f6', 'Morris': '#22c55e', 'Ocean': '#e11d48',
  'Passaic': '#a855f7', 'Salem': '#0ea5e9', 'Somerset': '#84cc16',
  'Sussex': '#6366f1', 'Union': '#ec4899', 'Warren': '#eab308',
};

const districts = {};
let matched = 0, skipped = 0;

for (const [key, gbm] of Object.entries(gbmDistricts)) {
  const enr = enrollmentByDist[key];
  const ev = evByDist[key];
  const rev = revByDist[key];
  const dfg = dfgByDist[key] || '';
  const gca = GCA_BY_COUNTY[gbm.county] || 1.0;

  // Need at minimum enrollment to be useful
  const total = enr?.total || 0;
  if (total === 0) {
    skipped++;
    continue;
  }

  // Generate a camelCase key from district name
  const distKey = makeCamelKey(gbm.county, gbm.distCode, gbm.name);

  // Determine district type heuristic
  let type = 'K-12';
  if (gbm.name.includes('Vocational') || gbm.name.includes('Vo-Tech')) type = 'Vocational';
  else if (gbm.name.includes('Charter')) type = 'Charter';
  else if (gbm.name.includes('Regional')) type = 'Regional';

  // Estimate combo (at-risk ∩ LEP) using probabilistic overlap
  const atRisk = enr.frl;
  const lep = enr.ml;
  const combo = total > 0 ? Math.round(atRisk * lep / total) : 0;

  // EV: use esttax data, create a 3-year approximation (we only have 1 year, estimate prior years at -4%)
  const evCurrent = ev?.evEqTable || ev?.ev || 0;
  const ev3yr = [evCurrent, Math.round(evCurrent * 0.96), Math.round(evCurrent * 0.92)];

  // Aggregate income: back-calculate from LFS if we can
  // LFS = (avgEV × evMult + income × incMult) / 2
  // For now, estimate from levy and tax burden (~4.5% statewide avg)
  const levy = rev?.totalTaxLevy || ev?.genFundLevy || 0;
  const estIncome = levy > 0 ? Math.round(levy / 0.05) : 0; // rough estimate

  // Budget from UFB revenue total
  const budget = rev?.totalBudget || Math.round(gbm.fy26 + levy + (rev?.federalAid || 0));

  districts[distKey] = {
    name: gbm.name,
    short: makeShortCode(gbm.name),
    county: gbm.county,
    type,
    dfg,
    gca,
    distCode: gbm.distCode,
    fy25: gbm.fy25,
    fy26: gbm.fy26,
    fy26Detail: {
      eq: gbm.fy26Detail.eq,
      sped: gbm.fy26Detail.sped,
      trans: gbm.fy26Detail.trans,
      sec: gbm.fy26Detail.sec,
    },
    ev3yr,
    income: estIncome,
    enr: {
      total,
      elem: enr.elem || 0,
      mid: enr.mid || 0,
      hs: enr.hs || 0,
    },
    atRisk: atRisk,
    atRiskPct: enr.frlPct,
    lep: lep,
    combo,
    levy,
    budget,
    ufb: {
      totalBudget: budget,
      localTaxLevy: levy,
      stateAid: rev?.totalStateAid || gbm.fy26,
      federalAid: rev?.federalAid || 0,
      otherRevenue: Math.max(0, budget - levy - (rev?.totalStateAid || gbm.fy26) - (rev?.federalAid || 0)),
    },
    color: COUNTY_COLORS[gbm.county] || '#6b7280',
  };
  matched++;
}

console.log(`  → ${matched} districts merged, ${skipped} skipped (no enrollment)`);

// ══════════════════════════════════════════════════════════════
// 8. Write output
// ══════════════════════════════════════════════════════════════
console.log('\nWriting output...');

// Build GCA export
const gcaEntries = Object.entries(GCA_BY_COUNTY)
  .map(([k, v]) => `  ${JSON.stringify(k.toLowerCase().replace(/\s/g, ''))}: ${v}`)
  .join(',\n');

// Build districts export
let distLines = [];
for (const [key, d] of Object.entries(districts)) {
  distLines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(d)}`);
}

const output = `// Auto-generated by scripts/build-districts.js
// Sources: NJ DOE FY26 GBM District Details, Fall Enrollment 2024-25,
//          UFB Revenue FY26, Estimated Tax Rates FY26, DFG 2000
// Generated: ${new Date().toISOString().split('T')[0]}

export const GCA = {
${Object.entries(GCA_BY_COUNTY).map(([k, v]) => `  ${k.toLowerCase().replace(/\s+/g, '')}: ${v}`).join(',\n')}
};

export const DISTRICTS = {
${distLines.join(',\n')}
};
`;

const outPath = path.join(__dirname, '..', 'src', 'data', 'districts-generated.js');
fs.writeFileSync(outPath, output);

const stats = {
  total: matched,
  withEV: Object.values(districts).filter(d => d.ev3yr[0] > 0).length,
  withLevy: Object.values(districts).filter(d => d.levy > 0).length,
  withBudget: Object.values(districts).filter(d => d.budget > 0).length,
  counties: [...new Set(Object.values(districts).map(d => d.county))].length,
};
console.log(`\nOutput: ${outPath}`);
console.log(`Stats:`, JSON.stringify(stats, null, 2));
console.log('Done!');


// ══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function makeCamelKey(county, code, name) {
  // Create a unique camelCase key from name
  const clean = name
    .replace(/\s*(City|Town|Twp|Boro|Township|Borough|Village)\s*$/i, '')
    .replace(/\s*(School District|Public Schools?|Regional|Reg)\s*$/i, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim();
  const words = clean.split(/\s+/);
  const camel = words[0].toLowerCase() + words.slice(1).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('');
  // Add county prefix if name is common
  return camel;
}

function makeShortCode(name) {
  // Generate a 2-4 letter abbreviation
  const clean = name
    .replace(/\s*(City|Town|Twp|Boro|Township|Borough|Village|Public Schools?|School District|Regional|Reg|Vocational|Vo-Tech|Charter)\s*/gi, ' ')
    .replace(/[^a-zA-Z\s]/g, '')
    .trim();
  const words = clean.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 1) {
    return words[0].slice(0, 4).toUpperCase();
  }
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 4);
}
