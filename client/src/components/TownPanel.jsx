import TrendChart from './TrendChart.jsx';
import { townTrend, townBreakdown, cellFor } from '../lib/rentals.js';
import { formatRent, formatMonth, formatFlatType } from '../lib/format.js';

export default function TownPanel({ data, town, flatType, monthIdx, onClose }) {
  if (!town) {
    return (
      <section className="panel panel--empty">
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">📍</span>
          <h2 className="empty-title">Select a town</h2>
          <p className="empty-text">
            Click a town on the map to see how its median rent has moved month by
            month and how it splits across flat types.
          </p>
        </div>
      </section>
    );
  }

  const trend = townTrend(data, town, flatType);
  const breakdown = townBreakdown(data, town, monthIdx);
  const current = cellFor(data, town, flatType, monthIdx);
  const month = data.months[monthIdx];

  const valid = trend.filter((p) => p.median != null);
  const peak = valid.reduce((a, b) => (b.median > a.median ? b : a), valid[0] ?? null);
  const low = valid.reduce((a, b) => (b.median < a.median ? b : a), valid[0] ?? null);
  const maxBar = Math.max(...breakdown.map((b) => b.median), 1);

  return (
    <section className="panel">
      <header className="panel-header">
        <div className="panel-title-group">
          <h2 className="panel-title">{town}</h2>
          <span className="panel-id">{formatFlatType(flatType)}</span>
        </div>
        <button type="button" className="panel-close" onClick={onClose} aria-label="Close panel">×</button>
      </header>
      <div className="panel-body">
        <div className="availability-hero">
          <span className="availability-type">{formatMonth(month)} · median rent</span>
          <div className="availability-number">
            <span className="availability-value">{current ? formatRent(current.median) : '—'}</span>
          </div>
          <span className="availability-updated">
            {current ? `${current.count} rental${current.count === 1 ? '' : 's'} approved` : 'no rentals this month'}
          </span>
        </div>

        <div className="panel-spark">
          <span className="other-lots-title">Median rent · {formatMonth(data.months[0])} – {formatMonth(data.months[data.months.length - 1])}</span>
          <TrendChart points={trend} highlightIdx={monthIdx} />
        </div>

        <div className="other-lots">
          <span className="other-lots-title">By flat type · {formatMonth(month)}</span>
          {breakdown.length === 0 ? (
            <p className="breakdown-empty">No rentals recorded this month.</p>
          ) : (
            <ul className="breakdown-list">
              {breakdown.map((b) => (
                <li key={b.flatType}>
                  <div className={`breakdown-row breakdown-row--static${b.flatType === flatType ? ' breakdown-row--active' : ''}`}>
                    <span className="breakdown-type">{formatFlatType(b.flatType)}</span>
                    <span className="breakdown-track">
                      <span className="breakdown-bar" style={{ width: `${(b.median / maxBar) * 100}%` }} />
                    </span>
                    <span className="breakdown-value">{formatRent(b.median)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <dl className="panel-meta">
          <dt>Peak</dt>
          <dd>{peak ? `${formatRent(peak.median)} · ${formatMonth(peak.month)}` : '—'}</dd>
          <dt>Lowest</dt>
          <dd>{low ? `${formatRent(low.median)} · ${formatMonth(low.month)}` : '—'}</dd>
        </dl>
      </div>
    </section>
  );
}
