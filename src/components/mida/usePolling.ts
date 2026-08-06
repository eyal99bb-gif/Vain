"use client";

import { useEffect, useRef, useState } from "react";

export type PollDecision<T> =
  | { done: false }
  | { done: true; value: T }
  | { done: true; error: string };

interface Options<T> {
  url: string;
  /** Inspect a response body and decide whether polling is finished. */
  decide: (data: unknown) => PollDecision<T>;
  onDone: (value: T) => void;
  onError: (message: string) => void;
  timeoutMs?: number;
  timeoutMessage?: string;
}

const BASE_MS = 1500;
const MAX_MS = 5000;

/**
 * Polls until `decide` says stop. Replaces a fixed 2s loop that fired up to
 * 45 serverless requests per try-on, never aborted a stalled fetch (so the
 * timeout could not fire), and died silently when iOS suspended timers in a
 * backgrounded tab.
 */
export function usePolling<T>({
  url,
  decide,
  onDone,
  onError,
  timeoutMs = 90_000,
  timeoutMessage = "זה לוקח יותר מדי זמן — נסו שוב בעוד רגע.",
}: Options<T>): { elapsedMs: number } {
  const [elapsedMs, setElapsedMs] = useState(0);
  // Latest-callback refs so changing handlers never restart the loop.
  const handlers = useRef({ decide, onDone, onError });
  useEffect(() => {
    handlers.current = { decide, onDone, onError };
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    let attempt = 0;

    const tick = async () => {
      if (cancelled) return;
      setElapsedMs(Date.now() - startedAt);

      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (res.ok) {
          const outcome = handlers.current.decide(await res.json());
          if (outcome.done) {
            if (cancelled) return;
            if ("error" in outcome) handlers.current.onError(outcome.error);
            else handlers.current.onDone(outcome.value);
            return;
          }
        }
      } catch {
        // Transient network error or abort — fall through and retry.
      } finally {
        clearTimeout(abortTimer);
      }

      if (cancelled) return;
      if (Date.now() - startedAt > timeoutMs) {
        handlers.current.onError(timeoutMessage);
        return;
      }
      attempt++;
      timer = setTimeout(tick, Math.min(BASE_MS + attempt * 500, MAX_MS));
    };

    // iOS suspends timers in background tabs; re-check as soon as we return.
    const onVisible = () => {
      if (document.visibilityState === "visible" && !cancelled) {
        clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [url, timeoutMs, timeoutMessage]);

  return { elapsedMs };
}
