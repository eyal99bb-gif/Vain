import type { Metadata } from "next";
import StudioVainLanding from "./StudioVainLanding";

export const metadata: Metadata = {
  title: "Studio Vain — עיצוב דיגיטלי פרימיום",
  description:
    "סוכנות עיצוב דיגיטלי פרימיום. יוצרים חוויות ויזואליות שעוצרות גלילה, מעוררות רגש, ומניעות לפעולה.",
};

export default function StudioPage() {
  return <StudioVainLanding />;
}
