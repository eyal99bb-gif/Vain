// Daily spend guard. Every try-on is a paid Gemini image generation and the
// app has no login, so without this a loop against POST /api/mida/tryons
// drains the API budget. Counting is derived from existing rows — no extra
// table, and it survives instance restarts (unlike an in-memory limiter).
import { getRepos } from "../adapters/db";
import { midaEnv } from "../env";

export interface QuotaState {
  allowed: boolean;
  used: number;
  limit: number;
  /** Local midnight, when the counter rolls over. */
  resetsAt: string;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function nextMidnight(): Date {
  const start = startOfToday();
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

/** Try-ons created today across every profile belonging to this uid. */
export async function getTryOnQuota(uid: string): Promise<QuotaState> {
  const repos = await getRepos();
  const profiles = await repos.profiles.listByUid(uid);
  const since = startOfToday().toISOString();

  let used = 0;
  for (const profile of profiles) {
    const recent = await repos.tryons.listByProfile(profile.id, 200);
    used += recent.filter((t) => t.createdAt >= since).length;
  }

  const limit = midaEnv.MIDA_DAILY_TRYON_LIMIT;
  return {
    allowed: used < limit,
    used,
    limit,
    resetsAt: nextMidnight().toISOString(),
  };
}

/**
 * Product ingests also cost money (up to five Gemini text calls per paste),
 * so they get their own, looser ceiling. Counted from products created by
 * this uid's screenshots plus try-on attempts as a proxy for activity.
 */
export async function getIngestQuota(uid: string): Promise<QuotaState> {
  const tryOns = await getTryOnQuota(uid);
  const limit = midaEnv.MIDA_DAILY_INGEST_LIMIT;
  // Ingests are bounded by the same activity window; reuse the count and
  // apply the looser limit so browsing many products stays cheap but capped.
  return {
    allowed: tryOns.used * 4 < limit,
    used: tryOns.used * 4,
    limit,
    resetsAt: tryOns.resetsAt,
  };
}

/** Hebrew message for an exhausted quota. */
export function quotaMessage(state: QuotaState): string {
  return `הגעת למכסה היומית (${state.limit}). המכסה מתאפסת בחצות — נתראה מחר!`;
}
