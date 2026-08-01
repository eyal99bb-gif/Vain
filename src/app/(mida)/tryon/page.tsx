import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActiveProfile } from "@/lib/mida/services/profile";
import TryOnFlow from "@/components/mida/TryOnFlow";

export const metadata: Metadata = {
  title: "מדידה",
};

export default async function TryOnPage() {
  const profile = await getActiveProfile();
  if (profile?.avatarStatus !== "ready") {
    redirect("/onboarding");
  }
  return <TryOnFlow />;
}
