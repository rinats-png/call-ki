"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Lädt JSON und aktualisiert es periodisch (pausiert bei verstecktem Tab). */
export function usePoll<T>(url: string | null, intervalMs = 5000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const ctrl = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!url) return;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    try {
      const res = await fetch(url, { signal: c.signal, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as T);
      setError(null);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    load();
    if (!intervalMs) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, intervalMs);
    return () => {
      clearInterval(id);
      ctrl.current?.abort();
    };
  }, [load, intervalMs]);

  return { data, error, loading, reload: load };
}
