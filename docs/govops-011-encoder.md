# GovOps Spec — Encoding pipeline (statute → proposals → review → commit)
<!-- type: route, priority: p1, depends_on: [govops-001, govops-002, govops-010] -->
type: route
priority: p1
depends_on: [govops-001, govops-002, govops-010]
spec_id: govops-011

## Intent

Replace the existing Jinja `/encode` surfaces with a React equivalent. A maintainer pastes (or uploads) statutory text, runs LLM-assisted extraction to generate proposed `LegalRule` records, reviews each proposal individually (approve / modify / reject / annotate), and commits the approved set to the active engine. The flow makes encoding agentic-by-default with human ratification — the canonical Law-as-Code path.

This spec **requires forward-looking backend additions**: the existing encode endpoints serve HTML and consume form-encoded bodies; React needs JSON equivalents. Mock fallbacks let Lovable build the UI before the backend ships those.

## Acceptance criteria

### `/encode` — batch list

- [ ] Route loads `GET /api/encode/batches` (forward-looking; mock fallback)
- [ ] Empty state: agentic-soft hero card with "Start a new extraction" CTA
- [ ] Each batch row shows: ref (mono short id), document title (serif), citation (mono), method (`manual` / `llm:claude` / `manual:llm-fallback`), proposal counts by status (pending / approved / rejected / modified), created_at, "Review" CTA
- [ ] Provenance ribbon: `agent` if method starts with `llm:`, `hybrid` if `manual:llm-fallback`, `human` for pure `manual`
- [ ] "New extraction" button (agent variant) → `/encode/new`

### `/encode/new` — ingest form

- [ ] Form fields:
  - **Document title** (text, required)
  - **Document citation** (text, required, mono)
  - **Source URL** (text, optional)
  - **Method** (radio: `manual` / `llm`)
  - **API key** (password, only shown when method=llm; help text "Used for this extraction only; not persisted")
  - **Statutory text** (textarea, required, mono, expands to 60vh, character count)
- [ ] Submit → `POST /api/encode/batches` (forward-looking) with JSON body
- [ ] On success → navigate to `/encode/$batchId`
- [ ] On LLM failure (timeout, auth, rate limit), submit auto-retries via `manual` extraction and shows toast "LLM extraction failed; fell back to manual rule patterns"
- [ ] Back link to `/encode`

### `/encode/$batchId` — proposal review

- [ ] Route loads `GET /api/encode/batches/$batchId` (forward-looking)
- [ ] Header: document title, citation, method chip, source-text expandable section (preserved from upload, mono, line-numbered, max 50vh scroll)
- [ ] **Proposals list**: each proposal is a card with rule_type chip, description, citation `<CitationLink>`, formal_expression (mono code), parameters (key-value table), status pill (pending / approved / modified / rejected), agentic ribbon if `method=llm` else hybrid
- [ ] Per-proposal actions:
  - **Approve**: `POST /api/encode/batches/$batchId/proposals/$proposalId/review` body `{status: "approved"}`
  - **Modify**: opens inline form to edit description, formal_expression, citation, parameters; submit body `{status: "modified", overrides: {...}}`
  - **Reject**: confirm modal; body `{status: "rejected", notes: "<reason>"}`
  - **Annotate**: comment-only, body `{status: "pending", notes: "<comment>"}` — keeps status but records reviewer note
- [ ] Status filter chips: pending / approved / modified / rejected (multi-select)
- [ ] **Bulk action bar** at top: when ≥1 proposal selected via row checkboxes, show "Approve all" / "Reject all" / "Clear selection"
- [ ] **Audit log panel** (collapsible, right side ≥1280px or below proposals on smaller): chronological list from `EncodingStore.audit` — timestamp, event_type, actor, detail
- [ ] **Commit** button (authority variant, sticky footer): visible only when at least one proposal is `approved`; opens confirm modal showing count of approved proposals; on confirm, `POST /api/encode/batches/$batchId/commit`; success toast and redirect to `/authority` with a query param highlighting the new rules
- [ ] Loading: skeleton header + 3 skeleton proposal cards
- [ ] Error: civic banner with retry; per-action errors as toasts

## Files to create / modify

