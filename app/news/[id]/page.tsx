// Article view with the "Why this matters" panel.
// SIMULATED: the article and the panel values come from data/news.ts (hand-written
// examples), not from an LLM.

import Link from "next/link";
import { notFound } from "next/navigation";
import NotRelevantButton from "@/components/NotRelevantButton";
import { getArticle } from "@/data/news";

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = getArticle(id);
  if (!article) notFound();

  const { why } = article;
  const fields = [
    ["Company", why.company],
    ["Event", why.event],
    ["Topic", why.topic],
    ["Product / service", why.productService],
    ["Source signal", why.sourceSignal],
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
        <p>{article.summary}</p>
        <p className="muted small">Example article written for this prototype. Not real news.</p>
      </article>

      <section className="card" aria-labelledby="why-heading">
        <div className="section-head">
          <h2 id="why-heading">Why this matters</h2>
          <span className="tag tag-warn">simulated: example data, not LLM output</span>
        </div>

        <p>
          <strong>{why.relevance} to Apple (AAPL).</strong> {why.explanation}
        </p>

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
