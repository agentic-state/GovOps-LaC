import { useId } from "react";
import { useIntl } from "react-intl";

import { DraftPreview } from "./DraftPreview";
import { SupersedesPanel } from "./SupersedesPanel";
import { DraftFormActions } from "./draft/DraftFormActions";
import { KeyAndJurisdictionFields } from "./draft/KeyAndJurisdictionFields";
import { ProvenanceFields } from "./draft/ProvenanceFields";
import { ValueAndDateFields } from "./draft/ValueAndDateFields";
import { useDraftFormState, type DraftInitial } from "./draft/useDraftFormState";
import type { ConfigValue, CreateConfigValueRequest } from "@/lib/types";

/**
 * Public form for drafting / superseding a ConfigValue. State and
 * validation live in `useDraftFormState`; this component composes the
 * field sub-components, the preview, and the action footer.
 *
 * Props are unchanged from the previous monolith — call sites need no
 * adjustment.
 */
export function DraftConfigForm({
  initial,
  prior,
  onSubmit,
  onSaveDraft,
  submitting,
  currentAuthor = "human:maintainer",
}: {
  initial: DraftInitial;
  prior: ConfigValue | null;
  onSubmit: (body: CreateConfigValueRequest) => Promise<void> | void;
  onSaveDraft?: (params: Record<string, string>) => void;
  submitting: boolean;
  currentAuthor?: string;
}) {
  const intl = useIntl();
  const headingId = useId();

  const state = useDraftFormState({
    initial,
    prior,
    onSubmit,
    onSaveDraft,
    currentAuthor,
  });

  const isAgent = currentAuthor.startsWith("agent:");
  const headingMsg = prior
    ? intl.formatMessage({ id: "draft.heading.supersede" }, { key: prior.key })
    : intl.formatMessage({ id: "draft.heading" });

  const errorCount = Object.keys(state.errors).length;

  return (
    <form
      onSubmit={state.handleSubmit}
      aria-labelledby={headingId}
      className="space-y-6"
      noValidate
    >
      <header className="space-y-2">
        <p
          className="text-xs uppercase tracking-[0.2em] text-foreground-subtle"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          spec govops-006
        </p>
        <h1
          id={headingId}
          className="text-xl tracking-tight text-foreground sm:text-2xl"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {headingMsg}
        </h1>
      </header>

      {prior && <SupersedesPanel prior={prior} />}

      {/* Screen-reader announcement for validation summary. */}
      <div role="status" aria-live="polite" className="sr-only">
        {errorCount > 0 ? `${errorCount} validation error${errorCount === 1 ? "" : "s"}` : ""}
      </div>

      <div className="grid grid-cols-1 gap-5 rounded-md border border-border bg-surface-raised p-5 sm:grid-cols-2">
        <KeyAndJurisdictionFields state={state} />
        <ValueAndDateFields state={state} />
        <ProvenanceFields state={state} />
      </div>

      {state.submitError && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-md border p-3 text-sm"
          style={{
            borderColor: "var(--verdict-rejected)",
            backgroundColor: "color-mix(in oklch, var(--verdict-rejected) 6%, transparent)",
            color: "var(--verdict-rejected)",
          }}
        >
          {state.submitError}
        </div>
      )}

      <DraftFormActions
        state={state}
        submitting={submitting}
        isAgent={isAgent}
        hasSaveDraft={!!onSaveDraft}
      />

      {/* Live timeline preview */}
      <section className="space-y-2 border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <h2
            className="text-xs uppercase tracking-[0.18em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {intl.formatMessage({ id: "draft.preview.title" })}
          </h2>
          <button
            type="button"
            onClick={() => state.setShowPreview(!state.showPreview)}
            aria-expanded={state.showPreview}
            className="text-xs text-foreground-muted underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {intl.formatMessage({
              id: state.showPreview ? "value.collapse" : "value.expand",
            })}
          </button>
        </div>
        {state.showPreview && (
          <DraftPreview
            draft={{
              key: state.key,
              jurisdiction: state.jurisdiction,
              domain: state.domain,
              valueType: state.valueType,
              value: state.value,
              effectiveFrom: state.effectiveFrom,
              citation: state.citation,
              rationale: state.rationale,
              language: state.language,
              author: currentAuthor,
            }}
            prior={prior}
          />
        )}
      </section>
    </form>
  );
}
