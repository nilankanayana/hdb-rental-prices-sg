import { formatRentCompact } from '../lib/format.js';

// Legend reflects the relative tercile bands computed for the current view, so
// the labels show the actual $ thresholds rather than fixed numbers.
export default function MapLegend({ bands }) {
  const items = bands
    ? [
        { cls: 'legend-dot--cheap', label: `< ${formatRentCompact(bands.t1)}` },
        { cls: 'legend-dot--mid', label: `${formatRentCompact(bands.t1)} – ${formatRentCompact(bands.t2)}` },
        { cls: 'legend-dot--pricey', label: `≥ ${formatRentCompact(bands.t2)}` },
      ]
    : [{ cls: 'legend-dot--unknown', label: 'No data' }];

  return (
    <div className="map-legend" aria-label="Median rent legend">
      <span className="map-legend-title">Median rent</span>
      {items.map((it) => (
        <span key={it.label} className="map-legend-item">
          <span className={`map-legend-dot ${it.cls}`} aria-hidden="true" />
          <span>{it.label}</span>
        </span>
      ))}
    </div>
  );
}
