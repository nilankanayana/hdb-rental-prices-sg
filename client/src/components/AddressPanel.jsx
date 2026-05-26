import { addressRent } from '../lib/rentals.js';
import { formatRent, formatFlatType } from '../lib/format.js';

// Detail for one exact address (block + street). The dataset has no block-level
// coordinates, so the map centres on the town; this panel carries the precise
// figures: overall median, per-flat-type breakdown, transaction count.
export default function AddressPanel({ addr, flatType, onBack, onClose }) {
  const current = addressRent(addr, flatType);
  const rows = Object.entries(addr.ft)
    .map(([ft, [median, count]]) => ({ ft, median, count }))
    .sort((a, b) => a.ft.localeCompare(b.ft));
  const maxBar = Math.max(...rows.map((r) => r.median), 1);

  return (
    <section className="panel">
      <header className="panel-header">
        <div className="panel-title-group">
          <h2 className="panel-title">{addr.label}</h2>
          <span className="panel-id">{formatFlatType(flatType)}</span>
        </div>
        <button type="button" className="panel-close" onClick={onClose} aria-label="Close panel">×</button>
      </header>
      <div className="panel-body">
        <button type="button" className="panel-back" onClick={onBack}>‹ {addr.town}</button>

        <div className="availability-hero">
          <span className="availability-type">{formatFlatType(flatType)} · median rent</span>
          <div className="availability-number">
            <span className="availability-value">{current ? formatRent(current.median) : '—'}</span>
          </div>
          <span className="availability-updated">
            {current ? `${current.count} rental${current.count === 1 ? '' : 's'} · all-time` : 'no rentals for this flat type'}
          </span>
        </div>

        <div className="other-lots">
          <span className="other-lots-title">By flat type · all-time median</span>
          <ul className="breakdown-list">
            {rows.map((r) => (
              <li key={r.ft}>
                <div className={`breakdown-row breakdown-row--static${r.ft === flatType ? ' breakdown-row--active' : ''}`}>
                  <span className="breakdown-type">{formatFlatType(r.ft)}</span>
                  <span className="breakdown-track">
                    <span className="breakdown-bar" style={{ width: `${(r.median / maxBar) * 100}%` }} />
                  </span>
                  <span className="breakdown-value">{formatRent(r.median)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <dl className="panel-meta">
          <dt>Town</dt>
          <dd>{addr.town}</dd>
          <dt>Block</dt>
          <dd>{addr.b}</dd>
          <dt>Street</dt>
          <dd>{addr.s}</dd>
          <dt>Rentals</dt>
          <dd>{addr.n}</dd>
        </dl>
      </div>
    </section>
  );
}
