import Link from "next/link";
import { getActiveProfile } from "@/lib/mida/services/profile";

export default async function MidaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getActiveProfile();

  return (
    <div className="mida min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
        <header className="flex items-center justify-between pb-2 pt-5">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tracking-tight text-mida-ink">
              MIDA
            </span>
            <span className="text-xs text-mida-muted">תמדוד. אל תנחש.</span>
          </Link>
          <Link
            href="/profiles"
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-mida-line bg-mida-surface px-3 py-1.5 text-xs font-medium text-mida-ink transition-colors duration-200 hover:border-mida-accent"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
              <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {profile?.name ?? "פרופיל"}
          </Link>
        </header>
        <main className="flex flex-1 flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {children}
        </main>
      </div>
    </div>
  );
}
