// Article view, following the Figma frame "2. Article view": the article on the
// left, and on the right the "Why you're seeing this" panel and "Related news"
// (below the article on narrow screens).
//
// Article column: source and time, headline, date and author, then the AI summary
// (with clickable keywords), the excerpt and the link to the full article.
//
// The panel shows only a heading, one reason paragraph and the "Not relevant"
// button. The reason states the evidence the article was collected on. It does
// not say what the article is about or whether it belongs here: the user decides.
// It is built in code from the collection rule (lib/reason.ts), so it always
// matches why the article was really collected. Example articles (only when
// there is no snapshot) get a reason in the same format and are labelled "simulated".

import Link from "next/link";
import { notFound } from "next/navigation";
import ArticleBody from "@/components/ArticleBody";
import NotRelevantButton from "@/components/NotRelevantButton";
import { getNewsItem, getRelatedNews } from "@/lib/news";

// The reason's first sentence ("Partial match.") is bold, as in the Figma frame.
function Reason({ text }: { text: string }) {
  const end = text.indexOf(". ");
  if (end === -1) return <p>{text}</p>;
  return (
    <p>
      <strong>{text.slice(0, end + 1)}</strong>
      {text.slice(end + 1)}
    </p>
  );
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = getNewsItem(id);
  if (!article) notFound();
  const related = getRelatedNews(id);

  return (
    <div className="article-layout">
      <div className="article-main">
        <p className="small back-link">
          <Link href="/">← Apple (AAPL:NASDAQ)</Link>
        </p>

        <article>
          <header className="article-head">
            <div>
              <p className="small">
                {article.source} · {article.timeAgo}
              </p>
              <h1>{article.title}</h1>
            </div>
            {article.dateTime && (
              <p className="muted small">
                {article.dateTime}
                {article.author && <> · by {article.author}</>}
              </p>
            )}
          </header>

          {!article.link ? (
            <>
              <p>{article.summary}</p>
              <p className="muted small">Example article written for this prototype. Not real news.</p>
            </>
          ) : (
            <>
              {/* Only a short excerpt is saved. The full article is at the publisher. */}
              <ArticleBody excerpt={article.excerpt ?? ""} aiSummary={article.aiSummary} />
              <p>
                <a href={article.link} target="_blank" rel="noopener noreferrer">
                  Read full article on {article.source}
                </a>
              </p>
            </>
          )}
        </article>
      </div>

      <div className="article-side">
        <aside className="why-panel" aria-labelledby="why-heading">
          <h2 id="why-heading">Why you&apos;re seeing this</h2>
          {article.simulated && <span className="tag tag-warn">simulated: example data, not LLM output</span>}
          <Reason text={article.reason ?? ""} />
          <NotRelevantButton articleId={article.id} />
        </aside>

        {related.length > 0 && (
          <section aria-labelledby="related-heading">
            <h2 id="related-heading">Related news</h2>
            <ul className="related-list">
              {related.map((item) => (
                <li key={item.id}>
                  <Link href={`/news/${item.id}`} className="news-item">
                    <span className="muted small">
                      {item.source} · {item.timeAgo}
                    </span>
                    <span className="news-title">{item.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
