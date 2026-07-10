"use client";

import dynamic from "next/dynamic";

const TryOnStudio = dynamic(() => import("./TryOnStudio"), {
  ssr: false,
  loading: () => (
    <div
      dir="rtl"
      className="h-dvh flex items-center justify-center bg-[#0C0A09] text-stone-400 text-sm tracking-widest"
    >
      טוען את הסטודיו…
    </div>
  ),
});

export default function TryOnClient() {
  return <TryOnStudio />;
}
