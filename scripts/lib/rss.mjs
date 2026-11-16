// A very small RSS/Atom reader: enough for headline, summary, link and date.

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
    .replace(/&amp;/g, "&")
    .trim();
}

function readTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  return match ? decodeEntities(match[1]) : "";
}

// Plain text of an HTML snippet.
function toText(html) {
  return decodeEntities(decodeEntities(html).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

// Returns [{ title, summary, link, date }] for an RSS 2.0 or Atom feed.
// summary is the feed's own description of the article, as plain text.
export function parseFeed(xml) {
  const items = [];
  for (const [, block] of xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/g)) {
    items.push({
      title: readTag(block, "title"),
      summary: toText(readTag(block, "description")),
      link: readTag(block, "link"),
      date: readTag(block, "pubDate") || readTag(block, "dc:date"),
    });
  }
  for (const [, block] of xml.matchAll(/<entry[\s>]([\s\S]*?)<\/entry>/g)) {
    const link = block.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/)?.[1] ?? block.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? "";
    items.push({
      title: readTag(block, "title"),
      summary: toText(readTag(block, "summary") || readTag(block, "content")),
      link: decodeEntities(link),
      date: readTag(block, "published") || readTag(block, "updated"),
    });
  }
  return items
    .map((item) => ({ ...item, title: item.title.replace(/<[^>]+>/g, "").trim(), date: new Date(item.date) }))
    .filter((item) => item.title && item.link.startsWith("http") && !Number.isNaN(item.date.getTime()));
}
