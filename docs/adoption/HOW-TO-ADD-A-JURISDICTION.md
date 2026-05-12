# How to add a jurisdiction to GovOps

This is the v3.1 adoption walkthrough. As of v3.1 there are **two supported paths** to add a new jurisdiction; both are zero-Python-edit. Pick the one that matches your environment.

| Path | When to use | Reversible? |
|---|---|---|
| **A — CLI + file edit** | You have shell access to the running instance (or run locally). | Yes (`git rm -r lawcode/<code>/`). |
| **B — Substrate API (`/api/authoring/*`)** | You only have HTTP access (hosted demo, ephemeral container) and want draft / approve / commit semantics. | Yes (`DELETE /api/authoring/drafts/{id}` before commit; after commit, the YAML is on disk and can be `git rm`'d). |

Both paths terminate at the same place: a `lawcode/<code>/` directory the L3 discovery loader (ADR-020) walks at startup. **Adding a jurisdiction never requires editing `src/govops/jurisdictions.py`.** If you find yourself looking at that file, you're following a pre-v3.1 runbook.

---

## Path A — CLI + file edit

Best for: local development, on-prem deployments, anywhere you have shell access.

### A1. Scaffold the skeleton

```bash
govops init pl --shapes oas,ei
```

This writes the following tree under `lawcode/pl/` (the L3 loader's discovery path; pinned by `tests/test_cli_init.py::TestInitLoaderRoundTrip`):

```
lawcode/pl/
├── config/
│   ├── jurisdiction.yaml    # ADR-019 metadata block + ConfigValue defaults
│   ├── oas-rules.yaml       # substrate values (per-parameter, dated)
│   └── ei-rules.yaml
└── programs/
    ├── oas.yaml             # program manifest (ADR-014)
    ├── oas.md               # plain-language sidecar
    ├── ei.yaml
    └── ei.md
```

Every value with a placeholder (`TODO ...`) is a hand-fill point. The skeleton is schema-valid the moment it lands — `pytest -q` confirms the structure before you touch a single citation.

### A2. Fill in the metadata + manifests

Edit `config/jurisdiction.yaml`, then each `programs/<id>.yaml`, replacing TODOs with statute-anchored values. The runbook `docs/runbooks/add-jurisdiction.md` walks the per-section discipline (authority chain, legal documents, rules, demo cases).

### A3. Make the jurisdiction live

Local: restart the FastAPI process. The L3 loader picks up `lawcode/pl/` at startup.

Without restart (test fixture or live admin script):

```python
from govops.jurisdictions import reload_registry
reload_registry()
```

Hot reload rebuilds `JURISDICTION_REGISTRY` in place. Existing references stay valid.

### A4. Verify

```bash
# YAML schema validity
python scripts/validate_lawcode.py

# Backend journey
pytest -q

# In the browser
curl -s "http://localhost:8000/api/authority-chain?jurisdiction_id=pl" | jq '.jurisdiction'
```

The new jurisdiction appears in the `/authority` picker, the `/compare` table, and the `/screen` form (after adding `pl` to the `SCREEN_JURISDICTIONS` allowlist per `docs/runbooks/add-jurisdiction.md` step 6 — that allowlist remains TypeScript-bound for v3.1; it migrates to a registry-driven shape in v3.2).

---

## Path B — Substrate API (in-app authoring)

Best for: hosted demo, ephemeral containers, multi-operator workflows where you want a draft / approve / commit audit trail before content lands on disk. Backed by ADR-022.

### B1. Draft the jurisdiction metadata

```bash
curl -s -X POST http://localhost:8000/api/authoring/drafts \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
{
  "type": "jurisdiction",
  "target_path": "pl/config/jurisdiction.yaml",
  "content": {
    "jurisdiction": {
      "id": "jur-pl-national",
      "country": "PL",
      "level": "national",
      "parent_id": null,
      "name": {"en": "Poland", "pl": "Polska"},
      "legal_tradition": "civil_law",
      "language_regime": "pl",
      "default_language": "pl"
    },
    "defaults": {"domain": "ui", "jurisdiction_id": "pl-oas", "effective_from": "1900-01-01"},
    "values": []
  },
  "author": "alice@example.org",
  "rationale": "Onboarding Poland OAS pilot."
}
EOF
```

The response contains the draft's `id`. The draft is now PENDING and persisted under `lawcode/.drafts/<id>.yaml` (survives restart).

### B2. Draft the program manifest

Same shape; `type: program` and `target_path: pl/programs/oas.yaml`. The `content` is the full program manifest including authority chain, legal documents, rules, and demo cases.

### B3. Approve each draft

```bash
curl -s -X POST http://localhost:8000/api/authoring/drafts/<id>/approve \
  -H "Content-Type: application/json" \
  -d '{"approver": "bob@example.org"}'
```

Approval is **idempotent**: re-approving an APPROVED draft is a no-op. A REJECTED draft cannot be approved (409 Conflict). Rejection requires a rationale:

```bash
curl -s -X POST http://localhost:8000/api/authoring/drafts/<id>/reject \
  -H "Content-Type: application/json" \
  -d '{"rejector": "bob@example.org", "reason": "Missing legal_tradition value."}'
```

### B4. Commit + reload

```bash
curl -s -X POST http://localhost:8000/api/authoring/commit \
  -H "Content-Type: application/json" \
  -d '{"committer": "bob@example.org"}'
```

All APPROVED drafts are written to `lawcode/<code>/...` and `reload_registry()` refreshes `JURISDICTION_REGISTRY`. The response carries `{committed: [...], reloaded: true}`.

### B5. Verify

```bash
curl -s "http://localhost:8000/api/authority-chain?jurisdiction_id=pl" | jq '.jurisdiction.name'
```

If the jurisdiction is back in the dropdown immediately, the substrate worked. The committed YAML is on disk under `lawcode/pl/config/jurisdiction.yaml` and `lawcode/pl/programs/oas.yaml` — operators with shell access can `git diff` them, commit to git, and PR.

### Discard / cancel

`DELETE /api/authoring/drafts/{id}` removes a non-committed draft. Returns 204 on success, 404 if unknown, 409 if the draft is already COMMITTED.

---

## What's not yet shipped (v3.1.x)

The substrate API is the v3.1 surface. The v3.1.x backlog adds UI wizards on top of it:

- **Onboard wizard** at `/admin/onboard` (multi-step identity → authority chain → programs → review)
- **Authority chain editor**, **Legal documents editor**, **Demo cases editor**, **Program manifest creator** at `/admin/<type>/draft`

When the wizards ship, they will drive `/api/authoring/*` under the hood. Path A and Path B above remain supported.

## Reference

- ADR-019 — jurisdiction metadata block
- ADR-020 — lawcode-as-discovery loader (the read path)
- ADR-022 — authoring substrate (the write path)
- `docs/runbooks/add-jurisdiction.md` — full per-section editing discipline for Path A
- `tests/test_authoring_substrate.py::TestCommitWritesToDiskAndRehydrates::test_jurisdiction_plus_program_commit_is_discoverable_by_loader` — the automated test pinning Path B
- `tests/test_cli_init.py::TestInitLoaderRoundTrip::test_scaffolded_jurisdiction_is_discoverable_after_init` — the automated test pinning Path A
