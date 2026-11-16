// Small label that shows the LLM's relevance level in words (not colour alone).

import { RELEVANCE_LABELS, type RelevanceLevel } from "@/lib/relevance";

export default function RelevanceBadge({ level }: { level: RelevanceLevel }) {
  return <span className={`tag badge-${level}`}>{RELEVANCE_LABELS[level]}</span>;
}
