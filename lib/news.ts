// Server-side only (reads files). Gives the pages their news list.
//
// News is collected from 10 free RSS feeds with a simple rule (see
// scripts/collect.mjs, data/sources.json and data/rules.json).
//
// The dataset is fixed: the snapshots for the New York days 2026-11-16 and
// 2026-11-17 are joined into one list (duplicates removed, the 3 spy articles
// once), so every test participant sees the same articles. While neither of
// those files exists yet, data/news/dev.json is shown for development.
// If there is no usable snapshot at all, the example articles are returned.
//
// The snapshot files also contain answer-key fields for spy articles (spy_type,
// expected_relevance). They are NOT copied here: nothing that uses this file can
// see them. The LLM's relevance answers in data/cache/ are not read here either:
// they are hidden from the UI on purpose, so users are not steered by the AI.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { articles as exampleArticles, exampleReason } from "@/data/example-news";
import { buildReason, publishedOn, type MatchedRule } from "@/lib/reason";

export type NewsItem = {
  id: string;
  source: string;
  title: string;
  timeAgo: string;
  link?: string; // real articles only: the publisher's page
  excerpt?: string; // real articles only: first ~100 words, paragraphs separated by a blank line
  summary?: string; // example articles only
  reason?: string; // "Why you're seeing this" text, built from the collection rule
  simulated?: boolean; // true for example articles
};

export type News = {
  items: NewsItem[];
  label: string | null; // which collection is shown; null = showing the example articles
};

const NEWS_DIR = path.join(process.cwd(), "data", "news");
const DATASET_DAYS = ["2026-11-16", "2026-11-17"];

function timeAgo(isoDate: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(isoDate).getTime()) / 60000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function isMatchedRule(value: unknown): value is MatchedRule {
  const v = value as MatchedRule | null;
  return typeof v?.headline === "object" && typeof v?.first_paragraph === "object";
}

// Reads one snapshot file. Returns [] if it is missing or broken.
function readSnapshot(fileName: string): NewsItem[] {
  try {
    const snapshot = JSON.parse(readFileSync(path.join(NEWS_DIR, fileName), "utf8"));
    const terms: string[] = snapshot.rule.terms;
    const items: NewsItem[] = [];
    for (const article of snapshot.articles) {
      const { id, title, link, source, date, excerpt, matched_rule } = article; // answer-key fields are left out on purpose
      if ([id, title, link, source, date, excerpt].some((value) => typeof value !== "string" || value === "")) continue;
      if (!isMatchedRule(matched_rule)) continue;
      items.push({
        id,
        title,
        link,
        source,
        excerpt,
        timeAgo: timeAgo(date),
        reason: buildReason(matched_rule, terms, source, publishedOn(date)),
      });
    }
    return items;
  } catch {
    return [];
  }
}

function readDataset(): News | null {
  let files = DATASET_DAYS.map((day) => `${day}.json`).filter((name) => existsSync(path.join(NEWS_DIR, name)));
  let label = `collected ${DATASET_DAYS.filter((day) => files.includes(`${day}.json`)).join(" and ")}`;
  if (files.length === 0 && existsSync(path.join(NEWS_DIR, "dev.json"))) {
    files = ["dev.json"];
    label = "development sample";
  }

  const byId = new Map<string, NewsItem>();
  const seenTitles = new Set<string>();
  for (const file of files) {
    for (const item of readSnapshot(file)) {
      const titleKey = item.title.toLowerCase();
      if (byId.has(item.id) || seenTitles.has(titleKey)) continue; // same article on both days
      byId.set(item.id, item);
      seenTitles.add(titleKey);
    }
  }
  if (byId.size === 0) return null;

  // Sort by id. Ids are hashes of the link, so this gives a mixed order that is
  // the same for everyone and does not group sources, days or spy articles.
  const items = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  return { items, label };
}

export function getNews(): News {
  const dataset = readDataset();
  if (dataset) return dataset;
  const items = exampleArticles.map((article) => ({ ...article, reason: exampleReason(article), simulated: true }));
  return { items, label: null };
}

export function getNewsItem(id: string): NewsItem | undefined {
  return getNews().items.find((item) => item.id === id);
}
