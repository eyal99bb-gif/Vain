// Diagnostic endpoint: which adapter modes are active in this deployment.
// Exposes no secrets — only mode names derived from env presence.
import { midaEnv } from "@/lib/mida/env";

export async function GET() {
  return Response.json({
    ok: true,
    aiMode: midaEnv.aiMode,
    dbMode: midaEnv.dbMode,
    storageMode: midaEnv.storageMode,
  });
}
