import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TickerWhy: news relevance concept",
  description:
    "Unofficial redesign concept of the Google Finance news section. Not affiliated with or endorsed by Google.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <span className="wordmark">Google Finance</span>
          <span className="tag tag-concept">Concept</span>
        </header>

        <div className="columns">
          <aside className="placeholder" aria-label="Lists panel (planned)">
            <span className="tag">planned</span>
            <p>Lists and watchlist panel</p>
          </aside>

          <main className="center">{children}</main>

          <aside className="placeholder" aria-label="Research panel (planned)">
            <span className="tag">planned</span>
            <p>Research panel</p>
          </aside>
        </div>

        <footer className="footer">
          Unofficial redesign concept, not affiliated with or endorsed by Google
        </footer>
      </body>
    </html>
  );
}
