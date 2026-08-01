import type { GarmentType } from "../types";

/** Ordered keyword rules — first match wins (dress before top, etc.). */
const RULES: [RegExp, GarmentType][] = [
  [/שמלה|שמלת|dress|gown/i, "dress"],
  [/חצאית|skirt/i, "skirt"],
  [/מעיל|ג'קט|גקט|jacket|coat|blazer|puffer|parka/i, "outerwear"],
  [/מכנס|ג'ינס|גינס|טייץ|pants|jeans|trousers|shorts|leggings|chinos/i, "pants"],
  [/חולצ|טי שירט|טישרט|סווטשירט|סוודר|קפוצ|גופיי|shirt|t-?shirt|tee|top|sweater|hoodie|sweatshirt|blouse|polo|tank/i, "top"],
];

export function classifyGarment(text: string): GarmentType {
  for (const [re, type] of RULES) {
    if (re.test(text)) return type;
  }
  return "unknown";
}
