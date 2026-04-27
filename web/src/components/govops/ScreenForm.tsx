import { useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import type {
  ScreenLegalStatus,
  ScreenRequest,
  ScreenResidencyPeriod,
} from "@/lib/types";
import { ResidencyPeriodRows } from "./ResidencyPeriodRows";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  validateScreenForm,
  isValid as isErrorFree,
  type ScreenFormErrors,
} from "@/lib/screenValidation";

const MIN_DOB = "1900-01-01";
const TODAY = () => new Date().toISOString().slice(0, 10);
const SUMMARY_MAX = 5;

/**
 * Map an error key (e.g. "dob", "legal_status", "residency.2.start_date")
 * to the DOM id of the input that should receive focus when the user
 * clicks the validation-summary link.
 */
function errorKeyToFieldId(key: string): string {
  if (key === "dob") return "screen-dob";
  if (key === "legal_status") return "screen-legal-citizen"; // first radio
  if (key === "residency") return "screen-residency-add";
  const m = key.match(/^residency\.(\d+)\.(country|start_date|end_date)$/);
  if (m) return `screen-residency-${m[1]}-${m[2]}`;
  return "";
}

export interface ScreenFormState {
  date_of_birth: string;
  legal_status: ScreenLegalStatus | "";
  country_of_birth: string;
  residency_periods: ScreenResidencyPeriod[];
  evidence_dob: boolean;
  evidence_residency: boolean;
}

const EMPTY: ScreenFormState = {
  date_of_birth: "",
  legal_status: "",
  country_of_birth: "",
  residency_periods: [{ country: "", start_date: "", end_date: null }],
  evidence_dob: false,
  evidence_residency: false,
};

