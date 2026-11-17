// Server-side only (reads files). Gives the pages their news list.
//
// News is collected from RSS sources (data/sources.json) with the scoring rule in
// data/rules.json and data/entities.json (scripts/collect.mjs). Only the RSS
// headline, summary and tags are used. Pages are not opened, so there is no excerpt.
//
// What is shown:
// 1. data/news/test-set.json, if it exists: exactly those ids, in that order
//    (the test list I check and choose). Only ids and order are read from it.
// 2. Otherwise the newest collection (data/news/dev.json), limited by
//    `display` in data/rules.json: at most `per_source` per source, highest score first.
// 3. If there is no collection at all, the example articles (simulated).
//
// The LLM's relevance answers in data/cache/relevance-*.json are never read here:
// relevance is hidden from the UI on purpose, so users are not steered by the AI.
// Only the AI summaries (data/cache/summaries-*.json) are read. A summary only
// describes the excerpt and never judges relevance (lib/summary.ts).

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { articles as exampleArticles, exampleReason } from "@/data/example-news";
import { buildReason, publishedOn, type MatchedRule } from "@/lib/reason";
import type { SummaryResult } from "@/lib/summary";

export type NewsItem = {
  id: string;
  source: string;
  title: string;
  timeAgo: string;
  link?: string; // real articles only: the publisher's page
  date?: string; // real articles only: "16 November 2026"
  dateTime?: string; // real articles only: "Mon, 16 November 2026 at 11:00 pm GMT"
  author?: string; // real articles only, if the feed names the writer
  excerpt?: string; // at most 200 words, ending at a full sentence
  aiSummary?: SummaryResult; // from data/cache/summaries-*.json, if the excerpt has not changed since
  summary?: string; // example articles only
  reason?: string; // "Why you're seeing this" text, built from the collection rule
  label?: string; // "Strong match" or "Partial match" (real articles only)
  score?: number; // used only to choose the preview, never shown
  published?: number; // real articles only: time in ms, used to pick the newest
  spy?: boolean; // real articles only: a planted test article (never shown on the page)
  simulated?: boolean; // true for example articles
};

