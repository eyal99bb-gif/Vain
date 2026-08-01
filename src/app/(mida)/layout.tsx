import Link from "next/link";

export default function MidaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        </header>
        <main className="flex flex-1 flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {children}
        </main>
      </div>
    </div>
  );
}
