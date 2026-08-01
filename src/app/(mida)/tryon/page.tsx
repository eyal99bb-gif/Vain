import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readUid } from "@/lib/mida/uid";
import { getProfile } from "@/lib/mida/services/profile";
import TryOnFlow from "@/components/mida/TryOnFlow";

export const metadata: Metadata = {
  title: "מדידה",
};

export default async function TryOnPage() {
  const uid = await readUid();
  const profile = uid ? await getProfile(uid) : null;
  if (profile?.avatarStatus !== "ready") {
    redirect("/onboarding");
  }
  return <TryOnFlow />;
}
