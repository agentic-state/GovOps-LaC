# GovOps Spec — Authority chain visualization
<!-- type: route, priority: p1, depends_on: [govops-001, govops-002] -->
type: route
priority: p1
depends_on: [govops-001, govops-002]
spec_id: govops-010

## Intent

Show the full authority chain — `jurisdiction → constitution → act → regulation → policy → program → service` — alongside the legal documents and rules that hang off it. This is the "where does this rule come from?" surface. A citizen, reviewer, or auditor opens this page and can trace any operational rule back through every layer of authority that legitimizes it.

The backend already serves all required endpoints — no new backend work is needed.

## Acceptance criteria

- [ ] Route `/authority` loads three endpoints in parallel: `GET /api/authority-chain`, `GET /api/legal-documents`, `GET /api/rules`
- [ ] Top section: jurisdiction header (name, country, level, legal_tradition, language_regime) with a `system` provenance ribbon
- [ ] **Chain visualization** — vertical tree (mobile + ≤768px) or horizontal flowchart (≥768px), one node per `AuthorityReference`, ordered by depth in the chain (root = constitution-equivalent, leaves = service)
  - Each node card shows: layer label (mono, uppercase, e.g. `CONSTITUTION`, `ACT`, `REGULATION`, `POLICY`, `PROGRAM`, `SERVICE`), title (serif), citation (mono with hover-underline), effective_date (locale-formatted, "—" if null)
  - Connecting lines: solid 1px `--border-strong`; on RTL, the chain orientation flips for horizontal mode
  - Click a node → highlights all dependent legal documents and rules (right-side panel scrolls to them, dimmed cards regain emphasis)
  - Provenance ribbon on each node: `human` (every authority reference is a human enactment)
- [ ] **Legal documents panel** (right column on ≥1024px, below chain on smaller): list of `LegalDocument` rows
  - Each row shows: document_type chip (statute/regulation/policy_manual/guidance), title, citation (mono), effective_date, expandable sections list
  - Sections within a document render as a nested `<details>` accordion: section_ref (mono), heading (serif), text (statute typography from govops-001 — serif, 1.0625rem, line-height 1.75, max-w-65ch)
  - Provenance: `human` per row
- [ ] **Rules panel** (below documents): list of `LegalRule`s
  - Each row shows: rule_type chip, description, citation (`<CitationLink>` → drawer with statute text), formal_expression (mono code block), parameters (key-value table)
  - "View source section" button → expands the matching legal document section in the documents panel
  - Provenance: `hybrid` (rule is a human-authored citation interpreted by the system)
- [ ] **Search/filter bar** spanning all three sections: text input filters by citation substring across chain, documents, and rules; dropdown filters by document_type and rule_type
- [ ] When a chain node is selected, a "Reset filter" link clears the highlight
- [ ] Empty states when no jurisdiction is loaded: civic banner with "Switch jurisdiction in the masthead" + dropdown link
- [ ] Loading: skeleton chain (3 placeholder nodes), skeleton list (3 doc rows + 3 rule rows)
- [ ] Error: civic banner with retry
- [ ] Print stylesheet: chain renders linearly (always vertical), all `<details>` open, no interactive controls

## Files to create / modify

```
src/routes/authority.tsx                              (new)
src/components/govops/authority/JurisdictionHeader.tsx (new)
src/components/govops/authority/ChainGraph.tsx        (new — responsive layout)
src/components/govops/authority/ChainNode.tsx         (new)
src/components/govops/authority/LegalDocumentList.tsx (new)
src/components/govops/authority/LegalDocumentCard.tsx (new)
src/components/govops/authority/LegalRuleList.tsx     (new)
src/components/govops/authority/LegalRuleCard.tsx     (new)
src/components/govops/authority/StatuteText.tsx       (new — serif, statute typography)
src/components/govops/authority/AuthoritySearchBar.tsx (new)
src/lib/api.ts                                        (modify — add 3 helpers)
src/lib/types.ts                                      (modify — add Jurisdiction, AuthorityReference, LegalDocument, LegalRule types)
src/messages/{en,fr,pt-BR,es-MX,de,uk}.json           (modify — add authority.* keys)
```

Update masthead nav: add `/authority` link after `/cases` and before `/config`.

## Tokens / data

```ts
// src/lib/types.ts additions
export type DocumentType = "statute" | "regulation" | "policy_manual" | "guidance";

export type RuleType =
  | "age_threshold" | "residency_minimum" | "residency_partial"
  | "legal_status" | "evidence_required" | "exclusion";

export interface Jurisdiction {
  id: string;
  name: string;
  country: string;
  level: string;          // "federal" | "provincial" | "municipal"
  parent_id: string | null;
  legal_tradition: string;
  language_regime: string;
}

export interface AuthorityReference {
  id: string;
  jurisdiction_id: string;
  layer: string;          // "constitution" | "act" | "regulation" | "policy" | "program" | "service"
  title: string;
  citation: string;
  effective_date: string | null;
  url: string;
  parent_id: string | null;
}

export interface LegalSection {
  id: string;
  section_ref: string;
  heading: string;
  text: string;
}

export interface LegalDocument {
  id: string;
  jurisdiction_id: string;
  document_type: DocumentType;
  title: string;
  citation: string;
  effective_date: string | null;
  sections: LegalSection[];
}

export interface LegalRule {
  id: string;
  source_document_id: string;
  source_section_ref: string;
  rule_type: RuleType;
  description: string;
  formal_expression: string;
  citation: string;
  parameters: Record<string, unknown>;
}
```