export type News = {
  items: NewsItem[];
  label: string | null; // which collection is shown; null = showing the example articles
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

function isMatchedRule(value: unknown): value is MatchedRule {
  const v = value as MatchedRule | null;
  return (
    typeof v?.score === "number" &&
    (v.label === "Strong match" || v.label === "Partial match") &&
    Array.isArray(v.signals) &&
    Array.isArray(v.duplicates)
  );
}

// "Mon, 16 November 2026 at 11:00 pm GMT", as in the Figma frame.
function dateTime(isoDate: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      weekday: "short", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC",
    })
      .formatToParts(new Date(isoDate))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year} at ${parts.hour}:${parts.minute} ${parts.dayPeriod.toLowerCase()} GMT`;
}

// The AI summaries for one snapshot, by article id. {} if there is no cache file.
function readSummaries(fileName: string): Record<string, SummaryResult & { excerpt_hash: string }> {
  try {
    const cacheFile = path.join(process.cwd(), "data", "cache", `summaries-${fileName.replace(".json", "")}.json`);
    return JSON.parse(readFileSync(cacheFile, "utf8")).results ?? {};
  } catch {
    return {};
  }
}
const excerptHash = (text: string) => createHash("sha1").update(text).digest("hex").slice(0, 12);

// Reads one snapshot file. Returns [] if it is missing or broken.
function readSnapshot(fileName: string): NewsItem[] {
  try {
    const snapshot = JSON.parse(readFileSync(path.join(NEWS_DIR, fileName), "utf8"));
    const summaries = readSummaries(fileName);
    const items: NewsItem[] = [];
    for (const article of snapshot.articles) {
      const { id, title, link, source, date, author, excerpt, matched_rule } = article; // answer-key fields are left out on purpose
      // Only whether it is a spy article is kept (to count it inside the limit), never its type or expected answer.
      if ([id, title, link, source, date].some((value) => typeof value !== "string" || value === "")) continue;
      if (!isMatchedRule(matched_rule)) continue;
      const cached = typeof excerpt === "string" ? summaries[id] : undefined;
      items.push({
        id,
        title,
        link,
        source,
        excerpt: typeof excerpt === "string" ? excerpt : undefined,
        aiSummary: cached && cached.excerpt_hash === excerptHash(excerpt) ? { summary: cached.summary, keywords: cached.keywords } : undefined,
        // Not shown when the feed gives the source's own name (Apple Newsroom).
        author: typeof author === "string" && author && author !== source ? author : undefined,
        date: publishedOn(date).replace(/^on /, ""),
        dateTime: dateTime(date),
        timeAgo: timeAgo(date),
        reason: buildReason(matched_rule, source, publishedOn(date)),
        label: matched_rule.label,
        score: matched_rule.score,
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

// Picks the articles to show in the preview: all spy articles, then the others in
// rounds. Round 1 takes the best article of every source, round 2 the second
// best, and so on up to perSource rounds. "Best" is the highest score, then the
// newest. Within a round the better article goes first. This stops at the total.
function pickForDisplay(all: NewsItem[]): NewsItem[] {
  const { total, perSource } = readDisplayLimits();
  const better = (a: NewsItem, b: NewsItem) => (b.score ?? 0) - (a.score ?? 0) || (b.published ?? 0) - (a.published ?? 0);
  const spies = all.filter((item) => item.spy);
  const bySource = new Map<string, NewsItem[]>();
  for (const item of all.filter((item) => !item.spy)) {
    bySource.set(item.source, [...(bySource.get(item.source) ?? []), item]);
  }
  for (const list of bySource.values()) list.sort(better);

  const picked = [...spies];
  for (let round = 0; round < perSource && picked.length < total; round++) {
    const roundItems = [...bySource.values()]
      .map((list) => list[round])
      .filter((item): item is NewsItem => item !== undefined)
      .sort(better);
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

const strip = ({ spy, published, score, ...item }: NewsItem): NewsItem => item; // eslint-disable-line @typescript-eslint/no-unused-vars

function readDataset(): News | null {
  const testSet = readTestSet();
  if (testSet) {
    const byId = new Map(testSet.files.flatMap(readSnapshot).map((item) => [item.id, item]));
    const items = testSet.ids.map((id) => byId.get(id)).filter((item): item is NewsItem => item !== undefined);
    if (items.length > 0) return { items: items.map(strip), label: "test list" };
  }

  if (!existsSync(path.join(NEWS_DIR, "dev.json"))) return null;
  const all = readSnapshot("dev.json");
  if (all.length === 0) return null;
  const shown = pickForDisplay(all);
  // Sort by id. Ids are hashes of the link, so the order mixes sources and dates.
  const items = shown.sort((a, b) => a.id.localeCompare(b.id)).map(strip);
  return { items, label: "development sample" };
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

// Words that say nothing about the topic. "apple" is here too, because almost every headline has it.
const PLAIN_WORDS = new Set(
  "a an the and or but of to in on for with at by from as is are was were be it its this that these those after before over into about up down out new says how why what who here now just than more most your you can will apple apple's".split(" "),
);
const topicWords = (title: string) =>
  new Set(title.toLowerCase().replace(/[’]/g, "'").split(/[^a-z0-9']+/).filter((w) => w.length > 1 && !PLAIN_WORDS.has(w)));

// "Related news" on the article page: other articles from the same list, the ones
// sharing the most headline words first (common words and "Apple" do not count).
// Ties keep the list order, starting after the current article.
export function getRelatedNews(id: string, count = 4): NewsItem[] {
  const items = getNews().items;
  const at = items.findIndex((item) => item.id === id);
  if (at === -1) return [];
  const words = topicWords(items[at].title);
  return [...items.slice(at + 1), ...items.slice(0, at)]
    .map((item, order) => ({ item, order, shared: [...topicWords(item.title)].filter((w) => words.has(w)).length }))
    .sort((a, b) => b.shared - a.shared || a.order - b.order)
    .slice(0, count)
    .map(({ item }) => item);
}
