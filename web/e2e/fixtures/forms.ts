/**
 * Form-fill helpers for UI-driven end-to-end tests.
 *
 * Each helper drives a form via real DOM events (click, fill, check)
 * and produces a minimum-valid payload so submission lands on a result
 * panel rather than a silent no-op. The helpers exist because the
 * v3 forms enforce per-event-type / per-jurisdiction sub-schemas that
 * spec authors kept missing -- LO-003 (NewEventForm) and LO-005
 * (ScreenForm + CheckForm) journey-coverage items.
 *
 * Selectors prefer stable hooks in this order:
 *   1. element id (e.g. "#screen-dob")
 *   2. data-testid (e.g. "check-dob")
 *   3. ARIA role + accessible name (last resort -- locale-sensitive)
 *
 * If a contract field changes, update this file rather than every spec.
 */

import { expect, type Page } from "@playwright/test";

// ── Screen form (/screen/$jur) ─────────────────────────────────────────────

export interface ScreenFormFill {
  /** ISO date YYYY-MM-DD. Default: 1955-04-12 (puts the case at OAS-eligible age). */
  dateOfBirth?: string;
  /** Default: "citizen". */
  legalStatus?: "citizen" | "permanent_resident" | "other";
  /** Default: "ca" (matches /screen/ca). */
  residencyCountry?: string;
  /** ISO date. Default: 1985-01-01 (puts residency in the eligible band). */
  residencyStart?: string;
  /** Default: true -- both evidence checkboxes checked, drives an Eligible verdict. */
  evidenceChecked?: boolean;
}

/**
 * Fill the /screen/$jurisdictionId form with a minimum-valid payload.
 * Does NOT click Submit -- caller decides which assertion to chain.
 *
 * The form validates these fields synchronously; submitting before all
 * required fields are filled scrolls the page to a validation summary
 * rather than producing a result panel.
 */
export async function fillScreenForm(page: Page, opts: ScreenFormFill = {}): Promise<void> {
  const dob = opts.dateOfBirth ?? "1955-04-12";
  const legalStatus = opts.legalStatus ?? "citizen";
  const country = opts.residencyCountry ?? "ca";
  const startDate = opts.residencyStart ?? "1985-01-01";
  const checkEvidence = opts.evidenceChecked ?? true;

  // Wait for the form to be hydrated (#screen-dob is the canonical anchor).
  await page.waitForSelector("#screen-dob", { state: "visible", timeout: 10_000 });

  // DOB.
  await page.locator("#screen-dob").fill(dob);

  // Legal status -- radio inputs by id.
  // The first radio is "screen-legal-citizen"; the others are
  // "screen-legal-permanent_resident" + "screen-legal-other".
  const radioId =
    legalStatus === "citizen" ? "#screen-legal-citizen" : `#screen-legal-${legalStatus}`;
  await page.locator(radioId).check();

  // Residency period 0 -- country select + start_date.
  await page.locator("#screen-residency-0-country").selectOption(country);
  await page.locator("#screen-residency-0-start_date").fill(startDate);

  // Evidence checkboxes (both, when requested).
  if (checkEvidence) {
    // Evidence-DOB checkbox + evidence-residency checkbox -- the
    // ScreenForm renders them via accessible labels; resolve by label
    // text matching the i18n string. The i18n keys are
    // "screen.form.evidence.dob" + "screen.form.evidence.residency"
    // -- in en that resolves to substrings "birth certificate" and
    // "records of my residency".
    await page.getByLabel(/birth certificate/i).check();
    await page.getByLabel(/records of.*residency/i).check();
  }
}

/**
 * Submit the /screen form via its primary button.
 * Caller is responsible for asserting the resulting verdict.
 */
export async function submitScreenForm(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^check eligibility$/i }).click();
}

// ── Check form (/check) ────────────────────────────────────────────────────

export interface CheckFormFill {
  /** Default: "ca". Active jurisdictions: ca, br, es, fr, de, ua, jp. */
  jurisdiction?: "ca" | "br" | "es" | "fr" | "de" | "ua" | "jp";
  /** ISO date. Default: a date 67 years ago (computed in the route as default). */
  dateOfBirth?: string;
  /** Default: "citizen". */
  legalStatus?: "citizen" | "permanent_resident" | "other";
  /** ISO date. Default: a date 49 years ago. */
  residencyStart?: string;
  /** Defaults: dob=true, residency=true, jobLoss=false (matches the route's defaults). */
  evidence?: { dob?: boolean; residency?: boolean; jobLoss?: boolean };
}

/**
 * Fill the /check multi-program form.
 *
 * Note: the /check route initializes the form with sensible defaults
 * (dob ~67 years ago, citizen, residency ~49 years ago, evidence dob+
 * residency checked). For most tests passing `{}` and submitting is
 * enough. The helper only mutates fields the caller specifies.
 *
 * Stable selectors via data-testid: check-jurisdiction, check-dob,
 * check-legal-status, check-residency-start, check-evidence-dob,
 * check-evidence-residency, check-evidence-job-loss, check-submit.
 */
