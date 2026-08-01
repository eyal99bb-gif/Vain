import type { Metadata } from "next";
import ProfileManager from "@/components/mida/ProfileManager";

export const metadata: Metadata = {
  title: "פרופילים",
};

export default function ProfilesPage() {
  return <ProfileManager />;
}
