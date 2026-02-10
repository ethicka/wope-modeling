#!/usr/bin/env python3
"""
Build fiscal stress supplemental data for all NJ districts.
Extracts:
  1. ESSER I, II, III allocations from PDF tables
  2. Historical fund balance from UFB recap CSVs
  3. TGES Indicator 20 (audited actuals) from Excel

Outputs: src/data/fiscal-stress-generated.js
"""

import csv
import json
import re
import sys
import os
from pathlib import Path

# Optional deps
try:
    import tabula
    import pandas as pd
    HAS_TABULA = True
except ImportError:
    HAS_TABULA = False
    print("Warning: tabula-py/pandas not installed, ESSER PDF extraction will be skipped")

try:
    import openpyxl
    HAS_OPENPYXL = True
except ImportError:
    HAS_OPENPYXL = False
    print("Warning: openpyxl not installed, TGES Excel extraction will be skipped")

RAW_DIR = Path(__file__).parent.parent / "data" / "raw"
OUT_FILE = Path(__file__).parent.parent / "src" / "data" / "fiscal-stress-generated.js"

# ── District code mapping ──────────────────────────────────────────
# We need to match PDF/CSV district codes to the keys in districts-generated.js
# Load the generated districts to build a code→key map
DISTRICTS_FILE = Path(__file__).parent.parent / "src" / "data" / "districts-generated.js"

def load_district_keys():
    """Parse distCode from districts-generated.js to build code→key mapping."""
    text = DISTRICTS_FILE.read_text()
    # Find all "key": {...,"distCode":"XXXX",...}
    mapping = {}
    # Match pattern: "keyName": {"name":"...", ..., "distCode":"0010", ...}
    for m in re.finditer(r'"(\w+)":\s*\{[^}]*"distCode":"(\d+)"', text):
        key, code = m.group(1), m.group(2)
        mapping[code] = key
    return mapping

def parse_dollar(s):
    """Parse a dollar string like '$ 232,945' or '$3,977,177' to int."""
    if not s or pd.isna(s):
        return 0
    s = str(s).replace('$', '').replace(',', '').replace(' ', '').replace('\r', '').replace('\n', '').strip()
    if s in ('', '-', 'NaN'):
        return 0
    try:
        return int(float(s))
    except ValueError:
        return 0


# ── ESSER EXTRACTION ──────────────────────────────────────────────

def extract_esser_i():
    """Extract ESSER I allocations from PDF."""
    if not HAS_TABULA:
        return {}
    print("Extracting ESSER I allocations...")
    dfs = tabula.read_pdf(str(RAW_DIR / "ESSER_I.pdf"), pages='all', lattice=True)
    all_rows = pd.concat(dfs, ignore_index=True)

    result = {}
    for _, row in all_rows.iterrows():
        code_col = [c for c in all_rows.columns if 'District' in c and 'Code' in c]
        alloc_col = [c for c in all_rows.columns if 'ESSER' in c and 'Allocation' in c]
        if not code_col or not alloc_col:
            continue
        code = str(row[code_col[0]]).strip()
        if not code.isdigit():
            continue
        code = code.zfill(4)
        alloc = parse_dollar(row[alloc_col[0]])
        if alloc > 0:
            result[code] = alloc

    print(f"  Found {len(result)} districts with ESSER I allocations")
    return result

