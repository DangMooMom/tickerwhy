// Collects news (version 3, scoring rule) from the RSS sources in
// data/sources.json. The score uses only the RSS headline, summary and tags.
// After scoring, only the collected articles are opened once to save an excerpt
// (settings in data/rules.json "excerpt": at most 200 words, ending at a full
// sentence). The full text is never saved.
//
// Usage: npm run fetch-news   (the last 7 days -> data/news/dev.json)
//
// Each article gets a score from four signals (scripts/lib/score.mjs, numbers in
// data/rules.json, names in data/entities.json). Articles at or above collect_at
// are collected and labelled "Strong match" or "Partial match". Stories with
// nearly the same headline are merged and the other sources are listed in
// matched_rule.duplicates. Articles just below the threshold are saved in
// near_misses so the threshold can be checked.
//
// Limits, so a run stays short:
// - a feed that does not answer within 10 seconds is skipped,
// - the same site is asked at most once every 3 seconds (different sites run at the same time),
// - after 5 minutes the run stops and saves what it has so far.
// Sources with "enabled": false (Yahoo Finance by default) or with an "excluded"
// reason (paywalled or blocked sites, or a feed that robots.txt disallows) are skipped.
//
// Nasdaq is "feed_only": its article pages are blocked, so a Nasdaq story is used
// only if the original publisher page is found (scripts/lib/original.mjs). The
// screen then shows the original publisher, links to its page, and
// matched_rule.collected_via records "Nasdaq RSS".
//
// Earlier versions are kept in scripts/archive/.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { countWords, fetchText, makeExcerpt, wait } from "./lib/excerpt.mjs";
import { parseFeed } from "./lib/rss.mjs";
import { findOriginal, loadPublisherIndex } from "./lib/original.mjs";
import { headlineWords, overlap, scoreItem } from "./lib/score.mjs";

const DATA = new URL("../data/", import.meta.url);
const NEWS = new URL("news/", DATA);
const FEED_TIMEOUT_MS = 10_000;
const SAME_SITE_GAP_MS = 3_000;
const TIME_LIMIT_MS = 5 * 60_000;
const WINDOW_MS = 7 * 24 * 60 * 60_000;
const SUMMARY_WORDS = 100; // the summary is cut to this many words, then scored and saved
const NEAR_MISS_LOW = 2;

const makeId = (link) => createHash("sha1").update(link).digest("hex").slice(0, 10);
const firstWords = (text, n) => text.split(/\s+/).filter(Boolean).slice(0, n).join(" ");
const byScoreThenNewest = (a, b) => b.matched_rule.score - a.matched_rule.score || b.date.localeCompare(a.date);

