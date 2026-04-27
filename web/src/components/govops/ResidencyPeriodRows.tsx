import { useIntl } from "react-intl";
import { Plus, X } from "lucide-react";
import type { ScreenResidencyPeriod } from "@/lib/types";

const COUNTRIES = [
  "ca", "br", "es", "fr", "de", "ua",
  "us", "uk", "mx", "pt", "ar", "it", "pl", "in", "ph", "cn", "other",
];

export function ResidencyPeriodRows({
  periods,
  onChange,
  errors,
  fieldsetError,
}: {
  periods: ScreenResidencyPeriod[];
  onChange: (next: ScreenResidencyPeriod[]) => void;
  /** Map of `residency.{i}.{field}` → message id. */
  errors?: Record<string, string>;
  /** Fieldset-level error message id (e.g. "must add at least one"). */
  fieldsetError?: string;
}) {
  const intl = useIntl();

  const update = (i: number, patch: Partial<ScreenResidencyPeriod>) => {
    const next = periods.map((p, idx) => (idx === i ? { ...p, ...patch } : p));
    onChange(next);
  };

  const remove = (i: number) => onChange(periods.filter((_, idx) => idx !== i));

  const add = () =>
    onChange([
      ...periods,
      { country: "", start_date: "", end_date: null },
    ]);

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium mb-1">
        {intl.formatMessage({ id: "screen.form.residency.heading" })}
      </legend>
      {fieldsetError && (
        <p role="alert" className="text-sm text-destructive">
          {intl.formatMessage({ id: fieldsetError })}
        </p>
      )}
      {periods.map((p, i) => {
        const ongoing = p.end_date === null;
        const eCountry = errors?.[`residency.${i}.country`];
        const eStart = errors?.[`residency.${i}.start_date`];
        const eEnd = errors?.[`residency.${i}.end_date`];
        return (
          <div
            key={i}
            className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end p-3 rounded border border-border bg-surface-sunken"
          >
            <label className="text-sm">
              <span className="block text-foreground-muted mb-1">
                {intl.formatMessage({ id: "screen.form.residency.country" })}
              </span>
              <select
                id={`screen-residency-${i}-country`}
                value={p.country}
                onChange={(e) => update(i, { country: e.target.value })}
                onKeyDown={(e) => {
                  // a11y: Backspace on an empty country deletes the row.
                  if (e.key === "Backspace" && !p.country && periods.length > 1) {
                    e.preventDefault();
                    remove(i);
                  }
                }}
                className={`w-full h-9 px-2 rounded border bg-surface text-foreground ${eCountry ? "border-destructive" : "border-border"}`}
                aria-required="true"
                aria-invalid={eCountry ? true : undefined}
                aria-describedby={eCountry ? `err-residency-${i}-country` : undefined}
              >
                <option value="">—</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c.toUpperCase()}</option>
                ))}
              </select>
              {eCountry && (
                <p id={`err-residency-${i}-country`} role="alert" className="mt-1 text-xs text-destructive">
                  {intl.formatMessage({ id: eCountry })}
                </p>
              )}
            </label>
            <label className="text-sm">
              <span className="block text-foreground-muted mb-1">
                {intl.formatMessage({ id: "screen.form.residency.start" })}
              </span>
              <input
                id={`screen-residency-${i}-start_date`}
                type="date"
                value={p.start_date}
                onChange={(e) => update(i, { start_date: e.target.value })}
                max={new Date().toISOString().slice(0, 10)}
                className={`w-full h-9 px-2 rounded border bg-surface text-foreground ${eStart ? "border-destructive" : "border-border"}`}
                aria-required="true"
                aria-invalid={eStart ? true : undefined}
                aria-describedby={eStart ? `err-residency-${i}-start` : undefined}
              />
              {eStart && (
                <p id={`err-residency-${i}-start`} role="alert" className="mt-1 text-xs text-destructive">
                  {intl.formatMessage({ id: eStart })}
                </p>
              )}
            </label>
            <label className="text-sm">
              <span className="block text-foreground-muted mb-1">
                {intl.formatMessage({ id: "screen.form.residency.end" })}
              </span>
              <div className="flex items-center gap-2">
                <input
                  id={`screen-residency-${i}-end_date`}
                  type="date"
                  value={p.end_date ?? ""}
                  disabled={ongoing}
                  onChange={(e) => update(i, { end_date: e.target.value || null })}
                  max={new Date().toISOString().slice(0, 10)}
                  className={`flex-1 h-9 px-2 rounded border bg-surface text-foreground disabled:opacity-50 ${eEnd ? "border-destructive" : "border-border"}`}
                  aria-invalid={eEnd ? true : undefined}
                  aria-describedby={eEnd ? `err-residency-${i}-end` : undefined}
                />
                <label className="inline-flex items-center gap-1 text-xs text-foreground-muted">
                  <input
                    type="checkbox"
                    checked={ongoing}
                    onChange={(e) => update(i, { end_date: e.target.checked ? null : "" })}
                  />
                  {intl.formatMessage({ id: "screen.form.residency.ongoing" })}
                </label>
              </div>
              {eEnd && (
                <p id={`err-residency-${i}-end`} role="alert" className="mt-1 text-xs text-destructive">
                  {intl.formatMessage({ id: eEnd })}
                </p>
              )}
            </label>
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={periods.length === 1}
              className="h-9 w-9 inline-flex items-center justify-center rounded border border-border text-foreground-muted hover:text-foreground hover:bg-surface disabled:opacity-30"
              aria-label={`Remove residency period ${i + 1}`}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        );
      })}
      <button
        id="screen-residency-add"
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1 text-sm text-foreground hover:text-foreground underline-offset-2 hover:underline"
      >
        <Plus className="size-4" aria-hidden />
        {intl.formatMessage({ id: "screen.form.residency.add" })}
      </button>
    </fieldset>
  );
}