def extract_esser_ii():
    """Extract ESSER II allocations from PDF."""
    if not HAS_TABULA:
        return {}
    print("Extracting ESSER II allocations...")
    dfs = tabula.read_pdf(str(RAW_DIR / "ESSER_II.pdf"), pages='all', lattice=True)
    all_rows = pd.concat(dfs, ignore_index=True)

    result = {}
    for _, row in all_rows.iterrows():
        code_col = [c for c in all_rows.columns if 'District' in c and 'Code' in c]
        if not code_col:
            continue
        code = str(row[code_col[0]]).strip()
        if not code.isdigit():
            continue
        code = code.zfill(4)

        # ESSER II allocation is in the column with 'ESSER II' or 'Allocation'
        # Due to messy PDF headers, the allocation may be in various columns
        # The main allocation column typically contains the largest dollar amount
        alloc_col = [c for c in all_rows.columns if 'ESSER II' in c or 'Allocation' in c]

        # Try to find the allocation - check multiple possible columns
        alloc = 0
        for col in all_rows.columns:
            val = str(row[col])
            if '$' in val and ',' in val:
                parsed = parse_dollar(val)
                if parsed > alloc:
                    alloc = parsed

        if alloc > 0:
            result[code] = alloc

    print(f"  Found {len(result)} districts with ESSER II allocations")
    return result

def extract_esser_iii():
    """Extract ARP ESSER III allocations from NEA combined PDF (pages 51+)."""
    if not HAS_TABULA:
        return {}
    print("Extracting ARP ESSER III allocations from NEA PDF...")

    nea_file = RAW_DIR / "NEA_ESSER_NJ.pdf"
    if not nea_file.exists():
        print("  NEA PDF not found, skipping ESSER III")
        return {}

    # ARP ESSER III section starts around page 51, PDF has 62 pages total
    dfs = tabula.read_pdf(str(nea_file), pages='51-62', lattice=True)
    all_rows = pd.concat(dfs, ignore_index=True) if dfs else pd.DataFrame()

    result = {}
    for _, row in all_rows.iterrows():
        code_col = [c for c in all_rows.columns if 'District' in c and 'Code' in c]
        if not code_col:
            continue
        code = str(row[code_col[0]]).strip()
        if not code.isdigit():
            continue
        code = code.zfill(4)

        # Find the total ARP ESSER column — look for largest dollar amount
        # The "Total ARP ESSER Mandatory Subgrant Award" is what we want
        alloc = 0
        for col in all_rows.columns:
            val = str(row[col])
            if '$' in val and ',' in val:
                parsed = parse_dollar(val)
                if parsed > alloc:
                    alloc = parsed

        if alloc > 0:
            result[code] = alloc

    print(f"  Found {len(result)} districts with ARP ESSER III allocations")
    return result


# ── FUND BALANCE EXTRACTION ────────────────────────────────────────

