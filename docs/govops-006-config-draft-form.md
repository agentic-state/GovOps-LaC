# GovOps Spec — Draft new ConfigValue form
<!-- type: route, priority: p1, depends_on: [govops-001, govops-002, govops-004] -->
type: route
priority: p1
depends_on: [govops-001, govops-002, govops-004]
spec_id: govops-006

## Intent

Let a maintainer draft a new `ConfigValue` — either a brand-new key or a supersession of an existing version. The form enforces the per-parameter contract from [ADR-006](../docs/design/ADRs/ADR-006-per-parameter-granularity.md): one record per leaf value, with citation, rationale, effective date, and an optional `supersedes` link to the prior version.

## Acceptance criteria

- [ ] Route `/config/draft` accepts optional query params: `key`, `jurisdiction_id`, `value_type`, `supersedes_id`. When present, those fields are pre-filled and read-only (except `value`, `effective_from`, `citation`, `rationale`, which are always editable)
- [ ] Form fields:
  - **Key** (text, mono font, validates against `^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+$`)
  - **Jurisdiction** (select: 6 jurisdictions + "global")
  - **Domain** (select: `rule` / `enum` / `ui` / `prompt` / `engine`)
  - **Value type** (select: `number` / `string` / `bool` / `list` / `enum` / `prompt` / `formula`)
  - **Value** (input adapts to value_type — number input, text input, checkbox, tag input, JSON textarea for `formula`, markdown textarea for `prompt`)
  - **Effective from** (date+time picker, defaults to today midnight UTC, must be valid ISO-8601)
  - **Citation** (text, mono font, required for `rule` domain, optional otherwise)
  - **Rationale** (textarea, required, min 20 chars, max 2000)
  - **Language** (select, only shown when domain=`ui`: 6 languages + ar)
  - **Supersedes** (read-only, populated when `supersedes_id` query param is set; shows "Replacing version effective from <date>")
- [ ] On submit: `POST /api/config/values` with the full body. **This endpoint does NOT yet exist in the backend** — the spec is forward-looking; until Phase 6 backend lands, the route should call a mocked client (toggleable via `VITE_USE_MOCK_API=true`) that returns a synthetic ULID after a 300ms delay
- [ ] Successful submit: navigate to the new value's timeline (`/config/$key/$jurisdictionId`) with a toast "Draft created — pending approval"
- [ ] Form validation errors surface inline next to each field, in red, with `aria-invalid="true"` and `aria-describedby` linking to the error message
- [ ] Dirty-state warning: confirm-leave dialog when navigating away with unsaved changes
- [ ] Cancel button: confirm-leave + history.back()
- [ ] Submit button is `<Button variant="agent">` if `author` starts with `agent:`, else `<Button variant="authority">` (per `govops-001` semantics)
- [ ] When `value_type=prompt`, the value textarea expands to fill 50vh, uses `--font-mono`, and shows live character count
- [ ] When `value_type=list` or `enum`, the value field is a tag input — comma or Enter creates a tag

## Files to create / modify

```
src/routes/config.draft.tsx                       (new — flat dot, query params)
src/components/govops/DraftConfigForm.tsx         (new)
src/components/govops/inputs/ValueInput.tsx       (new — dispatches on value_type)
src/components/govops/inputs/TagInput.tsx         (new)
src/components/govops/inputs/DateTimeInput.tsx    (new)
src/components/govops/SupersedesPanel.tsx         (new)
src/lib/api.ts                                    (modify — add `createConfigValue(body)`)
src/lib/api.mock.ts                               (new — mocked POST when VITE_USE_MOCK_API=true)
src/lib/validators.ts                             (new — key regex, value coercion)
src/lib/dirtyState.ts                             (new — useUnsavedChangesPrompt hook)
src/messages/{en,fr,ar}.json                      (modify)
```

## Tokens / data

```ts
// src/lib/types.ts addition
export interface CreateConfigValueRequest {
  domain: string;
  key: string;
  jurisdiction_id: string | null;
  value: unknown;
  value_type: ValueType;
  effective_from: string;          // ISO-8601 with timezone
  effective_to: string | null;
  citation: string | null;
  author: string;                  // current user / agent id
  rationale: string;
  supersedes: string | null;
  language: string | null;
}

// src/lib/api.ts addition
export async function createConfigValue(
  body: CreateConfigValueRequest
): Promise<ConfigValue> {
  if (import.meta.env.VITE_USE_MOCK_API === "true") {
    return mockCreateConfigValue(body);
  }
  const r = await fetcher("/api/config/values", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(err.detail || `createConfigValue failed: ${r.status}`);
  }
  return r.json();
}
```

```ts
// src/lib/validators.ts
export const KEY_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+$/;

export function validateKey(key: string): string | null {
  if (!key) return "validators.key.required";
  if (!KEY_REGEX.test(key)) return "validators.key.format";
  if (key.split(".").length < 3) return "validators.key.too_shallow";
  return null;
}

export function coerceValue(raw: string, type: ValueType): unknown {
  switch (type) {
    case "number":
      const n = Number(raw);
      if (Number.isNaN(n)) throw new Error("validators.value.not_a_number");
      return n;
    case "bool":
      return raw === "true";
    case "list":
    case "enum":
      return raw.split(",").map(s => s.trim()).filter(Boolean);
    case "formula":
      try { return JSON.parse(raw); }
      catch { throw new Error("validators.value.bad_json"); }
    case "string":
    case "prompt":
    default:
      return raw;
  }
}
```

