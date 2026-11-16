// Server-side only (reads files). Gives the pages their news list.
//
// News is collected from free RSS sources with a simple rule (see
// scripts/collect.mjs, data/sources.json and data/rules.json).
//
// The dataset is fixed: the snapshots for the New York days 2026-11-16 and
// 2026-11-17 are joined into one list (duplicates removed, the 3 spy articles
// once), so every test participant sees the same articles. While neither of
// those files exists yet, data/news/dev.json is shown for development.
//
// Only part of the collection is shown. If data/news/test-set.json exists (made by
// `npm run select-test-set` and checked by me: 16 stock-related + 4 spy articles),
// exactly those articles are shown, in that order. Otherwise the limits in
// data/rules.json ("display") are used: at most `total` articles, at most
// `per_source` from each source, newest first. Every collected article stays saved.
// From test-set.json only the ids and the order are read; its answer-key fields
// (role, category, spy_type) never reach the pages.
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
  published?: number; // real articles only: time in ms, used to pick the newest
  spy?: boolean; // real articles only: a planted test article (never shown on the page)
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
  return typeof v?.headline === "object" && typeof v?.summary === "object";
}

// Reads one snapshot file. Returns [] if it is missing or broken.
function readSnapshot(fileName: string): NewsItem[] {
  try {
    const snapshot = JSON.parse(readFileSync(path.join(NEWS_DIR, fileName), "utf8"));
    const items: NewsItem[] = [];
    for (const article of snapshot.articles) {
      const { id, title, link, source, date, excerpt, matched_rule } = article; // answer-key fields are left out on purpose
      // Only whether it is a spy article is kept (to count it inside the limit), never its type or expected answer.
      if ([id, title, link, source, date, excerpt].some((value) => typeof value !== "string" || value === "")) continue;
      if (!isMatchedRule(matched_rule)) continue;
      items.push({
        id,
        title,
        link,
        source,
        excerpt,
        timeAgo: timeAgo(date),
        reason: buildReason(matched_rule, source, publishedOn(date)),
        published: new Date(date).getTime(),
        spy: typeof article.spy_type === "string",
      });
    }
    return items;
  } catch {
    return [];
  }
}

// The display limits from data/rules.json.
function readDisplayLimits(): { total: number; perSource: number } {
  try {
    const { display } = JSON.parse(readFileSync(path.join(process.cwd(), "data", "rules.json"), "utf8"));
    return { total: Number(display.total) || 20, perSource: Number(display.per_source) || 3 };
  } catch {
    return { total: 20, perSource: 3 };
  }
}

// Picks the articles to show: all spy articles, then the others in rounds. Round 1
// takes the newest article of every source, round 2 the second newest, and so on
// up to perSource rounds. Within a round the newer article goes first. This stops
// when the total is reached, so every source gets a turn before any gets a second.
function pickForDisplay(all: NewsItem[]): NewsItem[] {
  const { total, perSource } = readDisplayLimits();
  const spies = all.filter((item) => item.spy);
  const bySource = new Map<string, NewsItem[]>();
  for (const item of all.filter((item) => !item.spy)) {
    bySource.set(item.source, [...(bySource.get(item.source) ?? []), item]);
  }
  for (const list of bySource.values()) list.sort((a, b) => (b.published ?? 0) - (a.published ?? 0));

  const picked = [...spies];
  for (let round = 0; round < perSource && picked.length < total; round++) {
    const roundItems = [...bySource.values()]
      .map((list) => list[round])
      .filter((item): item is NewsItem => item !== undefined)
      .sort((a, b) => (b.published ?? 0) - (a.published ?? 0));
    for (const item of roundItems) {
      if (picked.length === total) break;
      picked.push(item);
    }
  }
  return picked;
}

// The ids of the checked test list, in display order, and the files it was built from.
function readTestSet(): { ids: string[]; files: string[] } | null {
  try {
    const testSet = JSON.parse(readFileSync(path.join(NEWS_DIR, "test-set.json"), "utf8"));
    const ids = testSet.articles.map((article: { id: string }) => article.id);
    const files = testSet.built_from;
    return ids.length > 0 && Array.isArray(files) ? { ids, files } : null;
  } catch {
    return null;
  }
}

const strip = ({ spy, published, ...item }: NewsItem): NewsItem => item; // eslint-disable-line @typescript-eslint/no-unused-vars

function readDataset(): News | null {
  const testSet = readTestSet();
  if (testSet) {
    const byId = new Map(testSet.files.flatMap(readSnapshot).map((item) => [item.id, item]));
    const items = testSet.ids.map((id) => byId.get(id)).filter((item): item is NewsItem => item !== undefined);
    if (items.length > 0) {
      const label = testSet.files.includes("dev.json") ? "development sample" : `collected ${testSet.files.map((f) => f.replace(".json", "")).join(" and ")}`;
      return { items: items.map(strip), label };
    }
  }

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

  const shown = pickForDisplay([...byId.values()]);

  // Sort by id. Ids are hashes of the link, so this gives a mixed order that is
  // the same for everyone and does not group sources, days or spy articles.
  const items = shown.sort((a, b) => a.id.localeCompare(b.id)).map(strip);
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
