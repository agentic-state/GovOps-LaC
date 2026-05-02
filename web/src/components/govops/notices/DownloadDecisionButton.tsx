import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchDecisionNotice } from "@/lib/api";
import type { ScreenRequest } from "@/lib/types";

/** Hard-cap on how long we'll wait for the backend before bailing. */
const NOTICE_TIMEOUT_MS = 30_000;

export type DownloadDecisionButtonProps =
  | {
      mode: "case";
      caseId: string;
      language?: string;
      label?: string;
      variant?: "default" | "outline" | "secondary";
    }
  | {
      mode: "screen";
      screenRequest: ScreenRequest;
      language?: string;
      label?: string;
      variant?: "default" | "outline" | "secondary";
    };

/**
 * Passive consumer of the backend HTML-rendering endpoints (Phase 10C / ADR-012).
 * Opens the rendered notice in a new tab so the citizen can use the browser's
 * native "Save as PDF" / "Print" affordances. No persistence of the HTML or the
 * X-Notice-Sha256 header — the artefact is intentionally ephemeral.
 */
export function DownloadDecisionButton(props: DownloadDecisionButtonProps) {
  const intl = useIntl();
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Track object URLs so we can revoke them on unmount.
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      for (const u of urlsRef.current) {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  const language = props.language ?? "en";
  const variant = props.variant ?? "outline";
  const label = props.label ?? intl.formatMessage({ id: "screen.download.cta" });
  const tooltip = intl.formatMessage({ id: "screen.download.tooltip" });

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = setTimeout(() => ctrl.abort(), NOTICE_TIMEOUT_MS);
    try {
      const result =
        props.mode === "case"
          ? await fetchDecisionNotice({
              mode: "case",
              caseId: props.caseId,
              language,
              signal: ctrl.signal,
            })
          : await fetchDecisionNotice({
              mode: "screen",
              screenRequest: props.screenRequest,
              language,
              signal: ctrl.signal,
            });

      // Render via Blob URL — the new tab gets a real origin and the user can
      // use the browser's native Save / Print affordances. Never `document.write`.
      const blob = new Blob([result.html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      urlsRef.current.push(url);
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (!win) {
        toast.error(intl.formatMessage({ id: "screen.download.popup_blocked" }));
        return;
      }
      // Allow the new tab some time to fetch the blob before we revoke it.
      setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
          urlsRef.current = urlsRef.current.filter((u) => u !== url);
        } catch {
          /* noop */
        }
      }, 60_000);

      // Surface the integrity hash so reviewers can paste it into the audit log.
      if (result.sha256) {
        toast.success(
          intl.formatMessage(
            { id: "screen.download.integrity_ok" },
            { sha: result.sha256.slice(0, 12) },
          ),
          {
            description: result.sha256,
            action: {
              label: intl.formatMessage({ id: "screen.download.copy_sha" }),
              onClick: () => {
                void navigator.clipboard?.writeText(result.sha256!);
              },
            },
          },
        );
      } else if (result.preview) {
        toast.message(intl.formatMessage({ id: "screen.download.preview_notice" }));
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        toast.error(intl.formatMessage({ id: "screen.download.timeout" }));
      } else {
        toast.error(intl.formatMessage({ id: "screen.download.error" }));
      }
    } finally {
      clearTimeout(timer);
      abortRef.current = null;
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      onClick={handleClick}
      disabled={busy}
      title={tooltip}
      aria-label={label}
      className={busy ? "motion-safe:animate-pulse" : undefined}
    >
      <Download className="size-4" aria-hidden />
      {busy ? intl.formatMessage({ id: "screen.download.in_progress" }) : label}
    </Button>
  );
}
