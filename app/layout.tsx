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

        <main className="center">{children}</main>

        <footer className="footer">
          Unofficial redesign concept, not affiliated with or endorsed by Google
        </footer>
      </body>
    </html>
  );
}