```ts
// src/lib/api.ts additions
export async function getAuthorityChain(): Promise<{
  jurisdiction: Jurisdiction;
  chain: AuthorityReference[];
}> {
  return fetcher("/api/authority-chain");
}

export async function listLegalDocuments(): Promise<{ documents: LegalDocument[] }> {
  return fetcher("/api/legal-documents");
}

export async function listRules(): Promise<{ rules: LegalRule[] }> {
  return fetcher("/api/rules");
}
```

Tokens used: `--surface`, `--surface-raised` (chain nodes), `--border-strong` (chain connecting lines), `--authority` (selected node ring), `--font-serif` (titles, statute text), `--font-mono` (citations, layer labels, formal_expression), `--space-6`/`--space-8` (chain node gaps).

Statute text style class:
```css
.statute-text {
  font-family: var(--font-serif);
  font-size: 1.0625rem;
  line-height: 1.75;
  max-width: 65ch;
  color: var(--foreground);
}
```

## Reference implementation

```tsx
// src/components/govops/authority/ChainNode.tsx
import type { AuthorityReference } from "@/lib/types";
import { ProvenanceRibbon } from "@/components/govops/ProvenanceRibbon";
import { useIntl, FormattedDate } from "react-intl";

export function ChainNode({
  ref: ref_,
  selected,
  onSelect,
}: {
  ref: AuthorityReference;
  selected: boolean;
  onSelect: () => void;
}) {
  const intl = useIntl();
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex items-stretch text-start rounded-md border bg-surface-raised
        transition-colors hover:bg-surface
        focus-visible:shadow-[var(--ring-focus)] outline-none
        ${selected ? "ring-2 ring-authority" : ""}`}
    >
      <ProvenanceRibbon variant="human" />
      <div className="flex-1 px-4 py-3 space-y-1">
        <p
          className="text-[10px] uppercase tracking-[0.18em] text-foreground-subtle"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {intl.formatMessage({ id: `authority.layer.${ref_.layer}` })}
        </p>
        <p
          className="text-base"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {ref_.title}
        </p>
        <p
          className="text-xs text-foreground-muted"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {ref_.citation}
          {ref_.effective_date && (
            <>
              {" · "}
              <FormattedDate value={ref_.effective_date} year="numeric" month="short" />
            </>
          )}
        </p>
      </div>
    </button>
  );
}
```

```tsx
// src/components/govops/authority/ChainGraph.tsx
// Responsive layout: vertical CSS Grid on mobile, horizontal flex on desktop.
// Use a `useMediaQuery` hook (or Tailwind responsive classes) to drive the
// layout direction; do NOT use a fixed-orientation graphviz library.
// Connecting lines drawn with a single absolutely-positioned <svg>
// or with CSS pseudo-elements between adjacent nodes — keep it simple,
// no react-flow / react-d3-tree.
```

## i18n

```yaml
locales_required: [en, fr, pt-BR, es-MX, de, uk]
rtl_mirroring: capable_but_inactive
copy_keys:
  - authority.heading
  - authority.lede
  - authority.jurisdiction.country
  - authority.jurisdiction.level
  - authority.jurisdiction.legal_tradition
  - authority.jurisdiction.language_regime
  - authority.layer.constitution
  - authority.layer.act
  - authority.layer.regulation
  - authority.layer.policy
  - authority.layer.program
  - authority.layer.service
  - authority.documents.heading
  - authority.documents.empty
  - authority.documents.section.aria        # ICU: "Section {ref} of {title}"
  - authority.rules.heading
  - authority.rules.empty
  - authority.rules.formal_expression
  - authority.rules.parameters
  - authority.rules.view_source
  - authority.search.placeholder
  - authority.filter.document_type
  - authority.filter.rule_type
  - authority.filter.reset
  - authority.no_jurisdiction.title
  - authority.no_jurisdiction.body
  - document_type.statute
  - document_type.regulation
  - document_type.policy_manual
  - document_type.guidance
  - rule_type.age_threshold
  - rule_type.residency_minimum
  - rule_type.residency_partial
  - rule_type.legal_status
  - rule_type.evidence_required
  - rule_type.exclusion
```

## a11y

```yaml
contrast: AA
focus_visible: required
keyboard:
  - Chain nodes are <button> elements; Tab through in chain order
  - Enter/Space toggles selection and updates highlight in side panels
  - Esc clears selection (same as "Reset filter" link)
  - Document <details> open with Enter/Space on the <summary>
  - Rule cards: Tab to "View source section" button; Enter activates and focuses the matching section
aria_live: polite
  - Announce "{N} documents and {M} rules linked to {layer}: {title}" on chain selection
reduced_motion: respect
landmarks:
  - <main> for the page
  - <section aria-labelledby="chain-heading"> for the chain
  - <section aria-labelledby="documents-heading"> for documents
  - <section aria-labelledby="rules-heading"> for rules
print:
  - Chain renders linearly (vertical), no horizontal mode in print
  - All <details> elements open
  - Page-break-inside: avoid on each chain node, document, and rule card
```

provenance: human
  # The authority surface is fundamentally about human-enacted law.
  # Rules carry hybrid ribbons (human-authored citation + system formal expression).

## Out of scope

- Editing authority chain or legal documents (these come from `seed.py` / `jurisdictions.py`; v2.0 will move them under `lawcode/<jurisdiction>/` per ADR-003 — out of scope for this surface)
- Cross-jurisdiction comparison (a separate surface if/when needed)
- Visual diff of statute amendments over time (Phase 7 territory)
- Federation source attribution (Phase 8)
- Adding new layer types beyond the 6 currently in the data model
