# GovOps Spec — Prompt admin
<!-- type: route, priority: p1, depends_on: [govops-001, govops-002, govops-003, govops-004, govops-005, govops-006, govops-007] -->
type: route
priority: p1
depends_on: [govops-001, govops-002, govops-003, govops-004, govops-005, govops-006, govops-007]
spec_id: govops-008

## Intent

Treat LLM prompts as `ConfigValue` records (`value_type=prompt`) and give maintainers a dedicated authoring surface for them: markdown-aware editor, side-by-side diff against the in-effect version, and a "test against fixture" panel that runs the encoder on a saved fixture batch and shows the resulting proposals. This satisfies the v2.0 thesis that prompts are dated configuration, not deploy-time constants.

## Acceptance criteria

- [ ] Route `/config/prompts` lists all `value_type=prompt` records — one row per `(key, jurisdiction_id)` pair, showing the current-effective version. Loaded via `GET /api/config/values?domain=prompt`
- [ ] Each row shows: prompt key (mono), title (derived from the last segment of the key, humanized), current-effective version's first 200 chars, version count, "Edit" and "View timeline" buttons
- [ ] Click "Edit" → `/config/prompts/$key/$jurisdictionId/edit` (or "global" for jurisdiction-less prompts)
- [ ] Editor page layout (≥1024px viewport): three-column grid
  - **Left (35%)**: Markdown editor (CodeMirror 6 with `markdown` mode, `--font-mono`)
  - **Middle (35%)**: Live preview (rendered markdown of the editor contents)
  - **Right (30%)**: Fixture test panel
- [ ] Below 1024px: tabs instead of columns ("Edit" / "Preview" / "Test")
- [ ] **Editor** features: line numbers, soft-wrap, syntax highlighting for variables `{like_this}`, character count, "Reset to current-effective" button, autosave to localStorage every 5s with key `govops-prompt-draft-<key>-<jurisdictionId>` (cleared on submit)
- [ ] **Diff toggle**: "Show diff vs current" button overlays a diff view (reusing `<ValueDiff>` from `govops-005`) using the current localStorage draft as `to` and the current-effective version as `from`
- [ ] **Fixture test panel**:
  - Dropdown of available fixture batches (loaded from `GET /api/encode/fixtures` — see "Backend additions")
  - "Run extraction with this prompt" button — POSTs to `/api/encode/fixtures/{fixture_id}/run-with-prompt` with body `{prompt_text, prompt_key}`; backend executes the encoder pipeline against the fixture using this prompt without committing rules
  - Result panel shows: extracted proposals (count, types, key parameters), raw LLM response, latency, token count
  - "Compare with previous run" — store last 3 runs in localStorage, allow toggling to compare result counts and proposal sets
- [ ] Submit flow: "Save as draft" → calls `createConfigValue` (per `govops-006`) with `value_type=prompt`, `domain=prompt`, status implicitly `draft`, `supersedes` set to current-effective id; redirects to approval flow (`govops-007`)
- [ ] **Dual-approval marker**: per [PLAN.md Gate 4](../PLAN.md), prompt approvals will eventually require two approvers; for v1, the UI shows a "Requires dual approval" badge on prompt-type drafts in the approvals list — the second-approver mechanism is documented as Phase 4 backend work, not implemented in this spec
- [ ] Loading: skeleton editor + skeleton fixture panel
- [ ] Errors: toasts for fixture-test failures (network, LLM timeout, validation)

## Files to create / modify

```
src/routes/config.prompts.tsx                       (new — list view)
src/routes/config.prompts.$key.$jurisdictionId.edit.tsx (new — three-column editor)
src/components/govops/PromptEditor.tsx              (new — CodeMirror wrapper)
src/components/govops/PromptPreview.tsx             (new — markdown render)
src/components/govops/FixtureTestPanel.tsx          (new)
src/components/govops/PromptDraftAutosave.tsx       (new — localStorage hook)
src/components/govops/DualApprovalBadge.tsx         (new)
src/lib/api.ts                                      (modify — add fixture endpoints)
src/lib/markdown.ts                                 (new — sanitized renderer)
src/messages/{en,fr,ar}.json                        (modify)
package.json                                        (add @codemirror/lang-markdown, @uiw/react-codemirror, marked, dompurify)
```

## Tokens / data

```ts
// src/lib/api.ts additions
export interface FixtureBatchSummary {
  id: string;
  jurisdiction_id: string;
  document_title: string;
  document_citation: string;
  text_length: number;
  created_at: string;
}

export interface FixtureRunResult {
  fixture_id: string;
  prompt_key: string;
  proposals_count: number;
  proposals: Array<{
    rule_type: string;
    description: string;
    citation: string;
    parameters: Record<string, unknown>;
  }>;
  raw_response: string;
  latency_ms: number;
  token_count: number | null;
}

export async function listFixtures(): Promise<FixtureBatchSummary[]> {
  const r = await fetcher("/api/encode/fixtures");
  if (!r.ok) throw new Error(`listFixtures failed: ${r.status}`);
  return r.json();
}

export async function runFixtureWithPrompt(
  fixtureId: string,
  body: { prompt_text: string; prompt_key: string }
): Promise<FixtureRunResult> {
  const r = await fetcher(`/api/encode/fixtures/${fixtureId}/run-with-prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
