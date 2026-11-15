// Server-side only: imported by app/page.tsx (a Server Component) and app/api/stock/route.ts.
// Fetches AAPL prices from Yahoo Finance's public chart endpoint (no API key needed).
// If the fetch fails, returns the copy saved in data/stock-fallback.json.

import savedJson from "@/data/stock-fallback.json";
import type { RangeKey, StockData, StockPoint } from "./ranges";

const SYMBOL = "AAPL";

// Yahoo's names for each period tab, and how far apart the points are.
const YAHOO_PARAMS: Record<RangeKey, { range: string; interval: string }> = {
  "1D": { range: "1d", interval: "5m" },
  "5D": { range: "5d", interval: "30m" },
  "1M": { range: "1mo", interval: "1d" },
  "6M": { range: "6mo", interval: "1d" },
  YTD: { range: "ytd", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
  "5Y": { range: "5y", interval: "1wk" },
  MAX: { range: "max", interval: "1mo" },
};

const saved = savedJson as unknown as Partial<Record<RangeKey, StockData>>;

async function fetchLive(key: RangeKey): Promise<StockData> {
  const { range, interval } = YAHOO_PARAMS[key];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${SYMBOL}?range=${range}&interval=${interval}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Yahoo Finance returned HTTP ${res.status}`);

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp ?? [];
  const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];

  // Some intervals have no trade, so Yahoo sends null. Skip those points.
  const points: StockPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (typeof close === "number") {
      points.push({ t: timestamps[i], c: Math.round(close * 100) / 100 });
    }
  }

  const price = result?.meta?.regularMarketPrice;
  if (points.length < 2 || typeof price !== "number") {
    throw new Error("Yahoo Finance response did not contain usable prices");
  }

  return {
    range: key,
    points,
    price,
    baseline: result.meta.chartPreviousClose ?? points[0].c,
    currency: result.meta.currency ?? "USD",
    asOf: result.meta.regularMarketTime ?? points[points.length - 1].t,
    source: "live",
  };
}

// Returns live data, or saved data if the live fetch fails, or null if neither exists.
export async function getStock(key: RangeKey): Promise<StockData | null> {
  try {
    // STOCK_FORCE_SAVED=1 skips the live fetch so the fallback can be checked.
    if (process.env.STOCK_FORCE_SAVED === "1") throw new Error("Live fetch skipped");
    return await fetchLive(key);
  } catch (error) {
    console.warn(`[stock] ${key}: using saved data.`, error);
    const fallback = saved[key];
    return fallback ? { ...fallback, source: "saved" } : null;
  }
}
