// ARCHIVED (version 2, company word + activity word, RSS only). Kept for the record only. Reads data/archive/rss-v2/rules.json if run by hand after editing the path.
// Collects news (version 2) from the RSS sources in data/sources.json with the
// rule in data/rules.json: the RSS headline or summary must contain a company
// word ("Apple", "iPhone") AND an activity word (earnings, analysts, regulation
// and so on), as whole words. Pages are never opened: only the feed's headline,
// summary, link and date are used.
//
// Usage: npm run fetch-news   (the last 7 days -> data/news/dev.json)
//
// Limits, so a run stays short:
// - a feed that does not answer within 10 seconds is skipped,
// - the same site is asked at most once every 3 seconds (different sites run at the same time),
// - after 5 minutes the run stops and saves what it has so far.
//
// Version 1 (headline-or-summary rule with excerpts) is kept in scripts/archive/.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fetchText, wait } from "../lib/excerpt.mjs";
import { parseFeed } from "../lib/rss.mjs";
import { hasCompanyWord, matchActivityRule } from "../lib/activity-rule.mjs";

const DATA = new URL("../../data/", import.meta.url);
const NEWS = new URL("news/", DATA);
const FEED_TIMEOUT_MS = 10_000;
const SAME_SITE_GAP_MS = 3_000;
const TIME_LIMIT_MS = 5 * 60_000;
const WINDOW_MS = 7 * 24 * 60 * 60_000;
const SUMMARY_WORDS = 100; // the summary is cut to this many words, then checked and saved

const makeId = (link) => createHash("sha1").update(link).digest("hex").slice(0, 10);
const firstWords = (text, n) => text.split(/\s+/).filter(Boolean).slice(0, n).join(" ");

async function main() {
  const started = Date.now();
  const deadline = started + TIME_LIMIT_MS;
  const since = started - WINDOW_MS;
  const { sources } = JSON.parse(await readFile(new URL("sources.json", DATA), "utf8"));
  const rules = JSON.parse(await readFile(new URL("rules.json", DATA), "utf8"));

  // One queue per site, so the same site is never asked twice within 3 seconds.
  const bySite = new Map();
  for (const source of sources) {
    for (const feed of source.feeds) {
      const site = new URL(feed.url).hostname;
      bySite.set(site, [...(bySite.get(site) ?? []), { source, feed }]);
    }
  }
  const totalFeeds = [...bySite.values()].reduce((n, queue) => n + queue.length, 0);

  const report = {};
  for (const source of sources) {
    report[source.name] = { feeds: source.feeds.length, feeds_done: 0, feeds: {}, apple_items_7d: 0, matched: 0 };
  }
  const seenLinks = new Set();
  const seenTitles = new Set();
  const articles = [];
  let feedsDone = 0;
  let stoppedEarly = false;

  await Promise.all(
    [...bySite.values()].map(async (queue) => {
      for (const [index, { source, feed }] of queue.entries()) {
        if (index > 0) await wait(SAME_SITE_GAP_MS);
        const r = report[source.name];
        if (Date.now() > deadline) {
          stoppedEarly = true;
          r.feeds[feed.label] = { status: "skipped: 5-minute limit reached" };
          continue;
        }
        let status;
        try {
          const items = parseFeed(await fetchText(feed.url, { timeoutMs: FEED_TIMEOUT_MS }));
          const recent = items.filter((item) => item.date.getTime() >= since);
          let apple = 0;
          let matched = 0;
          for (const item of recent) {
            const summary = firstWords(item.summary, SUMMARY_WORDS);
            if (hasCompanyWord(rules, `${item.title} ${summary}`)) apple++;
            const matched_rule = matchActivityRule(rules, item.title, summary);
            if (!matched_rule) continue;
            matched++;
            const titleKey = item.title.toLowerCase();
            if (seenLinks.has(item.link) || seenTitles.has(titleKey)) continue; // same article in two feeds
            seenLinks.add(item.link);
            seenTitles.add(titleKey);
            articles.push({
              id: makeId(item.link),
              title: item.title,
              summary,
              link: item.link,
              source: source.name,
              date: item.date.toISOString(),
              matched_rule,
            });
          }
          r.apple_items_7d += apple;
          r.matched += matched;
          status = { status: "ok", items: items.length, items_7d: recent.length, apple_items_7d: apple, matched };
        } catch (error) {
          const reason = error.name === "TimeoutError" ? "no answer within 10 seconds" : error.message;
          status = { status: `failed: ${reason}` };
        }
        r.feeds[feed.label] = status;
        r.feeds_done++;
        feedsDone++;
        const detail = status.status === "ok" ? `${status.items_7d} in 7 days, ${status.apple_items_7d} Apple, ${status.matched} matched` : status.status;
        console.log(`[${feedsDone}/${totalFeeds}] ${source.name} ${r.feeds_done}/${source.feeds.length} (${feed.label}): ${detail}`);
      }
    }),
  );

  const seconds = Math.round((Date.now() - started) / 1000);
  await mkdir(NEWS, { recursive: true });
  await writeFile(
    new URL("dev.json", NEWS),
    JSON.stringify(
      {
        collected_at: new Date().toISOString(),
        window: "last 7 days",
        took_seconds: seconds,
        stopped_early: stoppedEarly,
        rule: "company word and activity word in the RSS headline or summary (data/rules.json)",
        report,
        articles: articles.sort((a, b) => b.date.localeCompare(a.date)),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`\nSaved data/news/dev.json: ${articles.length} articles in ${seconds} s${stoppedEarly ? " (stopped at the 5-minute limit)" : ""}`);
}

try {
  await main();
} catch (error) {
  console.error(`fetch-news failed: ${error.message}`);
  process.exit(1);
}