```
src/routes/encode.tsx                                  (new — list)
src/routes/encode.new.tsx                              (new — ingest form)
src/routes/encode.$batchId.tsx                         (new — review)
src/components/govops/encode/BatchRow.tsx              (new)
src/components/govops/encode/IngestForm.tsx            (new)
src/components/govops/encode/ProposalCard.tsx          (new)
src/components/govops/encode/ProposalEditor.tsx        (new — inline modify form)
src/components/govops/encode/ProposalStatusPill.tsx    (new)
src/components/govops/encode/BulkActionBar.tsx         (new)
src/components/govops/encode/EncodeAuditLog.tsx        (new)
src/components/govops/encode/CommitConfirmDialog.tsx   (new)
src/lib/api.ts                                         (modify — add 7 encoder helpers)
src/lib/api.mock.ts                                    (modify — add encode mocks)
src/lib/types.ts                                       (modify — add EncodingBatch, RuleProposal, ProposalStatus)
src/messages/{en,fr,pt-BR,es-MX,de,uk}.json            (modify — add encode.* keys)
```

Update masthead nav: add `/encode` link after `/authority`.

## Tokens / data

```ts
// src/lib/types.ts additions
export type ProposalStatus = "pending" | "approved" | "rejected" | "modified";
export type EncodeMethod = "manual" | "llm:claude" | "manual:llm-fallback";

export interface RuleProposal {
  id: string;
  rule_type: RuleType;          // already exported from govops-010
  description: string;
  formal_expression: string;
  citation: string;
  parameters: Record<string, unknown>;
  status: ProposalStatus;
  notes: string;
  reviewer: string | null;
  reviewed_at: string | null;
  source_section_ref: string;
}

export interface EncodingAuditEntry {
  timestamp: string;
  event_type: string;
  actor: string;
  detail: string;
  data: Record<string, unknown>;
}

export interface EncodingBatch {
  id: string;
  jurisdiction_id: string;
  document_title: string;
  document_citation: string;
  source_url: string | null;
  input_text: string;
  method: EncodeMethod;
  proposals: RuleProposal[];
  audit: EncodingAuditEntry[];
  created_at: string;
}

export interface EncodingBatchSummary {
  id: string;
  jurisdiction_id: string;
  document_title: string;
  document_citation: string;
  method: EncodeMethod;
  counts: Record<ProposalStatus, number>;
  created_at: string;
}
```

```ts
// src/lib/api.ts additions
export interface CreateBatchRequest {
  document_title: string;
  document_citation: string;
  source_url?: string;
  input_text: string;
  method: "manual" | "llm";
  api_key?: string;        // only when method=llm; never logged
}

export async function listEncodingBatches(): Promise<EncodingBatchSummary[]> {
  if (import.meta.env.VITE_USE_MOCK_API === "true") return mockListEncodingBatches();
  try {
    return await fetcher<EncodingBatchSummary[]>("/api/encode/batches");
  } catch {
    return mockListEncodingBatches();
  }
}

export async function getEncodingBatch(id: string): Promise<EncodingBatch> {
  if (import.meta.env.VITE_USE_MOCK_API === "true") return mockGetEncodingBatch(id);
  try {
    return await fetcher<EncodingBatch>(`/api/encode/batches/${encodeURIComponent(id)}`);
  } catch {
    return mockGetEncodingBatch(id);
  }
}

export async function createEncodingBatch(body: CreateBatchRequest): Promise<EncodingBatch> {
  if (import.meta.env.VITE_USE_MOCK_API === "true") return mockCreateEncodingBatch(body);
  try {
    return await fetcher<EncodingBatch>("/api/encode/batches", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (body.method === "llm") {
      // Auto-fallback to manual on LLM failure
      return mockCreateEncodingBatch({ ...body, method: "manual" });
    }
    throw e;
  }
}

export interface ReviewProposalBody {
  status: ProposalStatus;
  notes?: string;
  overrides?: Partial<Pick<RuleProposal, "description" | "formal_expression" | "citation" | "parameters">>;
}

export async function reviewProposal(
  batchId: string, proposalId: string, body: ReviewProposalBody,
): Promise<RuleProposal> {
  if (import.meta.env.VITE_USE_MOCK_API === "true") return mockReviewProposal(batchId, proposalId, body);
  try {
    return await fetcher<RuleProposal>(
      `/api/encode/batches/${encodeURIComponent(batchId)}/proposals/${encodeURIComponent(proposalId)}/review`,
      { method: "POST", body: JSON.stringify(body) },
    );
  } catch {
    return mockReviewProposal(batchId, proposalId, body);
  }
}

export async function bulkReviewProposals(
  batchId: string, body: { proposal_ids: string[]; status: ProposalStatus; notes?: string },
): Promise<{ updated: RuleProposal[] }> {
  if (import.meta.env.VITE_USE_MOCK_API === "true") return mockBulkReviewProposals(batchId, body);
  try {
    return await fetcher(
      `/api/encode/batches/${encodeURIComponent(batchId)}/bulk-review`,
      { method: "POST", body: JSON.stringify(body) },
    );
  } catch {
    return mockBulkReviewProposals(batchId, body);
  }
}

export async function commitBatch(batchId: string): Promise<{ committed_rule_ids: string[] }> {
  if (import.meta.env.VITE_USE_MOCK_API === "true") return mockCommitBatch(batchId);
  try {
    return await fetcher(
      `/api/encode/batches/${encodeURIComponent(batchId)}/commit`,
      { method: "POST" },
    );
  } catch {
    return mockCommitBatch(batchId);
  }
}
```

