import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import {
  createAuthoringDraft,
  scaffoldJurisdiction,
} from "@/lib/api";
import type { AuthoringDraft } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { RouteError } from "@/components/govops/RouteError";

export const Route = createFileRoute("/admin/onboard")({
  head: () => ({
    meta: [
      { title: "Onboard new jurisdiction — GovOps" },
      {
        name: "description",
        content:
          "Multi-step wizard for adding a jurisdiction to GovOps via the v3.1 authoring substrate.",
      },
    ],
  }),
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  component: OnboardWizard,
});

type WizardStep = "identity" | "review" | "submitted";

interface ScaffoldedDraft {
  target_path: string;
  content: Record<string, unknown>;
}

interface ScaffoldState {
  jurisdiction: ScaffoldedDraft;
  programs: Array<{
    program_id: string;
    target_path: string;
    content: Record<string, unknown>;
  }>;
}

/**
 * v3.1.x L8 Onboard wizard.
 *
 * Three steps:
 *   1. Identity   -- country code, name (English), shapes to scaffold
 *   2. Review     -- show the scaffolded YAML; let the operator edit
 *                    metadata fields inline before submitting
 *   3. Submitted  -- drafts are PENDING in the approval queue; jump to
 *                    /admin/drafts to approve + commit
 *
 * The wizard does NOT write to disk. It submits drafts through
 * /api/authoring/drafts (ADR-022). An approver later visits
 * /admin/drafts to approve + commit; that's when reload_registry()
 * fires and the new jurisdiction appears in the dropdown.
 */
