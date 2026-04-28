# GovOps Spec — Admin federation surface
<!-- type: route, priority: p2, depends_on: [govops-012] -->
type: route
priority: p2
depends_on: [govops-012]
spec_id: govops-020

## Intent

Phase 8 (ADR-009) gives GovOps a federation pipeline: third parties publish
signed lawcode packs, operators fetch them with cryptographic provenance,
and every fetched ConfigValue carries `source_publisher`, `source_repo`,
`source_commit`, `fetched_at`, and `source_signed` so audit can trace any
answer back to its origin.

Today there is no UI surface for this. The CLI (`govops fetch <publisher>`)
is the only way to fetch, and the only way to see what's been fetched is
to grep `lawcode/.federated/`. This spec adds an admin route — gated like
the rest of the admin surfaces (see govops-012) — that exposes:

1. The **registered publishers** from `lawcode/REGISTRY.yaml` plus the
   trust state for each (does a public key exist in the allowlist?).
2. The **imported packs** in `lawcode/.federated/` with their provenance
   (publisher, version, fetched_at, signed-state, file count).
3. **Per-pack actions** — disable / enable a pack without deleting it,
   re-fetch on demand.

The page is read-mostly. The new-publisher PR flow stays in git (matches
ADR-009's "trust is a YAML diff in your own repo" stance); this surface
exposes state and triggers fetches, not editorial flows.

## Backend contract (already shipped)

The backend has the federation pipeline; what's missing is a small set
of read-and-trigger endpoints. This spec assumes (and implies a follow-up
backend slice for) the following minimal API surface:

```
GET  /api/admin/federation/registry     — list registry entries + trust state
GET  /api/admin/federation/packs        — list .federated/<id>/.provenance.json contents
POST /api/admin/federation/fetch/{publisher_id}?dry_run={bool}&allow_unsigned={bool}
                                        — invoke govops.federation.fetch_pack
POST /api/admin/federation/packs/{publisher_id}/disable
POST /api/admin/federation/packs/{publisher_id}/enable
```

Backend slice is a follow-on commit; this spec focuses on the UI shape.
For initial frontend work against the unshipped backend, mock from
`web/src/lib/mock-federation.ts` (mirrors the existing mock pattern).

## Acceptance criteria

### Route — `/admin/federation`

- [ ] New TanStack route at `src/routes/admin.federation.tsx` (sibling to
      the existing admin sub-routes per govops-012). Admin gate applies.
- [ ] Page renders three sections, each its own card:
  1. **Registered publishers** (table)
  2. **Imported packs** (table)
  3. **Fetch a pack** (form)

#### Section 1 — Registered publishers

Columns: Publisher id, Name, Manifest URL, Trust status, Last fetched.

- [ ] **Trust status** is a chip:
  - `Trusted` (green) — public key on file
  - `Unsigned only` (amber) — no public key; `--allow-unsigned` required
  - `Untrusted` (red) — registry entry exists but no key, and the operator
    explicitly disabled `--allow-unsigned` (this case may not be reachable
    in v1; render the chip if the field is set in the API response)
- [ ] **Last fetched** column shows the `fetched_at` from
      `.provenance.json` if present; else `—`.
- [ ] Empty state: "No publishers registered. Add an entry to
      `lawcode/REGISTRY.yaml`." (i18n key
      `admin.federation.empty_registry`)

#### Section 2 — Imported packs

Columns: Publisher, Pack name, Version, Fetched at, Signed, Files,
Status, Actions.

- [ ] **Signed** column: ✓ (signed) / ⚠ (unsigned via --allow-unsigned).
      Sourced from `.provenance.json:signed`.
- [ ] **Status** column: `Active` or `Disabled` chip. (Disabled state
      represented in the API response as `enabled=false`; backend may
      implement disable as a sentinel file in the pack dir.)
- [ ] **Actions**: a `Dropdown` with:
  - `Re-fetch` → calls
    `POST /api/admin/federation/fetch/{publisher_id}` and refreshes the
    section on success.
  - `Disable` (if active) / `Enable` (if disabled) → calls the
    corresponding endpoint.
- [ ] Empty state: "No packs imported yet. Use the form below to fetch
      one." (i18n key `admin.federation.empty_packs`)

#### Section 3 — Fetch a pack

A small form:
- Publisher id (`Select` populated from registry entries; or text input
  if registry is empty)
- `Dry-run` checkbox (default unchecked)
- `Allow unsigned` checkbox (default unchecked, with a tooltip from
  i18n key `admin.federation.allow_unsigned_warning`)
- "Fetch" button

