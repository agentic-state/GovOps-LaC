/**
 * v3.1.x L11 demo cases editor helpers.
 *
 * Same posture as authority-entry.ts and legal-document-entry.ts: pure
 * helpers live outside the route file so the route satisfies
 * react-refresh's only-export-components rule while the helpers stay
 * unit-testable.
 */

export type Applicant = {
  id: string;
  legal_name: string;
  date_of_birth: string;
  legal_status: string;
  country_of_birth: string;
};

export type ResidencyPeriod = {
  country: string;
  start_date: string;
  end_date?: string;
  verified: boolean;
  evidence_ids: string[];
};

export type EvidenceItem = {
  id: string;
  type: string;
  description: string;
  provided: boolean;
  verified: boolean;
};

export type DemoCase = {
  id: string;
  applicant: Applicant;
  residency_periods: ResidencyPeriod[];
  evidence_items: EvidenceItem[];
};

export const LEGAL_STATUSES = [
  "citizen",
  "permanent_resident",
  "temporary_resident",
  "refugee",
  "non_resident",
] as const;

export const EVIDENCE_TYPES = [
  "birth_certificate",
  "passport",
  "tax_record",
  "employment_record",
  "residency_proof",
  "social_security_record",
  "other",
] as const;

export function cleanApplicant(a: Applicant): Applicant {
  return {
    id: a.id.trim(),
    legal_name: a.legal_name.trim(),
    date_of_birth: a.date_of_birth.trim(),
    legal_status: a.legal_status,
    country_of_birth: a.country_of_birth.trim(),
  };
}

export function cleanResidency(r: ResidencyPeriod): ResidencyPeriod {
  const out: ResidencyPeriod = {
    country: r.country.trim(),
    start_date: r.start_date.trim(),
    verified: Boolean(r.verified),
    evidence_ids: r.evidence_ids.map((s) => s.trim()).filter((s) => s.length > 0),
  };
  if (r.end_date && r.end_date.trim()) out.end_date = r.end_date.trim();
  return out;
}

export function cleanEvidence(e: EvidenceItem): EvidenceItem {
  return {
    id: e.id.trim(),
    type: e.type,
    description: e.description.trim(),
    provided: Boolean(e.provided),
    verified: Boolean(e.verified),
  };
}

export function cleanCase(c: DemoCase): DemoCase {
  return {
    id: c.id.trim(),
    applicant: cleanApplicant(c.applicant),
    residency_periods: c.residency_periods.map(cleanResidency),
    evidence_items: c.evidence_items.map(cleanEvidence),
  };
}

export type ValidationIssue = { message: string };

export function validateCases(cases: DemoCase[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const caseIds = new Set<string>();
  cases.forEach((c, i) => {
    const row = i + 1;
    if (!c.id.trim()) out.push({ message: `case ${row}: id required` });
    else if (caseIds.has(c.id))
      out.push({ message: `case ${row}: duplicate id "${c.id}"` });
    else caseIds.add(c.id);
    if (!c.applicant.id.trim())
      out.push({ message: `case ${row}: applicant.id required` });
    if (!c.applicant.legal_name.trim())
      out.push({ message: `case ${row}: applicant.legal_name required` });
    if (!c.applicant.date_of_birth.trim())
      out.push({ message: `case ${row}: applicant.date_of_birth required` });
    const evIds = new Set<string>();
    c.evidence_items.forEach((e, j) => {
      if (!e.id.trim())
        out.push({ message: `case ${row} evidence ${j + 1}: id required` });
      else if (evIds.has(e.id))
        out.push({
          message: `case ${row} evidence ${j + 1}: duplicate id "${e.id}"`,
        });
      else evIds.add(e.id);
    });
    c.residency_periods.forEach((r, j) => {
      if (!r.country.trim())
        out.push({ message: `case ${row} residency ${j + 1}: country required` });
      if (!r.start_date.trim())
        out.push({ message: `case ${row} residency ${j + 1}: start_date required` });
      r.evidence_ids.forEach((eid, k) => {
        if (eid.trim() && !evIds.has(eid.trim())) {
          out.push({
            message: `case ${row} residency ${j + 1} evidence_ids[${k}]: "${eid}" does not match any evidence item id`,
          });
        }
      });
    });
  });
  return out;
}

export function emptyCase(): DemoCase {
  return {
    id: "",
    applicant: {
      id: "",
      legal_name: "",
      date_of_birth: "",
      legal_status: "citizen",
      country_of_birth: "",
    },
    residency_periods: [],
    evidence_items: [],
  };
}

export function emptyResidency(): ResidencyPeriod {
  return {
    country: "",
    start_date: "",
    end_date: "",
    verified: false,
    evidence_ids: [],
  };
}

export function emptyEvidence(): EvidenceItem {
  return {
    id: "",
    type: "other",
    description: "",
    provided: false,
    verified: false,
  };
}
