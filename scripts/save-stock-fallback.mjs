// Saves the current live prices to data/stock-fallback.json.
// The app shows this file when the live fetch fails.
// Usage: start the app with `npm run dev`, then run `npm run save-stock`.

import { writeFile } from "node:fs/promises";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const RANGES = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "MAX"];

const saved = {};
for (const range of RANGES) {
  const res = await fetch(`${BASE}/api/stock?range=${range}`);
  const stock = await res.json();
  if (!res.ok || stock.source !== "live") {
    throw new Error(`${range}: live data not available, nothing was saved.`);
  }
  saved[range] = stock;
  console.log(`${range}: ${stock.points.length} points`);
}

await writeFile(new URL("../data/stock-fallback.json", import.meta.url), JSON.stringify(saved) + "\n");
console.log("Saved data/stock-fallback.json");
