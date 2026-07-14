// Binance SPOT TESTNET helpers. The base URL is hard-coded to the testnet
// so this module is physically incapable of touching a real account.
// Signals are computed from production market data (accurate prices);
// only ORDER EXECUTION goes to the testnet.

import { createHmac } from "node:crypto";

export const TESTNET_BASE = "https://testnet.binance.vision";

export function hmacSign(secret: string, query: string): string {
  return createHmac("sha256", secret).update(query).digest("hex");
}

/** round a quantity DOWN to the symbol's LOT_SIZE step */
export function roundStep(qty: number, step: number): number {
  if (step <= 0) return qty;
  const precision = Math.max(0, Math.round(-Math.log10(step)));
  return Number((Math.floor(qty / step + 1e-9) * step).toFixed(precision));
}

/** long-only target fraction: spot accounts cannot short */
export function longOnlyTarget(direction: number, positionFrac: number): number {
  return direction > 0 ? Math.abs(positionFrac) : 0;
}

/** rebalance decision: act only when drift exceeds the band */
export function rebalanceDelta(
  targetFrac: number,
  currentFrac: number,
  band = 0.05,
): number {
  const d = targetFrac - currentFrac;
  return Math.abs(d) > band ? d : 0;
}

export interface SignedClient {
  get: (path: string, params?: Record<string, string>) => Promise<unknown>;
  post: (path: string, params: Record<string, string>) => Promise<unknown>;
}

export function makeClient(key: string, secret: string): SignedClient {
  const call = async (
    method: "GET" | "POST",
    path: string,
    params: Record<string, string>,
  ): Promise<unknown> => {
    const qs = new URLSearchParams({
      ...params,
      timestamp: String(Date.now()),
      recvWindow: "10000",
    }).toString();
    const url = `${TESTNET_BASE}${path}?${qs}&signature=${hmacSign(secret, qs)}`;
    const res = await fetch(url, {
      method,
      headers: { "X-MBX-APIKEY": key },
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`testnet ${res.status}: ${body.slice(0, 300)}`);
    return JSON.parse(body);
  };
  return {
    get: (path, params = {}) => call("GET", path, params),
    post: (path, params) => call("POST", path, params),
  };
}
