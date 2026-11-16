// Saves today's news snapshot to data/news/YYYY-MM-DD.json (UTC date).
// Source: Google News RSS (public, no key). Usage: npm run fetch-news
//
// 20 articles per snapshot: 16 from a company search and 4 from a broad "Apple"
// search. The broad search is there on purpose: it brings in articles that may
// not be about Apple Inc., so the relevance judgement has something to catch.
//
// source_query records which search each article came from. It is kept ONLY for
// checking answers later. It must never be shown in the UI or sent to the LLM
// (lib/news.ts removes it when the app reads the file).
//
// If anything fails, the script prints the error and writes nothing.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

const QUERIES = [
  { query: '"Apple Inc" OR AAPL', count: 16 },
  { query: "Apple", count: 4 },
];

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

  const picked = [];
  const seenLinks = new Set();
  const seenTitles = new Set();
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

  // Shuffle before saving so the saved order does not show which search an article came from.
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
