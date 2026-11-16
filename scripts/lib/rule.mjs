// The collection rule: count each rule word in the headline and in the first
// paragraph. Capital and small letters count the same, and a longer word that
// contains the rule word counts too ("iPhones" counts for "iPhone").

function countTerm(text, term) {
  return text.toLowerCase().split(term.toLowerCase()).length - 1;
}

function countAll(terms, text) {
  const counts = {};
  for (const term of terms) {
    const n = countTerm(text, term);
    if (n > 0) counts[term] = n;
  }
  return counts;
}

// Returns { headline: { Apple: 1 }, first_paragraph: { iPhone: 2 } } with only the
// words that were found, or null if no rule word is in either place.
export function matchRule(terms, headline, firstParagraph) {
  const matched = { headline: countAll(terms, headline), first_paragraph: countAll(terms, firstParagraph) };
  const found = Object.keys(matched.headline).length > 0 || Object.keys(matched.first_paragraph).length > 0;
  return found ? matched : null;
}