On submit:
- Calls `POST /api/admin/federation/fetch/{publisher_id}` with the query
  flags.
- On `200`: shows a toast with the result summary
  (`Fetched X / pack-name vY.Z, N files, signed=true/false`) and
  refreshes the imported-packs section.
- On `4xx` / `5xx`: shows an error toast with the detail; form values
  are preserved.
- While in flight: button disabled, label switches to "Fetching…"
  (i18n: `admin.federation.fetch_in_progress`).

### i18n keys (all 6 locales)

| key | EN | FR |
| --- | --- | --- |
| `admin.federation.heading` | `Federation` | `Fédération` |
| `admin.federation.lede` | `Third-party lawcode publishers your installation has chosen to trust and fetch from. Trust decisions live in lawcode/global/trusted_keys.yaml; manage publishers in lawcode/REGISTRY.yaml.` | `Éditeurs tiers de lawcode auxquels votre installation a choisi de faire confiance et auprès desquels elle effectue des récupérations. Les décisions de confiance vivent dans lawcode/global/trusted_keys.yaml ; gérer les éditeurs dans lawcode/REGISTRY.yaml.` |
| `admin.federation.section.registry` | `Registered publishers` | `Éditeurs enregistrés` |
| `admin.federation.section.packs` | `Imported packs` | `Packs importés` |
| `admin.federation.section.fetch` | `Fetch a pack` | `Récupérer un pack` |
| `admin.federation.empty_registry` | `No publishers registered. Add an entry to lawcode/REGISTRY.yaml.` | `Aucun éditeur enregistré. Ajoutez une entrée à lawcode/REGISTRY.yaml.` |
| `admin.federation.empty_packs` | `No packs imported yet. Use the form below to fetch one.` | `Aucun pack importé pour l'instant. Utilisez le formulaire ci-dessous pour en récupérer un.` |
| `admin.federation.trust.trusted` | `Trusted` | `Fiable` |
| `admin.federation.trust.unsigned_only` | `Unsigned only` | `Non signé seulement` |
| `admin.federation.trust.untrusted` | `Untrusted` | `Non fiable` |
| `admin.federation.signed.true` | `Signed` | `Signé` |
| `admin.federation.signed.false` | `Unsigned (--allow-unsigned)` | `Non signé (--allow-unsigned)` |
| `admin.federation.action.refetch` | `Re-fetch` | `Récupérer à nouveau` |
| `admin.federation.action.disable` | `Disable` | `Désactiver` |
| `admin.federation.action.enable` | `Enable` | `Activer` |
| `admin.federation.fetch.publisher_id` | `Publisher` | `Éditeur` |
| `admin.federation.fetch.dry_run` | `Dry-run (verify only, do not write)` | `Vérification seule (ne rien écrire)` |
| `admin.federation.fetch.allow_unsigned` | `Allow unsigned` | `Autoriser non signé` |
| `admin.federation.allow_unsigned_warning` | `Records fetched without a verified signature are stamped source_signed=false in the audit trail. Use only for sandbox or research scenarios.` | `Les enregistrements récupérés sans signature vérifiée sont marqués source_signed=false dans la piste d'audit. À utiliser uniquement pour des scénarios sandbox ou de recherche.` |
| `admin.federation.fetch.submit` | `Fetch` | `Récupérer` |
| `admin.federation.fetch_in_progress` | `Fetching…` | `Récupération…` |

For pt-BR, es-MX, de, uk: machine-translate and flag.

### Out of scope

- **No new-publisher form.** Adding a registry entry remains a YAML PR
  per ADR-009 — that's the audit-of-trust-decision. A web form would
  bypass that audit.
- **No key-rotation UI.** A future ADR + spec covers rotation. v1
  treats it as a YAML PR.
- **No revocation flow.** Same — out of scope for v1.
- **No pack diff viewer.** Comparing what a re-fetch would change
  against what's currently imported is a useful affordance but a
  separate spec.

### Verification

- [ ] With an empty REGISTRY.yaml: the page renders both empty states
      and the fetch form (with the publisher field disabled or showing
      "no publishers registered").
- [ ] With a populated registry + a successfully-fetched pack: both
      tables render with the expected fields and the "Re-fetch" /
      "Disable" actions are wired.
- [ ] Allow-unsigned tooltip is visible on hover and matches the i18n
      string.
- [ ] FR locale renders all section headings, chips, and tooltips in
      French; the long lede paragraph wraps correctly without overflowing
      the card.
- [ ] `npm run check:i18n` passes.
- [ ] `npm run lint` clean.
