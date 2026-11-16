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
  const res = await fetch(url, { ...options, headers: { ...HEADERS, ...options.headers }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// Paragraphs that are site notices, not article text.
const NOTICE = /(may earn|earn a commission|affiliate|links on our|subscribe|sign up|newsletter|cookies|all rights reserved|disclaimer)/i;

// First paragraphs of the article, at most MAX_WORDS words. Returns "" if the
// page has no readable article text.
export function makeExcerpt(html, pageUrl) {
  const dom = new JSDOM(html, { url: pageUrl, virtualConsole: new VirtualConsole() }); // empty console: ignore page CSS errors
  const article = new Readability(dom.window.document).parse();
  if (!article?.content) return "";

  const paragraphs = [...new JSDOM(article.content).window.document.querySelectorAll("p")]
    .map((p) => p.textContent.replace(/\s+/g, " ").trim())
    .filter((text) => countWords(text) >= 8 && !NOTICE.test(text)); // skip bylines, captions and notices

  const kept = [];
  let words = 0;
  for (const paragraph of paragraphs.slice(0, MAX_PARAGRAPHS)) {
    const room = MAX_WORDS - words;
    if (room < 8) break;
    const cut = paragraph.split(" ").slice(0, room).join(" "); // the last paragraph may be cut short
    kept.push(cut);
    words += countWords(cut);
  }
  return words >= MIN_WORDS ? kept.join("\n\n") : "";
}
