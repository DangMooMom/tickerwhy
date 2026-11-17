// Makes the "AI summary" for each article with an excerpt and saves it to
// data/cache/summaries-<snapshot name>.json, so the article page can show it
// without an API key. Pages read only this cache and never call the LLM.
//
// Usage: start the app with `npm run dev` (it needs GROQ_API_KEY in .env.local)
// and run `npm run summarize-news`. Add `-- --test-list` to do only the articles
// in data/news/test-set.json.
//
// The script does not call Groq itself. It calls our own /api/summary route, so
// the key, the prompt and the checks live in one place. Only the title and the
// excerpt are sent.
//
// An article is asked again only if it has no summary yet or its excerpt changed
// (the cache keeps a hash of the excerpt). To redo everything, delete the cache files.

import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const NEWS_DIR = new URL("../data/news/", import.meta.url);
const CACHE_DIR = new URL("../data/cache/", import.meta.url);
const TEST_LIST_ONLY = process.argv.includes("--test-list");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hash = (text) => createHash("sha1").update(text).digest("hex").slice(0, 12);

async function summarize({ title, excerpt }) {
  // Up to 3 answers that fail a check, and up to 6 waits for the rate limit.
  let rejected = 0;
  let limited = 0;
  for (;;) {
    const res = await fetch(`${BASE}/api/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, excerpt }),
    });
    const data = await res.json();
    if (res.ok) return data; // { model, result, dropped }
    // 429 = rate limit, 502 = the answer failed a check (the LLM may do better on a retry).
    if (res.status === 429) limited++;
    else if (res.status === 502) rejected++;
    if (![429, 502].includes(res.status) || rejected === 3 || limited === 6) throw new Error(data.error ?? `HTTP ${res.status}`);
    console.log(res.status === 429 ? "  rate limit reached, waiting 20 seconds..." : `  ${data.error} Asking again...`);
    await wait(res.status === 429 ? 20000 : 2000);
  }
}

async function main() {
  const files = existsSync(NEWS_DIR) ? readdirSync(NEWS_DIR).filter((name) => /^(\d{4}-\d{2}-\d{2}|dev)\.json$/.test(name)).sort() : [];
  if (files.length === 0) throw new Error("No snapshot in data/news/.");
  let only = null;
  if (TEST_LIST_ONLY) {
    const testSet = JSON.parse(await readFile(new URL("test-set.json", NEWS_DIR), "utf8"));
    only = new Set(testSet.articles.map((a) => a.id));
  }

  let failed = 0;
  for (const name of files) {
    const snapshot = JSON.parse(await readFile(new URL(name, NEWS_DIR), "utf8"));
    const label = name.replace(".json", "");
    const cacheFile = new URL(`summaries-${label}.json`, CACHE_DIR);
    const cache = existsSync(cacheFile) ? JSON.parse(await readFile(cacheFile, "utf8")) : { snapshot: name, model: "", generated_at: "", results: {} };
    let added = 0;
    for (const article of snapshot.articles) {
      if (!article.excerpt || (only && !only.has(article.id))) continue;
      const excerptHash = hash(article.excerpt);
      if (cache.results[article.id]?.excerpt_hash === excerptHash) continue; // already done
      try {
        const { model, result, dropped } = await summarize(article);
        cache.results[article.id] = { ...result, dropped_keywords: dropped, excerpt_hash: excerptHash };
        cache.model = model;
        added++;
        console.log(`summarised: ${article.title.slice(0, 80)}`);
        await wait(1500); // stay under the provider's requests-per-minute limit
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
    console.log(`data/cache/summaries-${label}.json: ${added} new`);
  }
  if (failed > 0) {
    console.error(`${failed} articles failed. Run the script again to retry them.`);
    process.exit(1);
  }
}

try {
  await main();
} catch (error) {
  console.error(`summarize-news failed: ${error.message}`);
  process.exit(1);
}
