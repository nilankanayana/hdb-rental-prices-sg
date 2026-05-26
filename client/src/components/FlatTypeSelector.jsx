import { ALL_FLAT_TYPE } from '../lib/rentals.js';
import { formatFlatType } from '../lib/format.js';

// Flat-type chips (All + 1-ROOM … EXECUTIVE), mirroring the carpark project's
// LotTypeSelector. Counts are total transactions across the whole timeline.
export default function FlatTypeSelector({ flatTypes, counts, value, onChange }) {
  const options = [ALL_FLAT_TYPE, ...flatTypes];
  return (
    <div className="lot-type-selector" role="tablist" aria-label="Flat type">
      {options.map((ft) => {
        const count = counts?.[ft] ?? 0;
        const active = value === ft;
        return (
          <button
            key={ft}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={count === 0}
            className={`lot-type-chip${active ? ' lot-type-chip--active' : ''}`}
            onClick={() => onChange(ft)}
            title={`${formatFlatType(ft)} · ${count.toLocaleString()} rentals`}
          >
            <span className="lot-type-label">{formatFlatType(ft)}</span>
            <span className="lot-type-count">{count.toLocaleString()}</span>
          </button>
        );
      })}
    </div>
  );
}
