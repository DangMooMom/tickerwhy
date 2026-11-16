// Server-side only (reads files). Gives the pages their news list.
//
// It reads the newest snapshot in data/news/ (written by `npm run fetch-news`).
// If there is no usable snapshot, it returns the example articles instead.
//
// The snapshot files also contain source_query (which search an article came
// from). That field is for checking answers later, so it is NOT copied here:
// nothing that uses this file (the UI now, the LLM input later) can see it.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { articles as exampleArticles, type Article } from "@/data/example-news";

export type NewsItem = {
  id: string;
  source: string;
  title: string;
  timeAgo: string;
  link?: string; // real articles only: link to the publisher through Google News
  summary?: string; // example articles only
  why?: Article["why"]; // example articles only (hand-written, simulated)
};

export type News = {
  items: NewsItem[];
  snapshotDate: string | null; // null = showing the example articles
};

const NEWS_DIR = path.join(process.cwd(), "data", "news");

function timeAgo(isoDate: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(isoDate).getTime()) / 60000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function readLatestSnapshot(): News | null {
  try {
    if (!existsSync(NEWS_DIR)) return null;
    // File names are dates (YYYY-MM-DD.json), so the last one in sorted order is the newest.
    const files = readdirSync(NEWS_DIR).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();
    const latest = files.at(-1);
    if (!latest) return null;

    const snapshot = JSON.parse(readFileSync(path.join(NEWS_DIR, latest), "utf8"));
    const items: NewsItem[] = [];
    for (const article of snapshot.articles) {
      const { id, title, link, source, date } = article; // source_query is left out on purpose
      if ([id, title, link, source, date].some((value) => typeof value !== "string")) return null;
      items.push({ id, title, link, source, timeAgo: timeAgo(date) });
    }
    // The fetch script already shuffled the articles before saving, so the saved
    // order mixes both searches and stays the same on every page load.
    return items.length > 0 ? { items, snapshotDate: latest.replace(".json", "") } : null;
  } catch {
    return null; // unreadable or broken file: fall back to the example articles
  }
}

export function getNews(): News {
  return readLatestSnapshot() ?? { items: exampleArticles, snapshotDate: null };
}

export function getNewsItem(id: string): NewsItem | undefined {
  return getNews().items.find((item) => item.id === id);
}