**Backend additions required (Phase 4 / Phase 6 territory):**
- `GET /api/encode/batches` — list summaries
- `GET /api/encode/batches/{id}` — full batch + proposals + audit
- `POST /api/encode/batches` — create (replaces form-encoded `POST /encode/ingest`)
- `POST /api/encode/batches/{id}/proposals/{pid}/review` — single proposal review
- `POST /api/encode/batches/{id}/bulk-review` — bulk update
- `POST /api/encode/batches/{id}/commit` — promote approved proposals to engine

These are NOT in Phase 1 backend. The frontend uses `VITE_USE_MOCK_API` fallback consistent with `govops-006`/`007`/`008`.

**API key handling**: when `method=llm`, the API key is sent in the request body **once** for that single extraction. Never logged. Never echoed in responses. Document this in the form's help text. The current backend HTML route already follows this pattern.

Tokens used: `--surface`, `--surface-raised` (proposal cards), `--agentic-soft` (agent ribbon panels, fixture-style hero), `--authority` (commit button), `--verdict-pending`/`--verdict-enacted`/`--verdict-rejected` (status pills), `--font-mono` (input text, formal_expression, citations), `--font-serif` (proposal descriptions, document titles).

## Reference implementation

```tsx
// src/components/govops/encode/ProposalCard.tsx
import type { RuleProposal } from "@/lib/types";
import { ProvenanceRibbon } from "@/components/govops/ProvenanceRibbon";
import { CitationLink } from "@/components/govops/CitationLink";
import { ProposalStatusPill } from "./ProposalStatusPill";
import { useIntl } from "react-intl";

export function ProposalCard({
  proposal, isAgent, selected, onSelect, onAct, onModify,
}: {
  proposal: RuleProposal;
  isAgent: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onAct: (status: "approved" | "rejected", notes?: string) => void;
  onModify: () => void;
}) {
  const intl = useIntl();
  return (
    <article className="flex items-stretch rounded-md border border-border bg-surface">
      <ProvenanceRibbon variant={isAgent ? "agent" : "hybrid"} />
      <div className="flex-1 p-5 space-y-3">
        <header className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect(proposal.id)}
            aria-label={intl.formatMessage({ id: "encode.proposal.select" })}
          />
          <div className="flex-1 space-y-1">
            <span className="text-xs uppercase tracking-wide font-mono text-foreground-subtle">
              {intl.formatMessage({ id: `rule_type.${proposal.rule_type}` })}
            </span>
            <h3 className="text-base font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
              {proposal.description}
            </h3>
          </div>
          <ProposalStatusPill status={proposal.status} />
        </header>
        <CitationLink citation={proposal.citation} />
        <pre className="text-xs bg-surface-sunken p-3 rounded font-mono overflow-x-auto">
          {proposal.formal_expression}
        </pre>
        {Object.keys(proposal.parameters).length > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm font-mono">
            {Object.entries(proposal.parameters).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-foreground-muted">{k}</dt>
                <dd>{JSON.stringify(v)}</dd>
              </div>
            ))}
          </dl>
        )}
        <footer className="flex gap-2 pt-2">
          <button onClick={() => onAct("approved")} className="...authority">
            {intl.formatMessage({ id: "encode.proposal.approve" })}
          </button>
          <button onClick={onModify} className="...secondary">
            {intl.formatMessage({ id: "encode.proposal.modify" })}
          </button>
          <button onClick={() => onAct("rejected")} className="...destructive">
            {intl.formatMessage({ id: "encode.proposal.reject" })}
          </button>
        </footer>
      </div>
    </article>
  );
}
```

