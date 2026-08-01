// Assert-based tests for scraper parsing units (run: npm run test:mida).
import assert from "node:assert";
import * as cheerio from "cheerio";
import { parseJsonLd } from "../jsonld";
import { parseOg } from "../og";
import { parseSizeChart } from "../sizechart";
import { classifyGarment } from "../garment-type";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

test("parseJsonLd extracts schema.org Product incl. @graph nesting", () => {
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@graph":[
      {"@type":"BreadcrumbList"},
      {"@type":"Product","name":"חולצת אוברסייז","image":["https://cdn.example.com/a.jpg"],
       "color":"שחור",
       "offers":{"@type":"Offer","price":"129.90","priceCurrency":"ILS"},
       "hasVariant":[{"@type":"Product","color":"לבן"}]}
    ]}</script></head><body></body></html>`;
  const result = parseJsonLd(cheerio.load(html));
  assert.strictEqual(result.title, "חולצת אוברסייז");
  assert.deepStrictEqual(result.images, ["https://cdn.example.com/a.jpg"]);
  assert.strictEqual(result.price, 129.9);
  assert.strictEqual(result.currency, "ILS");
  assert.deepStrictEqual(result.colors, ["שחור", "לבן"]);
});

test("parseOg falls back to og: meta tags", () => {
  const html = `<html><head>
    <meta property="og:title" content="ג'ינס סקיני"/>
    <meta property="og:image" content="https://cdn.example.com/j.jpg"/>
    <meta property="product:price:amount" content="199.00"/>
    <meta property="product:price:currency" content="ILS"/>
  </head><body></body></html>`;
  const result = parseOg(cheerio.load(html));
  assert.strictEqual(result.title, "ג'ינס סקיני");
  assert.strictEqual(result.price, 199);
  assert.strictEqual(result.currency, "ILS");
});

test("parseSizeChart parses Hebrew cm table with ranges", () => {
  const html = `<table>
    <tr><th>מידה</th><th>היקף חזה (ס"מ)</th><th>היקף מותניים</th></tr>
    <tr><td>S</td><td>88-93</td><td>72-77</td></tr>
    <tr><td>M</td><td>94-99</td><td>78-83</td></tr>
  </table>`;
  const chart = parseSizeChart(cheerio.load(html));
  assert.ok(chart);
  assert.strictEqual(chart.rows.length, 2);
  assert.deepStrictEqual(chart.rows[0].values.chest, { min: 88, max: 93 });
  assert.deepStrictEqual(chart.rows[1].values.waist, { min: 78, max: 83 });
});

test("parseSizeChart converts inch tables to cm", () => {
  const html = `<table>
    <tr><th>Size</th><th>Chest (inch)</th></tr>
    <tr><td>M</td><td>37-39</td></tr>
    <tr><td>L</td><td>40-42</td></tr>
  </table>`;
  const chart = parseSizeChart(cheerio.load(html));
  assert.ok(chart);
  assert.deepStrictEqual(chart.rows[0].values.chest, { min: 94, max: 99.1 });
});

test("parseSizeChart ignores non-size tables", () => {
  const html = `<table>
    <tr><th>יום</th><th>שעות פתיחה</th></tr>
    <tr><td>ראשון</td><td>9-17</td></tr>
    <tr><td>שני</td><td>9-17</td></tr>
  </table>`;
  assert.strictEqual(parseSizeChart(cheerio.load(html)), null);
});

test("classifyGarment handles Hebrew and English titles", () => {
  assert.strictEqual(classifyGarment("חולצת טי בייסיק"), "top");
  assert.strictEqual(classifyGarment("מכנסי ג'ינס בגזרה גבוהה"), "pants");
  assert.strictEqual(classifyGarment("שמלת מידי פרחונית"), "dress");
  assert.strictEqual(classifyGarment("Oversized Hoodie"), "top");
  assert.strictEqual(classifyGarment("Puffer Jacket"), "outerwear");
  assert.strictEqual(classifyGarment("חצאית מיני"), "skirt");
  assert.strictEqual(classifyGarment("אקססוריז לשיער"), "unknown");
});

console.log(`\n${passed} scraper tests passed`);