function OnboardWizard() {
  const intl = useIntl();
  const navigate = useNavigate({ from: "/admin/onboard" });
  const [step, setStep] = useState<WizardStep>("identity");

  // Step 1 state
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [includeOas, setIncludeOas] = useState(true);
  const [includeEi, setIncludeEi] = useState(false);
  const [scaffolding, setScaffolding] = useState(false);
  const [scaffold, setScaffold] = useState<ScaffoldState | null>(null);

  // Step 2 state
  const [author, setAuthor] = useState("");
  const [rationale, setRationale] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedDrafts, setSubmittedDrafts] = useState<AuthoringDraft[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const codeOk = /^[a-z]{2,6}$/.test(code);
  const shapes: ("oas" | "ei")[] = [];
  if (includeOas) shapes.push("oas");
  if (includeEi) shapes.push("ei");
  const canScaffold = codeOk && displayName.trim().length > 0 && shapes.length > 0;

  async function handleScaffold() {
    setError(null);
    setScaffolding(true);
    try {
      const result = await scaffoldJurisdiction({ code, shapes });
      // Patch the display name into the scaffolded content before showing it.
      const patched: ScaffoldState = {
        jurisdiction: {
          target_path: result.jurisdiction.target_path,
          content: patchDisplayName(result.jurisdiction.content, displayName),
        },
        programs: result.programs,
      };
      setScaffold(patched);
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scaffolding failed.");
    } finally {
      setScaffolding(false);
    }
  }

  async function handleSubmit() {
    if (!scaffold || !author.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const created: AuthoringDraft[] = [];
      const jd = await createAuthoringDraft({
        type: "jurisdiction",
        target_path: scaffold.jurisdiction.target_path,
        content: scaffold.jurisdiction.content,
        author: author.trim(),
        rationale: rationale.trim() || undefined,
      });
      created.push(jd);
      for (const p of scaffold.programs) {
        const pd = await createAuthoringDraft({
          type: "program",
          target_path: p.target_path,
          content: p.content,
          author: author.trim(),
          rationale: rationale.trim() || undefined,
        });
        created.push(pd);
      }
      setSubmittedDrafts(created);
      setStep("submitted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1
          className="text-3xl tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {intl.formatMessage({ id: "onboard.title" })}
        </h1>
        <p className="max-w-3xl text-sm text-foreground-muted">
          {intl.formatMessage({ id: "onboard.lede" })}
        </p>
      </header>

      <StepIndicator current={step} />

      {error && (
        <div
          role="alert"
          className="rounded-md border border-border bg-surface p-3 text-sm"
          style={{ color: "var(--verdict-rejected)" }}
        >
          {error}
        </div>
      )}

      {step === "identity" && (
        <form
          className="space-y-4 rounded-md border border-border bg-surface p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (canScaffold) void handleScaffold();
          }}
        >
          <Field label={intl.formatMessage({ id: "onboard.code.label" })}>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toLowerCase())}
              placeholder="pl"
              maxLength={6}
              required
              data-testid="onboard-code"
              aria-describedby="onboard-code-hint"
              className="w-32 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span id="onboard-code-hint" className="ms-3 text-xs text-foreground-muted">
              {intl.formatMessage({ id: "onboard.code.hint" })}
            </span>
          </Field>

          <Field label={intl.formatMessage({ id: "onboard.name.label" })}>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Poland"
              required
              data-testid="onboard-name"
              className="w-full max-w-md rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Field>

          <fieldset className="space-y-2">
            <legend className="block text-xs uppercase tracking-wider text-foreground-muted">
              {intl.formatMessage({ id: "onboard.shapes.label" })}
            </legend>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={includeOas}
                onChange={(e) => setIncludeOas(e.target.checked)}
                data-testid="onboard-shape-oas"
              />
              {intl.formatMessage({ id: "onboard.shapes.oas" })}
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={includeEi}
                onChange={(e) => setIncludeEi(e.target.checked)}
                data-testid="onboard-shape-ei"
              />
              {intl.formatMessage({ id: "onboard.shapes.ei" })}
            </label>
          </fieldset>

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              variant="authority"
              disabled={!canScaffold || scaffolding}
              data-testid="onboard-scaffold"
            >
              {intl.formatMessage({
                id: scaffolding ? "onboard.scaffold.loading" : "onboard.scaffold.button",
              })}
            </Button>
            <Link
              to="/admin"
              className="text-sm text-foreground-muted hover:text-foreground"
            >
              {intl.formatMessage({ id: "onboard.cancel" })}
            </Link>
          </div>
        </form>
      )}

      {step === "review" && scaffold && (
        <section className="space-y-5">
          <div className="rounded-md border border-border bg-surface-raised p-4 text-sm">
            <p className="text-foreground">
              {intl.formatMessage(
                { id: "onboard.review.summary" },
                {
                  code: code.toUpperCase(),
                  name: displayName,
                  programs: scaffold.programs.map((p) => p.program_id).join(", "),
                },
              )}
            </p>
          </div>

          <ScaffoldedPreview
            heading={intl.formatMessage({ id: "onboard.review.jurisdiction.heading" })}
            path={scaffold.jurisdiction.target_path}
            content={scaffold.jurisdiction.content}
          />
          {scaffold.programs.map((p) => (
            <ScaffoldedPreview
              key={p.program_id}
              heading={intl.formatMessage(
                { id: "onboard.review.program.heading" },
                { id: p.program_id },
              )}
              path={p.target_path}
              content={p.content}
            />
          ))}

          <form
            className="space-y-3 rounded-md border border-border bg-surface p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (author.trim() && !submitting) void handleSubmit();
            }}
          >
            <Field label={intl.formatMessage({ id: "onboard.author.label" })}>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                required
                data-testid="onboard-author"
                className="w-full max-w-md rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </Field>
            <Field label={intl.formatMessage({ id: "onboard.rationale.label" })}>
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                rows={3}
                data-testid="onboard-rationale"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </Field>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("identity")}
                disabled={submitting}
              >
                {intl.formatMessage({ id: "onboard.back" })}
              </Button>
              <Button
                type="submit"
                variant="authority"
                disabled={!author.trim() || submitting}
                data-testid="onboard-submit"
              >
                {intl.formatMessage({
                  id: submitting ? "onboard.submit.loading" : "onboard.submit.button",
                })}
              </Button>
            </div>
          </form>
        </section>
      )}

      {step === "submitted" && submittedDrafts && (
        <section className="space-y-4 rounded-md border border-border bg-surface p-5">
          <h2
            className="text-xl text-foreground"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {intl.formatMessage({ id: "onboard.submitted.heading" })}
          </h2>
          <p className="text-sm text-foreground-muted">
            {intl.formatMessage(
              { id: "onboard.submitted.summary" },
              { n: submittedDrafts.length },
            )}
          </p>
          <ul role="list" className="space-y-2 text-sm">
            {submittedDrafts.map((d) => (
              <li key={d.id} className="font-mono text-xs text-foreground-muted">
                {d.type} · {d.target_path} · {d.id}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="authority"
              onClick={() => navigate({ to: "/admin/drafts" })}
              data-testid="onboard-goto-queue"
            >
              {intl.formatMessage({ id: "onboard.submitted.cta" })}
            </Button>
            <Link
              to="/admin"
              className="text-sm text-foreground-muted hover:text-foreground"
            >
              {intl.formatMessage({ id: "onboard.submitted.back" })}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function StepIndicator({ current }: { current: WizardStep }) {
  const intl = useIntl();
  const steps: Array<{ id: WizardStep; label: string }> = [
    { id: "identity", label: intl.formatMessage({ id: "onboard.step.identity" }) },
    { id: "review", label: intl.formatMessage({ id: "onboard.step.review" }) },
    { id: "submitted", label: intl.formatMessage({ id: "onboard.step.submitted" }) },
  ];
  return (
    <ol role="list" className="flex flex-wrap items-center gap-3 text-xs text-foreground-muted">
      {steps.map((s, i) => {
        const active = s.id === current;
        return (
          <li key={s.id} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${
                active ? "border-foreground text-foreground" : "border-border text-foreground-muted"
              }`}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {i + 1}
            </span>
            <span className={active ? "text-foreground" : ""}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs uppercase tracking-wider text-foreground-muted">{label}</span>
      <span className="inline-flex w-full items-baseline">{children}</span>
    </label>
  );
}

function ScaffoldedPreview({
  heading,
  path,
  content,
}: {
  heading: string;
  path: string;
  content: Record<string, unknown>;
}) {
  return (
    <details className="rounded-md border border-border bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
        {heading}{" "}
        <span
          className="ms-2 text-xs text-foreground-muted"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {path}
        </span>
      </summary>
      <pre
        className="overflow-x-auto border-t border-border bg-surface-sunken px-4 py-3 text-xs text-foreground-muted"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {JSON.stringify(content, null, 2)}
      </pre>
    </details>
  );
}

/**
 * Patch the operator's display name into the scaffolded jurisdiction
 * metadata. The cli_init scaffold emits "TODO Jurisdiction Name (English)"
 * as the placeholder; we replace it with the value the operator typed
 * so the draft is sensible without forcing a second edit step.
 */
function patchDisplayName(
  content: Record<string, unknown>,
  name: string,
): Record<string, unknown> {
  const patched = JSON.parse(JSON.stringify(content)) as Record<string, unknown>;
  const jur = patched.jurisdiction as { name?: Record<string, string> } | undefined;
  if (jur && jur.name && typeof jur.name === "object") {
    jur.name = { ...jur.name, en: name };
  }
  return patched;
}

export { patchDisplayName };
