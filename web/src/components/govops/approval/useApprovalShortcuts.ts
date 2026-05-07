import { useEffect } from "react";
import type { ApprovalAction } from "../ConfirmActionDialog";

export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

function modKey(e: KeyboardEvent): boolean {
  return isMac() ? e.metaKey : e.ctrlKey;
}

/**
 * Page-scoped keyboard shortcuts for the approvals action panel.
 * - Cmd/Ctrl + Enter           → approve
 * - Cmd/Ctrl + Shift + C       → request changes (requires valid comment)
 * - Cmd/Ctrl + Shift + R       → reject (requires valid comment)
 * - "?"                        → toggle help legend
 */
export function useApprovalShortcuts(opts: {
  enabled: boolean;
  commentOk: boolean;
  setPending: (a: ApprovalAction) => void;
  toggleHelp: () => void;
}) {
  const { enabled, commentOk, setPending, toggleHelp } = opts;
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "?" && !modKey(e) && !e.altKey) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        toggleHelp();
        return;
      }
      if (!modKey(e)) return;
      if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setPending("approve");
      } else if (e.key.toLowerCase() === "r" && e.shiftKey) {
        if (!commentOk) return;
        e.preventDefault();
        setPending("reject");
      } else if (e.key.toLowerCase() === "c" && e.shiftKey) {
        if (!commentOk) return;
        e.preventDefault();
        setPending("request");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, commentOk, setPending, toggleHelp]);
}
