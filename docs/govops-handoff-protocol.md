# GovOps — Spec Handoff Protocol (Agent → Lovable)

How another agent should hand specs back to me (Lovable) so I can implement
them in one pass without follow-up questions. Optimized for **agent-to-agent**
clarity, not human reading.

---

## 1. Format I prefer (in order of preference)

1. **Single Markdown file** with embedded fenced code blocks (`json`, `tsx`, `css`, `ts`).
   This is my favorite — I can read intent + copy code in one pass.
2. **JSON spec** (machine schema below) when the handoff is purely tokens/config.
3. **Mixed bundle**: one `.md` + referenced `.json` / `.png` files in `/mnt/documents/`.

Avoid: PDFs, screenshots-only, prose without code, or specs split across many files.

---

## 2. The canonical request envelope

Every spec the other agent sends me should follow this shape. Paste it directly
into chat — I'll treat it as authoritative.

```md
# GovOps Spec — <short title>
<!-- one of: tokens | component | route | layout | flow | copy | i18n | a11y-fix -->
type: <type>
priority: <p0 | p1 | p2>
depends_on: [<other spec ids or "none">]
spec_id: govops-<NNN>

## Intent
<1–3 sentences. What user-facing outcome? Why now?>

## Acceptance criteria
- [ ] Concrete, testable bullet
- [ ] Concrete, testable bullet

## Files to create / modify
- `src/routes/policies.$policyId.tsx` (new)
- `src/styles.css` (modify: add `--ribbon-agent`)

## Tokens / data (if any)
\`\`\`json
{ "...": "..." }
\`\`\`

## Reference implementation (optional, but loved)
\`\`\`tsx
// pseudo or real TSX showing the desired API
\`\`\`

## Out of scope
- Bullet of things NOT to touch
```

That's it. If the other agent gives me this envelope, I implement immediately.

---

## 3. JSON schema (when sending pure tokens/config)

Use this when the spec is data, not UI. Same envelope, but the body is JSON.

```json
{
  "spec_id": "govops-014",
  "type": "tokens",
  "priority": "p1",
  "depends_on": ["govops-001"],
  "intent": "Add semantic ribbon tokens for hybrid provenance (agent + human co-author).",
  "acceptance": [
    "--ribbon-hybrid resolves in light and dark",
    "Contrast vs --parchment ≥ 3:1",
    "Exposed as Tailwind class `border-ribbon-hybrid`"
  ],
  "changes": {
    "src/styles.css": {
      "add_to_root": {
        "--ribbon-hybrid": "oklch(0.74 0.12 180)"
      },
      "add_to_dark": {
        "--ribbon-hybrid": "oklch(0.78 0.10 180)"
      },
      "add_to_theme_inline": {
        "--color-ribbon-hybrid": "var(--ribbon-hybrid)"
      }
    }
  },
  "out_of_scope": ["Do not change existing agent/human ribbon hues"]
}
```

---

## 4. Naming + ID conventions

- `spec_id`: `govops-NNN` (zero-padded, monotonically increasing).
- File paths: always project-relative, POSIX (`src/...`), never absolute.
- Token names: kebab-case CSS vars, semantic not literal
  (`--ribbon-agent`, not `--lavender-2`).
- Routes: TanStack flat dot convention (`policies.$policyId.tsx`),
  never directory nesting, never `src/pages/`.

---

## 5. What to include vs. omit

**Include:**
- Intent + acceptance criteria (non-negotiable)
- Exact file paths
- Token values in OKLCH
- ICU MessageFormat strings for any user-facing copy (with `en`, plus at least
  one RTL locale like `ar` if i18n-relevant)
- A11y notes (focus, ARIA, contrast targets) when component-level
- Provenance: which surfaces are agent vs human vs hybrid

**Omit:**
- Long rationale paragraphs (link to the paper / earlier specs instead)
- Visual mockups as prose ("a card with a shadow…") — send a token spec or a TSX sketch
- Implementation details for files I shouldn't touch (`routeTree.gen.ts`, lockfiles)
- Anything about Supabase wiring unless the spec is explicitly backend

---

## 6. Multilingual + RTL expectations (always-on)

Every component spec must declare:

```md
i18n:
  locales_required: [en, ar, fr]   # at minimum en + one RTL
  rtl_mirroring: auto              # or: manual, none
  copy_keys:
    - policy.proposal.title
    - policy.proposal.cta.review
```

I will then use logical CSS properties (`padding-inline-start`, `margin-inline-end`)
and ICU MessageFormat by default.

---

## 7. Accessibility expectations (always-on)

Every interactive component spec must declare:

```md
a11y:
  contrast: AA              # or AAA
  focus_visible: required
  keyboard: [Tab, Enter, Esc]
  aria_live: polite         # if streams agent output
  reduced_motion: respect
```

---

## 8. Provenance ribbons — required field on every surface

Every component or route spec must say which ribbon applies:

```md
provenance: agent     # one of: agent | human | hybrid | none
```

This drives the 3px inline-start ribbon color and the ARIA label.

---

## 9. Dependencies on prior specs

If the new spec depends on tokens or components from earlier specs, list IDs
in `depends_on`. If a dependency is missing, I'll stop and ask — not guess.

---

## 10. Example: a complete, well-formed spec

```md
# GovOps Spec — Policy proposal review card
type: component
priority: p1
depends_on: [govops-001, govops-007]
spec_id: govops-022

## Intent
Surface an agent-drafted policy amendment for a human reviewer. Must clearly
mark agent provenance and offer Approve / Request changes / Reject actions.

## Acceptance criteria
- [ ] Renders title, summary, and a diff snippet (before/after)
- [ ] Lavender 3px inline-start ribbon (provenance: agent)
- [ ] Three actions, keyboard reachable in source order
- [ ] aria-live="polite" on the streaming summary region
- [ ] RTL: actions reverse via flex-direction logical property
- [ ] Contrast AA for all text on parchment + ink

## Files to create / modify
- `src/components/govops/ProposalCard.tsx` (new)
- `src/routes/proposals.$proposalId.tsx` (new)

## Tokens / data
\`\`\`json
{
  "uses_tokens": ["--ribbon-agent", "--parchment", "--ink", "--mono"],
  "spacing": { "padding": "var(--space-5)", "gap": "var(--space-3)" }
}
\`\`\`

## Reference implementation
\`\`\`tsx
<ProposalCard
  provenance="agent"
  title={t("proposal.title")}
  diff={{ before, after }}
  onApprove={...} onRequestChanges={...} onReject={...}
/>
\`\`\`

## i18n
locales_required: [en, ar, fr]
rtl_mirroring: auto
copy_keys: [proposal.title, proposal.cta.approve, proposal.cta.changes, proposal.cta.reject]

## a11y
contrast: AA
focus_visible: required
keyboard: [Tab, Shift+Tab, Enter, Space]
aria_live: polite
reduced_motion: respect

provenance: agent

## Out of scope
- Backend wiring for approve/reject (separate spec)
- Notification toasts
```

---

## TL;DR for the other agent

> Send one Markdown message per spec, using the envelope in §2. Always include
> `intent`, `acceptance`, `files`, `provenance`, `i18n`, `a11y`. Use OKLCH for
> colors, logical CSS properties, TanStack flat routes. If unsure, send the
> smallest spec that compiles — I'll iterate.
