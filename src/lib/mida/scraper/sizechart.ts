// Size-chart <table> detection and normalization to cm.
import type { CheerioAPI } from "cheerio";
import type { MeasureKey, NormalizedSizeChart, SizeChartRow } from "../types";

/** Header-cell aliases (Hebrew + English) → canonical measure keys. */
const HEADER_ALIASES: [RegExp, MeasureKey][] = [
  [/חזה|bust|chest/i, "chest"],
  [/מותן|מותניים|waist/i, "waist"],
  [/ירכ|אגן|hips?|seat/i, "hips"],
  [/פנימי|שפה|inseam|inside leg/i, "inseam"],
  [/כתפ|shoulders?/i, "shoulders"],
  [/גובה|height/i, "height"],
];

const SIZE_LABEL_RE = /^(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|\d{1,3})$/i;

const CHART_HINT_RE =
  /מידה|מידות|size|חזה|chest|bust|מותן|waist|היקף|hips|inseam|כתפ/i;

function headerToKey(text: string): MeasureKey | null {
  for (const [re, key] of HEADER_ALIASES) {
    if (re.test(text)) return key;
  }
  return null;
}

/** Parse a numeric cell: "96-101", "96/101", "96", "37.5". */
function parseRange(text: string): { min: number; max: number } | null {
  const cleaned = text.replace(/[″"']/g, "").trim();
  const nums = cleaned.match(/\d+(?:[.,]\d+)?/g);
  if (!nums || nums.length === 0) return null;
  const values = nums.slice(0, 2).map((n) => parseFloat(n.replace(",", ".")));
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || min <= 0) return null;
  return { min, max };
}

function looksLikeInches(
  key: MeasureKey,
  range: { min: number; max: number },
  tableText: string
): boolean {
  if (/אינץ|inch|″/i.test(tableText)) return true;
  // Girth values below plausible cm floors are inch measurements.
  if ((key === "chest" || key === "hips") && range.max < 60) return true;
  if (key === "waist" && range.max < 50) return true;
  if (key === "inseam" && range.max < 50) return true;
  return false;
}

const toCm = (r: { min: number; max: number }) => ({
  min: Math.round(r.min * 2.54 * 10) / 10,
  max: Math.round(r.max * 2.54 * 10) / 10,
});

/** Extract the best size chart from any table on the page, normalized to cm. */
export function parseSizeChart($: CheerioAPI): NormalizedSizeChart | null {
  let best: NormalizedSizeChart | null = null;
  let bestScore = 0;

  for (const table of $("table").toArray()) {
    const $table = $(table);
    const tableText = $table.text();
    if (!CHART_HINT_RE.test(tableText)) continue;

    const rows = $table.find("tr").toArray();
    if (rows.length < 2) continue;

    const headerCells = $(rows[0])
      .find("th,td")
      .toArray()
      .map((c) => $(c).text().trim());

    // Map each column to a measure key; column 0 is expected to be the label.
    const columnKeys = headerCells.map(headerToKey);
    const measureColumns = columnKeys.filter(Boolean).length;
    if (measureColumns === 0) continue;

    const chartRows: SizeChartRow[] = [];
    for (const row of rows.slice(1)) {
      const cells = $(row)
        .find("th,td")
        .toArray()
        .map((c) => $(c).text().trim());
      if (cells.length < 2) continue;

      const label = cells[0];
      if (!label || !SIZE_LABEL_RE.test(label)) continue;

      const values: SizeChartRow["values"] = {};
      for (let i = 1; i < cells.length && i < columnKeys.length; i++) {
        const key = columnKeys[i];
        if (!key) continue;
        const range = parseRange(cells[i]);
        if (!range) continue;
        values[key] = looksLikeInches(key, range, tableText)
          ? toCm(range)
          : range;
      }
      if (Object.keys(values).length > 0) chartRows.push({ label, values });
    }

    const score = chartRows.length * measureColumns;
    if (chartRows.length >= 2 && score > bestScore) {
      best = { unit: "cm", rows: chartRows };
      bestScore = score;
    }
  }

  return best;
}
