#!/usr/bin/env node
// Build aggregated HDB rental-price data from the data.gov.sg dataset
// "Renting Out of Flats from Jan 2021" (~200k owner-declared approved rentals).
// Run via `npm run build:data`.
//
// Source CSV columns: rent_approval_date (YYYY-MM), town, block, street_name,
// flat_type, monthly_rent. The raw file is far too large to ship to the browser,
// so we collapse it to median rent + transaction count per
// (town × flat_type × month), plus an "ALL" flat-type rollup, and embed town
// centroids so the client can place map markers.
//
// Place the CSV at the repo root (any *.csv name works) and run this script.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUT_JSON = path.join(REPO_ROOT, 'client', 'src', 'data', 'rentals.json');
const GEOCODE_CACHE = path.join(__dirname, 'geocode-cache.json');

const ALL = 'ALL';

// Approximate centroids (WGS84) for each HDB town / planning area in the data.
// Used only to position the town markers on the map.
const TOWN_CENTROIDS = {
  'ANG MO KIO': [1.3691, 103.8454],
  BEDOK: [1.3236, 103.9273],
  BISHAN: [1.3526, 103.8352],
  'BUKIT BATOK': [1.359, 103.7637],
  'BUKIT MERAH': [1.2819, 103.8239],
  'BUKIT PANJANG': [1.3774, 103.7719],
  'BUKIT TIMAH': [1.3294, 103.8021],
  CENTRAL: [1.289, 103.85],
  'CHOA CHU KANG': [1.384, 103.747],
  CLEMENTI: [1.3162, 103.7649],
  GEYLANG: [1.3201, 103.8918],
  HOUGANG: [1.3612, 103.8863],
  'JURONG EAST': [1.3329, 103.7436],
  'JURONG WEST': [1.3404, 103.709],
  'KALLANG/WHAMPOA': [1.31, 103.8651],
  'MARINE PARADE': [1.302, 103.905],
  'PASIR RIS': [1.3721, 103.9474],
  PUNGGOL: [1.3984, 103.9072],
  QUEENSTOWN: [1.2942, 103.7861],
  SEMBAWANG: [1.4491, 103.8185],
  SENGKANG: [1.3868, 103.8914],
  SERANGOON: [1.3554, 103.8679],
  TAMPINES: [1.3496, 103.9568],
  TENGAH: [1.374, 103.715],
  'TOA PAYOH': [1.3343, 103.8563],
  WOODLANDS: [1.4382, 103.789],
  YISHUN: [1.4304, 103.8354],
};

function median(sortedNums) {
  const n = sortedNums.length;
  if (n === 0) return null;
  const mid = n >> 1;
  return n % 2 ? sortedNums[mid] : Math.round((sortedNums[mid - 1] + sortedNums[mid]) / 2);
}

function findCsv() {
  const files = fs.readdirSync(REPO_ROOT).filter((f) => f.toLowerCase().endsWith('.csv'));
  if (!files.length) {
    console.error('No CSV found at repo root. Download "Renting Out of Flats from Jan 2021"');
    console.error('from data.gov.sg and place it here.');
    process.exit(1);
  }
  // Prefer a file whose name mentions renting, else the largest CSV.
  const named = files.find((f) => /rent/i.test(f));
  const chosen = named || files.sort((a, b) =>
    fs.statSync(path.join(REPO_ROOT, b)).size - fs.statSync(path.join(REPO_ROOT, a)).size
  )[0];
  return path.join(REPO_ROOT, chosen);
}

