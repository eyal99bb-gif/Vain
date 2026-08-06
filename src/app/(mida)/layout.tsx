import Link from "next/link";
import { getActiveProfile } from "@/lib/mida/services/profile";
import MotionProvider from "@/components/mida/MotionProvider";

export default async function MidaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getActiveProfile();

  return (
    <MotionProvider>
      <div className="mida min-h-dvh">
        <div
          className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5"
          style={{
            paddingInlineStart: "max(1.25rem, env(safe-area-inset-left))",
            paddingInlineEnd: "max(1.25rem, env(safe-area-inset-right))",
          }}
        >
          <header className="flex items-center justify-between gap-3 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))]">
            <Link
              href="/"
              className="flex items-baseline gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mida-accent"
            >
              <span className="font-display text-2xl font-bold tracking-tight text-mida-ink">
                MIDA
              </span>
              <span className="text-xs text-mida-muted">תמדוד. אל תנחש.</span>
            </Link>
            <Link
              href="/profiles"
              // 44px minimum touch target.
              className="flex h-11 min-w-11 cursor-pointer items-center gap-1.5 rounded-full border border-mida-line bg-mida-surface px-3 text-xs font-medium text-mida-ink transition-colors duration-200 hover:border-mida-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mida-accent"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span className="max-w-24 truncate">
                {profile?.name ?? "פרופיל"}
              </span>
            </Link>
          </header>
          <main className="flex flex-1 flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {children}
          </main>
        </div>
      </div>
    </MotionProvider>
  );
}
