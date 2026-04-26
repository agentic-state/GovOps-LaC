# GovOps Spec — ConfigValue approval flow
<!-- type: route, priority: p1, depends_on: [govops-001, govops-002, govops-004, govops-006] -->
type: route
priority: p1
depends_on: [govops-001, govops-002, govops-004, govops-006]
spec_id: govops-007

## Intent

Surface every `ConfigValue` in `draft` or `pending` status, let a maintainer review the proposal alongside its current-effective predecessor, and act: **approve**, **request changes**, or **reject**. Approval flips the record to `approved` status and (per backend) closes any superseded record's effective window. This is the human-authority surface — it is the only place a draft becomes operational.

## Acceptance criteria

- [ ] Route `/config/approvals` lists all records with `status in ("draft", "pending")` from `GET /api/config/values?status=draft,pending` (a forward-looking filter — see "Backend additions" below)
- [ ] List shows: key (mono), proposed value preview, author, created_at (relative: "2 days ago"), status pill, supersedes link if any
- [ ] Click a row → `/config/approvals/$id` (the approval review page)
- [ ] Approval review page shows:
  - **Header**: key, jurisdiction, value type, status pill, "Drafted by {author} on {date}"
  - **Side-by-side panes** (≥768px): "Currently in effect" (left) vs "Proposed" (right). The currently-in-effect pane resolves via `GET /api/config/resolve?key=...&jurisdiction_id=...&evaluation_date=<now>`. If no current value exists, the left pane shows an empty-state card "No prior version — this would be the first."
  - **Diff view** below: reuse `<ValueDiff>` component from `govops-005`
  - **Metadata strip**: rationale, citation, effective_from
  - **Action panel** (sticky on right or bottom): three buttons + a comment field
- [ ] **Approve** button (variant: `authority`, gold): opens confirm modal showing summary of what will change; on confirm, `POST /api/config/values/$id/approve` with `{approved_by, comment}`; on success, toast + redirect to `/config/$key/$jurisdictionId`
- [ ] **Request changes** button (variant: `secondary`): requires a comment ≥ 10 chars; `POST /api/config/values/$id/request-changes` with `{reviewer, comment}`; flips status to `draft`; redirects to approvals list
- [ ] **Reject** button (variant: `destructive`): confirm modal; requires a comment ≥ 10 chars; `POST /api/config/values/$id/reject` with `{reviewer, comment}`; flips status to `rejected`; redirects to approvals list
- [ ] Action panel disabled (with explanation) if the current user is the same as `author` (no self-approval) — for v1, "current user" is `localStorage["govops-user"]` defaulting to `"maintainer"`; the author check is a heuristic, not security
- [ ] Each action records an entry the backend writes to the audit trail; no separate frontend persistence
- [ ] Empty state: "No items awaiting review" with a back link to `/config`
- [ ] Loading state: skeleton list (3 rows) for the index, skeleton panes for the detail view
- [ ] Error state: civic banner with retry; on action failure (network/validation), toast with reason
- [ ] Live region announces status changes ("Approved", "Changes requested", "Rejected")

## Files to create / modify

```
src/routes/config.approvals.tsx                  (new — list of pending items)
src/routes/config.approvals.$id.tsx              (new — review + action page)
src/components/govops/ApprovalRow.tsx            (new)
src/components/govops/ApprovalActions.tsx        (new — three buttons + comment)
src/components/govops/ConfirmActionDialog.tsx    (new — shadcn Dialog wrapper)
src/components/govops/CurrentVsProposed.tsx      (new — side-by-side panes)
src/lib/api.ts                                   (modify — add 3 action helpers + approvalsList)
src/lib/currentUser.ts                           (new — localStorage shim)
src/messages/{en,fr,ar}.json                     (modify)
```

## Tokens / data

