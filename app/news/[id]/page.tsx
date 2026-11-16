// Article view: the article on the left and the "Why you're seeing this" panel
// on the right (below the article on narrow screens).
//
// The panel shows only a heading, one reason paragraph and the "Not relevant"
// button. The reason states the evidence the article was collected on. It does
// not say what the article is about or whether it belongs here: the user decides.
//
// Where the reason comes from:
// 1. Real headline with a cached LLM answer: the cached reason.
// 2. Real headline without an answer: a message saying so. Nothing is made up.
// 3. Example article (only when there is no snapshot): built in code, labelled "simulated".

import Link from "next/link";
import { notFound } from "next/navigation";
import NotRelevantButton from "@/components/NotRelevantButton";
import { getNewsItem } from "@/lib/news";

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = getNewsItem(id);
  if (!article) notFound();

  return (
    <div className="article-layout">
      <div className="article-main">
        <p className="small back-link">
          <Link href="/">← Apple (AAPL:NASDAQ)</Link>
        </p>

        <article>
          <p className="muted small">
            {article.source} · {article.timeAgo}
          </p>
          <h1>{article.title}</h1>
          {article.link ? (
            <>
              {/* Only a short excerpt is saved (first ~100 words). The rest is at the publisher. */}
              {article.excerpt?.split("\n\n").map((paragraph, index) => <p key={index}>{paragraph}</p>)}
              <p>
                {article.excerpt && <span aria-hidden="true">... </span>}
                <a href={article.link} target="_blank" rel="noopener noreferrer">
                  Continue reading at {article.source}
                </a>
              </p>
            </>
          ) : (
            <>
              <p>{article.summary}</p>
              <p className="muted small">Example article written for this prototype. Not real news.</p>
            </>
          )}
        </article>
      </div>

      <aside className="why-panel" aria-labelledby="why-heading">
        <h2 id="why-heading">Why you&apos;re seeing this</h2>
        {article.simulated && <span className="tag tag-warn">simulated: example data, not LLM output</span>}
        <p>{article.reason ?? "No reason is saved for this article yet."}</p>
        <NotRelevantButton articleId={article.id} />
      </aside>
    </div>
  );
}
