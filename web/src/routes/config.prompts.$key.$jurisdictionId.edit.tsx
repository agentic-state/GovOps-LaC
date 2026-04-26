import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { toast } from "sonner";

import { PromptEditor } from "@/components/govops/PromptEditor";
import { PromptPreview } from "@/components/govops/PromptPreview";
import { FixtureTestPanel } from "@/components/govops/FixtureTestPanel";
import { ValueDiff } from "@/components/govops/ValueDiff";
import { ProvenanceRibbon } from "@/components/govops/ProvenanceRibbon";
import { RouteError } from "@/components/govops/RouteError";
import { resolveCurrentConfigValue, createConfigValue } from "@/lib/api";
import { getCurrentUser } from "@/lib/currentUser";
import {
  validatePromptKey,
  validatePromptText,
  PROMPT_TEXT_MAX,
  PROMPT_TEXT_MIN,
} from "@/lib/validators";
import type { ConfigValue } from "@/lib/types";

export const Route = createFileRoute("/config/prompts/$key/$jurisdictionId/edit")({
  head: ({ params }) => ({
    meta: [{ title: `Edit prompt — ${params.key} — GovOps` }],
  }),
  loader: async ({ params }): Promise<ConfigValue | null> => {
    const jurisdictionForApi = params.jurisdictionId === "global" ? null : params.jurisdictionId;
    return resolveCurrentConfigValue(params.key, jurisdictionForApi, new Date().toISOString());
  },
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  component: PromptEditPage,
});

const AUTOSAVE_INTERVAL_MS = 5_000;

import { StorageKeys } from "@/lib/storageKeys";
const draftStorageKey = StorageKeys.promptDraft;

type Tab = "edit" | "preview" | "test";

