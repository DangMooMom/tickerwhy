// The "AI Summary" and the excerpt under it.
//
// The summary is plain text after a bold "AI Summary" label, so the label and
// the text read as one block (the student's design). It has no links. It comes
// from data/cache/ (made once by an LLM); this component never calls the LLM.

import type { SummaryResult } from "@/lib/summary";

export default function ArticleBody({ excerpt, aiSummary }: { excerpt: string; aiSummary?: SummaryResult }) {
  return (
    <>
      {aiSummary && (
        <p className="ai-summary">
          <span className="ai-summary-label">AI Summary</span> {aiSummary.summary}
        </p>
      )}

      <div className="excerpt">
        {excerpt.split("\n\n").map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </>
  );
}
