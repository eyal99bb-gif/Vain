import type { MetadataRoute } from "next";

/** Makes MIDA installable to the home screen — it is a phone-first tool. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MIDA — מדידה וירטואלית",
    short_name: "MIDA",
    description:
      "תמדוד לפני שאתה קונה: הלבשה וירטואלית והמלצת מידה מדויקת מכל חנות אונליין.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf6f1",
    theme_color: "#faf6f1",
    lang: "he",
    dir: "rtl",
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
