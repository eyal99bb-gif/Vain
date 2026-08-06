import { BROWSER_HEADERS, safeFetch } from "../net";

export type FetchOutcome =
  | { ok: true; html: string }
  | { ok: false; reason: "blocked" | "not-found" | "error" | "timeout" };

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

/** Fetch a product page with browser-like headers. Never throws. */
export async function fetchPage(url: string): Promise<FetchOutcome> {
  try {
    const res = await safeFetch(url, {
      timeoutMs: TIMEOUT_MS,
      maxBytes: MAX_BYTES,
      headers: {
        ...BROWSER_HEADERS,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (res.status === 403 || res.status === 429) {
      return { ok: false, reason: "blocked" };
    }
    if (res.status === 404) return { ok: false, reason: "not-found" };
    if (!res.ok) return { ok: false, reason: "error" };

    const html = res.body.toString("utf8");

    // Bot-challenge pages often return 200 with a challenge shell.
    if (
      /cf-challenge|captcha-delivery|__cf_chl|Just a moment/i.test(
        html.slice(0, 5000)
      )
    ) {
      return { ok: false, reason: "blocked" };
    }
    return { ok: true, html };
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return { ok: false, reason: "timeout" };
    }
    return { ok: false, reason: "error" };
  }
}
