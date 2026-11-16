// Suggests the test list the app shows and saves it to data/news/test-set.json.
// Usage: npm run select-test-set   (after npm run fetch-news and npm run analyze-news)
//
// The list is my design: 16 stock-related articles + 4 spy articles (8:2).
// - Stock-related: articles the LLM marked stock_relevant. Categories are mixed
//   (one per category in turn, newest first) and no source gives more than 3.
// - Spy: 2 collected shopping-deal articles (deal words in the headline, not
//   stock-relevant) and the planted spy_mention and spy_fruit articles.
// Every article was collected by the rule, so its "Why you're seeing this" text is true.
//
// The LLM only suggests. I check the list and can edit test-set.json by hand
// (the app shows exactly the ids in it, in that order).
//
// test-set.json is an answer key: role, category and spy_type are never shown in
// the UI and never sent to the LLM. lib/news.ts reads only the ids and the order.

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

const NEWS = new URL("../data/news/", import.meta.url);
const CACHE = new URL("../data/cache/", import.meta.url);
const DATASET_DAYS = ["2026-11-16", "2026-11-17"];
const STOCK_COUNT = 16;
const DEAL_SPIES = 2;
const PER_SOURCE = 3;
const CATEGORY_ORDER = ["earnings", "product_launch", "legal_regulation", "analyst_rating", "supply_chain", "leadership", "market_move", "other"];
const DEAL_WORDS = /\bdeals?\b|\bsale\b|% off|\$\d*\s?off|black friday|cheaper than ever|discount|price cut|lowest price/i;

const newestFirst = (a, b) => new Date(b.date) - new Date(a.date);

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

async function main() {
  // Same files the app uses: the dataset days, or the development sample.
  let names = DATASET_DAYS.map((day) => day).filter((day) => existsSync(new URL(`${day}.json`, NEWS)));
  if (names.length === 0) names = ["dev"];

  const articles = new Map();
  for (const name of names) {
    const snapshot = JSON.parse(await readFile(new URL(`${name}.json`, NEWS), "utf8"));
    const cacheFile = new URL(`relevance-${name}.json`, CACHE);
    if (!existsSync(cacheFile)) throw new Error(`No LLM answers for ${name}. Run npm run analyze-news first.`);
    const { results } = JSON.parse(await readFile(cacheFile, "utf8"));
    for (const article of snapshot.articles) {
      if (articles.has(article.id)) continue;
      if (!results[article.id]) throw new Error(`No LLM answer for: ${article.title}`);
      articles.set(article.id, { ...article, judged: results[article.id] });
    }
  }
  const all = [...articles.values()];
  const collected = all.filter((article) => !article.spy_type);

  // 1. Stock-related articles: categories in turn, newest first, at most PER_SOURCE per source.
  const perSource = new Map();
  const canTake = (article) => (perSource.get(article.source) ?? 0) < PER_SOURCE;
  const take = (article) => perSource.set(article.source, (perSource.get(article.source) ?? 0) + 1);

  const byCategory = new Map(CATEGORY_ORDER.map((category) => [category, []]));
  for (const article of collected.filter((a) => a.judged.stock_relevant).sort(newestFirst)) {
    byCategory.get(article.judged.category)?.push(article);
  }
  const stock = [];
  while (stock.length < STOCK_COUNT) {
    let tookOne = false;
    for (const list of byCategory.values()) {
      if (stock.length === STOCK_COUNT) break;
      const index = list.findIndex(canTake);
      if (index === -1) continue;
      const [article] = list.splice(index, 1);
      take(article);
      stock.push(article);
      tookOne = true;
    }
    if (!tookOne) break; // nothing left that fits the limits
  }

  // 2. Spy articles: shopping deals from the collection (different sources, fewest
  //    picks first, then newest), plus the planted spy_mention and spy_fruit.
  const deals = collected
    .filter((a) => DEAL_WORDS.test(a.title) && !a.judged.stock_relevant)
    .sort((a, b) => (perSource.get(a.source) ?? 0) - (perSource.get(b.source) ?? 0) || newestFirst(a, b));
  const dealSpies = [];
  for (const article of deals) {
    if (dealSpies.length === DEAL_SPIES) break;
    if (!canTake(article) || dealSpies.some((d) => d.source === article.source)) continue;
    take(article);
    dealSpies.push(article);
  }
  const planted = ["spy_mention", "spy_fruit"].map((type) => {
    const article = all.find((a) => a.spy_type === type);
    if (!article) throw new Error(`The snapshot has no ${type} article.`);
    return article;
  });
  const spies = [...dealSpies.map((a) => ({ ...a, spy_type: "spy_promo" })), ...planted];

  // 3. Order: shuffled, with one spy in each quarter of the list so they do not bunch up.
  const order = shuffle([...stock]);
  const total = order.length + spies.length;
  shuffle(spies).forEach((spy, i) => {
    const blockStart = Math.round((i * total) / spies.length);
    const blockEnd = Math.round(((i + 1) * total) / spies.length);
    const position = blockStart + Math.floor(Math.random() * (blockEnd - blockStart));
    order.splice(Math.min(position, order.length), 0, spy);
  });

  const testSet = {
    about: "Answer key and display order for the test list. The app shows exactly these ids in this order. role, category, stock_relevant and spy_type are for checking answers only and are never shown or sent to the LLM. Edit by hand to swap articles.",
    built_from: names.map((name) => `${name}.json`),
    built_at: new Date().toISOString(),
    articles: order.map((a) =>
      a.spy_type
        ? { id: a.id, role: "spy", spy_type: a.spy_type, title: a.title, source: a.source }
        : { id: a.id, role: "stock", category: a.judged.category, title: a.title, source: a.source },
    ),
  };
  await writeFile(new URL("test-set.json", NEWS), JSON.stringify(testSet, null, 2) + "\n");

  const deal = collected.filter((a) => DEAL_WORDS.test(a.title)).length;
  const relevant = collected.filter((a) => a.judged.stock_relevant).length;
  const pct = (n) => `${Math.round((n / collected.length) * 100)}%`;
  console.log(`Collected by the rule: ${collected.length}. Deal headlines: ${deal} (${pct(deal)}). Stock-relevant: ${relevant} (${pct(relevant)}).`);
  console.log(`Saved data/news/test-set.json: ${stock.length} stock-related + ${spies.length} spy = ${testSet.articles.length}`);
  if (stock.length < STOCK_COUNT) console.log(`WARNING: only ${stock.length} of ${STOCK_COUNT} stock-related articles fit the limits.`);
  if (dealSpies.length < DEAL_SPIES) console.log(`WARNING: only ${dealSpies.length} of ${DEAL_SPIES} deal articles fit the limits.`);
}

try {
  await main();
} catch (error) {
  console.error(`select-test-set failed: ${error.message}`);
  process.exit(1);
}
