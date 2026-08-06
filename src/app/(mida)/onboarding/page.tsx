import type { Metadata } from "next";
import OnboardingWizard from "@/components/mida/OnboardingWizard";

export const metadata: Metadata = {
  title: "בניית פרופיל",
};

export default function OnboardingPage() {
  return <OnboardingWizard />;
}
