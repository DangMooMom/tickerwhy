// Article view with the "Why this matters" panel.
//
// The panel has three cases:
// 1. Real headline with a cached LLM answer: shows it, labelled "AI-generated (Groq, cached)".
// 2. Real headline without an answer: says so. Nothing is made up.
// 3. Example article (only when there is no snapshot): hand-written values, labelled "simulated".

import Link from "next/link";
import { notFound } from "next/navigation";
import NotRelevantButton from "@/components/NotRelevantButton";
import RelevanceBadge from "@/components/RelevanceBadge";
import { getNewsItem } from "@/lib/news";

// The cache time is printed in UTC so the server and the browser show the same text.
function formatGenerated(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "unknown time";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date) + " UTC";
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = getNewsItem(id);
  if (!found) notFound();

  const { item: article, cache } = found;
  const { analysis, why } = article;

  // Rows of the panel: from the LLM answer if there is one, otherwise from the example values.
  let fields: string[][] = [];
  if (analysis) {
    fields = [
      ["Company", analysis.why.company],
      ["Event", analysis.why.event],
      ["Topic", analysis.why.topic],
      ["Product / service", analysis.why.product_service],
      ["Source signal", analysis.why.source_signal],
    ];
  } else if (why) {
    fields = [
      ["Company", why.company],
      ["Event", why.event],
      ["Topic", why.topic],
      ["Product / service", why.productService],
      ["Source signal", why.sourceSignal],
    ];
  }

  return (
    <>
      <p className="small">
        <Link href="/">← Apple (AAPL:NASDAQ)</Link>
      </p>

      <article>
        <p className="muted small">
          {article.source} · {article.timeAgo}
        </p>
        <h1>{article.title}</h1>
        {article.link ? (
          <>
            <p>
              <a href={article.link} target="_blank" rel="noopener noreferrer">
                Read the full article at {article.source} (opens in a new tab)
              </a>
            </p>
            <p className="muted small">
              Real headline from Google News RSS. Only the headline, source and date are saved here.
            </p>
          </>
        ) : (
          <>
            <p>{article.summary}</p>
            <p className="muted small">Example article written for this prototype. Not real news.</p>
          </>
        )}
      </article>

      <section className="card" aria-labelledby="why-heading">
        <div className="section-head">
          <h2 id="why-heading">Why this matters</h2>
          {analysis && <span className="tag">AI-generated (Groq, cached)</span>}
          {!analysis && why && <span className="tag tag-warn">simulated: example data, not LLM output</span>}
        </div>

        {analysis && (
          <>
            <p className="news-meta">
              <RelevanceBadge level={analysis.relevance} />
              <span className="muted small">
                Relevance to Apple (AAPL) · model confidence {Math.round(analysis.confidence * 100)}%
              </span>
            </p>
            <p>{analysis.explanation}</p>
          </>
        )}
        {!analysis && why && (
          <p>
            <strong>{why.relevance} to Apple (AAPL).</strong> {why.explanation}
          </p>
        )}
        {!analysis && !why && (
          <p role="status">
            No AI analysis is saved for this article yet, so nothing is shown here. Open the article and judge
            for yourself.
          </p>
        )}

        {fields.length > 0 && (
          <dl className="why-fields">
            {fields.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {analysis && cache && (
          <p className="muted small">
            Written by an AI model ({cache.model}) from the headline, source, date and link only, and saved on{" "}
            {formatGenerated(cache.generatedAt)}. It can be wrong. The confidence is the model&apos;s own
            estimate, not a measured accuracy.
          </p>
        )}

        <NotRelevantButton articleId={article.id} />
      </section>
    </>
  );
}
