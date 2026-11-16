// Collects news from the free RSS sources in data/sources.json with my own
// simple rule (data/rules.json): an article is collected if its headline or its
// RSS summary contains one of the rule words ("Apple", "iPhone").
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
// Steps:
// 1. Read every feed and keep the items from the time window.
// 2. Apply the rule to the headline and the RSS summary, without opening any page.
// 3. Open only the matching articles to get an excerpt (first 2-3 paragraphs, at
//    most 100 words). Different sites are opened at the same time; the same site
//    is opened at most once every 3 seconds. An article without an excerpt is not
//    collected. The full text is never saved: the repo is public and the articles
//    are copyrighted.
// The summary is cut to 100 words before the rule is checked, and that same text
// is saved, so the "Why you're seeing this" sentence can always be checked.
//
// The 2 planted spy articles from data/news/spy-articles.json are mixed in.
// spy_type and expected_relevance are answer-key fields: never shown in the UI
// and never sent to the LLM.
//
// If every feed fails, the script prints the error and writes nothing.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fetchText, makeExcerpt, MAX_WORDS, wait } from "./lib/excerpt.mjs";
import { parseFeed } from "./lib/rss.mjs";
import { matchRule } from "./lib/rule.mjs";

const DATA = new URL("../data/", import.meta.url);
const NEWS = new URL("news/", DATA);
const DATASET_DAYS = ["2026-11-16", "2026-11-17"];
const SAME_SITE_GAP_MS = 3000;
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
const firstWords = (text, n) => text.split(/\s+/).filter(Boolean).slice(0, n).join(" ");

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

async function main() {
  const started = Date.now();
  const { sources } = JSON.parse(await readFile(new URL("sources.json", DATA), "utf8"));
  const { terms } = JSON.parse(await readFile(new URL("rules.json", DATA), "utf8"));

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

  // 1 and 2. Read the feeds, keep the time window, remove duplicates, apply the rule.
  const seenLinks = new Set();
  const seenTitles = new Set();
  const matched = [];
  const report = {};
  let feedsWorked = 0;
  for (const source of sources) {
    const r = (report[source.name] = { in_window: 0, matched: 0, no_excerpt: 0, collected: 0 });
    for (const feed of source.feeds) {
      try {
        const items = parseFeed(await fetchText(feed.url)).filter((item) => inWindow(item.date));
        feedsWorked++;
        for (const item of items) {
          const titleKey = item.title.toLowerCase();
          if (seenLinks.has(item.link) || seenTitles.has(titleKey)) continue;
          seenLinks.add(item.link);
          seenTitles.add(titleKey);
          r.in_window++;
          const summary = firstWords(item.summary, MAX_WORDS);
          const matched_rule = matchRule(terms, item.title, summary);
          if (!matched_rule) continue;
          r.matched++;
          matched.push({ source: source.name, item, summary, matched_rule });
        }
      } catch (error) {
        r.error = `${feed.label} feed failed: ${error.message}`;
        console.error(`${source.name}: ${r.error}`);
      }
    }
    console.log(`${source.name}: ${r.in_window} in the time window, ${r.matched} match the rule`);
  }
  if (feedsWorked === 0) throw new Error("Every feed failed.");

  // 3. Open the matching articles. One queue per site; the sites run at the same time.
  const bySite = new Map();
  for (const entry of matched) {
    const site = new URL(entry.item.link).hostname;
    bySite.set(site, [...(bySite.get(site) ?? []), entry]);
  }
  const done = {};
  const articles = [];
  console.log(`\nOpening ${matched.length} matching articles on ${bySite.size} sites...`);
  await Promise.all(
    [...bySite.values()].map(async (queue) => {
      for (const [index, { source, item, summary, matched_rule }] of queue.entries()) {
        if (index > 0) await wait(SAME_SITE_GAP_MS);
        let excerpt = "";
        try {
          excerpt = makeExcerpt(await fetchText(item.link), item.link);
        } catch {
          excerpt = "";
        }
        done[source] = (done[source] ?? 0) + 1;
        const r = report[source];
        if (excerpt) {
          r.collected++;
          articles.push({
            id: makeId(item.link),
            title: item.title,
            summary,
            link: item.link,
            source,
            date: item.date.toISOString(),
            excerpt,
            matched_rule,
          });
        } else {
          r.no_excerpt++;
        }
        console.log(`${source} ${done[source]}/${r.matched}${excerpt ? "" : " (no excerpt)"}`);
      }
    }),
  );

  // Mix in the planted spy articles. Their matched_rule is worked out the same way.
  const spies = JSON.parse(await readFile(new URL("spy-articles.json", NEWS), "utf8"));
  for (const spy of spies) {
    if (!spy.excerpt) throw new Error(`Spy article has no excerpt: ${spy.title}`);
    if (articles.some((article) => article.id === spy.id)) continue;
    const summary = firstWords(spy.summary ?? "", MAX_WORDS);
    const matched_rule = matchRule(terms, spy.title, summary);
    if (!matched_rule) throw new Error(`Spy article does not match the rule: ${spy.title}`);
    const { id, title, link, source, date, excerpt, spy_type, expected_relevance } = spy;
    articles.push({ id, title, summary, link, source, date, excerpt, matched_rule, spy_type, expected_relevance });
  }

  const seconds = Math.round((Date.now() - started) / 1000);
  const snapshot = {
    date: day ?? "dev",
    collected_at: new Date().toISOString(),
    window: DEV ? "last 24 hours" : `New York day ${day}`,
    took_seconds: seconds,
    rule: { terms, checked_on: "headline and RSS summary" },
    report,
    articles: shuffle(articles), // the order shows neither the source nor the spy articles
  };
  await mkdir(NEWS, { recursive: true });
  await writeFile(new URL(fileName, NEWS), JSON.stringify(snapshot, null, 2) + "\n");

  console.log("\nSource                    in window  matched  no excerpt  collected");
  for (const [name, r] of Object.entries(report)) {
    console.log(
      `${name.padEnd(26)}${String(r.in_window).padStart(9)}${String(r.matched).padStart(9)}${String(r.no_excerpt).padStart(12)}${String(r.collected).padStart(11)}${r.error ? `  ${r.error}` : ""}`,
    );
  }
  console.log(`Saved data/news/${fileName}: ${articles.length} articles (${articles.length - spies.length} collected + ${spies.length} spy) in ${Math.floor(seconds / 60)} min ${seconds % 60} s`);
}

try {
  await main();
} catch (error) {
  console.error(`fetch-news failed: ${error.message}`);
  console.error("No file was written. Existing snapshots are unchanged.");
  process.exit(1);
}
