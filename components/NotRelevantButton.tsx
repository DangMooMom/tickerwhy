"use client";

// "Not relevant" flag. The flag is saved in this browser only (localStorage),
// so it is still there after a reload. Pressing the button again removes it.
// Nothing is sent to the server, and nobody reviews the flags yet (planned).

import { useEffect, useRef, useState } from "react";

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
  const [showModal, setShowModal] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Read the saved flag after the page loads. The server cannot see localStorage,
  // so the first render always shows "not flagged".
  useEffect(() => {
    setFlagged(readFlags().includes(articleId));
  }, [articleId]);

  // Close the feedback dialog with Escape.
  useEffect(() => {
    if (!showModal) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showModal]);

  function closeModal() {
    setShowModal(false);
    buttonRef.current?.focus(); // give focus back to the button that opened the dialog
  }

  function toggle() {
    const next = !flagged;
    const others = readFlags().filter((id) => id !== articleId);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next ? [...others, articleId] : others));
      setSaveFailed(false);
      // Only show the feedback dialog when the flag was really saved.
      if (next) setShowModal(true);
    } catch {
      setSaveFailed(true);
    }
    setFlagged(next);
  }

  let message = "Tell us if this article does not belong on this page.";
  if (flagged) message = "You flagged this article as not relevant. Saved in this browser only.";
  if (saveFailed) message = "Could not save in this browser, so this flag will be lost on reload.";

  return (
    <>
      <p className="flag-row">
        <span role="status">{message}</span>{" "}
        <button ref={buttonRef} className="link-button" aria-pressed={flagged} onClick={toggle}>
          {flagged ? "Undo" : "Not relevant"}
        </button>
      </p>

      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="feedback-title">Feedback received</h2>
            <p>
              Thank you. Your feedback was received and is waiting for review by a product manager.
            </p>
            <p>
              <span className="tag tag-warn">simulated</span>{" "}
              <span className="small muted">
                Nothing is sent to a server and no one reviews flags yet.
              </span>
            </p>
            <div className="modal-actions">
              <button className="button" autoFocus onClick={closeModal}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
