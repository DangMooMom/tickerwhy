// Saves today's news snapshot to data/news/YYYY-MM-DD.json (UTC date).
// Source: Google News RSS (public, no key). Usage: npm run fetch-news
//
// 20 articles per snapshot:
// - 17 regular articles: 14 from a company search and 3 from a broad "Apple" search.
// - 3 "spy" articles from data/news/spy-articles.json. These are real public
//   articles that I picked by hand because a reader could ask "why is this Apple
//   news?" (a shopping deal, an article about another company, the fruit). The
//   same three go into every snapshot, so the demo always runs the same test.
//
// Fields kept ONLY for checking answers later: source_query (which search a
// regular article came from), and spy_type and expected_relevance (spy articles).
// They must never be shown in the UI or sent to the LLM. lib/news.ts and
// scripts/analyze-news.mjs copy only id, title, link, source and date.
//
// If anything fails, the script prints the error and writes nothing.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const QUERIES = [
  { query: '"Apple Inc" OR AAPL', count: 14 },
  { query: "Apple", count: 3 },
];
const SPY_COUNT = 3;

async function readSpyArticles() {
  const spies = JSON.parse(await readFile(new URL("../data/news/spy-articles.json", import.meta.url), "utf8"));
  const fields = ["id", "title", "link", "source", "date", "spy_type"];
  const valid =
    Array.isArray(spies) &&
    spies.length === SPY_COUNT &&
    spies.every((spy) => fields.every((field) => typeof spy[field] === "string") && Array.isArray(spy.expected_relevance));
  if (!valid) throw new Error(`data/news/spy-articles.json must hold ${SPY_COUNT} complete spy articles.`);
  return spies;
}

function decodeEntities(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

// Returns the text inside <tag>...</tag> of one RSS item, or "".
function readTag(item, tag) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? decodeEntities(match[1].trim()) : "";
}

async function fetchQuery(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google News RSS returned HTTP ${res.status} for query: ${query}`);
  const xml = await res.text();

  const articles = [];
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const source = readTag(item, "source");
    const link = readTag(item, "link");
    const date = new Date(readTag(item, "pubDate"));
    // Google News titles end with " - Source name". Remove that part.
    let title = readTag(item, "title");
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));

    if (!title || !link || !source || Number.isNaN(date.getTime())) continue;
    articles.push({
      // Short id made from the link, so it says nothing about the search it came from.
      id: createHash("sha1").update(link).digest("hex").slice(0, 10),
      title,
      link,
      source,
      date: date.toISOString(),
      source_query: query,
    });
  }
  return articles;
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const file = new URL(`../data/news/${today}.json`, import.meta.url);
  if (existsSync(file)) {
    console.log(`data/news/${today}.json already exists. Nothing was changed.`);
    return;
  }

  // Start with the spy articles, so a regular article that happens to be the
  // same one is skipped as a duplicate.
  const picked = await readSpyArticles();
  const seenLinks = new Set(picked.map((spy) => spy.link));
  const seenTitles = new Set(picked.map((spy) => spy.title.toLowerCase()));
  for (const { query, count } of QUERIES) {
    let taken = 0;
    for (const article of await fetchQuery(query)) {
      if (taken === count) break;
      const titleKey = article.title.toLowerCase();
      if (seenLinks.has(article.link) || seenTitles.has(titleKey)) continue; // duplicate
      seenLinks.add(article.link);
      seenTitles.add(titleKey);
      picked.push(article);
      taken++;
    }
    if (taken < count) throw new Error(`Only ${taken} of ${count} articles found for query: ${query}`);
    console.log(`${query}: ${taken} articles`);
  }

  // Shuffle before saving so the saved order does not show which search an article
  // came from, and the spy articles do not stand out by position.
  const snapshot = { date: today, fetched_at: new Date().toISOString(), articles: shuffle(picked) };
  await mkdir(new URL("../data/news/", import.meta.url), { recursive: true });
  await writeFile(file, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`Saved data/news/${today}.json (${picked.length} articles)`);
}

try {
  await main();
} catch (error) {
  console.error(`fetch-news failed: ${error.message}`);
  console.error("No file was written. Existing snapshots are unchanged.");
  process.exit(1);
}
