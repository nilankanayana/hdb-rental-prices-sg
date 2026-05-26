import { useMemo, useState } from 'react';
import { useElementWidth } from '../hooks/useElementWidth.js';
import { formatRent, formatRentCompact, formatMonth } from '../lib/format.js';

const HEIGHT = 220;
const PAD = { top: 14, right: 14, bottom: 24, left: 46 };

function niceCeil(value) {
  if (value <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(value));
  const norm = value / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

// Median rent per month for one town + flat type. Months without data break the
// line (no synthetic zeros).
export default function TrendChart({ points, highlightIdx, onHover }) {
  const [ref, width] = useElementWidth();
  const [hoverIdx, setHoverIdx] = useState(null);

  const withData = points.filter((p) => p.median != null);

  const geom = useMemo(() => {
    const w = Math.max(width, 280);
    const innerW = w - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const maxVal = niceCeil(Math.max(1, ...withData.map((p) => p.median)));
    const n = points.length;
    const x = (i) => PAD.left + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1));
    const y = (v) => PAD.top + innerH - (innerH * v) / maxVal;
    const yTicks = Array.from({ length: 4 }, (_, i) => (maxVal * (i + 1)) / 4);
    return { w, innerH, maxVal, x, y, yTicks };
  }, [width, points, withData]);

  if (!width) return <div className="chart-svg-wrap" ref={ref} style={{ height: HEIGHT }} />;
  if (!withData.length) {
    return (
      <div className="chart-svg-wrap" ref={ref} style={{ height: HEIGHT, display: 'grid', placeItems: 'center' }}>
        <span className="breakdown-empty">No rentals recorded for this selection.</span>
      </div>
    );
  }

  const { w, x, y, yTicks } = geom;

  // Build path segments, breaking across null months.
  let d = '';
  let pen = false;
  for (const p of points) {
    if (p.median == null) { pen = false; continue; }
    d += `${pen ? 'L' : 'M'}${x(p.idx).toFixed(1)},${y(p.median).toFixed(1)} `;
    pen = true;
  }

  const activeIdx = hoverIdx ?? highlightIdx;
  const activePoint = activeIdx != null ? points[activeIdx] : null;
  const showTip = activePoint && activePoint.median != null;

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * w;
    let nearest = null;
    let best = Infinity;
    for (const p of withData) {
      const dst = Math.abs(x(p.idx) - px);
      if (dst < best) { best = dst; nearest = p.idx; }
    }
    setHoverIdx(nearest);
    onHover?.(nearest);
  };

  return (
    <div className="chart-svg-wrap" ref={ref}>
      <svg
        viewBox={`0 0 ${w} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        role="img"
        aria-label="Median rent by month"
        onMouseMove={handleMove}
        onMouseLeave={() => { setHoverIdx(null); onHover?.(null); }}
      >
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={PAD.left - 8} y={y(t)} className="chart-axis-label" textAnchor="end" dominantBaseline="middle">
              {formatRentCompact(t)}
            </text>
          </g>
        ))}

        {showTip && <line x1={x(activeIdx)} x2={x(activeIdx)} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="chart-guide" />}

        <path d={d.trim()} className="chart-line chart-line--rent chart-line--active" />

        {showTip && <circle cx={x(activeIdx)} cy={y(activePoint.median)} r={4} className="chart-dot chart-dot--rent chart-dot--active" />}

        {points.map((p) =>
          p.month.endsWith('-01') ? (
            <text key={p.idx} x={x(p.idx)} y={HEIGHT - 7} className="chart-axis-label" textAnchor="middle">
              {p.month.slice(0, 4)}
            </text>
          ) : null
        )}
      </svg>

      {showTip && (
        <div className="chart-tooltip" style={{ left: `${(x(activeIdx) / w) * 100}%`, top: PAD.top }}>
          <div className="chart-tooltip-year">{formatMonth(activePoint.month)}</div>
          <div className="chart-tooltip-row">
            <span className="chart-tooltip-swatch chart-tooltip-swatch--rent" />
            <span className="chart-tooltip-cat">Median</span>
            <span className="chart-tooltip-val">{formatRent(activePoint.median)}</span>
          </div>
          <div className="chart-tooltip-row">
            <span className="chart-tooltip-swatch" style={{ background: 'transparent' }} />
            <span className="chart-tooltip-cat">Rentals</span>
            <span className="chart-tooltip-val">{activePoint.count}</span>
          </div>
        </div>
      )}
    </div>
  );
}
