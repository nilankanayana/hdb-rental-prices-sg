#!/usr/bin/env node
// Resolve each unique HDB address (block + street) to WGS84 lat/lng via the free
// OneMap search API, caching results on disk. Run via `npm run geocode`.
//
//   1. `npm run build:data`  → client/src/data/rentals.json (addresses, no coords)
//   2. `npm run geocode`     → fills client/scripts/geocode-cache.json
//   3. `npm run build:data`  → merges the cache so addresses carry [lat, lng]
//
// The cache makes this idempotent and resumable: only addresses missing from it
// are fetched, so re-runs are cheap and a OneMap token (valid ~3 days) is only
// needed while new addresses remain. The browser never calls OneMap.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// Read .env without a dependency (client has no dotenv): pull out ONEMAP_TOKEN.
function readEnvToken() {
  try {
    const env = fs.readFileSync(path.resolve(REPO_ROOT, '.env'), 'utf-8');
    return env.match(/^ONEMAP_TOKEN=(.*)$/m)?.[1]?.trim() || '';
  } catch {
    return '';
  }
}

const RENTALS_JSON = path.join(REPO_ROOT, 'client', 'src', 'data', 'rentals.json');
const CACHE_JSON = path.join(__dirname, 'geocode-cache.json');
const SEARCH_URL = 'https://www.onemap.gov.sg/api/common/elastic/search';

const TOKEN = readEnvToken();
const CONCURRENCY = 5;          // polite parallelism
const SAVE_EVERY = 100;         // checkpoint cadence
const MAX_RETRIES = 4;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return fallback; }
}

function keyOf(town, block, street) {
  return `${town}|${block}|${street}`;
}

async function geocodeOne(block, street) {
  const searchVal = `${block} ${street}`;
  const url = `${SEARCH_URL}?searchVal=${encodeURIComponent(searchVal)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {} });
      if (res.status === 429 || res.status >= 500) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (res.status === 401) throw new Error('UNAUTHORIZED');
      if (!res.ok) return null;
      const json = await res.json();
      const results = json.results ?? [];
      if (!results.length) return null;
      // Prefer an exact block-number match; fall back to the first hit.
      const exact = results.find((r) => (r.BLK_NO ?? '').toUpperCase() === block.toUpperCase());
      const pick = exact ?? results[0];
      const lat = Number(pick.LATITUDE);
      const lng = Number(pick.LONGITUDE);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return [Number(lat.toFixed(6)), Number(lng.toFixed(6))];
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') throw err;
      if (attempt === MAX_RETRIES) return null;
      await sleep(1000 * 2 ** attempt);
    }
  }
  return null;
}

async function main() {
  if (!TOKEN) {
    console.error('No ONEMAP_TOKEN in .env — add your free OneMap token and re-run.');
    console.error('Get one at https://www.onemap.gov.sg/apidocs/ (register → generate token).');
    process.exit(1);
  }

  const data = loadJson(RENTALS_JSON, null);
  if (!data?.addresses) {
    console.error(`No addresses in ${path.relative(REPO_ROOT, RENTALS_JSON)} — run \`npm run build:data\` first.`);
    process.exit(1);
  }

  const cache = loadJson(CACHE_JSON, {});
  const townName = (ti) => data.towns[ti]?.name ?? '';

  // Only addresses we have not resolved yet (null in cache means "tried, not found").
  const todo = data.addresses.filter((a) => !(keyOf(townName(a.ti), a.b, a.s) in cache));
  console.log(`${data.addresses.length} addresses · ${Object.keys(cache).length} cached · ${todo.length} to fetch`);
  if (!todo.length) { console.log('Nothing to do.'); return; }

  let done = 0;
  let found = 0;
  let sinceSave = 0;
  let aborted = false;

  const save = () => fs.writeFileSync(CACHE_JSON, JSON.stringify(cache));

  // Simple fixed-size worker pool over the todo queue.
  let cursor = 0;
  async function worker() {
    while (cursor < todo.length && !aborted) {
      const a = todo[cursor++];
      const town = townName(a.ti);
      const key = keyOf(town, a.b, a.s);
      try {
        const coord = await geocodeOne(a.b, a.s);
        cache[key] = coord;
        if (coord) found++;
      } catch (err) {
        if (err.message === 'UNAUTHORIZED') { aborted = true; break; }
        cache[key] = null;
      }
      done++;
      if (++sinceSave >= SAVE_EVERY) { save(); sinceSave = 0; process.stdout.write(`\r  ${done}/${todo.length} (${found} located)…`); }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  save();
  process.stdout.write('\n');

  if (aborted) {
    console.error('OneMap rejected the token (401). It may be expired — regenerate it and re-run; cached progress is kept.');
    process.exit(1);
  }
  console.log(`Geocoded ${done} addresses (${found} located, ${done - found} not found). Cache: ${path.relative(REPO_ROOT, CACHE_JSON)}`);
  console.log('Now re-run `npm run build:data` to merge coordinates into rentals.json.');
}

main();
