import type {
  ScreenRequest,
  ScreenResponse,
  ScreenRuleResult,
  ScreenOutcome,
} from "./types";

const JURISDICTION_LABELS: Record<string, string> = {
  ca: "Old Age Security — Canada",
  br: "Benefício de Prestação Continuada — Brasil",
  es: "Pensión No Contributiva — España",
  fr: "Allocation de Solidarité aux Personnes Âgées — France",
  de: "Grundsicherung im Alter — Deutschland",
  ua: "State social assistance — Ukraine",
};

const MIN_AGE = 65;
const MIN_RESIDENCY_YEARS = 10;
const FULL_RESIDENCY_YEARS = 40;

function yearsBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return (to.getTime() - from.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
}

/**
 * Deterministic mock evaluation that powers the citizen-facing self-screening
 * flow when the backend is unreachable. No PII is logged or stored — the
 * function is pure: same input ⇒ same output. Result is flagged with
 * `_preview: true` so the UI can show a "preview mode" badge.
 */
export function mockScreen(req: ScreenRequest): ScreenResponse {
  const evalDate = req.evaluation_date ?? new Date().toISOString().slice(0, 10);
  const age = yearsBetween(req.date_of_birth, evalDate);

  const totalResidencyYears = req.residency_periods
    .filter((p) => p.country.toLowerCase() === req.jurisdiction_id.toLowerCase())
    .reduce((sum, p) => sum + yearsBetween(p.start_date, p.end_date ?? evalDate), 0);

  const rules: ScreenRuleResult[] = [];

  rules.push({
    rule_id: "age_threshold",
    description: `Applicant must be at least ${MIN_AGE} years old at evaluation date`,
    citation: "OAS Act, s. 3(1)",
    outcome: age >= MIN_AGE ? "satisfied" : "not_satisfied",
    detail: `Computed age ≈ ${age.toFixed(1)} years`,
    effective_from: "1985-04-01",
  });

  const legalOk = req.legal_status === "citizen" || req.legal_status === "permanent_resident";
  rules.push({
    rule_id: "legal_status",
    description: "Applicant must hold citizenship or permanent residency",
    citation: "OAS Act, s. 3(1)(b)",
    outcome: legalOk ? "satisfied" : "not_satisfied",
    detail: `Declared status: ${req.legal_status}`,
  });

  let residencyOutcome: ScreenRuleResult["outcome"] = "not_satisfied";
  if (!req.evidence_present.residency) residencyOutcome = "insufficient_evidence";
  else if (totalResidencyYears >= MIN_RESIDENCY_YEARS) residencyOutcome = "satisfied";
  rules.push({
    rule_id: "residency_minimum",
    description: `At least ${MIN_RESIDENCY_YEARS} years of residency in the jurisdiction after age 18`,
    citation: "OAS Act, s. 3(1)(c)",
    outcome: residencyOutcome,
    detail: `Declared in-jurisdiction residency ≈ ${totalResidencyYears.toFixed(1)} years`,
    effective_from: "1985-04-01",
  });

  const dobOutcome: ScreenRuleResult["outcome"] = req.evidence_present.dob
    ? "satisfied"
    : "insufficient_evidence";
  rules.push({
    rule_id: "evidence_dob",
    description: "Acceptable proof of date of birth on hand",
    citation: "OAS Regulations, s. 12",
    outcome: dobOutcome,
    detail: req.evidence_present.dob
      ? "Applicant indicated they have a birth certificate or passport."
      : "Applicant did not confirm proof of date of birth.",
  });

  const missing: string[] = [];
  if (!req.evidence_present.dob) missing.push("Birth certificate or passport");
  if (!req.evidence_present.residency)
    missing.push("Records of your residency (utility bills, tax returns, lease agreements)");

  let outcome: ScreenOutcome;
  if (rules.some((r) => r.outcome === "not_satisfied")) outcome = "ineligible";
  else if (rules.some((r) => r.outcome === "insufficient_evidence")) outcome = "insufficient_evidence";
  else outcome = "eligible";

  let pensionType: ScreenResponse["pension_type"] = "";
  let partialRatio: string | undefined;
  if (outcome === "eligible") {
    if (totalResidencyYears >= FULL_RESIDENCY_YEARS) pensionType = "full";
    else {
      pensionType = "partial";
      partialRatio = `${Math.floor(totalResidencyYears)}/${FULL_RESIDENCY_YEARS}`;
    }
  }

  return {
    outcome,
    pension_type: pensionType,
    partial_ratio: partialRatio,
    rule_results: rules,
    missing_evidence: missing,
    jurisdiction_label: JURISDICTION_LABELS[req.jurisdiction_id] ?? req.jurisdiction_id,
    evaluation_date: evalDate,
    _preview: true,
  };
}
