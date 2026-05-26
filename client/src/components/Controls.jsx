// Coverage badge + reload. The dataset is static (annual/monthly snapshots),
// so the badge reports the month range rather than a live timestamp.
export default function Controls({ onRefresh, loading, error, hasData, monthRange, count }) {
  let badgeClass = 'status-badge';
  let badgeContent;

  if (error && !hasData) {
    badgeClass += ' status-badge--error';
    badgeContent = <>Error · {error}</>;
  } else if (!hasData) {
    badgeContent = <>Loading…</>;
  } else {
    badgeClass += ' status-badge--annual';
    badgeContent = (
      <>
        <span className="annual-dot" aria-hidden="true" />
        {count != null ? `${count.toLocaleString()} rentals · ` : ''}
        {monthRange ? `${monthRange[0]} – ${monthRange[1]}` : ''}
      </>
    );
  }

  return (
    <div className="controls">
      <span className={badgeClass} aria-live="polite">{badgeContent}</span>
      <button
        type="button"
        className="refresh-btn"
        onClick={onRefresh}
        disabled={loading}
        aria-label="Reload data"
        title="Reload the dataset"
      >
        <span className={`refresh-icon${loading ? ' refresh-icon--spinning' : ''}`} aria-hidden="true">↻</span>
        {loading ? 'Loading…' : 'Reload'}
      </button>
    </div>
  );
}
