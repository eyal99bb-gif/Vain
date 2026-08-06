import type { Metadata, Viewport } from "next";
import { Frank_Ruhl_Libre, Heebo } from "next/font/google";
import "./globals.css";

const frankRuhl = Frank_Ruhl_Libre({
  variable: "--font-frank-ruhl",
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "700", "900"],
});

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

/**
 * viewport-fit=cover is what makes env(safe-area-inset-*) report real
 * values on notched iPhones — without it they are 0 and the bottom CTA
 * sits under the home indicator.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#faf6f1",
};

export const metadata: Metadata = {
  title: {
    default: "MIDA — מדידה וירטואלית",
    template: "%s — MIDA",
  },
  description:
    "תמדוד לפני שאתה קונה. MIDA מלבישה עליך כל בגד מכל חנות אונליין וממליצה על המידה המדויקת שלך.",
  // Required for the OG image URL to resolve when the link is unfurled.
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"
  ),
  applicationName: "MIDA",
  openGraph: {
    type: "website",
    locale: "he_IL",
    siteName: "MIDA",
    title: "MIDA — תמדוד לפני שאתה קונה",
    description:
      "מדביקים קישור לבגד מכל חנות, רואים אותו עליכם, ומקבלים המלצת מידה מדויקת.",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${frankRuhl.variable} ${heebo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
