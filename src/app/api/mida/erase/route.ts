import { readUid } from "@/lib/mida/uid";
import { eraseAllData } from "@/lib/mida/services/erase";
import { logError } from "@/lib/mida/log";

/** Erase every profile, try-on and image belonging to this anonymous user. */
export async function POST() {
  const uid = await readUid();
  if (!uid) return Response.json({ ok: true, profiles: 0 });

  try {
    const profiles = await eraseAllData(uid);
    return Response.json({ ok: true, profiles });
  } catch (err) {
    const errorId = logError("erase.all", err, { uid });
    return Response.json({ error: "delete_failed", errorId }, { status: 500 });
  }
}
