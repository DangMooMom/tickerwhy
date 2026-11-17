// The collection rule (version 2): a company word AND an activity word, each
// found as a whole word or whole phrase in the headline or the RSS summary.
// Capital and small letters count the same. "Apple" matches "Apple's" but not
// "grapple" or "Apples".

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A letter or digit right before or after the term means it is part of a longer word.
const wholeWord = (term) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(term)}(?![\\p{L}\\p{N}])`, "iu");

// rules = the parsed data/rules.json. Returns
// { company: [{ term, where }], activity: [{ term, category, where }] }
// with where = "headline" or "summary", or null if the rule does not match.
export function matchActivityRule(rules, headline, summary) {
  const places = [
    ["headline", headline],
    ["summary", summary],
  ];
  const company = [];
  const activity = [];
  for (const [where, text] of places) {
    for (const term of rules.company_terms) {
      if (wholeWord(term).test(text)) company.push({ term, where });
    }
    for (const [category, terms] of Object.entries(rules.activity)) {
      for (const term of terms) {
        if (wholeWord(term).test(text)) activity.push({ term, category, where });
      }
    }
  }
  return company.length > 0 && activity.length > 0 ? { company, activity } : null;
}

// True if the text contains a company word (used to count Apple articles per feed).
export function hasCompanyWord(rules, text) {
  return rules.company_terms.some((term) => wholeWord(term).test(text));
}