def extract_fund_balance_recap():
    """Extract unrestricted general fund balance from UFB recap CSVs."""
    print("Extracting fund balance from UFB recap CSVs...")

    # Each recap file covers one budget year. The amount columns represent:
    # For newer files (22+):
    #   amount_1 = Audited Balance 6/30/prior-2yr
    #   amount_2 = Audited/Est Balance 6/30/prior-1yr
    #   amount_3 = Est Balance 6/30/current-yr
    #   amount_4 = Anticipated 6/30/budget-yr
    # The "Unrestricted-General Operating Budget" row_desc is the unassigned surplus

    # Map file → fiscal year the recap represents
    recap_files = {
        "recap20.csv": {"fy": 2020, "cols": {
            "amount_1": "fy18", "amount_2": "fy19", "amount_3": "fy19r", "amount_4": "fy20"
        }},
        "recap21.csv": {"fy": 2021, "cols": {
            "amount_1": "fy19", "amount_2": "fy20", "amount_3": "fy20r", "amount_4": "fy21"
        }},
        "recap22.csv": {"fy": 2022, "cols": {
            "amount_1": "fy20", "amount_2": "fy21", "amount_3": "fy21r", "amount_4": "fy22"
        }},
        "recap23.csv": {"fy": 2023, "cols": {
            "amount_1": "fy21", "amount_2": "fy22", "amount_3": "fy22r", "amount_4": "fy23"
        }},
        "recap24.csv": {"fy": 2024, "cols": {
            "amount_1": "fy22", "amount_2": "fy23", "amount_3": "fy23r", "amount_4": "fy24"
        }},
        "recap25.csv": {"fy": 2025, "cols": {
            "amount_1": "fy23", "amount_2": "fy24", "amount_3": "fy24r", "amount_4": "fy25"
        }},
        "recap26.csv": {"fy": 2026, "cols": {
            "amount_1": "fy24", "amount_2": "fy25", "amount_3": "fy25r", "amount_4": "fy26"
        }},
    }

    # Collect: dist_code → {fyXX: amount, ...}
    balances = {}

    for filename, meta in recap_files.items():
        filepath = RAW_DIR / filename
        if not filepath.exists():
            print(f"  Skipping {filename} (not found)")
            continue

        with open(filepath, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                desc = row.get('row_desc', '').strip()
                # Match the unrestricted general operating budget line
                if 'Unrestricted' not in desc or 'General Operating Budget' not in desc:
                    continue
                # Skip the descriptor row that just has 1,2,3,4
                amt1 = row.get('amount_1', '0').strip()
                if amt1 in ('1', '2', '3', '4', ''):
                    continue

                code = str(row.get('district_id', '')).strip().zfill(4)
                if code == '0000':
                    continue

                if code not in balances:
                    balances[code] = {}

                # Use the first two amount columns (audited figures)
                # amount_1 = audited balance from 2 years prior
                # amount_2 = audited/estimated balance from 1 year prior
                col_map = meta["cols"]
                for amt_key, fy_key in col_map.items():
                    if 'r' in fy_key:  # skip revised estimates
                        continue
                    try:
                        val = int(float(row.get(amt_key, '0').strip() or '0'))
                        # Only update if we don't already have this FY from a newer (more accurate) file
                        # or if the value is from the most recent file
                        fy_tag = fy_key
                        if fy_tag not in balances[code] or meta["fy"] > balances[code].get(f"_{fy_tag}_src", 0):
                            balances[code][fy_tag] = val
                            balances[code][f"_{fy_tag}_src"] = meta["fy"]
                    except (ValueError, KeyError):
                        pass

    # Clean up internal tracking keys
    for code in balances:
        balances[code] = {k: v for k, v in balances[code].items() if not k.startswith('_')}

    print(f"  Found fund balance data for {len(balances)} districts")

    # Show a sample
    sample_codes = list(balances.keys())[:3]
    for c in sample_codes:
        print(f"    {c}: {balances[c]}")

    return balances


def extract_tges_indicator20():
    """Extract audited fund balance from TGES Indicator 20 Excel files."""
    if not HAS_OPENPYXL:
        return {}

    print("Extracting TGES Indicator 20 (audited fund balance)...")

    # Each edition covers 2 fiscal years of audited actuals
    tges_files = {
        "CSG20_2024.xlsx": {"years": ["fy22", "fy23"], "header_row": 2},
        "CSG20_2025.xlsx": {"years": ["fy23", "fy24"], "header_row": 3},
    }

    # Collect: dist_code → {fyXX_budgeted: N, fyXX_actual: N, ...}
    result = {}

    for filename, meta in tges_files.items():
        filepath = RAW_DIR / filename
        if not filepath.exists():
            print(f"  Skipping {filename} (not found)")
            continue

        wb = openpyxl.load_workbook(str(filepath), read_only=True, data_only=True)
        ws = wb.active

        rows = list(ws.iter_rows(min_row=meta["header_row"] + 1, values_only=True))
        print(f"  {filename}: {len(rows)} data rows")

        for row in rows:
            if len(row) < 8:
                continue
            # Cols: [type, county, dist_code, name, yr1_budgeted, yr1_actual, yr2_budgeted, yr2_actual]
            dist_code = row[2]
            if dist_code is None:
                continue
            dist_code = str(int(dist_code)).zfill(4) if isinstance(dist_code, (int, float)) else str(dist_code).strip().zfill(4)

            if dist_code not in result:
                result[dist_code] = {}

            fy1, fy2 = meta["years"]

            # Year 1 budgeted and actual
            if row[4] is not None:
                result[dist_code][f"{fy1}_budgeted"] = int(row[4]) if isinstance(row[4], (int, float)) else 0
            if row[5] is not None:
                result[dist_code][f"{fy1}_actual"] = int(row[5]) if isinstance(row[5], (int, float)) else 0
            # Year 2
            if row[6] is not None:
                result[dist_code][f"{fy2}_budgeted"] = int(row[6]) if isinstance(row[6], (int, float)) else 0
            if row[7] is not None:
                result[dist_code][f"{fy2}_actual"] = int(row[7]) if isinstance(row[7], (int, float)) else 0

        wb.close()

    print(f"  Found TGES data for {len(result)} districts")
    return result


# ── BUILD OUTPUT ──────────────────────────────────────────────────

def build_output():
    code_to_key = load_district_keys()
    print(f"Loaded {len(code_to_key)} district code→key mappings")

    # Extract all data sources
    esser1 = extract_esser_i()
    esser2 = extract_esser_ii()
    esser3 = extract_esser_iii()
    fund_bal = extract_fund_balance_recap()
    tges = extract_tges_indicator20()

    # Merge everything keyed by district code, then map to district keys
    output = {}
    all_codes = set(list(esser1.keys()) + list(esser2.keys()) + list(esser3.keys()) +
                     list(fund_bal.keys()) + list(tges.keys()))

    mapped = 0
    unmapped = 0

    for code in sorted(all_codes):
        key = code_to_key.get(code)
        if not key:
            unmapped += 1
            continue
        mapped += 1

        entry = {}

        # ESSER allocations
        e1 = esser1.get(code, 0)
        e2 = esser2.get(code, 0)
        e3 = esser3.get(code, 0)
        total_esser = e1 + e2 + e3
        if total_esser > 0:
            entry["esser"] = {"i": e1, "ii": e2, "iii": e3, "total": total_esser}

        # Fund balance history (from recap CSVs)
        fb = fund_bal.get(code, {})
        if fb:
            # Build a year-by-year array sorted chronologically
            fb_history = {}
            for fy_key, val in sorted(fb.items()):
                # Convert fy18 → 2018, etc.
                yr = int(fy_key.replace('fy', '')) + 2000
                fb_history[yr] = val
            if fb_history:
                entry["fundBalance"] = fb_history

        # TGES audited actuals
        tg = tges.get(code, {})
        if tg:
            entry["tges"] = tg

        if entry:
            output[key] = entry

    print(f"\nMapped {mapped} district codes to keys, {unmapped} unmapped")
    print(f"Output: {len(output)} districts with fiscal data")

    # Show some stats
    with_esser = sum(1 for v in output.values() if "esser" in v)
    with_fb = sum(1 for v in output.values() if "fundBalance" in v)
    with_tges = sum(1 for v in output.values() if "tges" in v)
    print(f"  With ESSER data: {with_esser}")
    print(f"  With fund balance history: {with_fb}")
    print(f"  With TGES audited data: {with_tges}")

    # Show sample
    sample_keys = list(output.keys())[:2]
    for k in sample_keys:
        print(f"\n  Sample [{k}]:")
        print(f"    {json.dumps(output[k], indent=2)[:500]}")

    # Write JS module
    js = "// Auto-generated by scripts/build-fiscal-data.py\n"
    js += "// Sources: NJ DOE ESSER Allocation PDFs, UFB Recapitulation of Balance CSVs,\n"
    js += "//          TGES Indicator 20 (Audited Fund Balance)\n"
    js += f"// Generated: {pd.Timestamp.now().strftime('%Y-%m-%d') if HAS_TABULA else '2026-02-08'}\n\n"
    js += "export const FISCAL_DATA = "
    js += json.dumps(output, separators=(',', ':'))
    js += ";\n"

    OUT_FILE.write_text(js)
    print(f"\nWrote {OUT_FILE} ({len(js):,} bytes)")


if __name__ == "__main__":
    os.chdir(str(RAW_DIR))
    build_output()
