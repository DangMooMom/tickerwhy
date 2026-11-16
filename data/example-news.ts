import { buildReason } from "@/lib/reason";

// EXAMPLE DATA (simulated). These articles and sources are invented for the prototype.
// They are shown only when there is no news snapshot in data/news/.
// Their "why you're seeing this" reason is built by exampleReason() below, in the
// same format as for real articles.

export type Article = {
  id: string;
  source: string;
  timeAgo: string;
  title: string;
  summary: string;
};

export const articles: Article[] = [
  // --- Directly about Apple Inc. ---
  {
    id: "iphone-holiday-demand",
    source: "Example Tech Wire",
    timeAgo: "2 hours ago",
    title: "Apple raises iPhone production targets ahead of the holiday quarter",
    summary:
      "Apple has asked its assemblers to build more of the latest iPhone models than first planned, pointing to stronger than expected early demand in the US and India.",
  },
  {
    id: "q4-earnings-services",
    source: "Sample Markets Daily",
    timeAgo: "5 hours ago",
    title: "Apple beats fourth-quarter estimates as services revenue hits a record",
    summary:
      "Apple reported quarterly revenue and earnings per share above analyst estimates. Services, which includes the App Store and iCloud, grew faster than hardware.",
  },
  {
    id: "app-store-ruling",
    source: "Example Policy Report",
    timeAgo: "9 hours ago",
    title: "EU regulators open new review of App Store payment rules",
    summary:
      "European regulators will review whether Apple's updated App Store terms let developers point users to cheaper payment options outside the app.",
  },

  // --- Indirectly related: suppliers ---
  {
    id: "tsmc-chip-prices",
    source: "Sample Chip Journal",
    timeAgo: "12 hours ago",
    title: "TSMC plans price increase for its most advanced chips next year",
    summary:
      "TSMC has told customers it will charge more for its most advanced manufacturing process from next year, citing higher costs at its new plants.",
  },
  {
    id: "foxconn-india-plant",
    source: "Example Asia Business",
    timeAgo: "1 day ago",
    title: "Foxconn to expand its India plant as device makers shift assembly",
    summary:
      "Foxconn will add production lines at its plant in southern India. The company assembles smartphones for several global brands.",
  },

  // --- Confusing: the word "Apple" but not Apple Inc. ---
  {
    id: "apple-harvest-prices",
    source: "Sample Farm News",
    timeAgo: "1 day ago",
    title: "Apple prices jump after poor harvest in Washington State",
    summary:
      "A late spring frost cut this year's apple harvest in Washington State. Wholesale prices for popular varieties have risen sharply as a result.",
  },
  {
    id: "apple-records-reissue",
    source: "Example Music Weekly",
    timeAgo: "2 days ago",
    title: "Apple Records announces remastered box set of classic albums",
    summary:
      "Apple Records, the label founded by the Beatles, will release a remastered box set next spring with previously unheard studio recordings.",
  },
  {
    id: "big-apple-tourism",
    source: "Sample City Herald",
    timeAgo: "2 days ago",
    title: "Big Apple hotels report record bookings for the holiday season",
    summary:
      "Hotels in New York City say holiday bookings are at their highest level in years, helped by a rise in international visitors.",
  },
];

// Builds the reason the same way as for real articles: the rule words "Apple"
// and "iPhone" counted in the headline and in the first paragraph (here, the summary).
const EXAMPLE_TERMS = ["Apple", "iPhone"];

function countTerms(text: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const term of EXAMPLE_TERMS) {
    const n = text.toLowerCase().split(term.toLowerCase()).length - 1;
    if (n > 0) counts[term] = n;
  }
  return counts;
}

export function exampleReason(article: Article): string {
  const matched = { headline: countTerms(article.title), first_paragraph: countTerms(article.summary) };
  if (Object.keys(matched.headline).length === 0 && Object.keys(matched.first_paragraph).length === 0) {
    return `This example article does not match the collection rule. Published by ${article.source} ${article.timeAgo}.`;
  }
  return buildReason(matched, article.source, article.timeAgo);
}
