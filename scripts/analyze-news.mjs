// Asks the LLM about every article in the newest snapshot and saves the answers
// to data/cache/relevance-YYYY-MM-DD.json. The app shows that cache, so a
// reviewer can see the results without an API key.
//
// Usage: start the app with `npm run dev` (it needs GROQ_API_KEY in .env.local),
// then run `npm run analyze-news`.
//
// The script does not call Groq itself. It calls our own /api/relevance route,
// so the key and the prompt live in one place.
//
// Only title, summary, source and date are sent. The answer-key fields
// (source_query, spy_type, expected_relevance) are never sent.
// Articles that are already in the cache are kept and not asked again.

import { existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const NEWS_DIR = new URL("../data/news/", import.meta.url);
const CACHE_DIR = new URL("../data/cache/", import.meta.url);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function analyze(article) {
  // Pick the four fields by name so nothing else from the snapshot can be sent.
  const { title, summary = "", source, date } = article;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${BASE}/api/relevance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, summary, source, date }),
    });
    const data = await res.json();
    if (res.ok) return data;
    if (res.status !== 429 || attempt === 3) throw new Error(data.error ?? `HTTP ${res.status}`);
    console.log("  rate limit reached, waiting 20 seconds...");
    await wait(20000);
  }
}

async function main() {
  const files = existsSync(NEWS_DIR) ? readdirSync(NEWS_DIR).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort() : [];
  const latest = files.at(-1);
  if (!latest) throw new Error("No snapshot in data/news/. Run `npm run fetch-news` first.");

  const date = latest.replace(".json", "");
  const snapshot = JSON.parse(await readFile(new URL(latest, NEWS_DIR), "utf8"));
  const cacheFile = new URL(`relevance-${date}.json`, CACHE_DIR);
  const cache = existsSync(cacheFile)
    ? JSON.parse(await readFile(cacheFile, "utf8"))
    : { date, model: "", generated_at: "", results: {} };

  let added = 0;
  let failed = 0;
  for (const article of snapshot.articles) {
    if (cache.results[article.id]) continue; // already analysed
    try {
      const { model, result } = await analyze(article);
      cache.results[article.id] = result;
      cache.model = model;
      added++;
      console.log(`analysed: ${article.title.slice(0, 80)}`);
    } catch (error) {
      failed++;
      console.error(`FAILED: ${article.title.slice(0, 60)} (${error.message})`);
    }
    await wait(1500); // stay under the provider's requests-per-minute limit
  }

  if (added > 0) {
    cache.generated_at = new Date().toISOString();
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cacheFile, JSON.stringify(cache, null, 2) + "\n");
  }
  const total = Object.keys(cache.results).length;
  console.log(`data/cache/relevance-${date}.json: ${total} of ${snapshot.articles.length} articles analysed (${added} new, ${failed} failed)`);
  if (failed > 0) process.exit(1);
}

try {
  await main();
} catch (error) {
  console.error(`analyze-news failed: ${error.message}`);
  process.exit(1);
}
