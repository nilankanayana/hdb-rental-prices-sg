import { useEffect, useMemo, useRef, useState } from 'react';
import { searchPlaces, addressRent } from '../lib/rentals.js';
import { formatRent, formatFlatType } from '../lib/format.js';

// Type-ahead over towns and exact addresses (block + street). Town hits appear
// first, then matching addresses. Each result shows its median rent for the
// active flat type.
export default function SearchBox({ towns, medians, addressIndex, flatType, onSelectTown, onSelectAddress }) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const activeItemRef = useRef(null);

  // Flatten town + address hits into one keyboard-navigable list.
  const items = useMemo(() => {
    if (!query.trim()) return [];
    const { towns: t, addresses: a } = searchPlaces(query, towns, addressIndex);
    return [
      ...t.map((town) => ({ kind: 'town', town })),
      ...a.map((addr) => ({ kind: 'address', addr })),
    ];
  }, [query, towns, addressIndex]);

  useEffect(() => setActiveIdx(0), [query]);
  useEffect(() => { activeItemRef.current?.scrollIntoView({ block: 'nearest' }); }, [activeIdx]);
  useEffect(() => {
    const onDocClick = (e) => { if (!wrapperRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function commit(item) {
    if (item.kind === 'town') {
      onSelectTown(item.town.name);
      setQuery(item.town.name);
    } else {
      onSelectAddress(item.addr);
      setQuery(item.addr.label);
    }
    setOpen(false);
  }

  function onKeyDown(e) {
    if (!items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); commit(items[activeIdx]); }
    else if (e.key === 'Escape') { setQuery(''); setOpen(false); }
  }

  return (
    <div className="search-box" ref={wrapperRef}>
      <div className="search-input-wrapper">
        <span className="search-icon" aria-hidden="true">⌕</span>
        <input
          type="search"
          className="search-input"
          placeholder="Search town, block or street…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button type="button" className="search-clear" onClick={() => { setQuery(''); setOpen(false); }} aria-label="Clear search">×</button>
        )}
      </div>
      {open && query && (
        <div className="search-results" role="listbox">
          {items.length === 0 ? (
            <div className="search-empty">Nothing matches "{query}".</div>
          ) : (
            items.map((item, idx) => {
              const active = idx === activeIdx;
              if (item.kind === 'town') {
                const cell = medians.get(item.town.name);
                return (
                  <button
                    key={`t:${item.town.name}`}
                    type="button" role="option"
                    ref={active ? activeItemRef : null}
                    aria-selected={active}
                    className={`search-result${active ? ' search-result--active' : ''}`}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => commit(item)}
                  >
                    <div className="result-main">
                      <span className="result-address">{item.town.name}</span>
                      <span className="result-id">Town · {formatFlatType(flatType)}</span>
                    </div>
                    <span className="result-badge result-badge--rent">{cell ? formatRent(cell.median) : '—'}</span>
                  </button>
                );
              }
              const rent = addressRent(item.addr, flatType);
              return (
                <button
                  key={`a:${item.addr.ti}:${item.addr.b}:${item.addr.s}`}
                  type="button" role="option"
                  ref={active ? activeItemRef : null}
                  aria-selected={active}
                  className={`search-result${active ? ' search-result--active' : ''}`}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => commit(item)}
                >
                  <div className="result-main">
                    <span className="result-address">{item.addr.label}</span>
                    <span className="result-id">{item.addr.town} · {item.addr.n} rental{item.addr.n === 1 ? '' : 's'}</span>
                  </div>
                  <span className="result-badge result-badge--rent">{rent ? formatRent(rent.median) : '—'}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
