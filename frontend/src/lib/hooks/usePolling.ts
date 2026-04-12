import { useEffect, useRef } from "react";

export function usePolling(
  fetchFn: () => Promise<void>,
  intervalMs: number = 30000,
  enabled: boolean = true,
) {
  const savedFetch = useRef(fetchFn);
  savedFetch.current = fetchFn;

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      savedFetch.current();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs, enabled]);
}
