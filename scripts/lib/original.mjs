// Finds the original publisher page for a story that reached us through the
// Nasdaq AAPL RSS feed. Nasdaq's own article pages are blocked (HTTP 403), so the
// excerpt can only come from the publisher's own page.
//
// Only the publisher's public discovery files are used: robots.txt and the
// sitemaps it lists. A page that robots.txt disallows is never used. Nothing is
// guessed: if no page is found, the story is skipped.
//
// config (from data/sources.json, Nasdaq "original_publishers"):
// { robots, news_sitemap, monthly_sitemap: "https://.../sitemap/{yyyy}/{mm}" }

import { fetchText, wait } from "./excerpt.mjs";

const GAP_MS = 3000;
const normalise = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const words = (text) => new Set(normalise(text).split(" ").filter(Boolean));

function overlap(a, b) {
  const shared = [...a].filter((w) => b.has(w)).length;
  const all = new Set([...a, ...b]).size;
  return all === 0 ? 0 : shared / all;
}

// Disallow rules for "User-agent: *".
function disallowRules(robotsText) {
  const rules = [];
  let forAll = false;
  for (const line of robotsText.split("\n")) {
    const m = line.match(/^\s*(User-agent|Disallow)\s*:\s*(.*)$/i);
    if (!m) continue;
    if (/user-agent/i.test(m[1])) forAll = m[2].trim() === "*";
    else if (forAll && m[2].trim()) rules.push(m[2].trim().replace(/\*$/, ""));
  }
  return rules;
}

// Loads robots.txt and the sitemaps for the months in the time window.
export async function loadPublisherIndex(config, sinceDate, untilDate) {
  const robots = await fetchText(config.robots, { timeoutMs: 10000 });
  const disallow = disallowRules(robots);
  const pages = []; // { url, title, date }
  if (config.news_sitemap) {
    await wait(GAP_MS);
    const xml = await fetchText(config.news_sitemap, { timeoutMs: 15000 });
    for (const [, block] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
      const url = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
      const title = block.match(/<news:title>([\s\S]*?)<\/news:title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "");
      if (url) pages.push({ url, title: title ?? "" });
    }
  }
  if (config.monthly_sitemap) {
    const months = new Set();
    for (let d = new Date(sinceDate); d <= untilDate; d.setUTCDate(d.getUTCDate() + 1)) months.add(d.toISOString().slice(0, 7));
    for (const month of months) {
      await wait(GAP_MS);
      const [yyyy, mm] = month.split("-");
      const xml = await fetchText(config.monthly_sitemap.replace("{yyyy}", yyyy).replace("{mm}", mm), { timeoutMs: 15000 });
      for (const [, url] of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) pages.push({ url, title: "" });
    }
  }
  return { disallow, pages };
}

const allowed = (url, disallow) => !disallow.some((rule) => new URL(url).pathname.startsWith(rule));

// The date part of a URL like /investing/2026/11/14/slug/ and the slug words.
function urlParts(url) {
  const m = new URL(url).pathname.match(/\/(\d{4})\/(\d{2})\/(\d{2})\/([^/]+)\/?$/);
  return m ? { date: `${m[1]}-${m[2]}-${m[3]}`, slug: words(m[4].replace(/-/g, " ")) } : null;
}

// Returns the original URL for a story, or null.
// 1. Same title in the news sitemap.  2. A URL dated within one day whose slug
// words overlap the headline's first words by at least 0.6.
export function findOriginal(title, publishedIso, index) {
  const exact = index.pages.find((p) => p.title && normalise(p.title) === normalise(title));
  if (exact && allowed(exact.url, index.disallow)) return exact.url;

  const day = new Date(publishedIso);
  const days = [-1, 0, 1].map((n) => new Date(day.getTime() + n * 86400000).toISOString().slice(0, 10));
  let best = null;
  for (const page of index.pages) {
    const parts = urlParts(page.url);
    if (!parts || !days.includes(parts.date)) continue;
    // Slugs are cut at about 50 characters, so compare with the same number of headline words.
    const head = new Set([...words(title)].slice(0, parts.slug.size));
    const score = overlap(head, parts.slug);
    if (score >= 0.6 && (!best || score > best.score)) best = { url: page.url, score };
  }
  return best && allowed(best.url, index.disallow) ? best.url : null;
}
