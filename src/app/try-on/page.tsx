import type { Metadata } from "next";
import TryOnClient from "@/components/tryon/TryOnClient";

export const metadata: Metadata = {
  title: "Virtual Try-On — מדידת עגילים בתלת־ממד | Studio Vain",
  description:
    "מדדו עגילים על אוזן תלת־ממדית ריאליסטית: בחרו נקודת פירסינג, עיצוב ומתכת — וראו את הלוק שלכם בזמן אמת.",
};

export default function TryOnPage() {
  return <TryOnClient />;
}
