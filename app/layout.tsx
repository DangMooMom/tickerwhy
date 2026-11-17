import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TickerWhy",
  description: "Apple (AAPL) news with a short note on why each article was collected.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <span className="wordmark">TickerWhy</span>
        </header>

        <main className="center">{children}</main>
      </body>
    </html>
  );
}