function main() {
  const csvPath = findCsv();
  console.log(`Reading ${path.relative(REPO_ROOT, csvPath)}…`);
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) console.warn(`  ${parsed.errors.length} parse warning(s)`);

  // bucket[town][flatType][month] = [rent, rent, ...]
  const bucket = new Map();
  // addressBucket["town|block|street"] = { town, block, street, all: [], byFt: Map }
  const addressBucket = new Map();
  const monthsSet = new Set();
  const flatTypesSet = new Set();
  const flatTypeCounts = new Map();
  const unknownTowns = new Set();
  let used = 0;
  let allRents = 0;
  let allRentSum = 0;

  for (const row of parsed.data) {
    const month = String(row.rent_approval_date ?? '').trim();
    const town = String(row.town ?? '').trim().toUpperCase();
    const flatType = String(row.flat_type ?? '').trim().toUpperCase();
    const block = String(row.block ?? '').trim().toUpperCase();
    const street = String(row.street_name ?? '').trim().toUpperCase();
    const rent = Number(String(row.monthly_rent ?? '').replace(/[^0-9.]/g, ''));
    if (!month || !town || !flatType || !Number.isFinite(rent) || rent <= 0) continue;
    if (!TOWN_CENTROIDS[town]) { unknownTowns.add(town); continue; }

    // Per-address rollup (block + street) for the search index.
    if (block && street) {
      const key = `${town}|${block}|${street}`;
      let addr = addressBucket.get(key);
      if (!addr) addressBucket.set(key, (addr = { town, block, street, all: [], byFt: new Map() }));
      addr.all.push(rent);
      let ftArr = addr.byFt.get(flatType);
      if (!ftArr) addr.byFt.set(flatType, (ftArr = []));
      ftArr.push(rent);
    }

    monthsSet.add(month);
    flatTypesSet.add(flatType);
    flatTypeCounts.set(flatType, (flatTypeCounts.get(flatType) ?? 0) + 1);
    flatTypeCounts.set(ALL, (flatTypeCounts.get(ALL) ?? 0) + 1);
    allRents += 1;
    allRentSum += rent;
    used += 1;

    let byFt = bucket.get(town);
    if (!byFt) bucket.set(town, (byFt = new Map()));
    for (const ft of [flatType, ALL]) {
      let byMonth = byFt.get(ft);
      if (!byMonth) byFt.set(ft, (byMonth = new Map()));
      let arr = byMonth.get(month);
      if (!arr) byMonth.set(month, (arr = []));
      arr.push(rent);
    }
  }

  const months = [...monthsSet].sort();
  const monthIndex = new Map(months.map((m, i) => [i, m]));
  const monthToIdx = new Map(months.map((m, i) => [m, i]));
  const flatTypes = [...flatTypesSet].sort(); // 1-ROOM … EXECUTIVE

  // Reduce buckets to compact cells: cells[town][ft][monthIdx] = [median, count]
  const cells = {};
  let overallAllSorted = [];
  for (const [town, byFt] of bucket) {
    cells[town] = {};
    for (const [ft, byMonth] of byFt) {
      const perMonth = {};
      for (const [month, arr] of byMonth) {
        arr.sort((a, b) => a - b);
        perMonth[monthToIdx.get(month)] = [median(arr), arr.length];
        if (ft === ALL) overallAllSorted = overallAllSorted.concat(arr);
      }
      cells[town][ft] = perMonth;
    }
  }
  overallAllSorted.sort((a, b) => a - b);

  const towns = Object.keys(cells)
    .sort()
    .map((name) => ({ name, lat: TOWN_CENTROIDS[name][0], lng: TOWN_CENTROIDS[name][1] }));
  const townIdx = new Map(towns.map((t, i) => [t.name, i]));

  // Optional geocode cache from `npm run geocode`: "TOWN|BLOCK|STREET" → [lat,lng]|null
  let geocode = {};
  try {
    geocode = JSON.parse(fs.readFileSync(GEOCODE_CACHE, 'utf-8'));
  } catch { /* no cache yet — addresses ship without coordinates */ }

  // Per-address index: each entry carries overall median + count and a
  // per-flat-type breakdown. Town is referenced by index to keep the file small.
  //   { ti, b, s, n, m, ft: { "4-ROOM": [median, count], ... }, g?: [lat, lng] }
  const addresses = [];
  let located = 0;
  for (const addr of addressBucket.values()) {
    addr.all.sort((a, b) => a - b);
    const ft = {};
    for (const [type, arr] of addr.byFt) {
      arr.sort((a, b) => a - b);
      ft[type] = [median(arr), arr.length];
    }
    const entry = {
      ti: townIdx.get(addr.town),
      b: addr.block,
      s: addr.street,
      n: addr.all.length,
      m: median(addr.all),
      ft,
    };
    const coord = geocode[`${addr.town}|${addr.block}|${addr.street}`];
    if (Array.isArray(coord)) { entry.g = coord; located++; }
    addresses.push(entry);
  }
  // Stable order: town, then street, then block (numeric-ish).
  addresses.sort((a, b) =>
    a.ti - b.ti || a.s.localeCompare(b.s) || a.b.localeCompare(b.b, undefined, { numeric: true })
  );

  const out = {
    generatedAt: new Date().toISOString(),
    source: 'data.gov.sg — Renting Out of Flats from Jan 2021 (owner-declared, not verified by HDB)',
    monthRange: [months[0], months[months.length - 1]],
    months,
    flatTypes,
    flatTypeCounts: Object.fromEntries(flatTypeCounts),
    overallMedian: median(overallAllSorted),
    overallMean: Math.round(allRentSum / allRents),
    totalRecords: used,
    towns,
    cells,
    addresses,
  };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(out));
  const kb = (fs.statSync(OUT_JSON).size / 1024).toFixed(0);
  console.log(
    `Aggregated ${used.toLocaleString()} rentals → ${towns.length} towns × ${flatTypes.length} flat types × ${months.length} months`
  );
  console.log(`  overall median $${out.overallMedian} · mean $${out.overallMean} · ${addresses.length.toLocaleString()} addresses (${located.toLocaleString()} geocoded)`);
  if (unknownTowns.size) console.warn(`  skipped towns without centroids: ${[...unknownTowns].join(', ')}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUT_JSON)} (${kb} KB)`);
  void monthIndex;
}

main();
