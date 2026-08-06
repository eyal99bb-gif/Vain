import { after } from "next/server";

/**
 * Run a long task after the response is sent, without blocking it.
 * Backed by next/server `after` (waitUntil on serverless hosts). This is the
 * seam where a real queue (BullMQ etc.) would plug in later.
 *
 * Limits of the in-process approach: no retries, and a job dies silently if
 * the process is recycled mid-run — status then stays 'processing' and the
 * client's poll timeout surfaces a retry UI.
 */
export function runJob(name: string, fn: () => Promise<void>): void {
  after(async () => {
    try {
      await fn();
    } catch (err) {
      // fn is expected to persist its own failure state; this is a backstop.
      console.error(`[mida] job ${name} failed:`, err);
    }
  });
}
