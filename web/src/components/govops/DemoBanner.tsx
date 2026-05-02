/**
 * v2.1 hosted-demo banner — sticky at the top of every page when the build
 * was produced with `VITE_DEMO_MODE=1` (set in the Dockerfile).
 *
 * Renders nothing on local-dev builds (env unset). One-line, dismissible per
 * session via sessionStorage so the banner doesn't waste vertical space on
 * every navigation. Copy is the same as the X-GovOps-Demo-Banner header so a
 * curl-only client and a browser see the same warning.
 */

import { useEffect, useState } from "react";

const DISMISS_KEY = "govops-demo-banner-dismissed";

export function DemoBanner() {
  // Resolved at build-time by Vite. When undefined or "0", the banner stays
  // hidden — local dev sees no chrome change.
  const isDemo = (import.meta.env.VITE_DEMO_MODE ?? "0") === "1";

  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (!isDemo) return;
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      // sessionStorage may be unavailable in private/SSR contexts; ignore.
    }
  }, [isDemo]);

  if (!isDemo || dismissed) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 9999,
        background: "#fff3cd",
        borderBottom: "1px solid #ffc107",
        color: "#664d03",
        padding: "0.55rem 1rem",
        fontSize: "0.82rem",
        lineHeight: 1.5,
        textAlign: "center",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <strong>Public demo on free tier</strong> — anything you do here is
      visible to other visitors and auto-expires after 7 days. Seeded data
      and the demo cases stay forever. First load may take ~30s if the
      demo was idle.{" "}
      <a
        href="https://github.com/agentic-state/GovOps-LaC"
        style={{ color: "#664d03", fontWeight: 600 }}
      >
        Source
      </a>{" "}
      ·{" "}
      <button
        type="button"
        onClick={dismiss}
        style={{
          background: "transparent",
          border: 0,
          color: "#664d03",
          cursor: "pointer",
          padding: 0,
          font: "inherit",
          textDecoration: "underline",
        }}
        aria-label="Dismiss demo banner for this session"
      >
        Dismiss
      </button>
    </div>
  );
}
