"use client";

// SIMULATED: the flag is kept only in this component's state. It is not saved or
// sent anywhere yet, and it resets when the page is reloaded.

import { useState } from "react";

export default function NotRelevantButton() {
  const [flagged, setFlagged] = useState(false);

  return (
    <div className="flag-row">
      <button className="button" aria-pressed={flagged} onClick={() => setFlagged(!flagged)}>
        {flagged ? "Undo flag" : "Not relevant"}
      </button>
      <span className="muted small" role="status">
        {flagged
          ? "Flagged as not relevant. Simulated: the flag is not saved or sent for review yet."
          : "Tell us if this article does not belong on this page."}
      </span>
    </div>
  );
}
