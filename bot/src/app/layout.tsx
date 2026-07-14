import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "יועץ המסחר — Vain Trading",
  description:
    "ניתוח רב-אותות כן: משטר מרקוב, מומנטום, מגמה ותנודתיות, עם אחוזים אמיתיים וטווחי אי-ודאות. לא ייעוץ השקעות.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
