/**
 * Pure validation for the self-screening form. Returns a flat map of
 * field-id → message-id (i18n key). UI components look up messages and
 * render them inline with `aria-describedby`.
 *
 * Field-id conventions:
 *   - `dob`                      date of birth field
 *   - `legal_status`             radio group
 *   - `residency`                fieldset-level (e.g. "must add at least one")
 *   - `residency.{i}.country`    individual row field
 *   - `residency.{i}.start_date`
 *   - `residency.{i}.end_date`
 */
import type { ScreenLegalStatus, ScreenResidencyPeriod } from "./types";

export interface ScreenFormValuesForValidation {
  date_of_birth: string;
  legal_status: ScreenLegalStatus | "";
  residency_periods: ScreenResidencyPeriod[];
}

export type ScreenFormErrors = Record<string, string>;

const MIN_DOB = "1900-01-01";
const today = () => new Date().toISOString().slice(0, 10);

export function validateScreenForm(s: ScreenFormValuesForValidation): ScreenFormErrors {
  const errors: ScreenFormErrors = {};
  const TODAY = today();

  // ── DOB ────────────────────────────────────────────────────────────────
  if (!s.date_of_birth) {
    errors.dob = "screen.errors.dob.required";
  } else if (s.date_of_birth < MIN_DOB) {
    errors.dob = "screen.errors.dob.too_old";
  } else if (s.date_of_birth > TODAY) {
    errors.dob = "screen.errors.dob.future";
  }

  // ── Legal status ───────────────────────────────────────────────────────
  if (!s.legal_status) {
    errors.legal_status = "screen.errors.legal_status.required";
  }

  // ── Residency periods ──────────────────────────────────────────────────
  if (!s.residency_periods.length) {
    errors.residency = "screen.errors.residency.required";
  } else {
    s.residency_periods.forEach((p, i) => {
      const prefix = `residency.${i}`;
      if (!p.country) errors[`${prefix}.country`] = "screen.errors.residency.country_required";
      if (!p.start_date) {
        errors[`${prefix}.start_date`] = "screen.errors.residency.start_required";
      } else if (p.start_date < MIN_DOB) {
        errors[`${prefix}.start_date`] = "screen.errors.residency.start_too_old";
      } else if (p.start_date > TODAY) {
        errors[`${prefix}.start_date`] = "screen.errors.residency.start_future";
      } else if (s.date_of_birth && p.start_date < s.date_of_birth) {
        errors[`${prefix}.start_date`] = "screen.errors.residency.start_before_dob";
      }
      if (p.end_date) {
        if (p.end_date > TODAY) {
          errors[`${prefix}.end_date`] = "screen.errors.residency.end_future";
        } else if (p.start_date && p.end_date < p.start_date) {
          errors[`${prefix}.end_date`] = "screen.errors.residency.end_before_start";
        }
      }
    });

    // Overlap detection: complete pairs only (need both start and end resolved).
    const resolved = s.residency_periods.map((p, idx) => ({
      idx,
      start: p.start_date,
      end: p.end_date ?? TODAY,
    }));
    for (let i = 0; i < resolved.length; i++) {
      for (let j = i + 1; j < resolved.length; j++) {
        const a = resolved[i];
        const b = resolved[j];
        if (!a.start || !b.start) continue;
        if (a.start <= b.end && b.start <= a.end) {
          // Flag the later row's start as the conflict point.
          const later = a.start <= b.start ? b.idx : a.idx;
          const key = `residency.${later}.start_date`;
          if (!errors[key]) errors[key] = "screen.errors.residency.overlap";
        }
      }
    }
  }

  return errors;
}

export function isValid(errors: ScreenFormErrors): boolean {
  return Object.keys(errors).length === 0;
}