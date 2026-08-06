import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveProfile } from "@/lib/mida/services/profile";
import { getRepos } from "@/lib/mida/adapters/db";
import { getStorage } from "@/lib/mida/adapters/storage";
import Closet, { type ClosetLook } from "@/components/mida/Closet";
import { EmptyState } from "@/components/mida/ui";

export const metadata: Metadata = {
  title: "הארון שלי",
};

export default async function ClosetPage() {
  const profile = await getActiveProfile();
  if (!profile) redirect("/onboarding");

  const repos = await getRepos();
  const storage = await getStorage();
  const tryons = await repos.tryons.listByProfile(profile.id, 60);

  const looks: ClosetLook[] = [];
  for (const tryon of tryons) {
    if (tryon.status !== "ready" || !tryon.resultKey) continue;
    const titles: string[] = [];
    for (const id of tryon.productIds.length ? tryon.productIds : [tryon.productId]) {
      const product = await repos.products.getById(id);
      if (product) titles.push(product.title);
    }
    looks.push({
      id: tryon.id,
      url: storage.url(tryon.resultKey),
      isFavorite: tryon.isFavorite,
      titles,
      size: tryon.sizeRec?.size ?? null,
      createdAt: tryon.createdAt,
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-5 py-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold text-mida-ink">
          הארון של {profile.name}
        </h1>
        <p className="text-sm text-mida-muted">
          כל מה שמדדת נשמר כאן — אפשר לסמן מועדפים ולשתף.
        </p>
      </div>

      {looks.length === 0 ? (
        <EmptyState
          title="הארון עוד ריק"
          body="כל מדידה שתעשו תישמר כאן אוטומטית, עם המלצת המידה שלה."
          action={
            <Link
              href="/tryon"
              className="flex h-12 cursor-pointer items-center justify-center rounded-full bg-mida-accent px-8 text-base font-semibold text-white transition-colors duration-200 hover:bg-mida-accent-deep"
            >
              למדידה ראשונה
            </Link>
          }
        />
      ) : (
        <Closet looks={looks} />
      )}
    </div>
  );
}
