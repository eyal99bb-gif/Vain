// SSRF guard. The app fetches URLs supplied by users (product links) and by
// the model (image/size-guide URLs), so every outbound request must be proven
// to target a public host — otherwise the server becomes a proxy into the
// private network and the cloud metadata endpoint.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { midaEnv } from "./env";

const ALLOWED_PORTS = new Set(["", "80", "443"]);

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || // this network
    a === 10 || // private
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local incl. 169.254.169.254 metadata
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    a >= 224 // multicast + reserved
  );
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd")) {
    return true;
  }
  // IPv4-mapped (::ffff:127.0.0.1) inherits the IPv4 rules.
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIPv4(mapped[1]) : false;
}

export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return true; // not an IP literal: treat as unsafe
}

/**
 * Resolve the URL's host and reject anything that is not a public address.
 * Returns the parsed URL so callers can reuse it.
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("blocked_scheme");
  }
  // Local development against a test store on localhost; forced off in prod.
  if (midaEnv.allowPrivateUrls) return url;
  if (!ALLOWED_PORTS.has(url.port)) throw new Error("blocked_port");

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error("blocked_address");
    return url;
  }
  if (/\.(local|internal|localhost)$/i.test(host) || host === "localhost") {
    throw new Error("blocked_address");
  }

  // Check every address the name resolves to — a hostname pointing at
  // 127.0.0.1 is the classic bypass.
  const records = await lookup(host, { all: true });
  if (records.length === 0) throw new Error("blocked_address");
  for (const record of records) {
    if (isPrivateAddress(record.address)) throw new Error("blocked_address");
  }
  return url;
}

export interface SafeFetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
}

export interface SafeFetchResult {
  ok: boolean;
  status: number;
  body: Buffer;
  contentType: string;
  url: string;
}

/**
 * Fetch with SSRF protection: redirects are followed manually so each hop is
 * re-validated, and the body is capped so a huge asset can't exhaust memory.
 */
export async function safeFetch(
  rawUrl: string,
  { headers = {}, timeoutMs = 10_000, maxBytes = 4 * 1024 * 1024 }: SafeFetchOptions = {}
): Promise<SafeFetchResult> {
  let current = rawUrl;

  for (let hop = 0; hop <= 3; hop++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, {
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("blocked_redirect");
      current = new URL(location, url).toString();
      continue;
    }

    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        if (received >= maxBytes) {
          reader.cancel().catch(() => {});
          break;
        }
      }
    }

    return {
      ok: res.ok,
      status: res.status,
      body: Buffer.concat(chunks),
      contentType: res.headers.get("content-type") ?? "",
      url: url.toString(),
    };
  }
  throw new Error("too_many_redirects");
}

/** Browser-ish headers — many store CDNs reject bare server requests. */
export const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Accept-Language": "he,en;q=0.8",
};
