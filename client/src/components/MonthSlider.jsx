import { formatMonth } from '../lib/format.js';

// Scrub through months by index. Drives the map snapshot.
export default function MonthSlider({ months, value, onChange }) {
  const max = months.length - 1;
  const step = (dir) => onChange(Math.min(max, Math.max(0, value + dir)));
  return (
    <div className="month-slider">
      <button type="button" className="year-step" onClick={() => step(-1)} disabled={value <= 0} aria-label="Previous month">‹</button>
      <input
        type="range"
        className="month-range"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Month"
      />
      <button type="button" className="year-step" onClick={() => step(1)} disabled={value >= max} aria-label="Next month">›</button>
      <span className="year-readout">{formatMonth(months[value])}</span>
    </div>
  );
}