async function main() {
  const started = Date.now();
  const deadline = started + TIME_LIMIT_MS;
  const since = started - WINDOW_MS;
  const { sources } = JSON.parse(await readFile(new URL("sources.json", DATA), "utf8"));
  const rules = JSON.parse(await readFile(new URL("rules.json", DATA), "utf8"));
  const entities = JSON.parse(await readFile(new URL("entities.json", DATA), "utf8"));
  const enabled = sources.filter((source) => source.enabled !== false && !source.excluded);
  const sourceByName = new Map(sources.map((source) => [source.name, source]));

  // One queue per site, so the same site is never asked twice within 3 seconds.
  const bySite = new Map();
  for (const source of enabled) {
    for (const feed of source.feeds) {
      const site = new URL(feed.url).hostname;
      bySite.set(site, [...(bySite.get(site) ?? []), { source, feed }]);
    }
  }
  const totalFeeds = [...bySite.values()].reduce((n, queue) => n + queue.length, 0);

  const report = {};
  for (const source of sources) {
    report[source.name] =
      source.enabled === false
        ? { skipped: "disabled in data/sources.json" }
        : source.excluded
          ? { skipped: `excluded: ${source.excluded}` }
          : { feeds_done: 0, feeds: {}, newest_item: null, collected: 0, excerpts_ok: 0, excerpts_failed: 0 };
  }
  const candidates = []; // scored at or above collect_at
  const nearMisses = [];
  const seenLinks = new Set();
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
          for (const item of items) if (!r.newest_item || item.date.toISOString() > r.newest_item) r.newest_item = item.date.toISOString();
          const recent = items.filter((item) => item.date.getTime() >= since);
          let collected = 0;
          for (const item of recent) {
            if (seenLinks.has(item.link)) continue; // same link in two feeds of one source
            seenLinks.add(item.link);
            const summary = firstWords(item.summary, SUMMARY_WORDS);
            const matched_rule = scoreItem({ ...item, summary }, source, rules, entities);
            if (!matched_rule) continue; // A = 0
            const article = {
              id: makeId(item.link),
              title: item.title,
              summary,
              link: item.link,
              // A ticker feed carries stories from many publishers. Show the publisher, and keep the feed in "via".
              source: item.creator && source.source_type === "ticker_feed" ? item.creator : source.name,
              via: source.name,
              // The writer's name from the feed (dc:creator or Atom author). In a ticker feed that field is the publisher, so no author.
              author: source.source_type === "ticker_feed" ? "" : item.creator,
              source_type: source.source_type,
              date: item.date.toISOString(),
              categories: item.categories,
              tickers: item.tickers,
              matched_rule,
            };
            if (matched_rule.label) {
              candidates.push(article);
              collected++;
            } else if (matched_rule.score >= NEAR_MISS_LOW) {
              nearMisses.push(article);
            }
          }
          status = { status: "ok", items: items.length, items_7d: recent.length, collected_before_merge: collected };
        } catch (error) {
          const reason = error.name === "TimeoutError" ? "no answer within 10 seconds" : error.message;
          status = { status: `failed: ${reason}` };
        }
        r.feeds[feed.label] = status;
        r.feeds_done++;
        feedsDone++;
        const detail = status.status === "ok" ? `${status.items_7d} in 7 days, ${status.collected_before_merge} collected` : status.status;
        console.log(`[${feedsDone}/${totalFeeds}] ${source.name} ${r.feeds_done}/${source.feeds.length} (${feed.label}): ${detail}`);
      }
    }),
  );

  // Merge the same story from different sources. The highest score is kept (newest if equal).
  const { overlap_at, common_words } = rules.same_story;
  const kept = [];
  for (const article of candidates.sort(byScoreThenNewest)) {
    const words = headlineWords(article.title, common_words);
    const same = kept.find((k) => overlap(k.words, words) >= overlap_at);
    if (same) {
      if (same.article.source !== article.source && !same.article.matched_rule.duplicates.includes(article.source)) {
        same.article.matched_rule.duplicates.push(article.source);
      }
      continue;
    }
    kept.push({ article, words });
  }
  let articles = kept.map((k) => k.article);

  // Feed-only sources (Nasdaq): replace each story's link with the original publisher page, or skip it.
  for (const source of enabled.filter((s) => s.feed_only)) {
    const indexes = new Map();
    for (const [publisher, config] of Object.entries(source.original_publishers ?? {})) {
      try {
        indexes.set(publisher, await loadPublisherIndex(config, new Date(since), new Date()));
      } catch (error) {
        console.error(`${publisher}: could not read robots.txt or sitemaps (${error.message})`);
      }
    }
    const r = report[source.name];
    r.original_found = 0;
    r.skipped_no_original = 0;
    articles = articles.filter((article) => {
      if (article.via !== source.name) return true;
      const index = indexes.get(article.source);
      const original = index ? findOriginal(article.title, article.date, index) : null;
      if (!original) {
        r.skipped_no_original++;
        return false;
      }
      r.original_found++;
      article.feed_link = article.link;
      article.link = original;
      article.matched_rule.collected_via = `${source.name} RSS`;
      return true;
    });
    console.log(`${source.name}: original publisher page found for ${r.original_found}, skipped ${r.skipped_no_original}`);
  }
  for (const article of articles) report[article.via].collected++;

  // Open each collected article once for its excerpt. One queue per site, 3 seconds apart.
  const ex = rules.excerpt;
  const pages = new Map();
  for (const article of articles) {
    const site = new URL(article.link).hostname;
    pages.set(site, [...(pages.get(site) ?? []), article]);
  }
  let pagesDone = 0;
  console.log(`\nOpening ${articles.length} collected articles on ${pages.size} sites for excerpts...`);
  await Promise.all(
    [...pages.values()].map(async (queue) => {
      for (const [index, article] of queue.entries()) {
        if (index > 0) await wait(SAME_SITE_GAP_MS);
        if (Date.now() > deadline) {
          stoppedEarly = true;
          Object.assign(article, { excerpt: "", excerpt_words: 0, excerpt_status: "skipped: 5-minute limit reached" });
          continue;
        }
        let excerpt = "";
        let status = "ok";
        try {
          excerpt = makeExcerpt(await fetchText(article.link, { timeoutMs: FEED_TIMEOUT_MS }), article.link, {
            maxWords: ex.max_words,
            minWords: ex.min_words,
            maxParagraphs: ex.max_paragraphs,
            sentenceEnd: true,
            selector: sourceByName.get(article.via)?.excerpt_selector ?? "",
          });
          if (!excerpt) status = "failed: no readable article text";
        } catch (error) {
          status = `failed: ${error.name === "TimeoutError" ? "no answer within 10 seconds" : error.message}`;
        }
        Object.assign(article, { excerpt, excerpt_words: countWords(excerpt), excerpt_status: status });
        report[article.via][excerpt ? "excerpts_ok" : "excerpts_failed"]++;
        pagesDone++;
        console.log(`excerpt ${pagesDone}/${articles.length} ${article.source}: ${excerpt ? `${countWords(excerpt)} words` : status}`);
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
        rule: "scoring rule version 3 (data/rules.json, data/entities.json)",
        report,
        articles, // highest score first, then newest
        near_misses: nearMisses.sort(byScoreThenNewest),
      },
      null,
      2,
    ) + "\n",
  );
  const strong = articles.filter((a) => a.matched_rule.label === "Strong match").length;
  console.log(
    `\nSaved data/news/dev.json: ${articles.length} articles (${strong} strong, ${articles.length - strong} partial) from ${candidates.length} before merging, ${nearMisses.length} near misses, in ${seconds} s${stoppedEarly ? " (stopped at the 5-minute limit)" : ""}`,
  );
}

try {
  await main();
} catch (error) {
  console.error(`fetch-news failed: ${error.message}`);
  process.exit(1);
}
