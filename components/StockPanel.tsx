"use client";

// Current price, change, period tabs and the price chart.
// The first render uses data fetched on the server. Clicking a tab asks our own
// /api/stock route for that period, so the browser never calls an outside service.

import { useState } from "react";
import { RANGE_KEYS, type RangeKey, type StockData } from "@/lib/ranges";

// Chart size in SVG units. The SVG scales to the width of its container.
const W = 800;
const H = 260;
const LEFT = 52;
const RIGHT = 8;
const TOP = 12;
const BOTTOM = 26;

// US market time, fixed so the server and the browser print the same text.
const TIME_ZONE = "America/New_York";

function formatAxisDate(unixSeconds: number, range: RangeKey): string {
  let options: Intl.DateTimeFormatOptions;
  if (range === "1D") options = { hour: "numeric", minute: "2-digit" };
  else if (range === "MAX") options = { year: "numeric" };
  else if (range === "1Y" || range === "5Y") options = { month: "short", year: "numeric" };
  else options = { month: "short", day: "numeric" };
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: TIME_ZONE }).format(
    unixSeconds * 1000,
  );
}

function formatAsOf(unixSeconds: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
    timeZoneName: "short",
  }).format(unixSeconds * 1000);
}

function Chart({ stock, up }: { stock: StockData; up: boolean }) {
  const { points, range, baseline } = stock;
  const closes = points.map((point) => point.c);
  // On the 1D view the previous close is drawn as a dotted line, so keep it in view.
  const showBaseline = range === "1D";
  const min = Math.min(...closes, ...(showBaseline ? [baseline] : []));
  const max = Math.max(...closes, ...(showBaseline ? [baseline] : []));
  const span = max - min || 1;

  const x = (i: number) => LEFT + (i / (points.length - 1)) * (W - LEFT - RIGHT);
  const y = (price: number) => TOP + (1 - (price - min) / span) * (H - TOP - BOTTOM);

  const line = points.map((point, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(point.c).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - BOTTOM} L${LEFT},${H - BOTTOM} Z`;

  const yTicks = [0, 1, 2, 3].map((k) => min + (span * k) / 3);
  const xTicks = [0, 1, 2, 3].map((k) => Math.round((k * (points.length - 1)) / 4));
  const color = up ? "var(--up)" : "var(--down)";

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`AAPL price chart, ${range}. Low ${min.toFixed(2)}, high ${max.toFixed(2)}.`}
    >
      {yTicks.map((price) => (
        <g key={price}>
          <line className="chart-grid" x1={LEFT} x2={W - RIGHT} y1={y(price)} y2={y(price)} />
          <text className="chart-label" x={LEFT - 8} y={y(price) + 4} textAnchor="end">
            {price.toFixed(span < 10 ? 2 : 0)}
          </text>
        </g>
      ))}
      {xTicks.map((i) => (
        <text key={i} className="chart-label" x={x(i)} y={H - 6}>
          {formatAxisDate(points[i].t, range)}
        </text>
      ))}
      <path d={area} fill={color} opacity={0.15} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {showBaseline && (
        <line className="chart-baseline" x1={LEFT} x2={W - RIGHT} y1={y(baseline)} y2={y(baseline)} />
      )}
    </svg>
  );
}

export default function StockPanel({ initial }: { initial: StockData }) {
  const [stock, setStock] = useState(initial);
  const [selected, setSelected] = useState<RangeKey>(initial.range);
  const [error, setError] = useState("");

  async function selectRange(range: RangeKey) {
    setSelected(range);
    setError("");
    try {
      const res = await fetch(`/api/stock?range=${range}`);
      if (!res.ok) throw new Error();
      setStock(await res.json());
    } catch {
      setError(`Could not load ${range} data. Showing ${stock.range} instead.`);
    }
  }

  const change = stock.price - stock.baseline;
  const percent = (change / stock.baseline) * 100;
  const up = change >= 0;
  const sign = up ? "+" : "−";

  return (
    <section aria-label="Price">
      <div className="price-row">
        <span className="price">${stock.price.toFixed(2)}</span>
        <span className={up ? "change up" : "change down"}>
          {up ? "▲" : "▼"} {sign}
          {Math.abs(percent).toFixed(2)}% ({sign}
          {Math.abs(change).toFixed(2)}) {stock.range}
        </span>
      </div>
      <p className="muted small">
        {formatAsOf(stock.asOf)} · {stock.currency} ·{" "}
        {stock.source === "live" ? (
          "Live data from Yahoo Finance (may be delayed)"
        ) : (
          <span className="tag tag-warn">Saved data: live fetch failed</span>
        )}
      </p>

      <div className="card">
        <Chart stock={stock} up={up} />
        <div className="tabs" role="group" aria-label="Chart period">
          {RANGE_KEYS.map((range) => (
            <button
              key={range}
              className={range === selected ? "tab tab-active" : "tab"}
              aria-pressed={range === selected}
              onClick={() => selectRange(range)}
            >
              {range}
            </button>
          ))}
        </div>
        {error && (
          <p className="small tag-warn" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
