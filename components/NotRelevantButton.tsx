"use client";

// "Not relevant" flag. The flag is saved in this browser only (localStorage),
// so it is still there after a reload. Pressing the button again removes it.
// Nothing is sent to the server, and nobody reviews the flags yet (planned).

import { useEffect, useState } from "react";

const STORAGE_KEY = "tickerwhy:not-relevant"; // holds a JSON list of article ids

function readFlags(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return []; // storage is blocked or the saved value is broken
  }
}

export default function NotRelevantButton({ articleId }: { articleId: string }) {
  const [flagged, setFlagged] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // Read the saved flag after the page loads. The server cannot see localStorage,
  // so the first render always shows "not flagged".
  useEffect(() => {
    setFlagged(readFlags().includes(articleId));
  }, [articleId]);

  function toggle() {
    const next = !flagged;
    const others = readFlags().filter((id) => id !== articleId);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next ? [...others, articleId] : others));
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
    setFlagged(next);
  }

  let message = "Tell us if this article does not belong on this page.";
  if (flagged) message = "Flagged as not relevant. Saved in this browser only; it is not sent anywhere.";
  if (saveFailed) message = "Could not save in this browser, so this flag will be lost on reload.";

  return (
    <div className="flag-row">
      <button className="button" aria-pressed={flagged} onClick={toggle}>
        {flagged ? "Undo flag" : "Not relevant"}
      </button>
      <span className="muted small" role="status">
        {message}
      </span>
    </div>
  );
}
