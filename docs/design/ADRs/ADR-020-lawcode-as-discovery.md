# ADR-020 -- Lawcode-as-discovery (registry retired from Python)

**Status**: Accepted
**Date**: 2026-05-10
**Track / Gate**: GovOps v3.1 -- Lane 3. Closes the v3.0 adoption gap surfaced
on 2026-05-10 by Marco's first hands-on play of the v3.0 release.

## Context

v3.0 promised "out-of-the-box adoption" via `govops init <iso-code>` and
shipped a Phase H scaffolder + plain-language sidecar generator + lawcode
schema gate. The 2026-05-10 playthrough surfaced the half-shipped truth:
the running app's `JURISDICTION_REGISTRY` lived as a hand-written Python
literal at `src/govops/jurisdictions.py:1430`, and `govops init pl`
produced a `lawcode/pl/` skeleton the running engine could not see.

The `/admin` Operator runbook even codified the broken story explicitly:

> *Register the jurisdiction in `src/govops/jurisdictions.py` with its
> authority chain and demo cases.*

Adding a real new jurisdiction needed a Python edit + a PR through git --
exactly the friction Phase H was supposed to remove.

ADR-019 (Lane 1) added the `jurisdiction:` schema slot.
Lane 2 + 2b (PR #41 + #42) populated each jurisdiction's slot with the
identity facts the Python literal carried, plus generated 6 missing OAS
manifests so every registered jurisdiction now has a YAML manifest on
disk. The diff harness at `tests/test_jurisdiction_metadata.py` proves
byte-identical pack equivalence between the YAML and Python paths.

This ADR is the rewire: replace the literal with a loader that builds
the registry from `lawcode/` at module-import time. Cuts the friction.
Adoption becomes "drop a `lawcode/<code>/` directory, restart the
process" -- and ADR-022's authoring substrate will close that further
into "click through the Onboard wizard".

## Decision

### Loader API

A single function in `src/govops/jurisdictions.py`:

```python
def build_registry_from_lawcode(lawcode_root: Path) -> dict[str, JurisdictionPack]:
    """Walk lawcode/<code>/ and assemble JurisdictionPack objects from YAML."""
```

Behaviour per jurisdiction directory:

1. Skip `.federated/` (handled separately) and `global/` (cross-jurisdictional ConfigValue space).
2. Read `<jur>/config/jurisdiction.yaml` `jurisdiction:` block via
   `load_jurisdiction_metadata` (ADR-019). Project to a `Jurisdiction`
   model via `meta.to_jurisdiction()`.
3. Read `<jur>/programs/oas.yaml` via `load_program_manifest` (ADR-014).
   The OAS manifest carries the v3.0 pack's authority chain, legal
   documents, rules, and demo cases. EI manifests for the 6 jurisdictions
   that have them are loaded separately downstream (existing behaviour;
   the registry shape stays anchored on OAS for v3.1 -- v3.2 may
   broaden to multi-program packs).
4. Build a `JurisdictionPack` matching the v3.0 dict shape:
   - `jurisdiction` from metadata projection
   - `authority_chain`, `legal_documents`, `rules`, `demo_cases` from the
     program manifest
   - `cases_factory` is a closure that returns a fresh list copy each
     call (defensive against caller mutation)
   - `default_language` from metadata
   - `program_name` from `program.name[default_language]` with fallback
     to `en`, then first locale present
5. After local jurisdictions, recurse into `lawcode/.federated/<publisher_id>/`
   so federation packs flow through the same loader. No special-casing.

### Hot reload

`reload_registry()` rebuilds the dict in place:

```python
JURISDICTION_REGISTRY.clear()
JURISDICTION_REGISTRY.update(build_registry_from_lawcode(...))
```

Mutating in place (rather than reassigning the module attribute) lets
the 35+ call sites that imported the dict reference -- not re-imported
the module -- see the updated state. The authoring substrate (ADR-022,
Lane 7) calls this after committing drafts so the Onboard wizard
delivers a live registry update without a process restart.

### Failure posture

Fail-closed at startup. A malformed program manifest or missing metadata
block raises during module import. Better to refuse to start than to
half-load the registry and surface confused behaviour mid-request.

A jurisdiction directory missing either `config/jurisdiction.yaml` OR
`programs/oas.yaml` is silently skipped (federation publishers may ship
metadata-only packs the v3.1 registry shape doesn't surface). The L4
Onboard wizard validates at draft-commit time so this skip path never
fires for in-app authoring.

## What gets retired

**Live**:
- The hand-written `JURISDICTION_REGISTRY` literal at
  `jurisdictions.py:1430` (~70 lines).

**Held for one release cycle, retired in v3.1.x housekeeping**:
- `BRAZIL_FEDERAL`, `BRAZIL_AUTHORITY_CHAIN`, `BRAZIL_LEGAL_DOCS`,
  `BRAZIL_RULES`, `_brazil_demo_cases`, and the analogous constants for
  ES/FR/DE/UA/JP. Other code (encoder seeds, legacy tests, federation
  fixtures) still references some of these names directly. Removing
  them in the same PR as the rewire would conflate concerns.
- `seed.py`'s CA constants -- same posture. Many callers; cleanup is
  its own audit.

**Stays alive**:
- `JurisdictionPack` class -- the runtime shape every consumer depends
  on. Future v3.2 work may move it to `models.py` for cleanliness, but
  that move is independent of this ADR.

## Verification

The L2 + L2b diff harness (`tests/test_jurisdiction_metadata.py`) is
the regression gate. It runs against the new build path and asserts:

- Every JURISDICTION_REGISTRY[code] entry has a metadata file +
  OAS manifest on disk.
- Each pack's `jurisdiction` (id / name / country / level / parent_id /
  legal_tradition / language_regime), `default_language`,
  `authority_chain`, `legal_documents`, `rules` (incl. parameter
  values), `demo_cases`, and `program_name` match the values the v3.0
  literal carried.

After this PR merges and the literal is gone, the harness asserts
self-consistency between metadata + manifest YAML rather than YAML vs
Python. The harness retires once a future PR removes the diff comparison
against `pack.jurisdiction.<field>` -- but for v3.1 it remains the
regression gate that catches a YAML drift from the byte-identical
contract.

Full backend suite: 773 tests pass after the rewire, identical to the
773-test baseline established in PR #42 (L2b).

## Consequences

### Positive

- **Adoption is real** -- a contributor drops `lawcode/<code>/` (manually,
  or via `govops init`, or post-ADR-022 via the Onboard wizard) and
  the running app sees the new jurisdiction at next startup or after
  `reload_registry()`. Zero Python edits, zero git PRs (unless the
  contributor wants one for review hygiene).
- **One source of truth** -- jurisdiction identity + program structure
  live on disk in YAML, not split between Python literals and YAML
  manifests. The half-shipped duality of v3.0 is gone.
- **Hot reload primitive in place** for ADR-022's authoring substrate
  to close the loop on in-app draft -> commit -> live.
- **Federation flows the same path** -- `lawcode/.federated/<publisher>/`
  hydration uses the same loader, no parallel code path.

### Negative

- **One release of dead code** -- the legacy `*_FEDERAL`,
  `*_AUTHORITY_CHAIN`, `*_RULES`, `*_demo_cases` constants stay in
  `jurisdictions.py` and `seed.py` until v3.1.x. Documented in code
  comments. Type checkers + IDEs will surface them as unused if a
  contributor goes looking; cleanup is a one-shot housekeeping PR
  scoped to that audit.
- **Module import is now I/O-bound** -- `build_registry_from_lawcode`
  walks `lawcode/` and parses 14 YAML files at import time. v3.0's
  literal had zero I/O. Measured cost on the dev machine is ~50ms;
  acceptable for the v3.1 demo bar (Marco's "MVP demo not production"
  rule). v3.2 may revisit if a load-bearing import-time scenario
  surfaces.

### Neutral

- **Dict shape unchanged** -- the 35+ call sites that read
  `JURISDICTION_REGISTRY[code].rules`,
  `.authority_chain`, etc. keep working with no edit. The rewire is
  invisible to consumers.

## References

- ADR-019 -- jurisdiction-metadata schema slot (the prerequisite)
- ADR-014 -- program manifest shape (read by the loader)
- ADR-013 -- substrate seam for parameter resolution
- v3.1 plan, Lane 3 -- this ADR's implementation context
- `tests/test_jurisdiction_metadata.py` -- the diff harness this ADR
  relies on for regression coverage
- PR #40 (L1 schema slot), #41 (L2a metadata migration), #42 (L2b
  manifest generation) -- the dependency chain this PR closes