```ts
// src/lib/api.ts additions
export async function listApprovals(): Promise<ListConfigValuesResponse> {
  // Query backend for all non-approved records; client-side join with predecessors.
  const draft = await fetcher("/api/config/values?status=draft").then(r => r.json());
  const pending = await fetcher("/api/config/values?status=pending").then(r => r.json());
  return {
    values: [...draft.values, ...pending.values],
    count: draft.count + pending.count,
  };
}

export async function approveConfigValue(
  id: string,
  body: { approved_by: string; comment: string }
): Promise<ConfigValue> {
  const r = await fetcher(`/api/config/values/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function requestChangesConfigValue(
  id: string,
  body: { reviewer: string; comment: string }
): Promise<ConfigValue> {
  const r = await fetcher(`/api/config/values/${id}/request-changes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function rejectConfigValue(
  id: string,
  body: { reviewer: string; comment: string }
): Promise<ConfigValue> {
  const r = await fetcher(`/api/config/values/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
```

**Backend additions required (forward-looking, Phase 6):**
- `GET /api/config/values?status=<draft|pending|approved|rejected>` — extend the filter
- `POST /api/config/values/{id}/approve` — body `{approved_by, comment}`; flips status, writes audit entry
- `POST /api/config/values/{id}/request-changes` — body `{reviewer, comment}`; status → draft; writes audit
- `POST /api/config/values/{id}/reject` — body `{reviewer, comment}`; status → rejected; writes audit

These are NOT in the Phase 1 backend (which is read-only). The frontend uses the same `VITE_USE_MOCK_API` toggle as `govops-006` until the Phase 6 backend lands.

Tokens used: `--authority` (approve button), `--agentic-soft` (proposed pane background), `--surface-sunken` (current pane background), `--verdict-pending` (status pill), `--verdict-rejected` (reject button), `--ring-focus` (focus ring on action buttons).

## Reference implementation

```tsx
// src/components/govops/ApprovalActions.tsx
import { useIntl } from "react-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";  // shadcn
import { Textarea } from "@/components/ui/textarea";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { getCurrentUser } from "@/lib/currentUser";
import {
  approveConfigValue,
  requestChangesConfigValue,
  rejectConfigValue,
} from "@/lib/api";
import type { ConfigValue } from "@/lib/types";

export function ApprovalActions({ cv, onResolved }: { cv: ConfigValue; onResolved: () => void }) {
  const intl = useIntl();
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState<null | "approve" | "request" | "reject">(null);
  const [busy, setBusy] = useState(false);

  const user = getCurrentUser();
  const isSelfApproval = user === cv.author;

  async function run() {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending === "approve") {
        await approveConfigValue(cv.id, { approved_by: user, comment });
      } else if (pending === "request") {
        await requestChangesConfigValue(cv.id, { reviewer: user, comment });
      } else {
        await rejectConfigValue(cv.id, { reviewer: user, comment });
      }
      onResolved();
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  return (
    <section
      aria-labelledby="actions-heading"
      className="rounded-lg border border-border bg-surface p-5 space-y-4 sticky top-4"
    >
      <h2 id="actions-heading" className="text-lg font-semibold">
        {intl.formatMessage({ id: "approvals.actions.heading" })}
      </h2>
      {isSelfApproval && (
        <div role="alert" className="rounded bg-verdict-pending/10 p-3 text-sm">
          {intl.formatMessage({ id: "approvals.self_approval_blocked" })}
        </div>
      )}
      <Textarea
        aria-label={intl.formatMessage({ id: "approvals.comment.label" })}
        placeholder={intl.formatMessage({ id: "approvals.comment.placeholder" })}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
      />
      <div className="flex flex-col gap-2">
        <Button
          variant="authority"
          disabled={isSelfApproval || busy}
          onClick={() => setPending("approve")}
        >
          {intl.formatMessage({ id: "approvals.action.approve" })}
        </Button>
        <Button
          variant="secondary"
          disabled={isSelfApproval || busy || comment.length < 10}
          onClick={() => setPending("request")}
        >
          {intl.formatMessage({ id: "approvals.action.request_changes" })}
        </Button>
        <Button
          variant="destructive"
          disabled={isSelfApproval || busy || comment.length < 10}
          onClick={() => setPending("reject")}
        >
          {intl.formatMessage({ id: "approvals.action.reject" })}
        </Button>
      </div>
      <ConfirmActionDialog
        open={pending !== null}
        action={pending}
        cv={cv}
        comment={comment}
        busy={busy}
        onConfirm={run}
        onCancel={() => setPending(null)}
      />
    </section>
  );
}
```

## i18n

```yaml
locales_required: [en, fr, ar]
rtl_mirroring: auto
copy_keys:
  - approvals.heading                       # "Pending approvals"
  - approvals.empty.title
  - approvals.empty.body
  - approvals.review.heading                # ICU: "Review draft for {key}"
  - approvals.pane.current                  # "Currently in effect"
  - approvals.pane.proposed                 # "Proposed"
  - approvals.pane.no_prior                 # "No prior version — this would be the first."
  - approvals.actions.heading
  - approvals.action.approve
  - approvals.action.request_changes
  - approvals.action.reject
  - approvals.comment.label
  - approvals.comment.placeholder           # "Reason for your decision (visible in audit trail)"
  - approvals.confirm.approve.title
  - approvals.confirm.approve.body          # ICU: "Approve {key} effective {date, date, medium}?"
  - approvals.confirm.reject.title
  - approvals.confirm.reject.body
  - approvals.confirm.cta.approve
  - approvals.confirm.cta.cancel
  - approvals.success.approved
  - approvals.success.requested_changes
  - approvals.success.rejected
  - approvals.error.generic
  - approvals.self_approval_blocked         # "You can't act on a draft you authored."
  - approvals.row.author                    # ICU: "by {author}"
  - approvals.row.created_at                # ICU: "{date, relativeTime}"
```

## a11y

```yaml
contrast: AA
focus_visible: required
keyboard:
  - List view: Tab through rows; Enter opens detail
  - Detail view: Tab order — back link → tabs (current/proposed/diff if tabbed) → comment field → approve → request changes → reject
  - Modal: focus trapped, Esc closes, Enter on confirm button submits
aria_live: polite
  - Announce action result ("Approved", "Changes requested", "Rejected")
  - Announce when self-approval is blocked
reduced_motion: respect
modal:
  - shadcn Dialog with focus-trap and aria-modal
  - Restore focus to triggering button on close
landmarks:
  - <main> for the page
  - Detail view: <article> for each pane (current, proposed); <section aria-labelledby="actions-heading"> for action panel
```

provenance: human
  # Approval is the canonical human-authority act. The button styling
  # (authority variant) and provenance label make this explicit.

## Out of scope

- Multi-reviewer dual-approval (PLAN.md Gate 4 / [ADR-008] is for prompt-as-config dual approval, deferred to Phase 4)
- Approval delegation
- Bulk approve / reject
- Real authentication — `getCurrentUser()` reads from localStorage as a stub
- Comment threading on a draft (one comment per action only)
- Email / Slack notifications
- Approval expiry / auto-reject after N days
