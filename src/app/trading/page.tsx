import type { Metadata } from "next";
import TradingDashboard from "./TradingDashboard";

export const metadata: Metadata = {
  title: "יועץ המסחר — Vain",
  description:
    "ניתוח רב-אותות כן: משטר מרקוב, מומנטום, מגמה, תנודתיות — עם אחוזים אמיתיים וטווחי אי-ודאות. לא ייעוץ השקעות.",
};

export default function TradingPage() {
  return <TradingDashboard />;
}
