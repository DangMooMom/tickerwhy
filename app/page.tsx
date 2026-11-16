// Stock page: header, price + chart, news list.
// This is a Server Component, so the price fetch below runs on the server.

import Link from "next/link";
import RelevanceBadge from "@/components/RelevanceBadge";
import StockPanel from "@/components/StockPanel";
import { getNews } from "@/lib/news";
import { getStock } from "@/lib/stock";

// Fetch the price on every request instead of once at build time.
export const dynamic = "force-dynamic";

export default async function StockPage() {
  const stock = await getStock("1D");
  const news = getNews();

  return (
    <>
      <p className="muted small">AAPL:NASDAQ</p>
      <h1>Apple</h1>

      {stock ? (
        <StockPanel initial={stock} />
      ) : (
        <p className="card" role="alert">
          Price data is unavailable: the live fetch failed and no saved data was found.
        </p>
      )}

      <section aria-labelledby="news-heading">
        <div className="section-head">
          <h2 id="news-heading">News</h2>
          {news.snapshotDate ? (
            <>
              <span className="tag">Google News RSS snapshot: {news.snapshotDate}</span>
              {news.cache && <span className="tag">Relevance: AI-generated (Groq, cached)</span>}
            </>
          ) : (
            <span className="tag tag-warn">simulated: example articles</span>
          )}
        </div>
        <ul className="news-list">
          {news.items.map((article) => (
            <li key={article.id}>
              {/* Articles the AI judged "unrelated" are dimmed, not hidden: the user decides. */}
              <Link
                href={`/news/${article.id}`}
                className={article.analysis?.relevance === "unrelated" ? "news-item news-item-dim" : "news-item"}
              >
                <span className="news-meta muted small">
                  {article.source} · {article.timeAgo}
                  {article.analysis && <RelevanceBadge level={article.analysis.relevance} />}
                </span>
                <span className="news-title">{article.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
