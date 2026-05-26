// Selectors over the aggregated rentals payload.
//   data.cells[town][flatType][monthIdx] = [median, count]
// flatType includes the literal 'ALL' rollup; monthIdx is the index into
// data.months (stored as a string key in JSON).

export const ALL_FLAT_TYPE = 'ALL';

export function cellFor(data, town, flatType, monthIdx) {
  const c = data?.cells?.[town]?.[flatType]?.[monthIdx];
  if (!c) return null;
  return { median: c[0], count: c[1] };
}

// town → median rent for the current (flatType, month) view. Towns with no
// matching transactions are omitted.
export function townMedians(data, flatType, monthIdx) {
  const out = new Map();
  for (const t of data.towns) {
    const c = cellFor(data, t.name, flatType, monthIdx);
    if (c && c.median != null) out.set(t.name, c);
  }
  return out;
}

// Monthly median series for one town + flat type across the whole timeline.
export function townTrend(data, town, flatType) {
  return data.months.map((month, idx) => {
    const c = cellFor(data, town, flatType, idx);
    return { idx, month, median: c?.median ?? null, count: c?.count ?? 0 };
  });
}

// Median rent per flat type for one town in a given month, sorted by flat size.
export function townBreakdown(data, town, monthIdx) {
  return data.flatTypes
    .map((ft) => {
      const c = cellFor(data, town, ft, monthIdx);
      return { flatType: ft, median: c?.median ?? null, count: c?.count ?? 0 };
    })
    .filter((r) => r.median != null);
}

// Tercile thresholds over a set of values → used to colour the map relative to
// whatever flat type / month is currently displayed.
export function computeBands(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length < 3) return null;
  const q = (p) => sorted[Math.floor((sorted.length - 1) * p)];
  return { t1: q(1 / 3), t2: q(2 / 3) };
}

export function bandOf(median, bands) {
  if (median == null) return 'unknown';
  if (!bands) return 'mid';
  if (median < bands.t1) return 'cheap';
  if (median < bands.t2) return 'mid';
  return 'pricey';
}

// Build a searchable view of data.addresses, resolving the town name once.
//   addr: { ti, b: block, s: street, n: count, m: median, ft: {FT:[med,count]} }
export function buildAddressIndex(data) {
  return (data.addresses ?? []).map((a) => {
    const town = data.towns[a.ti]?.name ?? '';
    return { ...a, town, label: `BLK ${a.b} ${a.s}`, search: `${a.b} ${a.s} ${town}` };
  });
}

// Median rent for an address under the active flat type ('ALL' → overall).
export function addressRent(addr, flatType) {
  if (flatType === ALL_FLAT_TYPE) return { median: addr.m, count: addr.n };
  const c = addr.ft?.[flatType];
  return c ? { median: c[0], count: c[1] } : null;
}

// Combined search over towns + addresses. Every whitespace-separated token must
// appear, so "105 ang mo kio ave 4" narrows correctly.
export function searchPlaces(query, towns, addressIndex, limit = 16) {
  const tokens = query.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { towns: [], addresses: [] };
  const townHits = towns.filter((t) => tokens.every((tok) => t.name.includes(tok))).slice(0, 6);
  const addrHits = [];
  for (const a of addressIndex) {
    if (tokens.every((tok) => a.search.includes(tok))) {
      addrHits.push(a);
      if (addrHits.length >= limit) break;
    }
  }
  return { towns: townHits, addresses: addrHits };
}