Tokens used: `--surface-raised` (form panel), `--border` (inputs), `--ring` (focus), `--authority` (submit button), `--agentic-soft` (when author=agent), `--verdict-rejected` (validation errors), `--verdict-pending` (draft status pill in success toast).

## Reference implementation

```tsx
// src/routes/config.draft.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { DraftConfigForm } from "@/components/govops/DraftConfigForm";
import { createConfigValue } from "@/lib/api";
import type { CreateConfigValueRequest } from "@/lib/types";

export const Route = createFileRoute("/config/draft")({
  component: DraftPage,
  validateSearch: (s) => ({
    key: typeof s.key === "string" ? s.key : undefined,
    jurisdiction_id: typeof s.jurisdiction_id === "string" ? s.jurisdiction_id : undefined,
    value_type: typeof s.value_type === "string" ? s.value_type : undefined,
    supersedes_id: typeof s.supersedes_id === "string" ? s.supersedes_id : undefined,
  }),
});

function DraftPage() {
  const search = Route.useSearch();
  const nav = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(body: CreateConfigValueRequest) {
    setSubmitting(true);
    try {
      const created = await createConfigValue(body);
      nav({
        to: "/config/$key/$jurisdictionId",
        params: {
          key: created.key,
          jurisdictionId: created.jurisdiction_id ?? "global",
        },
      });
    } finally {
      setSubmitting(false);
    }
  }

  return <DraftConfigForm initial={search} onSubmit={onSubmit} submitting={submitting} />;
}
```

## i18n

```yaml
locales_required: [en, fr, ar]
rtl_mirroring: auto
copy_keys:
  - draft.heading                   # "Draft new ConfigValue"
  - draft.heading.supersede         # "Draft replacement for {key}"
  - draft.field.key.label
  - draft.field.key.help            # "Format: <jurisdiction>-<program>.<domain>.<scope>.<param>"
  - draft.field.jurisdiction.label
  - draft.field.domain.label
  - draft.field.value_type.label
  - draft.field.value.label
  - draft.field.value.placeholder.number
  - draft.field.value.placeholder.string
  - draft.field.value.placeholder.list
  - draft.field.value.placeholder.prompt
  - draft.field.effective_from.label
  - draft.field.effective_from.help # "When this value first takes effect (UTC)."
  - draft.field.citation.label
  - draft.field.citation.help       # "Statute or section reference, e.g. 'OAS Act, s. 3(1)'"
  - draft.field.rationale.label
  - draft.field.rationale.help      # "Why this value, why now? At least 20 characters."
  - draft.field.language.label
  - draft.field.supersedes.title
  - draft.field.supersedes.detail   # ICU: "Replacing version effective {date, date, medium}"
  - draft.submit
  - draft.submit.submitting
  - draft.cancel
  - draft.unsaved.title
  - draft.unsaved.body
  - draft.unsaved.confirm
  - draft.unsaved.dismiss
  - draft.success                   # toast: "Draft created — pending approval"
  - validators.key.required
  - validators.key.format
  - validators.key.too_shallow
  - validators.value.not_a_number
  - validators.value.bad_json
  - validators.rationale.too_short  # ICU: "{min, plural, one {At least # character} other {At least # characters}}"
```

## a11y

```yaml
contrast: AA
focus_visible: required
keyboard:
  - Tab through fields in source order
  - Enter on a field does NOT submit the form (would be too easy to mis-fire); only Submit button submits
  - Esc on tag input closes any open dropdown but does not cancel the form
aria_live: polite
  - On validation failure: errors announced via the form's aria-live region
  - On submit success: toast announced
  - On submit failure: error banner announced
reduced_motion: respect
form_semantics:
  - Wrap in <form aria-labelledby="draft-heading"> with onSubmit handler
  - Each field uses <label htmlFor>; errors via <p id="...-error" role="alert">
  - Required fields marked with aria-required="true" and a visible asterisk
unsaved_warning:
  - beforeunload listener active while form is dirty
  - In-app navigation triggers a confirm dialog (modal, focus-trapped)
```

provenance: hybrid
  # The draft itself is hybrid: an agent may pre-fill, but the human
  # rationale + submission is required. The created ConfigValue's
  # provenance is recorded by author field on the backend.

## Out of scope

- Approval (deferred to `govops-007`)
- Backend implementation of `POST /api/config/values` — this spec defines the contract; the backend ships in Phase 6 of the v2.0 PLAN
- Audit logging beyond what the backend records (no separate frontend audit)
- Bulk import / CSV upload
- Diff preview during drafting (would require resolving the current value first; revisit if maintainers request it)
- Auto-suggesting citations from a legal corpus (out of scope; future encoder integration)
