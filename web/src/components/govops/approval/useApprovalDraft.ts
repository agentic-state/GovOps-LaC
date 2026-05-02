import { useEffect, useState } from "react";
import { StorageKeys } from "@/lib/storageKeys";

const COMMENT_KEY = StorageKeys.approvalComment;
const EXPANDED_KEY = StorageKeys.approvalPanelExpanded;
const HELP_KEY = StorageKeys.approvalShortcutsOpen;

/**
 * Persisted UI state for the approvals panel: comment draft (per cv id),
 * panel-expanded toggle, and help-legend visibility. SSR-safe — values
 * start at sensible defaults and hydrate from storage after mount.
 */
export function useApprovalDraft(cvId: string) {
  const [comment, setComment] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const c = window.localStorage.getItem(COMMENT_KEY(cvId));
      if (c) setComment(c);
      const e = window.localStorage.getItem(EXPANDED_KEY);
      if (e !== null) setExpanded(e === "1");
      const h = window.sessionStorage.getItem(HELP_KEY);
      if (h !== null) setShowHelp(h === "1");
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [cvId]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (comment) window.localStorage.setItem(COMMENT_KEY(cvId), comment);
      else window.localStorage.removeItem(COMMENT_KEY(cvId));
    } catch {
      /* ignore */
    }
  }, [comment, cvId, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(EXPANDED_KEY, expanded ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [expanded, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(HELP_KEY, showHelp ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [showHelp, hydrated]);

  const clearComment = () => {
    try {
      window.localStorage.removeItem(COMMENT_KEY(cvId));
    } catch {
      /* ignore */
    }
  };

  return {
    comment,
    setComment,
    expanded,
    setExpanded,
    showHelp,
    setShowHelp,
    clearComment,
  };
}
