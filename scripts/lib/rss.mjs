// A very small RSS/Atom reader: headline, summary, link, date, plus the extra
// fields some feeds carry (Nasdaq: nasdaq:tickers, category, dc:creator;
// Atom: category term).

function decodeEntities(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#039;|&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#822[01];/g, '"')
    .replace(/&#8211;/g, "-")
    .replace(/&#8212;/g, "-")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&zwn?j;/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .trim();
}

function readTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  return match ? decodeEntities(match[1]) : "";
}

function readAllTags(block, tag) {
  return [...block.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => decodeEntities(m[1]));
}

// Plain text of an HTML snippet. Decoded twice because some feeds encode twice ("&amp;quot;").
function toText(html) {
  return decodeEntities(decodeEntities(html).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

// Returns [{ title, summary, link, date, tickers, categories, creator }] for an
// RSS 2.0 or Atom feed. tickers: upper case, without duplicates (Nasdaq only).
export function parseFeed(xml) {
  const items = [];
  for (const [, block] of xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/g)) {
    const tickerText = readTag(block, "nasdaq:tickers");
    items.push({
      title: toText(readTag(block, "title")),
      summary: toText(readTag(block, "description")),
      link: readTag(block, "link"),
      date: readTag(block, "pubDate") || readTag(block, "dc:date"),
      tickers: [...new Set(tickerText.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean))],
      categories: readAllTags(block, "category"),
      creator: toText(readTag(block, "dc:creator")),
    });
  }
  for (const [, block] of xml.matchAll(/<entry[\s>]([\s\S]*?)<\/entry>/g)) {
    // The article link is the one with rel="alternate" or no rel at all (not "enclosure" or "self").
    const links = [...block.matchAll(/<link\b([^>]*)\/?>/g)].map((m) => m[1]);
    const articleLink = links.find((a) => /rel="alternate"/.test(a)) ?? links.find((a) => !/rel=/.test(a)) ?? links[0] ?? "";
    items.push({
      title: toText(readTag(block, "title")),
      summary: toText(readTag(block, "summary") || readTag(block, "content")),
      link: decodeEntities(articleLink.match(/href="([^"]+)"/)?.[1] ?? ""),
      date: readTag(block, "published") || readTag(block, "updated"),
      tickers: [],
      categories: [...block.matchAll(/<category[^>]*term="([^"]+)"/g)].map((m) => decodeEntities(m[1])),
      creator: toText(readTag(block, "name")),
    });
  }
  return items
    .map((item) => ({ ...item, date: new Date(item.date) }))
    .filter((item) => item.title && item.link.startsWith("http") && !Number.isNaN(item.date.getTime()));
}