export async function fillCheckForm(page: Page, opts: CheckFormFill = {}): Promise<void> {
  // Wait for hydration anchor.
  await page.waitForSelector('[data-testid="check-form"]', { state: "visible", timeout: 10_000 });

  if (opts.jurisdiction !== undefined) {
    await page.locator('[data-testid="check-jurisdiction"]').selectOption(opts.jurisdiction);
  }
  if (opts.dateOfBirth !== undefined) {
    await page.locator('[data-testid="check-dob"]').fill(opts.dateOfBirth);
  }
  if (opts.legalStatus !== undefined) {
    await page.locator('[data-testid="check-legal-status"]').selectOption(opts.legalStatus);
  }
  if (opts.residencyStart !== undefined) {
    await page.locator('[data-testid="check-residency-start"]').fill(opts.residencyStart);
  }
  if (opts.evidence?.dob !== undefined) {
    await setCheckbox(page, '[data-testid="check-evidence-dob"]', opts.evidence.dob);
  }
  if (opts.evidence?.residency !== undefined) {
    await setCheckbox(page, '[data-testid="check-evidence-residency"]', opts.evidence.residency);
  }
  if (opts.evidence?.jobLoss !== undefined) {
    await setCheckbox(page, '[data-testid="check-evidence-job-loss"]', opts.evidence.jobLoss);
  }
}

/**
 * Submit the /check form. Caller asserts on the result panel.
 */
export async function submitCheckForm(page: Page): Promise<void> {
  await page.locator('[data-testid="check-submit"]').click();
}

async function setCheckbox(page: Page, selector: string, checked: boolean): Promise<void> {
  const el = page.locator(selector);
  const isChecked = await el.isChecked();
  if (isChecked !== checked) {
    if (checked) await el.check();
    else await el.uncheck();
  }
}

// ── NewEventForm (case-detail Dialog) ──────────────────────────────────────

export type NewEventType = "re_evaluate" | "move_country" | "change_legal_status" | "add_evidence";

export interface NewEventFill {
  /** Default: "re_evaluate" (no extra required fields). */
  eventType?: NewEventType;
  /** ISO date. Default: today (the form's pre-filled value). */
  effectiveDate?: string;
  /** Required iff eventType="add_evidence". Default "id_card". */
  evidenceType?: string;
  /** Optional. Required iff eventType="move_country". Default "ca". */
  toCountry?: string;
  /** Optional. Used iff eventType="change_legal_status". Default "citizen". */
  toStatus?: "citizen" | "permanent_resident" | "other";
  /** Optional free-form note. */
  note?: string;
}

/**
 * Open + fill + submit the NewEventForm dialog on a /cases/$id detail page.
 * Returns once the dialog has closed (post-submit).
 *
 * The form is gated by per-event-type sub-schemas. The Save button stays
 * disabled until the type-specific required fields validate -- this is
 * what tripped the L3 O07 spec before LO-003 landed.
 */
export async function submitNewEventForm(page: Page, opts: NewEventFill = {}): Promise<void> {
  const eventType: NewEventType = opts.eventType ?? "re_evaluate";

  // Open the dialog via the trigger button.
  const trigger = page.getByRole("button", { name: /^record event$/i });
  await expect(trigger).toBeVisible({ timeout: 10_000 });
  await trigger.click();

  // Dialog heading anchor.
  await expect(page.getByRole("heading", { name: /record a life event/i })).toBeVisible({
    timeout: 5_000,
  });

  // ── Event type (shadcn Select -- click trigger then click option) ───
  // Default is "re_evaluate"; only switch when the caller asks for
  // something else, to avoid a redundant Radix interaction.
  if (eventType !== "re_evaluate") {
    await page.locator("#evt-type").click();
    const optionLabel: Record<NewEventType, RegExp> = {
      re_evaluate: /re-evaluation/i,
      move_country: /move country/i,
      change_legal_status: /legal status change/i,
      add_evidence: /^new evidence$/i,
    };
    await page.getByRole("option", { name: optionLabel[eventType] }).click();
  }

  // ── Effective date ──────────────────────────────────────────────────
  if (opts.effectiveDate !== undefined) {
    await page.locator("#evt-date").fill(opts.effectiveDate);
  }

  // ── Per-type required fields ────────────────────────────────────────
  if (eventType === "add_evidence") {
    await page.locator("#evt-evtype").fill(opts.evidenceType ?? "id_card");
  } else if (eventType === "move_country") {
    // to_country is a shadcn Select with id "evt-to".
    await page.locator("#evt-to").click();
    const country = (opts.toCountry ?? "ca").toUpperCase();
    await page.getByRole("option", { name: new RegExp(`^${country}$`, "i") }).click();
  } else if (eventType === "change_legal_status") {
    // to_status default is "citizen" so only switch when the caller
    // overrides; otherwise the Select stays at its initial state.
    if (opts.toStatus !== undefined && opts.toStatus !== "citizen") {
      await page.locator("#evt-status").click();
      const label =
        opts.toStatus === "permanent_resident" ? /permanent resident/i : /^other$/i;
      await page.getByRole("option", { name: label }).click();
    }
  }

  // ── Optional note ───────────────────────────────────────────────────
  if (opts.note !== undefined) {
    await page.locator("#evt-note").fill(opts.note);
  }

  // ── Submit ──────────────────────────────────────────────────────────
  const saveBtn = page.getByRole("button", { name: /^save event$/i });
  await expect(saveBtn, "Save event must be enabled when required fields are filled").toBeEnabled({
    timeout: 5_000,
  });
  await saveBtn.click();
}
