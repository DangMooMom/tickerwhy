// Collects news from the 10 free RSS feeds in data/sources.json with my own
// simple rule (data/rules.json): an article is collected if its headline or its
// first paragraph contains one of the rule words ("Apple", "iPhone").
//
// Usage:
//   npm run fetch-news            the New York day that has just ended -> data/news/YYYY-MM-DD.json
//   npm run fetch-news -- --dev   the last 24 hours -> data/news/dev.json (for development only)
//
// The dataset is fixed to the New York days 2026-11-16 and 2026-11-17, so every
// test participant sees the same articles. On other days the normal run does
// nothing. The daily workflow runs at 05:00 UTC (midnight in New York), so a run
// on 17 November writes 2026-11-16.json.
//
// For every article in the time window the script opens the article page once
// and keeps only a short excerpt (first 2-3 paragraphs, at most 100 words). The
// full text is never saved: the repo is public and the articles are copyrighted.
// An article without an excerpt is not collected. The rule is checked on the
// headline and on the first paragraph of the excerpt, and the result is saved as
// matched_rule: which word, where, how many times. The page builds the
// "Why you're seeing this" text from matched_rule, so the text always matches the
// real rule.
//
// The 3 spy articles from data/news/spy-articles.json (real articles I planted to
// test filtering) are mixed in. spy_type and expected_relevance are answer-key
// fields: never shown in the UI and never sent to the LLM.
//
// If every feed fails, the script prints the error and writes nothing.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fetchText, makeExcerpt, wait } from "./lib/excerpt.mjs";
import { parseFeed } from "./lib/rss.mjs";
import { matchRule } from "./lib/rule.mjs";

const DATA = new URL("../data/", import.meta.url);
const NEWS = new URL("news/", DATA);
const DATASET_DAYS = ["2026-11-16", "2026-11-17"];
const WAIT_MS = 3000; // pause before every article page; requests also rotate between sites
const DEV = process.argv.includes("--dev");

// "2026-11-16" for a moment, in New York time. (The en-CA format is YYYY-MM-DD.)
const newYorkDay = (date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(date);

// "2026-11-16" for any moment during 17 November, New York time.
function lastFinishedNewYorkDay(now = new Date()) {
  const day = new Date(`${newYorkDay(now)}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

const makeId = (link) => createHash("sha1").update(link).digest("hex").slice(0, 10);

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

async function main() {
  const { sources } = JSON.parse(await readFile(new URL("sources.json", DATA), "utf8"));
  const rule = JSON.parse(await readFile(new URL("rules.json", DATA), "utf8"));
  const terms = rule.terms;

  const day = DEV ? null : lastFinishedNewYorkDay();
  if (!DEV && !DATASET_DAYS.includes(day)) {
    console.log(`${day} is not one of the dataset days (${DATASET_DAYS.join(", ")}). Nothing to do.`);
    return;
  }
  const fileName = DEV ? "dev.json" : `${day}.json`;
  if (!DEV && existsSync(new URL(fileName, NEWS))) {
    console.log(`data/news/${fileName} already exists. Nothing was changed.`);
    return;
  }
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const inWindow = (date) => (DEV ? date.getTime() >= since : newYorkDay(date) === day);

  // 1. Read every feed and keep the items from the time window, without duplicates.
  const seenLinks = new Set();
  const seenTitles = new Set();
  const queues = [];
  const report = {};
  for (const source of sources) {
    report[source.name] = { in_window: 0, no_excerpt: 0, collected: 0 };
    try {
      const items = parseFeed(await fetchText(source.feed)).filter((item) => inWindow(item.date));
      const queue = [];
      for (const item of items) {
        const titleKey = item.title.toLowerCase();
        if (seenLinks.has(item.link) || seenTitles.has(titleKey)) continue;
        seenLinks.add(item.link);
        seenTitles.add(titleKey);
        queue.push(item);
      }
      report[source.name].in_window = queue.length;
      queues.push({ source, queue });
    } catch (error) {
      report[source.name].error = `feed failed: ${error.message}`;
      console.error(`${source.name}: feed failed (${error.message})`);
    }
  }
  if (queues.length === 0) throw new Error("Every feed failed.");

  // 2. Open each article page once, one site after another, and apply the rule.
  const articles = [];
  while (queues.some(({ queue }) => queue.length > 0)) {
    for (const { source, queue } of queues) {
      const item = queue.shift();
      if (!item) continue;
      await wait(WAIT_MS);
      let excerpt = "";
      try {
        excerpt = makeExcerpt(await fetchText(item.link), item.link);
      } catch {
        excerpt = "";
      }
      if (!excerpt) {
        report[source.name].no_excerpt++;
        continue; // no excerpt: not collected
      }
      const matched_rule = matchRule(terms, item.title, excerpt.split("\n\n")[0]);
      if (!matched_rule) continue; // the rule did not match
      report[source.name].collected++;
      articles.push({
        id: makeId(item.link),
        title: item.title,
        link: item.link,
        source: source.name,
        date: item.date.toISOString(),
        excerpt,
        matched_rule,
      });
      console.log(`${source.name}: ${item.title.slice(0, 80)}`);
    }
  }

  // 3. Mix in the spy articles. Their matched_rule is worked out the same way.
  const spies = JSON.parse(await readFile(new URL("spy-articles.json", NEWS), "utf8"));
  for (const spy of spies) {
    if (!spy.excerpt) throw new Error(`Spy article has no excerpt: ${spy.title}`);
    if (articles.some((article) => article.id === spy.id)) continue;
    const matched_rule = matchRule(terms, spy.title, spy.excerpt.split("\n\n")[0]);
    if (!matched_rule) throw new Error(`Spy article does not match the rule: ${spy.title}`);
    const { id, title, link, source, date, excerpt, spy_type, expected_relevance } = spy;
    articles.push({ id, title, link, source, date, excerpt, matched_rule, spy_type, expected_relevance });
  }

  // Shuffle so the order shows neither the source nor the spy articles.
  const snapshot = {
    date: day ?? "dev",
    collected_at: new Date().toISOString(),
    window: DEV ? "last 24 hours" : `New York day ${day}`,
    rule: { terms },
    report,
    articles: shuffle(articles),
  };
  await mkdir(NEWS, { recursive: true });
  await writeFile(new URL(fileName, NEWS), JSON.stringify(snapshot, null, 2) + "\n");

  console.log("\nSource                    in window  no excerpt  collected");
  for (const [name, r] of Object.entries(report)) {
    console.log(`${name.padEnd(26)}${String(r.in_window).padStart(9)}${String(r.no_excerpt).padStart(12)}${String(r.collected).padStart(11)}${r.error ? `  ${r.error}` : ""}`);
  }
  console.log(`Saved data/news/${fileName}: ${articles.length} articles (${articles.length - spies.length} collected by the rule + ${spies.length} spy)`);
}

try {
  await main();
} catch (error) {
  console.error(`fetch-news failed: ${error.message}`);
  console.error("No file was written. Existing snapshots are unchanged.");
  process.exit(1);
}
