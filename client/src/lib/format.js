const nf = new Intl.NumberFormat('en-SG');

export function formatRent(n) {
  if (n == null) return '—';
  return `$${nf.format(n)}`;
}

// Compact money for map markers / axis ticks: $2.8k, $1.2k.
export function formatRentCompact(n) {
  if (n == null) return '—';
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n}`;
}

export function formatCount(n) {
  if (n == null) return '—';
  return nf.format(n);
}

// "2021-01" → "Jan 2021"
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatMonth(ym) {
  if (!ym) return '—';
  const [y, m] = ym.split('-');
  return `${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

export function formatFlatType(ft) {
  if (ft === 'ALL') return 'All flats';
  return ft.charAt(0) + ft.slice(1).toLowerCase(); // "4-ROOM" → "4-room"
}
