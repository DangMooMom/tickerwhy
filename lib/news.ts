// Server-side only (reads files). Gives the pages their news list.
//
// The dataset is fixed: the snapshots for the New York days 2026-11-16 and
// 2026-11-17 are joined into one list (duplicates removed, the 3 spy articles
// once), so every test participant sees the same articles. While neither of
// those files exists yet, the newest other snapshot is shown for development.
// If there is no usable snapshot at all, the example articles are returned.
//
// Snapshots are written by `npm run fetch-news`, excerpts are added by
// `npm run fetch-bodies`, and the LLM answers in data/cache/ are written by
// `npm run analyze-news`. Reading them needs no API key.
//
// The snapshot files also contain answer-key fields: source_query (which search
// an article came from) and, for spy articles, spy_type and expected_relevance.
// They are NOT copied here: nothing that uses this file can see them.
//
// From a cached LLM answer only `reason` is passed on. `relevance`, `confidence`
// and `matched_terms` stay in the cache file for checking answers; they are kept
// out of the pages on purpose, so users are not steered by the AI's judgement.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { articles as exampleArticles, exampleReason } from "@/data/example-news";
import { parseRelevanceResult } from "@/lib/relevance";

export type NewsItem = {
  id: string;
  source: string;
  title: string;
  timeAgo: string;
  link?: string; // real articles only: link to the publisher through Google News
  excerpt?: string; // real articles only: first ~100 words, paragraphs separated by a blank line
  summary?: string; // example articles only
  // "Why you're seeing this" text. Real articles: the cached LLM reason, if there
  // is one. Example articles: a reason built in code (simulated).
  reason?: string;
  simulated?: boolean; // true for example articles
};

export type News = {
  items: NewsItem[];
  snapshotDate: string | null; // which snapshot days are shown; null = showing the example articles
};

const NEWS_DIR = path.join(process.cwd(), "data", "news");
const CACHE_DIR = path.join(process.cwd(), "data", "cache");

const DATASET_DAYS = ["2026-11-16", "2026-11-17"];

function timeAgo(isoDate: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(isoDate).getTime()) / 60000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// Reads one snapshot and its cache file. Returns null if the snapshot is missing or broken.
function readDay(date: string): NewsItem[] | null {
  try {
    const snapshot = JSON.parse(readFileSync(path.join(NEWS_DIR, `${date}.json`), "utf8"));

    let cached: { results?: Record<string, unknown> } | null = null;
    try {
      cached = JSON.parse(readFileSync(path.join(CACHE_DIR, `relevance-${date}.json`), "utf8"));
    } catch {
      cached = null; // no cache file, or it is broken: show the articles without reasons
    }

    const items: NewsItem[] = [];
    for (const article of snapshot.articles) {
      const { id, title, link, source, date: published, excerpt } = article; // answer-key fields are left out on purpose
      if ([id, title, link, source, published].some((value) => typeof value !== "string")) return null;
      // Every cached answer is checked again. One that does not match the schema is not shown.
      const reason = parseRelevanceResult(cached?.results?.[id])?.reason;
      items.push({
        id,
        title,
        link,
        source,
        timeAgo: timeAgo(published),
        excerpt: typeof excerpt === "string" && excerpt ? excerpt : undefined,
        reason,
      });
    }
    return items;
  } catch {
    return null;
  }
}

function readDataset(): News | null {
  if (!existsSync(NEWS_DIR)) return null;
  // File names are dates (YYYY-MM-DD.json), so sorted order is oldest to newest.
  const allDays = readdirSync(NEWS_DIR)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .map((name) => name.replace(".json", ""))
    .sort();

  // The fixed dataset days if we have them; otherwise the newest other snapshot (development only).
  let days = DATASET_DAYS.filter((day) => allDays.includes(day));
  if (days.length === 0) days = allDays.slice(-1);

  const byId = new Map<string, NewsItem>();
  const seenTitles = new Set<string>();
  for (const day of days) {
    for (const item of readDay(day) ?? []) {
      const titleKey = item.title.toLowerCase();
      if (byId.has(item.id) || seenTitles.has(titleKey)) continue; // same article on both days
      byId.set(item.id, item);
      seenTitles.add(titleKey);
    }
  }
  if (byId.size === 0) return null;

  // Sort by id. Ids are hashes of the link, so this gives a mixed order that is
  // the same for everyone and does not group the spy articles or the two days.
  const items = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  return { items, snapshotDate: days.join(" and ") };
}

export function getNews(): News {
  const snapshot = readDataset();
  if (snapshot) return snapshot;
  const items = exampleArticles.map((article) => ({ ...article, reason: exampleReason(article), simulated: true }));
  return { items, snapshotDate: null };
}

export function getNewsItem(id: string): NewsItem | undefined {
  return getNews().items.find((item) => item.id === id);
}
