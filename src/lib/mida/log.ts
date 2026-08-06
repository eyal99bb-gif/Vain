// Minimal structured logging. Raw exception text can carry hostnames,
// bucket names and connection strings, so errors are logged server-side
// under a short id and only that id is handed to the client.
import { randomUUID } from "node:crypto";

type Fields = Record<string, unknown>;

const isProd = process.env.NODE_ENV === "production";

function emit(level: "info" | "warn" | "error", event: string, fields: Fields) {
  const line = { level, event, time: new Date().toISOString(), ...fields };
  const text = isProd ? JSON.stringify(line) : `[mida] ${level} ${event}`;
  if (level === "error") console.error(text, isProd ? "" : fields);
  else if (level === "warn") console.warn(text, isProd ? "" : fields);
  else console.log(text, isProd ? "" : fields);
}

export function logInfo(event: string, fields: Fields = {}): void {
  emit("info", event, fields);
}

export function logWarn(event: string, fields: Fields = {}): void {
  emit("warn", event, fields);
}

/** Logs an error and returns the correlation id to surface to the client. */
export function logError(event: string, err: unknown, fields: Fields = {}): string {
  const errorId = randomUUID().slice(0, 8);
  emit("error", event, {
    ...fields,
    errorId,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  return errorId;
}
