/**
 * v3.1.x L10 legal documents editor helpers.
 *
 * Same posture as authority-entry.ts: lives outside the route file so
 * the route can keep react-refresh's only-export-components rule while
 * the helpers stay unit-testable.
 */

export type LegalSection = {
  id: string;
  ref: string;
  heading: string;
  text: string;
};

export type LegalDocument = {
  id: string;
  type: string;
  title: string;
  citation: string;
  effective_date?: string;
  url?: string;
  sections: LegalSection[];
};

export const DOC_TYPES = [
  "statute",
  "regulation",
  "policy",
  "guideline",
  "case_law",
] as const;

export function cleanSection(s: LegalSection): LegalSection {
  return {
    id: s.id.trim(),
    ref: s.ref.trim(),
    heading: s.heading.trim(),
    text: s.text.trim(),
  };
}

export function cleanDocument(d: LegalDocument): LegalDocument {
  const out: LegalDocument = {
    id: d.id.trim(),
    type: d.type,
    title: d.title.trim(),
    citation: d.citation.trim(),
    sections: d.sections.map(cleanSection),
  };
  if (d.effective_date && d.effective_date.trim()) {
    out.effective_date = d.effective_date.trim();
  }
  if (d.url && d.url.trim()) {
    out.url = d.url.trim();
  }
  return out;
}

export type ValidationIssue = { row: number; message: string };

export function validateDocuments(docs: LegalDocument[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const docIds = new Set<string>();
  docs.forEach((d, i) => {
    const row = i + 1;
    if (!d.id.trim()) out.push({ row, message: `doc ${row}: id required` });
    else if (docIds.has(d.id))
      out.push({ row, message: `doc ${row}: duplicate id "${d.id}"` });
    else docIds.add(d.id);
    if (!d.title.trim()) out.push({ row, message: `doc ${row}: title required` });
    if (!d.type) out.push({ row, message: `doc ${row}: type required` });
    const secIds = new Set<string>();
    d.sections.forEach((s, j) => {
      if (!s.id.trim())
        out.push({ row, message: `doc ${row} section ${j + 1}: id required` });
      else if (secIds.has(s.id))
        out.push({
          row,
          message: `doc ${row} section ${j + 1}: duplicate id "${s.id}"`,
        });
      else secIds.add(s.id);
    });
  });
  return out;
}
