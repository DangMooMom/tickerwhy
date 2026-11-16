// Server-side only (reads files). Gives the pages their news list.
//
// It reads a snapshot from data/news/ (written by `npm run fetch-news`) and the
// LLM answers for it from data/cache/ (written by `npm run analyze-news`).
// Reading the cache needs no API key.
//
// Which snapshot: the newest one that has a cache file. The daily workflow adds
// snapshots without calling the LLM, so the very newest one may not be analysed
// yet. If no snapshot has a cache, the newest snapshot is shown without answers.
// If there is no usable snapshot at all, the example articles are returned.
//
// The snapshot files also contain answer-key fields: source_query (which search an article came
// from) and, for spy articles, spy_type and expected_relevance. They are NOT copied here:
// nothing that uses this file (the UI now, the LLM input later) can see it.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { articles as exampleArticles, type Article } from "@/data/example-news";
import { parseRelevanceResult, type RelevanceResult } from "@/lib/relevance";

export type NewsItem = {
  id: string;
  source: string;
  title: string;
  timeAgo: string;
  link?: string; // real articles only: link to the publisher through Google News
  summary?: string; // example articles only
  why?: Article["why"]; // example articles only (hand-written, simulated)
  analysis?: RelevanceResult; // real articles only: cached LLM answer, if there is one
};

export type News = {
  items: NewsItem[];
  snapshotDate: string | null; // null = showing the example articles
  cache: { model: string; generatedAt: string } | null; // null = no cached LLM answers
};

const NEWS_DIR = path.join(process.cwd(), "data", "news");
const CACHE_DIR = path.join(process.cwd(), "data", "cache");

const cachePath = (date: string) => path.join(CACHE_DIR, `relevance-${date}.json`);

function timeAgo(isoDate: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(isoDate).getTime()) / 60000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function readSnapshot(): News | null {
  try {
    if (!existsSync(NEWS_DIR)) return null;
    // File names are dates (YYYY-MM-DD.json), so sorted order is oldest to newest.
    const dates = readdirSync(NEWS_DIR)
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
      .map((name) => name.replace(".json", ""))
      .sort();
    const date = dates.findLast((d) => existsSync(cachePath(d))) ?? dates.at(-1);
    if (!date) return null;

    let cached: { model?: unknown; generated_at?: unknown; results?: Record<string, unknown> } | null = null;
    try {
      cached = JSON.parse(readFileSync(cachePath(date), "utf8"));
    } catch {
      cached = null; // no cache file, or it is broken: show the articles without answers
    }

    const snapshot = JSON.parse(readFileSync(path.join(NEWS_DIR, `${date}.json`), "utf8"));
    const items: NewsItem[] = [];
    for (const article of snapshot.articles) {
      const { id, title, link, source, date: published } = article; // answer-key fields are left out on purpose
      if ([id, title, link, source, published].some((value) => typeof value !== "string")) return null;
      // Every cached answer is checked again. One that does not match the schema is not shown.
      const analysis = parseRelevanceResult(cached?.results?.[id]) ?? undefined;
      items.push({ id, title, link, source, timeAgo: timeAgo(published), analysis });
    }
    if (items.length === 0) return null;

    // The fetch script already shuffled the articles before saving, so the saved
    // order mixes both searches and stays the same on every page load.
    const hasAnswers = items.some((item) => item.analysis);
    return {
      items,
      snapshotDate: date,
      cache: hasAnswers ? { model: String(cached?.model ?? ""), generatedAt: String(cached?.generated_at ?? "") } : null,
    };
  } catch {
    return null; // unreadable or broken file: fall back to the example articles
  }
}

export function getNews(): News {
  return readSnapshot() ?? { items: exampleArticles, snapshotDate: null, cache: null };
}

export function getNewsItem(id: string): { item: NewsItem; cache: News["cache"] } | undefined {
  const news = getNews();
  const item = news.items.find((candidate) => candidate.id === id);
  return item ? { item, cache: news.cache } : undefined;
}
