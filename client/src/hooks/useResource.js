import { useCallback, useEffect, useRef, useState } from 'react';

export function useResource(url, intervalMs) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const abortRef = useRef(null);
  const timerRef = useRef(null);
  const cancelledRef = useRef(false);

  const fetchOnce = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (cancelledRef.current) return;
      setData(json);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      if (err.name === 'AbortError' || cancelledRef.current) return;
      setError(err.message);
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [url]);

  const refresh = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(fetchOnce, intervalMs);
    fetchOnce();
  }, [fetchOnce, intervalMs]);

  useEffect(() => {
    cancelledRef.current = false;
    fetchOnce();
    timerRef.current = setInterval(fetchOnce, intervalMs);
    return () => {
      cancelledRef.current = true;
      clearInterval(timerRef.current);
      abortRef.current?.abort();
    };
  }, [intervalMs, fetchOnce]);

  return { data, error, loading, lastUpdated, refresh };
}