function PromptEditPage() {
  const intl = useIntl();
  const { key, jurisdictionId } = Route.useParams();
  const nav = useNavigate();
  const jurisdictionForApi = jurisdictionId === "global" ? null : jurisdictionId;

  // ── Layout: ≥1024 → three-column grid, < 1024 → tabs.
  const [isWide, setIsWide] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsWide(m.matches);
    apply();
    m.addEventListener("change", apply);
    return () => m.removeEventListener("change", apply);
  }, []);
  const [tab, setTab] = useState<Tab>("edit");

  // ── Current-effective version (drives "Reset" + diff overlay).
  // Loaded by the route loader so SSR/back-nav have it available immediately.
  const current: ConfigValue | null = Route.useLoaderData();
  const currentLoading = false;

  // ── Editor value: hydrate from localStorage, fall back to current text.
  const [value, setValue] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (currentLoading || hydrated) return;
    try {
      const saved = window.localStorage.getItem(draftStorageKey(key, jurisdictionId));
      if (saved !== null) {
        setValue(saved);
      } else {
        setValue(String(current?.value ?? ""));
      }
    } catch {
      setValue(String(current?.value ?? ""));
    }
    setHydrated(true);
  }, [currentLoading, hydrated, key, jurisdictionId, current]);

  // ── Autosave every 5s + announce.
  const [autosavedAt, setAutosavedAt] = useState<number | null>(null);
  const lastSavedValue = useRef<string>("");
  useEffect(() => {
    if (!hydrated) return;
    const t = setInterval(() => {
      if (value === lastSavedValue.current) return;
      try {
        window.localStorage.setItem(draftStorageKey(key, jurisdictionId), value);
        lastSavedValue.current = value;
        setAutosavedAt(Date.now());
      } catch {
        /* ignore */
      }
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [value, hydrated, key, jurisdictionId]);

  // ── Diff toggle.
  const [showDiff, setShowDiff] = useState(false);

  const draftAsConfigValue: ConfigValue | null = useMemo(() => {
    if (!current) return null;
    return {
      ...current,
      id: "__draft__",
      value,
      status: "draft",
    };
  }, [current, value]);

  // ── Reset to current-effective.
  const onReset = useCallback(() => {
    if (!current) return;
    setValue(String(current.value ?? ""));
  }, [current]);

  // ── Inline validation (govops-008).
  const keyError = useMemo(() => validatePromptKey(key), [key]);
  const textError = useMemo(() => validatePromptText(value), [value]);
  const blocked = Boolean(keyError) || Boolean(textError);
  const blockedReason = keyError
    ? intl.formatMessage({ id: keyError })
    : textError
      ? intl.formatMessage({ id: textError }, { min: PROMPT_TEXT_MIN, max: PROMPT_TEXT_MAX })
      : undefined;

  // ── Submit (save as draft).
  const [submitting, setSubmitting] = useState(false);
  const onSubmit = async () => {
    if (!current) return;
    if (blocked) {
      if (blockedReason) toast.error(blockedReason);
      return;
    }
    setSubmitting(true);
    try {
      const cv = await createConfigValue({
        domain: "prompt",
        key,
        jurisdiction_id: jurisdictionForApi,
        value,
        value_type: "prompt",
        effective_from: new Date().toISOString(),
        effective_to: null,
        citation: current.citation,
        author: getCurrentUser(),
        rationale: "Prompt revision drafted via /config/prompts editor (govops-008).",
        supersedes: current.id,
        language: current.language,
      });
      try {
        window.localStorage.removeItem(draftStorageKey(key, jurisdictionId));
      } catch {
        /* ignore */
      }
      toast.success(intl.formatMessage({ id: "draft.success" }));
      nav({ to: "/config/approvals/$id", params: { id: cv.id } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const editorPane = (
    <PromptEditor
      value={value}
      onChange={setValue}
      ariaLabel={intl.formatMessage({ id: "prompt.editor.aria" })}
    />
  );
  const previewPane = (
    <PromptPreview
      value={value}
      ariaLabel={intl.formatMessage({ id: "prompt.editor.col.preview" })}
    />
  );
  const testPane = (
    <FixtureTestPanel
      promptKey={key}
      promptText={value}
      disabled={blocked}
      disabledReason={blockedReason}
    />
  );

  return (
    <section aria-labelledby="edit-heading" className="space-y-6">
      <header className="flex items-stretch">
        <ProvenanceRibbon variant="hybrid" />
        <div className="flex-1 space-y-2">
          <p
            className="text-xs uppercase tracking-[0.2em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            prompt editor · spec govops-008
          </p>
          <h1
            id="edit-heading"
            className="text-2xl tracking-tight text-foreground sm:text-3xl"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            <FormattedMessage id="prompt.editor.heading" values={{ key }} />
          </h1>
          <code
            className="block text-xs text-foreground-muted"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {key} · {jurisdictionId}
          </code>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onReset}
          disabled={!current}
          className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium text-foreground hover:bg-surface-sunken disabled:opacity-50"
        >
          {intl.formatMessage({ id: "prompt.editor.reset" })}
        </button>
        <button
          type="button"
          onClick={() => setShowDiff((v) => !v)}
          disabled={!current}
          aria-pressed={showDiff}
          className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium text-foreground hover:bg-surface-sunken disabled:opacity-50"
        >
          {intl.formatMessage({
            id: showDiff ? "prompt.editor.hide_diff" : "prompt.editor.show_diff",
          })}
        </button>

        <span
          className="ms-auto text-[11px] text-foreground-subtle"
          style={{ fontFamily: "var(--font-mono)" }}
          aria-live="polite"
        >
          <FormattedMessage id="prompt.editor.character_count" values={{ count: value.length }} />
          {autosavedAt && (
            <>
              {" · "}
              <FormattedMessage
                id="prompt.editor.autosave_status"
                values={{
                  time: intl.formatRelativeTime(
                    Math.round((autosavedAt - Date.now()) / 1000),
                    "second",
                    { numeric: "auto" },
                  ),
                }}
              />
            </>
          )}
        </span>
      </div>

      {/* Inline validation errors (govops-008) */}
      {(keyError || textError) && (
        <div
          role="alert"
          aria-live="polite"
          className="space-y-1 rounded-md border p-3 text-xs"
          style={{
            borderColor: "var(--verdict-rejected)",
            backgroundColor: "color-mix(in oklch, var(--verdict-rejected) 6%, transparent)",
            color: "var(--verdict-rejected)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {keyError && (
            <p>
              <span className="font-semibold">key:</span> {intl.formatMessage({ id: keyError })}
            </p>
          )}
          {textError && (
            <p>
              <span className="font-semibold">text:</span>{" "}
              {intl.formatMessage(
                { id: textError },
                { min: PROMPT_TEXT_MIN, max: PROMPT_TEXT_MAX },
              )}
            </p>
          )}
        </div>
      )}

      {/* Diff overlay */}
      {showDiff && current && draftAsConfigValue && (
        <section
          aria-labelledby="diff-overlay-heading"
          className="rounded-md border p-4"
          style={{ borderColor: "var(--lavender-400)", backgroundColor: "var(--surface)" }}
        >
          <h2
            id="diff-overlay-heading"
            className="mb-3 text-sm font-semibold text-foreground"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            <FormattedMessage id="approvals.diff.heading" />
          </h2>
          <ValueDiff from={current} to={draftAsConfigValue} />
        </section>
      )}

      {/* Tabs (narrow) or three-column grid (wide). */}
      {isWide ? (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "minmax(0, 35fr) minmax(0, 35fr) minmax(0, 30fr)",
            minHeight: "60vh",
          }}
        >
          <div className="min-h-[60vh]">{editorPane}</div>
          <div className="min-h-[60vh]">{previewPane}</div>
          <div className="min-h-[60vh]">{testPane}</div>
        </div>
      ) : (
        <div>
          <div
            role="tablist"
            aria-label="Editor panes"
            className="flex gap-1 border-b border-border"
          >
            {(["edit", "preview", "test"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                type="button"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`h-9 rounded-t-md border-x border-t px-3 text-sm transition-colors ${
                  tab === t
                    ? "border-border bg-surface text-foreground"
                    : "border-transparent text-foreground-muted hover:text-foreground"
                }`}
              >
                {intl.formatMessage({ id: `prompt.editor.col.${t}` })}
              </button>
            ))}
          </div>
          <div className="mt-3 min-h-[60vh]">
            {tab === "edit" && editorPane}
            {tab === "preview" && previewPane}
            {tab === "test" && testPane}
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        <Link
          to="/config/prompts"
          className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground hover:bg-surface-sunken"
        >
          {intl.formatMessage({ id: "prompt.editor.discard" })}
        </Link>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || !current || blocked}
          aria-disabled={blocked || undefined}
          title={blocked ? blockedReason : undefined}
          className="inline-flex h-9 items-center rounded-md px-4 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "var(--civic-gold-600)" }}
        >
          {submitting
            ? intl.formatMessage({ id: "draft.submit.submitting" })
            : intl.formatMessage({ id: "prompt.editor.save_draft" })}
        </button>
      </div>
    </section>
  );
}
