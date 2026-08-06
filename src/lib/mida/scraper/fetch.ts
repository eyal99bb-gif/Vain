export type FetchOutcome =
  | { ok: true; html: string }
  | { ok: false; reason: "blocked" | "not-found" | "error" | "timeout" };

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

/** Fetch a product page with browser-like headers. Never throws. */
export async function fetchPage(url: string): Promise<FetchOutcome> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "he,en;q=0.8",
      },
    });

    if (res.status === 403 || res.status === 429) {
      return { ok: false, reason: "blocked" };
    }
    if (res.status === 404) return { ok: false, reason: "not-found" };
    if (!res.ok) return { ok: false, reason: "error" };

    const reader = res.body?.getReader();
    if (!reader) return { ok: false, reason: "error" };

    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      if (received >= MAX_BYTES) {
        reader.cancel().catch(() => {});
        break;
      }
    }
    const html = Buffer.concat(chunks).toString("utf8");

    // Bot-challenge pages often return 200 with a challenge shell.
    if (/cf-challenge|captcha-delivery|__cf_chl|Just a moment/i.test(html.slice(0, 5000))) {
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
