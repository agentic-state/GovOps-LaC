/**
 * v2.1 hosted-demo "warming up" splash.
 *
 * On the free-tier HF Spaces deploy, the container sleeps after 48h idle
 * and takes ~30s to wake on the first request. This splash overlays the
 * page when the API health-check hasn't responded within 2s and stays up
 * until /api/health returns 200 (or 30s elapses, whichever is first).
 *
 * Activates only when `VITE_DEMO_MODE=1` (build-time env, set in
 * Dockerfile). Local dev sees no overlay.
 */

import { useEffect, useState } from "react";

type Phase = "checking" | "ready" | "timeout";

const HEALTH_PATH = "/api/health";
const SHOW_AFTER_MS = 2_000; // hide initially; appear if API is slow
const HARD_TIMEOUT_MS = 35_000; // give up after 35s — show "may be down"

export function WarmingSplash() {
  const isDemo = (import.meta.env.VITE_DEMO_MODE ?? "0") === "1";

  const [phase, setPhase] = useState<Phase>("checking");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isDemo) {
      setPhase("ready");
      return;
    }

    const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
    const url = `${baseUrl}${HEALTH_PATH}`;
    let cancelled = false;
    const startedAt = Date.now();

    const showTimer = window.setTimeout(() => {
      if (!cancelled) setVisible(true);
    }, SHOW_AFTER_MS);

    const hardTimer = window.setTimeout(() => {
      if (!cancelled) setPhase("timeout");
    }, HARD_TIMEOUT_MS);

    const poll = async () => {
      while (!cancelled && Date.now() - startedAt < HARD_TIMEOUT_MS) {
        try {
          const r = await fetch(url, { method: "GET" });
          if (r.ok) {
            if (!cancelled) {
              setPhase("ready");
              setVisible(false);
            }
            return;
          }
        } catch {
          // Network error — backend is still warming. Wait a beat and retry.
        }
        await new Promise((res) => setTimeout(res, 1500));
      }
    };
    void poll();

    return () => {
      cancelled = true;
      window.clearTimeout(showTimer);
      window.clearTimeout(hardTimer);
    };
  }, [isDemo]);

  if (!isDemo || phase === "ready" || !visible) return null;

  const isTimeout = phase === "timeout";
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(252,251,247,0.97)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#1d1d24",
      }}
    >
      <div
        style={{
          maxWidth: "32rem",
          textAlign: "center",
          background: "#f8f6ef",
          border: "1px solid #d5d5d8",
          borderRadius: "12px",
          padding: "2rem",
          boxShadow: "0 12px 32px rgba(29,29,36,0.08)",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "3px solid #b89441",
            borderTopColor: "transparent",
            margin: "0 auto 1rem",
            animation: isTimeout ? "none" : "govops-spin 0.9s linear infinite",
          }}
        />
        <h1
          style={{
            fontFamily: "'Source Serif 4', Georgia, serif",
            fontSize: "1.5rem",
            fontWeight: 700,
            margin: 0,
            marginBottom: "0.75rem",
          }}
        >
          {isTimeout ? "Demo may be down" : "Warming up the demo"}
        </h1>
        <p
          style={{
            fontSize: "0.95rem",
            lineHeight: 1.55,
            color: "#3a3a42",
            margin: 0,
          }}
        >
          {isTimeout ? (
            <>
              The free-tier hosted demo isn&apos;t responding. It may be sleeping
              or temporarily over its API quota. You can{" "}
              <a
                href="https://github.com/agentic-state/GovOps-LaC"
                style={{ color: "#4d3989" }}
              >
                run it locally
              </a>{" "}
              or check back in a few minutes.
            </>
          ) : (
            <>
              The free-tier container sleeps after a couple of days idle.
              First request takes ~30s to wake it. Once it&apos;s up,
              everything is instant.
            </>
          )}
        </p>
      </div>
      <style>{`@keyframes govops-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
