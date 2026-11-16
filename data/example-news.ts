// EXAMPLE DATA (simulated). These articles and sources are invented for the prototype.
// The "why" values are written by hand; they are NOT LLM output yet.
// They follow the fields the LLM will return later: relevance, company, event,
// topic, product/service, source signal, plus a short explanation.

export type Relevance = "Relevant" | "Indirectly relevant" | "Unrelated";

export type Article = {
  id: string;
  source: string;
  timeAgo: string;
  title: string;
  summary: string;
  why: {
    relevance: Relevance;
    explanation: string;
    company: string;
    event: string;
    topic: string;
    productService: string;
    sourceSignal: string;
  };
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
    why: {
      relevance: "Relevant",
      explanation:
        "The article is about Apple Inc. and its main product. iPhone demand is the largest driver of Apple's revenue.",
      company: "Apple Inc. (AAPL)",
      event: "Production target increase",
      topic: "Product demand",
      productService: "iPhone",
      sourceSignal: "Technology news outlet; names Apple Inc. and the iPhone in the headline.",
    },
  },
  {
    id: "q4-earnings-services",
    source: "Sample Markets Daily",
    timeAgo: "5 hours ago",
    title: "Apple beats fourth-quarter estimates as services revenue hits a record",
    summary:
      "Apple reported quarterly revenue and earnings per share above analyst estimates. Services, which includes the App Store and iCloud, grew faster than hardware.",
    why: {
      relevance: "Relevant",
      explanation:
        "This is Apple's own earnings report. Results against analyst estimates directly affect the AAPL share price.",
      company: "Apple Inc. (AAPL)",
      event: "Quarterly earnings report",
      topic: "Financial results",
      productService: "Services (App Store, iCloud)",
      sourceSignal: "Financial news outlet; cites Apple's earnings release and the AAPL ticker.",
    },
  },
  {
    id: "app-store-ruling",
    source: "Example Policy Report",
    timeAgo: "9 hours ago",
    title: "EU regulators open new review of App Store payment rules",
    summary:
      "European regulators will review whether Apple's updated App Store terms let developers point users to cheaper payment options outside the app.",
    why: {
      relevance: "Relevant",
      explanation:
        "The review targets Apple's App Store, a high-margin part of its services business, so the outcome could affect earnings.",
      company: "Apple Inc. (AAPL)",
      event: "Regulatory review",
      topic: "Regulation and competition",
      productService: "App Store",
      sourceSignal: "Policy news outlet; names Apple as the company under review.",
    },
  },

  // --- Indirectly related: suppliers ---
  {
    id: "tsmc-chip-prices",
    source: "Sample Chip Journal",
    timeAgo: "12 hours ago",
    title: "TSMC plans price increase for its most advanced chips next year",
    summary:
      "TSMC has told customers it will charge more for its most advanced manufacturing process from next year, citing higher costs at its new plants.",
    why: {
      relevance: "Indirectly relevant",
      explanation:
        "The article is about TSMC, not Apple. TSMC makes the chips in iPhones and Macs, so higher chip prices could raise Apple's costs.",
      company: "TSMC (supplier to Apple)",
      event: "Supplier price increase",
      topic: "Supply chain costs",
      productService: "Apple silicon chips (A-series, M-series)",
      sourceSignal: "Semiconductor trade outlet; Apple is mentioned only as a customer.",
    },
  },
  {
    id: "foxconn-india-plant",
    source: "Example Asia Business",
    timeAgo: "1 day ago",
    title: "Foxconn to expand its India plant as device makers shift assembly",
    summary:
      "Foxconn will add production lines at its plant in southern India. The company assembles smartphones for several global brands.",
    why: {
      relevance: "Indirectly relevant",
      explanation:
        "The article is about Foxconn. Foxconn assembles most iPhones, so its India expansion affects where and how reliably Apple's products are made.",
      company: "Foxconn (supplier to Apple)",
      event: "Factory expansion",
      topic: "Manufacturing and supply chain",
      productService: "iPhone assembly",
      sourceSignal: "Regional business outlet; Apple is not named in the headline.",
    },
  },

  // --- Confusing: the word "Apple" but not Apple Inc. ---
  {
    id: "apple-harvest-prices",
    source: "Sample Farm News",
    timeAgo: "1 day ago",
    title: "Apple prices jump after poor harvest in Washington State",
    summary:
      "A late spring frost cut this year's apple harvest in Washington State. Wholesale prices for popular varieties have risen sharply as a result.",
    why: {
      relevance: "Unrelated",
      explanation:
        "\"Apple\" here means the fruit. The article is about farming and food prices and has no link to Apple Inc.",
      company: "None (apple growers, not Apple Inc.)",
      event: "Poor harvest",
      topic: "Agriculture and food prices",
      productService: "None",
      sourceSignal: "Agriculture outlet; no mention of Apple Inc., AAPL, or any Apple product.",
    },
  },
  {
    id: "apple-records-reissue",
    source: "Example Music Weekly",
    timeAgo: "2 days ago",
    title: "Apple Records announces remastered box set of classic albums",
    summary:
      "Apple Records, the label founded by the Beatles, will release a remastered box set next spring with previously unheard studio recordings.",
    why: {
      relevance: "Unrelated",
      explanation:
        "Apple Records is the Beatles' record label, owned by Apple Corps. It is a different company from Apple Inc.",
      company: "Apple Corps / Apple Records (not Apple Inc.)",
      event: "Album reissue announcement",
      topic: "Music industry",
      productService: "None",
      sourceSignal: "Music outlet; the name matches but the company is Apple Corps.",
    },
  },
  {
    id: "big-apple-tourism",
    source: "Sample City Herald",
    timeAgo: "2 days ago",
    title: "Big Apple hotels report record bookings for the holiday season",
    summary:
      "Hotels in New York City say holiday bookings are at their highest level in years, helped by a rise in international visitors.",
    why: {
      relevance: "Unrelated",
      explanation:
        "\"Big Apple\" is a nickname for New York City. The article is about tourism and has no link to Apple Inc.",
      company: "None (New York City hotels)",
      event: "Record hotel bookings",
      topic: "Travel and tourism",
      productService: "None",
      sourceSignal: "Local news outlet; no mention of Apple Inc. or AAPL.",
    },
  },
];

export function getArticle(id: string): Article | undefined {
  return articles.find((article) => article.id === id);
}