## i18n

```yaml
locales_required: [en, fr, pt-BR, es-MX, de, uk]
rtl_mirroring: capable_but_inactive
copy_keys:
  - encode.list.heading
  - encode.list.lede
  - encode.list.empty.title
  - encode.list.empty.body
  - encode.list.new
  - encode.list.column.title
  - encode.list.column.citation
  - encode.list.column.method
  - encode.list.column.counts
  - encode.list.column.created
  - encode.method.manual
  - encode.method.llm
  - encode.method.llm_fallback
  - encode.new.heading
  - encode.new.field.title
  - encode.new.field.citation
  - encode.new.field.source_url
  - encode.new.field.method.label
  - encode.new.field.method.manual
  - encode.new.field.method.llm
  - encode.new.field.api_key.label
  - encode.new.field.api_key.help
  - encode.new.field.text.label
  - encode.new.field.text.help
  - encode.new.submit
  - encode.new.submitting
  - encode.new.cancel
  - encode.new.error.llm_fallback        # toast: "LLM extraction failed; falling back to manual rule patterns."
  - encode.review.heading                # ICU: "Review proposals — {title}"
  - encode.review.source_text.toggle
  - encode.review.filter.status
  - encode.review.bulk.heading           # ICU: "{count, plural, one {# selected} other {# selected}}"
  - encode.review.bulk.approve
  - encode.review.bulk.reject
  - encode.review.bulk.clear
  - encode.review.commit
  - encode.review.commit.confirm.title
  - encode.review.commit.confirm.body    # ICU: "Commit {count} approved {count, plural, one {proposal} other {proposals}} to the engine?"
  - encode.review.commit.success         # ICU: "Committed {count} {count, plural, one {rule} other {rules}}"
  - encode.review.audit.heading
  - encode.proposal.select
  - encode.proposal.approve
  - encode.proposal.modify
  - encode.proposal.reject
  - encode.proposal.annotate
  - encode.proposal.notes.label
  - encode.proposal.notes.placeholder
  - encode.proposal.modify.heading
  - encode.proposal.modify.cancel
  - encode.proposal.modify.save
  - proposal_status.pending
  - proposal_status.approved
  - proposal_status.modified
  - proposal_status.rejected
```

## a11y

```yaml
contrast: AA
focus_visible: required
keyboard:
  - List: Tab through batch rows; Enter opens review
  - Ingest form: Tab in source order; Enter does NOT submit textarea (newline); explicit submit button only
  - Review: Tab through filter chips → bulk action bar (when active) → proposal cards in order → audit log toggle → commit button
  - Per proposal: Tab through checkbox → action buttons (approve / modify / reject)
  - Modify form: Esc closes without saving (with dirty-state confirm)
  - Commit confirm modal: focus trapped, Esc cancels, Enter on confirm button submits
aria_live: polite
  - Batch creation success / failure (incl. LLM-fallback toast)
  - Per-proposal review result
  - Bulk action result with count
  - Commit success with count
reduced_motion: respect
form_safety:
  - API key field type="password", autocomplete="off"
  - On batch creation success, do NOT echo the API key back in any UI surface
  - Do NOT log the API key client-side
unsaved_warning:
  - beforeunload listener active when ingest form is dirty or modify form is open
landmarks:
  - <main> for the page
  - <section aria-labelledby="..."> for proposals, audit log
  - Modal: <dialog>-style with role="dialog" aria-modal="true"
```

provenance: hybrid
  # Encoding is the canonical hybrid surface: agent drafts, human ratifies.
  # Per-proposal ribbon depends on the batch method (agent vs hybrid vs human).
  # The /encode list itself uses 'hybrid' as the page-level provenance.

## Out of scope

- Real LLM provider switching (Claude is hardcoded by current backend; abstraction is a separate track)
- LLM streaming output (current backend returns the full response after extraction)
- Diff between proposal and any prior committed rule (would require the impact-index work in Phase 7)
- Reverting a committed batch (out of scope; rules are immutable once on the engine)
- Side-by-side jurisdiction comparison of proposals
- Re-running extraction with a different prompt — that's `govops-008` (prompt admin fixture test) territory
- Persisting fixture batches as ConfigValue records (Phase 4 / `govops-008`)
- WebSocket progress updates during LLM extraction
