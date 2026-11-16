// Asks the LLM how relevant each article in every snapshot in data/news/ is to
// Apple Inc. and saves the answers (relevance, confidence) to
// data/cache/relevance-<snapshot name>.json, one cache file per snapshot. The
// answers are for checking against the answer key only; the UI does not show them.
//
// Usage: start the app with `npm run dev` (it needs GROQ_API_KEY in .env.local)
// and run `npm run analyze-news`.
//
// The script does not call Groq itself. It calls our own /api/relevance route,
// so the key and the prompt live in one place.
//
// Only title, excerpt, source and date are sent. The answer-key fields
// (spy_type, expected_relevance) and matched_rule are never sent.
// Articles that already have an answer are not asked again. To analyse everything
// again, delete the files in data/cache/.

import { existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const NEWS_DIR = new URL("../data/news/", import.meta.url);
const CACHE_DIR = new URL("../data/cache/", import.meta.url);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function analyze(article) {
  // Pick the four fields by name so nothing else from the snapshot can be sent.
  const { title, excerpt, source, date } = article;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${BASE}/api/relevance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, excerpt, source, date }),
    });
    const data = await res.json();
    if (res.ok) return data; // { model, result }
    // 429 = rate limit, 502 = the answer failed the schema check (the LLM may do better on a retry).
    const canRetry = res.status === 429 || res.status === 502;
    if (!canRetry || attempt === 3) throw new Error(data.error ?? `HTTP ${res.status}`);
    console.log(res.status === 429 ? "  rate limit reached, waiting 20 seconds..." : "  answer rejected, asking again...");
    await wait(res.status === 429 ? 20000 : 2000);
  }
}

async function main() {
  const files = existsSync(NEWS_DIR) ? readdirSync(NEWS_DIR).filter((name) => /^(\d{4}-\d{2}-\d{2}|dev)\.json$/.test(name)).sort() : [];
  if (files.length === 0) throw new Error("No snapshot in data/news/.");

  // Answers found so far, by article id. An article that is in two snapshots is asked only once.
  const known = new Map();
  const jobs = [];
  for (const name of files) {
    const date = name.replace(".json", "");
    const snapshot = JSON.parse(await readFile(new URL(name, NEWS_DIR), "utf8"));
    const cacheFile = new URL(`relevance-${date}.json`, CACHE_DIR);
    const cache = existsSync(cacheFile)
      ? JSON.parse(await readFile(cacheFile, "utf8"))
      : { date, model: "", generated_at: "", results: {} };
    for (const [id, result] of Object.entries(cache.results)) known.set(id, { result, model: cache.model });
    jobs.push({ date, snapshot, cacheFile, cache });
  }

  let failed = 0;
  for (const { date, snapshot, cacheFile, cache } of jobs) {
    let added = 0;
    for (const article of snapshot.articles) {
      if (cache.results[article.id]) continue; // already analysed
      try {
        if (!known.has(article.id)) {
          known.set(article.id, await analyze(article));
          console.log(`analysed: ${article.title.slice(0, 80)}`);
          await wait(1500); // stay under the provider's requests-per-minute limit
        }
        const { model, result } = known.get(article.id);
        cache.results[article.id] = result;
        cache.model = model;
        added++;
      } catch (error) {
        failed++;
        console.error(`FAILED: ${article.title.slice(0, 60)} (${error.message})`);
      }
    }
    if (added > 0) {
      cache.generated_at = new Date().toISOString();
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(cacheFile, JSON.stringify(cache, null, 2) + "\n");
    }
    const total = snapshot.articles.filter((article) => cache.results[article.id]).length;
    console.log(`data/cache/relevance-${date}.json: ${total} of ${snapshot.articles.length} articles analysed (${added} new)`);
  }
  if (failed > 0) {
    console.error(`${failed} articles failed. Run the script again to retry them.`);
    process.exit(1);
  }
}

try {
  await main();
} catch (error) {
  console.error(`analyze-news failed: ${error.message}`);
  process.exit(1);
}
