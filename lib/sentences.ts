// Splits an excerpt into paragraphs and numbered sentences.
//
// The same function is used when the summary is made (app/api/summary) and when
// the article page is shown, so a keyword's sentence_index always points to the
// same sentence. Paragraphs are separated by a blank line. Sentence numbers run
// on across paragraphs, starting at 0.

export type Sentence = { index: number; text: string };

// Words with a full stop that do not end a sentence.
const ABBREVIATIONS = /(?:^|\s)(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Inc|Co|Corp|Ltd|vs|etc|e\.g|i\.e|U\.S|U\.K|No|[A-Z])\.$/;

function splitParagraph(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  // A sentence ends at . ! or ? (maybe followed by a closing quote or bracket),
  // then a space, then a capital letter, digit or opening quote.
  for (const match of text.matchAll(/[.!?]["'”’)]?\s+(?=["“‘(]?[A-Z0-9])/g)) {
    const end = match.index + match[0].trimEnd().length;
    const candidate = text.slice(start, end);
    if (ABBREVIATIONS.test(candidate.replace(/["'”’)]$/, ""))) continue;
    sentences.push(candidate.trim());
    start = match.index + match[0].length;
  }
  const rest = text.slice(start).trim();
  if (rest) sentences.push(rest);
  return sentences;
}

export function splitExcerpt(excerpt: string): Sentence[][] {
  let index = 0;
  return excerpt
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => splitParagraph(paragraph).map((text) => ({ index: index++, text })));
}

// Whole-word, case-insensitive search. Returns the position or -1.
export function findTerm(text: string, term: string): number {
  const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  if (!escaped) return -1;
  const match = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu").exec(text);
  return match ? match.index : -1;
}
