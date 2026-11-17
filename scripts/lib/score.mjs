// The scoring rule (version 3). Uses only the RSS headline and summary.
// Numbers and thresholds come from data/rules.json, names from data/entities.json.
//
// Signals (only the highest condition inside each signal counts):
// A company   company name in the headline, or product/person in the headline, or any of them only in the summary
// B activity  a company-activity word in the headline, or only in the summary
// C ticker_tag the feed tagged the story with AAPL (few tagged stocks score more)
// D source_type official Apple source or a ticker news feed
// If A is 0 the article is not collected.

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Whole word or whole phrase. A letter or digit right before or after means it is part of a longer word.
const wholeWord = (term, flags = "iu") => new RegExp(`(?<![\\p{L}\\p{N}])${escape(term)}(?![\\p{L}\\p{N}])`, flags);

const firstFound = (terms, text) => terms.find((term) => wholeWord(term).test(text));

// Removes exclusion phrases ("Big Apple") so they cannot count as Apple. Returns the cleaned text and what was removed.
function removeExclusions(text, exclusions, found) {
  let cleaned = text;
  for (const phrase of exclusions) {
    const pattern = wholeWord(phrase, "giu");
    if (pattern.test(cleaned)) {
      found.add(phrase);
      cleaned = cleaned.replace(wholeWord(phrase, "giu"), " ");
    }
  }
  return cleaned;
}

// item: { title, summary, tickers }, source: { name, source_type, ticker_tags }.
// Returns matched_rule = { score, label, signals, excluded_terms, duplicates }, or
// { score, signals, ... , label: null } when below the threshold, or null when A is 0.
export function scoreItem(item, source, rules, entities) {
  const s = rules.scoring;
  const excluded = new Set();
  const title = removeExclusions(item.title, entities.exclusions, excluded);
  const summary = removeExclusions(item.summary, entities.exclusions, excluded);
  const signals = [];

  // A. Company mention
  const companyInTitle = firstFound(entities.company_names, title);
  const productInTitle = firstFound([...entities.products, ...entities.people], title);
  const anyInSummary = firstFound([...entities.company_names, ...entities.products, ...entities.people], summary);
  if (companyInTitle) {
    signals.push({ signal: "company", term: companyInTitle, kind: "company_name", where: "title", points: s.company.company_name_in_headline });
  } else if (productInTitle) {
    const kind = entities.people.includes(productInTitle) ? "person" : "product";
    signals.push({ signal: "company", term: productInTitle, kind, where: "title", points: s.company.product_or_person_in_headline });
  } else if (anyInSummary) {
    const kind = entities.company_names.includes(anyInSummary) ? "company_name" : entities.people.includes(anyInSummary) ? "person" : "product";
    signals.push({ signal: "company", term: anyInSummary, kind, where: "summary", points: s.company.in_summary_only });
  } else {
    return null; // A = 0: not about Apple by our names
  }

  // B. Company activity
  const activityIn = (text) => {
    for (const [category, terms] of Object.entries(rules.activity)) {
      const term = firstFound(terms, text);
      if (term) return { term, category };
    }
    return null;
  };
  const activityTitle = activityIn(title);
  const activitySummary = activityTitle ? null : activityIn(summary);
  if (activityTitle) signals.push({ signal: "activity", ...activityTitle, where: "title", points: s.activity.in_headline });
  else if (activitySummary) signals.push({ signal: "activity", ...activitySummary, where: "summary", points: s.activity.in_summary_only });

  // C. Ticker tag from the feed (a third-party judgement, so the source is recorded)
  const tickers = item.tickers ?? [];
  if (source.ticker_tags && tickers.includes(s.ticker_tag.ticker)) {
    const few = tickers.length <= s.ticker_tag.few_tickers_max;
    signals.push({ signal: "ticker_tag", by: source.name, tickers, points: few ? s.ticker_tag.few_tickers : s.ticker_tag.many_tickers });
  }

  // D. Source type
  const typePoints = s.source_type[source.source_type] ?? 0;
  if (typePoints > 0) signals.push({ signal: "source_type", type: source.source_type, points: typePoints });

  const score = signals.reduce((sum, signal) => sum + signal.points, 0);
  const label = score >= s.strong_match_at ? "Strong match" : score >= s.collect_at ? "Partial match" : null;
  return { score, label, signals, excluded_terms: [...excluded], duplicates: [] };
}

// Word set of a headline for comparing stories.
export function headlineWords(title, commonWords) {
  const common = new Set(commonWords);
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((word) => word && !common.has(word)),
  );
}

// Shared words divided by all words (0 to 1).
export function overlap(a, b) {
  const shared = [...a].filter((word) => b.has(word)).length;
  const all = new Set([...a, ...b]).size;
  return all === 0 ? 0 : shared / all;
}
