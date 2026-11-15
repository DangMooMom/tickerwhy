// Shared by server and browser code. Contains no secrets and no data fetching.

export const RANGE_KEYS = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "MAX"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export function isRangeKey(value: string): value is RangeKey {
  return (RANGE_KEYS as readonly string[]).includes(value);
}

export type StockPoint = { t: number; c: number }; // t = Unix seconds, c = close price

export type StockData = {
  range: RangeKey;
  points: StockPoint[];
  price: number; // latest market price
  baseline: number; // close just before this range started; used for the change figure
  currency: string;
  asOf: number; // Unix seconds of the latest market price
  source: "live" | "saved"; // "saved" = live fetch failed, showing data/stock-fallback.json
};
