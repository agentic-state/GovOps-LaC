import type { AuthorityReference, Jurisdiction, LegalDocument, LegalRule } from "./types";

/**
 * Mock fixture for the /authority surface, used as a fallback when the
 * FastAPI backend is unreachable from the cloud preview. Mirrors the OAS
 * reference jurisdiction shipped in seed.py.
 */
export const MOCK_JURISDICTION: Jurisdiction = {
  id: "ca-oas",
  name: "Canada — Old Age Security",
  country: "Canada",
  level: "federal",
  parent_id: null,
  legal_tradition: "common law (with civil law in Quebec)",
  language_regime: "bilingual: English / French",
};

export const MOCK_AUTHORITY_CHAIN: AuthorityReference[] = [
  {
    id: "auth.constitution",
    jurisdiction_id: "ca-oas",
    layer: "constitution",
    title: "Constitution Act, 1867",
    citation: "30 & 31 Vict., c. 3 (U.K.)",
    effective_date: "1867-07-01",
    url: "https://laws-lois.justice.gc.ca/eng/Const/",
    parent_id: null,
  },
  {
    id: "auth.act",
    jurisdiction_id: "ca-oas",
    layer: "act",
    title: "Old Age Security Act",
    citation: "R.S.C. 1985, c. O-9",
    effective_date: "1952-01-01",
    url: "https://laws-lois.justice.gc.ca/eng/acts/o-9/",
    parent_id: "auth.constitution",
  },
  {
    id: "auth.regulation",
    jurisdiction_id: "ca-oas",
    layer: "regulation",
    title: "Old Age Security Regulations",
    citation: "C.R.C., c. 1246",
    effective_date: "1978-04-01",
    url: "https://laws-lois.justice.gc.ca/eng/regulations/C.R.C.,_c._1246/",
    parent_id: "auth.act",
  },
  {
    id: "auth.policy",
    jurisdiction_id: "ca-oas",
    layer: "policy",
    title: "OAS Eligibility Policy Manual",
    citation: "ESDC Policy Manual, ch. 4",
    effective_date: "2020-01-15",
    url: "https://www.canada.ca/en/services/benefits/publicpensions/cpp/old-age-security.html",
    parent_id: "auth.regulation",
  },
  {
    id: "auth.program",
    jurisdiction_id: "ca-oas",
    layer: "program",
    title: "Old Age Security Program",
    citation: "ESDC Program 5004",
    effective_date: "1952-01-01",
    url: "https://www.canada.ca/en/services/benefits/publicpensions/cpp/old-age-security.html",
    parent_id: "auth.policy",
  },
  {
    id: "auth.service",
    jurisdiction_id: "ca-oas",
    layer: "service",
    title: "OAS Pension Application Service",
    citation: "Service Canada — OAS Pension",
    effective_date: "1952-01-01",
    url: "https://www.canada.ca/en/services/benefits/publicpensions/cpp/old-age-security/apply.html",
    parent_id: "auth.program",
  },
];

export const MOCK_LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    id: "doc.oas-act",
    jurisdiction_id: "ca-oas",
    document_type: "statute",
    title: "Old Age Security Act",
    citation: "R.S.C. 1985, c. O-9",
    effective_date: "1985-12-31",
    sections: [
      {
        id: "doc.oas-act.s3",
        section_ref: "s. 3(1)",
        heading: "Payment of full pension",
        text: "Subject to this Act and the regulations, a full monthly pension may be paid to every person who has attained sixty-five years of age and who has resided in Canada for at least forty years after attaining eighteen years of age.",
      },
      {
        id: "doc.oas-act.s3-2",
        section_ref: "s. 3(2)",
        heading: "Payment of partial pension",
        text: "A partial monthly pension may be paid to a person who has resided in Canada after attaining eighteen years of age for an aggregate period of at least ten years but less than forty years, calculated at one-fortieth of the full monthly pension for each year of residence.",
      },
    ],
  },
  {
    id: "doc.oas-regs",
    jurisdiction_id: "ca-oas",
    document_type: "regulation",
    title: "Old Age Security Regulations",
    citation: "C.R.C., c. 1246",
    effective_date: "1978-04-01",
    sections: [
      {
        id: "doc.oas-regs.s5",
        section_ref: "s. 5",
        heading: "Evidence of residence",
        text: "An applicant for a pension shall, on request, provide documentary evidence of every period of residence in Canada relied upon for the purposes of qualifying for a pension.",
      },
    ],
  },
  {
    id: "doc.oas-policy",
    jurisdiction_id: "ca-oas",
    document_type: "policy_manual",
    title: "OAS Eligibility Policy Manual",
    citation: "ESDC Policy Manual, ch. 4",
    effective_date: "2020-01-15",
    sections: [
      {
        id: "doc.oas-policy.s4-2",
        section_ref: "ch. 4 § 2",
        heading: "Acceptable proof of residence",
        text: "Acceptable documents include lease agreements, utility bills, employer records, and tax returns. CRA records may be queried directly with applicant consent.",
      },
    ],
  },
];

export const MOCK_LEGAL_RULES: LegalRule[] = [
  {
    id: "rule.age-65",
    source_document_id: "doc.oas-act",
    source_section_ref: "s. 3(1)",
    rule_type: "age_threshold",
    description: "Applicant must be at least 65 years of age.",
    formal_expression: "age(applicant) >= 65",
    citation: "OAS Act, s. 3(1)",
    parameters: { min_age: 65 },
  },
  {
    id: "rule.residency-40",
    source_document_id: "doc.oas-act",
    source_section_ref: "s. 3(1)",
    rule_type: "residency_minimum",
    description: "Forty years of residence after age 18 required for full pension.",
    formal_expression: "residency_years(applicant, since_age=18) >= 40",
    citation: "OAS Act, s. 3(1)",
    parameters: { full_pension_years: 40, since_age: 18 },
  },
  {
    id: "rule.residency-10",
    source_document_id: "doc.oas-act",
    source_section_ref: "s. 3(2)",
    rule_type: "residency_partial",
    description:
      "Ten years of residence after age 18 required for partial pension; ratio = years/40.",
    formal_expression: "residency_years(applicant, since_age=18) >= 10",
    citation: "OAS Act, s. 3(2)",
    parameters: { partial_min_years: 10, ratio_denominator: 40 },
  },
  {
    id: "rule.evidence",
    source_document_id: "doc.oas-regs",
    source_section_ref: "s. 5",
    rule_type: "evidence_required",
    description: "Documentary evidence required for every period of residence relied upon.",
    formal_expression: "all(period.verified for period in residency_periods(applicant))",
    citation: "OAS Regs, s. 5",
    parameters: { required_evidence: ["lease", "utility_bill", "tax_return"] },
  },
];
