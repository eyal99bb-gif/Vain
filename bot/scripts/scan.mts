// Scheduled signal scanner — runs on GitHub Actions every 30 minutes.
// Scans all crypto assets on 1h + 1d bars and writes alerts.json with the
// signals that are actually WORTH an alert: clear direction, conviction
// ≥ 0.35, and a positive half-Kelly (measured edge). The workflow turns
// each alert into a GitHub Issue, which triggers the owner's email/push
// notifications. Fixture data never alerts.

import { writeFileSync } from "node:fs";
import { analyze } from "../src/lib/quant/analyze";
import { ASSETS } from "../src/lib/quant/config";
import { fetchSeries } from "../src/lib/quant/fetchClient";
import type { Interval } from "../src/lib/quant/types";

const INTERVALS: Interval[] = ["1h", "1d"];
const MIN_CONVICTION = 0.35;

interface Alert {
  key: string;
  title: string;
  body: string;
}

const intervalHe = (i: Interval) => (i === "1h" ? "שעתי" : "יומי");
const fmt = (x: number) => x.toLocaleString("en-US", { maximumFractionDigits: 2 });

async function main() {
  const alerts: Alert[] = [];
  const skipped: string[] = [];

  for (const asset of ASSETS.filter((a) => a.kind === "crypto")) {
    for (const interval of INTERVALS) {
      try {
        const series = await fetchSeries(asset.id, interval);
        if (series.source === "fixture") {
          skipped.push(`${asset.id}/${interval}: no live data`);
          continue;
        }
        const a = analyze(series, 10000);
        const e = a.ensemble;
        const worthwhile =
          e.direction !== 0 && e.conviction >= MIN_CONVICTION && a.kelly.half > 0;
        if (!worthwhile) continue;

        const dirHe = e.direction > 0 ? "לונג" : "שורט";
        alerts.push({
          key: `${asset.id}-${interval}-${dirHe}`,
          title: `🔔 אות מסחר: ${asset.id} ${dirHe} (${intervalHe(interval)})`,
          body: [
            `@eyal99bb-gif`,
            ``,
            `**${asset.label} — ${dirHe} (${intervalHe(interval)})**`,
            ``,
            `- מחיר בזמן הסריקה: $${fmt(e.price)}`,
            `- ביטחון: ${(e.conviction * 100).toFixed(0)}%`,
            `- הסתברות היסטורית: ${(a.hitRate.rate * 100).toFixed(0)}% (טווח ${(a.hitRate.lo * 100).toFixed(0)}%–${(a.hitRate.hi * 100).toFixed(0)}%, על ${a.hitRate.n} מקרים)`,
            `- גודל מוצע (חצי-קלי): ${(Math.abs(e.positionFrac) * 100).toFixed(0)}% מהתיק`,
            e.stop !== null ? `- סטופ מוצע: $${fmt(e.stop)}` : ``,
            ``,
            `[פתח את הדשבורד](https://eyal99bb-gif.github.io/Vain/) לניתוח המלא ולתוכנית הפעולה.`,
            ``,
            `_התראה אוטומטית. לא ייעוץ השקעות — בדוק את המספרים בעצמך, נייר לפני כסף._`,
          ].join("\n"),
        });
      } catch (err) {
        skipped.push(`${asset.id}/${interval}: ${err}`);
      }
    }
  }

  writeFileSync("alerts.json", JSON.stringify(alerts, null, 2));
  console.log(`alerts: ${alerts.length}`);
  for (const a of alerts) console.log(` - ${a.title}`);
  if (skipped.length) console.log(`skipped: ${skipped.join(" | ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
