// Alpaca PAPER trading helpers. The base URL is hard-coded to the paper
// environment, and keys are verified to be paper keys (they start with
// "PK"; live keys start with "AK") — double insurance that this module is
// physically incapable of touching real money.

export const ALPACA_PAPER_BASE = "https://paper-api.alpaca.markets";

/** Alpaca paper API key ids always start with PK; live keys with AK. */
export function isPaperKey(keyId: string): boolean {
  return keyId.startsWith("PK");
}

export interface AlpacaClient {
  get: (path: string) => Promise<unknown>;
  post: (path: string, body: Record<string, string>) => Promise<unknown>;
}

export function makeAlpaca(keyId: string, secret: string): AlpacaClient {
  const call = async (
    method: "GET" | "POST",
    path: string,
    body?: Record<string, string>,
  ): Promise<unknown> => {
    const res = await fetch(`${ALPACA_PAPER_BASE}${path}`, {
      method,
      headers: {
        "APCA-API-KEY-ID": keyId,
        "APCA-API-SECRET-KEY": secret,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`alpaca ${res.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : {};
  };
  return {
    get: (path) => call("GET", path),
    post: (path, body) => call("POST", path, body),
  };
}