```

**Backend additions required (forward-looking, Phase 4):**
- `GET /api/encode/fixtures` — list saved fixture batches the maintainer can test against
- `POST /api/encode/fixtures/{fixture_id}/run-with-prompt` — body `{prompt_text, prompt_key}`; backend executes the encoder against the fixture using the supplied prompt; returns proposals, raw response, latency, token count; **does NOT commit rules**

These are NOT in the Phase 1 backend. The frontend uses the same `VITE_USE_MOCK_API` toggle as `govops-006`/`govops-007`.

Tokens used: `--surface-raised` (editor pane), `--surface-sunken` (preview pane), `--agentic-soft` (fixture panel — agent-territory background), `--font-mono` (editor), `--font-serif` (preview body), `--ring-focus`, `--diff-added-bg` / `--diff-removed-bg` (when diff overlay active).

Editor styling: CodeMirror theme should consume CSS vars so it matches GovOps tokens — supply `--cm-bg: var(--surface-raised); --cm-fg: var(--foreground); --cm-cursor: var(--agentic);` etc.

## Reference implementation

```tsx
// src/components/govops/PromptEditor.tsx
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { useEffect } from "react";
import { useIntl } from "react-intl";

const govopsTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--surface-raised)",
    color: "var(--foreground)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.875rem",
    height: "100%",
  },
  ".cm-cursor": { borderColor: "var(--agentic)" },
  ".cm-selectionBackground": { backgroundColor: "var(--agentic-soft)" },
  ".cm-line": { paddingInline: "var(--space-2)" },
});

export function PromptEditor({
  value,
  onChange,
  onAutosave,
}: {
  value: string;
  onChange: (v: string) => void;
  onAutosave: (v: string) => void;
}) {
  const intl = useIntl();

  useEffect(() => {
    const t = setTimeout(() => onAutosave(value), 5000);
    return () => clearTimeout(t);
  }, [value, onAutosave]);

  return (
    <div
      role="region"
      aria-label={intl.formatMessage({ id: "prompt.editor.aria" })}
      className="h-full rounded-md border border-border overflow-hidden"
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={[markdown(), govopsTheme]}
        basicSetup={{ lineNumbers: true, highlightActiveLine: true }}
        height="100%"
      />
    </div>
  );
}
```

## i18n

```yaml
locales_required: [en, fr, ar]
rtl_mirroring: auto
copy_keys:
  - prompts.heading                          # "Prompts as configuration"
  - prompts.subheading                       # "Edit, version, and test the LLM prompts the encoder uses."
  - prompts.row.versions                     # ICU: "{count, plural, one {# version} other {# versions}}"
  - prompts.row.edit
  - prompts.row.timeline
  - prompts.empty.title
  - prompts.empty.body
  - prompt.editor.heading                    # ICU: "Editing {key}"
  - prompt.editor.aria
  - prompt.editor.col.edit
  - prompt.editor.col.preview
  - prompt.editor.col.test
  - prompt.editor.reset
  - prompt.editor.show_diff
  - prompt.editor.hide_diff
  - prompt.editor.autosave_status            # ICU: "Autosaved {time, relativeTime}"
  - prompt.editor.character_count            # ICU: "{count, number} characters"
  - prompt.editor.save_draft
  - prompt.editor.discard
  - prompt.fixture.heading                   # "Test against fixture"
  - prompt.fixture.select.label
  - prompt.fixture.select.placeholder
  - prompt.fixture.run
  - prompt.fixture.running
  - prompt.fixture.result.heading
  - prompt.fixture.result.proposals          # ICU: "{count, plural, one {# proposal} other {# proposals}}"
  - prompt.fixture.result.latency            # ICU: "{ms, number} ms"
  - prompt.fixture.result.tokens             # ICU: "{tokens, number} tokens"
  - prompt.fixture.result.compare_with_previous
  - prompt.fixture.error.timeout
  - prompt.fixture.error.no_response
  - prompt.dual_approval.badge               # "Requires dual approval"
  - prompt.dual_approval.tooltip             # explains Phase 4 policy
```

## a11y

```yaml
contrast: AA
focus_visible: required
keyboard:
  - Editor: standard CodeMirror keybindings preserved
  - Tab from editor wrapper to "Reset" / "Show diff" buttons; do NOT trap Tab inside CodeMirror — Tab should advance to the next region (use Esc to release CodeMirror first if it captures Tab)
  - Fixture panel: Tab to dropdown → Run button → Results table
aria_live: polite
  - "Autosaved" announcement after each autosave (debounced)
  - Fixture run start / completion / error
  - Diff toggle on/off
reduced_motion: respect
codemirror_a11y:
  - Provide aria-label on the editor wrapper
  - Ensure screen-readers can read the editor as a textarea (CodeMirror exposes role="textbox" by default)
  - Live region announces line/column on cursor moves only when explicitly enabled (off by default — too noisy)
markdown_render_safety:
  - Sanitize via DOMPurify; allow standard markdown tags only; disallow <script>, <iframe>, on* handlers
```

provenance: hybrid
  # Prompts are agent-territory by use, but human-authored.
  # Editing UI uses lavender accents (agent-soft fixture panel),
  # action buttons use authority styling (gold) for the human approval step.

## Out of scope

- Live LLM preview from inside the editor (the fixture panel is the only execution path)
- Multi-prompt batches (one prompt edited at a time)
- Versioning the dual-approval policy itself (the Phase 4 backend work)
- Diffing across translations (each prompt is single-language)
- Real-time collaboration / concurrent editors
- Prompt linting / quality scoring
- Auto-suggesting variable names — user types `{like_this}` manually for v1
