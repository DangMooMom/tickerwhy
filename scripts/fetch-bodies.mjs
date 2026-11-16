// Adds a short excerpt (the first paragraphs, at most 100 words) to every article
// in data/news/. Usage: npm run fetch-bodies
//
// For each article without an excerpt it:
// 1. finds the publisher's address behind the Google News link,
// 2. downloads that public page once,
// 3. picks out the article text with @mozilla/readability,
// 4. keeps only the first 2-3 paragraphs, cut at 100 words.
//
// The full article text is never saved anywhere, only the excerpt: this is a
// public repo and the articles are copyrighted. The app shows the excerpt with a
// link to the original.
//
// Pages that need a login, block scripts or have no readable text are skipped
// and listed at the end. The script does not try to get around paywalls or blocks.
//
// Only articles with an excerpt are used in the app. An article that cannot be
// used gets an `excluded` field holding the reason. Nothing is deleted:
// - no excerpt could be fetched (the reason is the error), or
// - it is listed in data/news/excluded.json, my hand-made list of pages that
//   are not articles (for example a stock quote page).
// If a later run does get the excerpt, the `excluded` field is removed again.

import { readdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";

const NEWS_DIR = new URL("../data/news/", import.meta.url);
const MAX_WORDS = 100;
const MAX_PARAGRAPHS = 3;
const MIN_WORDS = 30; // less than this is probably a cookie notice or a teaser, not the article
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; news-excerpt-script)" };

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const countWords = (text) => text.split(/\s+/).filter(Boolean).length;

async function fetchText(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...HEADERS, ...options.headers }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// A Google News link does not contain the publisher's address. Google's own page
// for the link holds two values that its lookup service needs to return it.
async function findPublisherUrl(link) {
  const url = new URL(link);
  if (url.hostname !== "news.google.com") return link; // already a publisher link

  const id = url.pathname.split("/").pop();
  const page = await fetchText(`https://news.google.com/rss/articles/${id}`);
  const signature = page.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const timestamp = page.match(/data-n-a-ts="([^"]+)"/)?.[1];
  if (!signature || !timestamp) throw new Error("Google News page had no lookup values");

  const request = [
    "garturlreq",
    [["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1], "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
    id,
    Number(timestamp),
    signature,
  ];
  const answer = await fetchText("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: "f.req=" + encodeURIComponent(JSON.stringify([[["Fbv4je", JSON.stringify(request), null, "generic"]]])),
  });
  // The answer is a few lines of JSON after a ")]}'" guard line.
  const found = JSON.parse(JSON.parse(answer.split("\n\n")[1])[0][2])[1];
  if (typeof found !== "string" || !found.startsWith("http")) throw new Error("Google News did not return an address");
  return found;
}

// First paragraphs of the article, at most MAX_WORDS words. Returns "" if the
// page has no readable article text.
function makeExcerpt(html, pageUrl) {
  const dom = new JSDOM(html, { url: pageUrl, virtualConsole: new VirtualConsole() }); // empty console: ignore page CSS errors
  const article = new Readability(dom.window.document).parse();
  if (!article?.content) return "";

  const paragraphs = [...new JSDOM(article.content).window.document.querySelectorAll("p")]
    .map((p) => p.textContent.replace(/\s+/g, " ").trim())
    .filter((text) => countWords(text) >= 8); // skip bylines, captions and other one-liners

  const kept = [];
  let words = 0;
  for (const paragraph of paragraphs.slice(0, MAX_PARAGRAPHS)) {
    const room = MAX_WORDS - words;
    if (room < 8) break;
    const cut = paragraph.split(" ").slice(0, room).join(" "); // the last paragraph may be cut short
    kept.push(cut);
    words += countWords(cut);
  }
  return words >= MIN_WORDS ? kept.join("\n\n") : "";
}

async function main() {
  // Every snapshot file plus the fixed spy articles.
  const names = readdirSync(NEWS_DIR).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name) || name === "spy-articles.json");
  // Pages I marked by hand as "not an article": id -> reason.
  const notArticles = new Map(
    JSON.parse(await readFile(new URL("excluded.json", NEWS_DIR), "utf8")).map((entry) => [entry.id, entry.reason]),
  );
  const files = [];
  for (const name of names) {
    const data = JSON.parse(await readFile(new URL(name, NEWS_DIR), "utf8"));
    files.push({ name, data, articles: Array.isArray(data) ? data : data.articles });
  }

  // The same article can be in several files. Fetch it once and reuse the excerpt.
  const excerpts = new Map();
  for (const { articles } of files) {
    for (const article of articles) if (article.excerpt) excerpts.set(article.id, article.excerpt);
  }

  const failed = new Map();
  for (const { articles } of files) {
    for (const article of articles) {
      if (excerpts.has(article.id) || failed.has(article.id) || notArticles.has(article.id)) continue;
      try {
        const publisherUrl = await findPublisherUrl(article.link);
        const excerpt = makeExcerpt(await fetchText(publisherUrl), publisherUrl);
        if (!excerpt) throw new Error("no readable article text");
        excerpts.set(article.id, excerpt);
        console.log(`ok (${countWords(excerpt)} words): ${article.title.slice(0, 70)}`);
      } catch (error) {
        failed.set(article.id, { article, reason: error.message });
        console.log(`FAILED (${error.message}): ${article.title.slice(0, 70)}`);
      }
      await wait(10000); // 10 seconds between articles, to stay under the sites' request limits
    }
  }

  for (const { name, data, articles } of files) {
    const before = JSON.stringify(data);
    for (const article of articles) {
      const excerpt = excerpts.get(article.id);
      if (excerpt) article.excerpt = excerpt;

      // Mark what cannot be used, with the reason. Clear the mark if it no longer applies.
      delete article.excluded;
      if (notArticles.has(article.id)) article.excluded = notArticles.get(article.id);
      else if (!excerpt) article.excluded = `no excerpt (${failed.get(article.id)?.reason ?? "not fetched"})`;
    }
    if (JSON.stringify(data) !== before) await writeFile(new URL(name, NEWS_DIR), JSON.stringify(data, null, 2) + "\n");
  }

  console.log(`\n${excerpts.size} articles have an excerpt. ${failed.size} could not be fetched:`);
  for (const { article, reason } of failed.values()) {
    console.log(`- ${article.spy_type ? `[${article.spy_type}] ` : ""}${article.source}: ${article.title} (${reason})`);
  }
}

try {
  await main();
} catch (error) {
  console.error(`fetch-bodies failed: ${error.message}`);
  process.exit(1);
}
