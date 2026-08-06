import { Skeleton } from "@/components/mida/ui";

/** Shown while a server component fetches — replaces a blank frame. */
export default function MidaLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 py-8">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex flex-col gap-3 pt-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
      <Skeleton className="mt-auto h-12 w-full rounded-full" />
    </div>
  );
}
