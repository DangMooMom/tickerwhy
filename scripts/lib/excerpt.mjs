// Shared helpers for the news scripts: download a public page and make a short
// excerpt from it. Only the excerpt is ever kept, never the full article text
// (this is a public repo and the articles are copyrighted).

import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";

export const MAX_WORDS = 100;
const MAX_PARAGRAPHS = 3;
const MIN_WORDS = 30; // less than this is probably a notice or a teaser, not the article
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; tickerwhy-student-project)" };

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const countWords = (text) => text.split(/\s+/).filter(Boolean).length;

export async function fetchText(url, options = {}) {
  const { timeoutMs = 20000, ...rest } = options;
  const res = await fetch(url, { ...rest, headers: { ...HEADERS, ...rest.headers }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// Paragraphs that are site notices, not article text.
// A short line that is only a time stamp, such as "Monday November 16, 2026 2:40 pm PST
// by Joe Rossignol" or a stock widget's "NASDAQ · As of 4:00 PM ET 11/16/26".
const TIMESTAMP_LINE = /^(?=[\s\S]{0,120}$)[\s\S]*\b\d{1,2}:\d{2}\s?(?:am|pm|a\.m\.|p\.m\.)\b/i;
// A short writer bio, such as The Verge's "[name] writes about tech news, reviews
// gadgets, and helps readers save money..." (the name is a link, so it is often lost).
const WRITER_BIO = /^(?=[\s\S]{0,250}$)(?:\S+\s){0,3}(?:writes|covers|reports) (?:about|on)\b/i;
// A short photo caption: one line that ends with the photo's date, such as CNBC's
// "A man checks his phone near an Apple logo ... in Shanghai, China, on Sept. 13, 2023.",
// or that names a photo credit.
const MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?";
const PHOTO_CAPTION = new RegExp(
  `^(?=[\\s\\S]{0,250}$)(?:[\\s\\S]*\\bon ${MONTH} \\d{1,2}, \\d{4}\\.$|[\\s\\S]*\\b(?:Getty Images|Photo by|Photo credit|Image credit)\\b)`,
  "i",
);
const NOTICE = /(may earn|earn a commission|affiliate|links on our|subscribe|sign up|newsletter|cookies|all rights reserved|disclaimer)/i;

// Cuts text to at most maxWords words, ending at the last full sentence.
// Returns "" if no sentence ends within the limit.
function cutAtSentenceEnd(text, maxWords) {
  const words = text.split(/\s+/).filter(Boolean).slice(0, maxWords).join(" ");
  const match = words.match(/^[\s\S]*[.!?]["'\u201d\u2019)]?(?=\s|$)/);
  return match ? match[0] : "";
}

// First paragraphs of the article, at most maxWords words, ending at a sentence
// end. Returns "" if the page has no readable article text (for example a
// paywall or login page) or the text is shorter than minWords.
// Version 1 used 3 paragraphs and a hard cut at 100 words (the defaults below
// keep that behaviour for the archived script).
//
// selector: for sites whose article text is not in <p> tags. Apple Newsroom keeps
// each paragraph in <div class="pagebody-copy">, so its source entry in
// data/sources.json sets "excerpt_selector": ".pagebody-copy". Those elements are
// read straight from the page, and footnote marks (<sup>) are removed.
export function makeExcerpt(html, pageUrl, { maxWords = MAX_WORDS, minWords = MIN_WORDS, maxParagraphs = MAX_PARAGRAPHS, sentenceEnd = false, selector = "" } = {}) {
  const dom = new JSDOM(html, { url: pageUrl, virtualConsole: new VirtualConsole() }); // empty console: ignore page CSS errors
  let blocks;
  if (selector) {
    blocks = [...dom.window.document.querySelectorAll(selector)];
    for (const block of blocks) block.querySelectorAll("sup").forEach((sup) => sup.remove());
  } else {
    const article = new Readability(dom.window.document).parse();
    if (!article?.content) return "";
    blocks = [...new JSDOM(article.content).window.document.querySelectorAll("p")];
  }

  const paragraphs = blocks
    .map((p) => p.textContent.replace(/\s+/g, " ").trim())
    .filter(
      (text) =>
        countWords(text) >= 8 &&
        !NOTICE.test(text) &&
        !TIMESTAMP_LINE.test(text) &&
        !WRITER_BIO.test(text) &&
        !PHOTO_CAPTION.test(text),
    ); // skip bylines, captions, notices, time stamps and writer bios

  const kept = [];
  let words = 0;
  for (const paragraph of paragraphs.slice(0, maxParagraphs)) {
    const room = maxWords - words;
    if (room < 8) break;
    if (countWords(paragraph) <= room) {
      kept.push(paragraph);
      words += countWords(paragraph);
      continue;
    }
    const cut = sentenceEnd ? cutAtSentenceEnd(paragraph, room) : paragraph.split(" ").slice(0, room).join(" ");
    if (cut) {
      kept.push(cut);
      words += countWords(cut);
    }
    break;
  }
  return words >= minWords ? kept.join("\n\n") : "";
}
