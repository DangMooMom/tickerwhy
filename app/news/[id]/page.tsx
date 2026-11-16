// Article view with the "Why this matters" panel.
// The article is either a real headline from the newest snapshot in data/news/ or,
// if there is no snapshot, an example article.
// SIMULATED: the panel is never LLM output yet. Example articles show hand-written
// values from data/example-news.ts; real headlines show placeholders.

import Link from "next/link";
import { notFound } from "next/navigation";
import NotRelevantButton from "@/components/NotRelevantButton";
import { getNewsItem } from "@/lib/news";

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = getNewsItem(id);
  if (!article) notFound();

  // Real headlines have no judgement yet, so every field shows a placeholder.
  const { why } = article;
  const notJudged = "Not judged yet";
  const fields = [
    ["Company", why?.company ?? notJudged],
    ["Event", why?.event ?? notJudged],
    ["Topic", why?.topic ?? notJudged],
    ["Product / service", why?.productService ?? notJudged],
    ["Source signal", why?.sourceSignal ?? notJudged],
  ];

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
          <span className="tag tag-warn">
            {why ? "simulated: example data, not LLM output" : "simulated: placeholder, not LLM output"}
          </span>
        </div>

        {why ? (
          <p>
            <strong>{why.relevance} to Apple (AAPL).</strong> {why.explanation}
          </p>
        ) : (
          <p>
            <strong>Not judged yet.</strong> The LLM is not connected, so this article has no relevance
            judgement. The fields below are placeholders.
          </p>
        )}

        <dl className="why-fields">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <NotRelevantButton />
      </section>
    </>
  );
}
