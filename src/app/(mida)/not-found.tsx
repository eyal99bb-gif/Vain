import Link from "next/link";

export default function MidaNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
      <h1 className="font-display text-2xl font-bold text-mida-ink">
        העמוד לא נמצא
      </h1>
      <p className="text-sm text-mida-muted">
        הקישור שגוי או שהעמוד הוסר.
      </p>
      <Link
        href="/"
        className="flex h-12 cursor-pointer items-center justify-center rounded-full bg-mida-accent px-8 text-base font-semibold text-white transition-colors duration-200 hover:bg-mida-accent-deep"
      >
        חזרה לדף הבית
      </Link>
    </div>
  );
}