export function ScreenForm({
  jurisdictionId,
  loading,
  onSubmit,
  onChange,
}: {
  jurisdictionId: string;
  loading: boolean;
  onSubmit: (req: ScreenRequest) => void;
  onChange?: () => void;
}) {
  const intl = useIntl();
  const [state, setState] = useState<ScreenFormState>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const errors: ScreenFormErrors = useMemo(
    () =>
      validateScreenForm({
        date_of_birth: state.date_of_birth,
        legal_status: state.legal_status,
        residency_periods: state.residency_periods,
      }),
    [state],
  );
  const valid = isErrorFree(errors);

  /** Show errors only after the user attempts submit, to avoid noisy first paint. */
  const showError = (key: string) => (submitted ? errors[key] : undefined);

  const patch = (p: Partial<ScreenFormState>) => {
    setState((s) => ({ ...s, ...p }));
    onChange?.();
  };

  const resetAll = () => {
    setState(EMPTY);
    setSubmitted(false);
  };

  /** Click handler for the Reset button — opens confirm dialog when there
   * is anything worth losing; resets immediately on an empty form. */
  const onResetClicked = () => {
    const dirty =
      state.date_of_birth !== "" ||
      state.legal_status !== "" ||
      state.country_of_birth !== "" ||
      state.evidence_dob ||
      state.evidence_residency ||
      state.residency_periods.some(
        (p) => p.country !== "" || p.start_date !== "" || p.end_date !== null,
      );
    if (dirty) setResetOpen(true);
    else resetAll();
  };

  const focusFieldById = (id: string) => {
    if (!id) return;
    const el = document.getElementById(id) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Defer focus so the scroll animation doesn't fight tab focus rings.
    requestAnimationFrame(() => el.focus({ preventScroll: true }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valid || loading) {
      // Surface the summary at the top of the form.
      requestAnimationFrame(() => {
        summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        summaryRef.current?.focus();
      });
      return;
    }
    onSubmit({
      jurisdiction_id: jurisdictionId,
      date_of_birth: state.date_of_birth,
      legal_status: state.legal_status as ScreenLegalStatus,
      country_of_birth: state.country_of_birth || undefined,
      residency_periods: state.residency_periods,
      evidence_present: {
        dob: state.evidence_dob,
        residency: state.evidence_residency,
      },
    });
  };

  const summaryEntries = useMemo(() => {
    if (!submitted) return [];
    return Object.entries(errors).slice(0, SUMMARY_MAX);
  }, [submitted, errors]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 screen-form" noValidate>
      {/* ── Validation summary (top of form) ──────────────────────────── */}
      {submitted && !valid && summaryEntries.length > 0 && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          aria-labelledby="screen-summary-heading"
          className="rounded border border-destructive/60 bg-destructive/5 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-destructive"
        >
          <p
            id="screen-summary-heading"
            className="font-medium text-destructive"
          >
            {intl.formatMessage(
              { id: "screen.errors.summary.heading" },
              { count: Object.keys(errors).length },
            )}
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            {summaryEntries.map(([key, msgId]) => {
              const targetId = errorKeyToFieldId(key);
              return (
                <li key={key}>
                  <a
                    href={`#${targetId}`}
                    onClick={(e) => {
                      e.preventDefault();
                      focusFieldById(targetId);
                    }}
                    className="text-destructive underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive rounded-sm"
                  >
                    {intl.formatMessage({ id: msgId })}
                  </a>
                </li>
              );
            })}
          </ul>
          {Object.keys(errors).length > SUMMARY_MAX && (
            <p className="mt-2 text-xs text-foreground-muted">
              {intl.formatMessage(
                { id: "screen.errors.summary.more" },
                { count: Object.keys(errors).length - SUMMARY_MAX },
              )}
            </p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="screen-dob" className="block text-sm font-medium">
          {intl.formatMessage({ id: "screen.form.dob.label" })}{" "}
          <span aria-hidden className="text-destructive">*</span>
        </label>
        <input
          id="screen-dob"
          type="date"
          required
          aria-required="true"
          min={MIN_DOB}
          max={TODAY()}
          value={state.date_of_birth}
          onChange={(e) => patch({ date_of_birth: e.target.value })}
          className={`mt-1 h-9 px-2 rounded border bg-surface text-foreground ${showError("dob") ? "border-destructive" : "border-border"}`}
          aria-invalid={showError("dob") ? true : undefined}
          aria-describedby={showError("dob") ? "err-screen-dob" : "screen-dob-help"}
        />
        <p id="screen-dob-help" className="text-xs text-foreground-muted mt-1">
          {intl.formatMessage({ id: "screen.form.dob.help" })}
        </p>
        {showError("dob") && (
          <p id="err-screen-dob" role="alert" className="mt-1 text-xs text-destructive">
            {intl.formatMessage({ id: showError("dob")! })}
          </p>
        )}
      </div>

      <fieldset>
        <legend className="text-sm font-medium">
          {intl.formatMessage({ id: "screen.form.legal_status.label" })}{" "}
          <span aria-hidden className="text-destructive">*</span>
        </legend>
        <div className="mt-2 grid gap-2" aria-describedby={showError("legal_status") ? "err-screen-legal" : undefined}>
          {(["citizen", "permanent_resident", "other"] as const).map((opt, i) => (
            <label key={opt} className="inline-flex items-center gap-2 text-sm">
              <input
                id={i === 0 ? "screen-legal-citizen" : `screen-legal-${opt}`}
                type="radio"
                name="legal_status"
                value={opt}
                checked={state.legal_status === opt}
                onChange={() => patch({ legal_status: opt })}
                aria-required="true"
                aria-invalid={showError("legal_status") ? true : undefined}
              />
              {intl.formatMessage({ id: `screen.form.legal_status.${opt}` })}
            </label>
          ))}
        </div>
        {showError("legal_status") && (
          <p id="err-screen-legal" role="alert" className="mt-1 text-xs text-destructive">
            {intl.formatMessage({ id: showError("legal_status")! })}
          </p>
        )}
      </fieldset>

      <div>
        <label htmlFor="screen-cob" className="block text-sm font-medium">
          {intl.formatMessage({ id: "screen.form.country_of_birth.label" })}
        </label>
        <input
          id="screen-cob"
          type="text"
          maxLength={80}
          value={state.country_of_birth}
          onChange={(e) => patch({ country_of_birth: e.target.value })}
          className="mt-1 h-9 px-2 rounded border border-border bg-surface text-foreground w-full max-w-xs"
        />
        <p className="text-xs text-foreground-muted mt-1">
          {intl.formatMessage({ id: "screen.form.country_of_birth.help" })}
        </p>
      </div>

      <ResidencyPeriodRows
        periods={state.residency_periods}
        onChange={(periods) => patch({ residency_periods: periods })}
        errors={submitted ? errors : undefined}
        fieldsetError={showError("residency")}
      />

      <fieldset>
        <legend className="text-sm font-medium">
          {intl.formatMessage({ id: "screen.form.evidence.heading" })}
        </legend>
        <div className="mt-2 grid gap-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.evidence_dob}
              onChange={(e) => patch({ evidence_dob: e.target.checked })}
            />
            {intl.formatMessage({ id: "screen.form.evidence.dob" })}
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.evidence_residency}
              onChange={(e) => patch({ evidence_residency: e.target.checked })}
            />
            {intl.formatMessage({ id: "screen.form.evidence.residency" })}
          </label>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center h-10 px-4 rounded bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {loading
            ? intl.formatMessage({ id: "screen.form.submit.loading" })
            : intl.formatMessage({ id: "screen.form.submit" })}
        </button>
        <button
          type="button"
          onClick={onResetClicked}
          className="text-sm text-foreground-muted hover:text-foreground underline underline-offset-2"
        >
          {intl.formatMessage({ id: "screen.form.reset" })}
        </button>
      </div>

      {/* ── Reset confirmation ───────────────────────────────────────── */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {intl.formatMessage({ id: "screen.reset.title" })}
            </DialogTitle>
            <DialogDescription>
              {intl.formatMessage({ id: "screen.reset.body" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              {intl.formatMessage({ id: "screen.reset.keep" })}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                resetAll();
                setResetOpen(false);
              }}
            >
              {intl.formatMessage({ id: "screen.reset.discard" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
