# ADR-025: Structural-aware YAML emission for commit_approved

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-05-12 |
| **Authors** | GovOps team |
| **Extends** | ADR-022 (authoring substrate) |
| **Lane** | v3.2 L4 |

## Context

ADR-022 shipped `DraftStore.commit_approved()` using `yaml.safe_dump()` to write approved drafts to `lawcode/<code>/...`. That worked at v3.1's demo bar but produces noisy diffs against the human-authored canonical files because PyYAML's safe_dump:

- Strips comments
- Reorders keys deterministically (alphabetical by default; `sort_keys=False` only stops the sort, doesn't preserve the original order across a load/dump cycle in all cases)
- Reformats block scalars (`>-`, `|-`) according to its own line-width heuristics
- Loses inline comments inside sequences

The practical symptom: open a canonical-shape `oas.yaml`, author a draft by loading it + setting one parameter, commit. The on-disk diff would show every comment lost + many keys reordered, drowning the real change in noise. For a public-facing showcase repo (`agentic-state/GovOps-LaC`) with named external readers, this is a real cost: PRs proposing actual edits become unreviewable.

`docs/IDEA-GovOps-v3.2-SubstrateHardening.md` Lane 4 framed the bar plainly: a no-op commit (load file, save unchanged content back) should produce a zero-byte diff.

## Decision

`commit_approved()` switches from `yaml.safe_dump()` to a structural round-trip via `ruamel.yaml`:

1. **If the target file exists:** load it with ruamel (preserves comments + key order + block-scalar style), recursively merge the draft's content into the loaded structure (`_merge_for_commit()`), dump.
2. **If the target file does not exist:** clean ruamel dump from the draft content (no source file to round-trip against).

The merge contract handles each value class:

| Target slot | Source slot | Action |
| --- | --- | --- |
| `CommentedMap` (mapping) | `dict` (mapping) | recurse into both; preserves comments at the structural layer |
| `CommentedSeq` (sequence) | `list` (sequence) | replace target only if contents differ (`list(target) != source`); preserves CommentedSeq metadata when unchanged |
| `CommentedMap` key absent from source | -- | delete the key from target (drafts are full files per L9-L11 editors) |
| Leaf (scalar) | Leaf (scalar) | replace only if value differs |
| Mismatched types | -- | replace |

`ruamel.yaml>=0.18.0` is added to `pyproject.toml` dependencies. The ruamel YAML instance is tuned for canonical-lawcode shape (block style, 2-space indent, preserved quotes, no line-width wrapping).

## What this does NOT do

Two ruamel round-trip quirks survive this lane:

1. **Orphan leading comments when their key is deleted.** A `# comment` line above a key gets attached to the *prior* key's post-comment slot in ruamel's internal model, not the deleted key's slot. So `del target['status']` leaves the `# soon-to-be-removed` line in the projected output. Documented as a pinned contract in `tests/test_authoring_substrate.py::test_removed_key_drops_value_but_leaves_orphan_comment`. The deleted *value* is gone (the load-bearing assertion); the orphan comment is a known ruamel quirk we accept rather than fight.

2. **No comment preservation on newly-added keys.** A draft adding a new top-level key gets it appended without any leading comment (there was nothing to round-trip against). Authors who want commentary on new keys must add it via a follow-up edit-in-place commit. Acceptable for v3.2; can be addressed by a "comment payload" field on drafts in a future lane.

## Consequences

### Positive

- **Zero-byte no-op diffs.** Load `lawcode/ca/programs/oas.yaml`, commit it back unchanged through the substrate -> byte-identical output. Verified by `test_no_op_load_and_commit_yields_byte_identical_output`.
- **Comments survive edits.** A draft that touches `status: active -> status: deprecated` produces a diff showing only that single line, with every surrounding comment intact. PRs become reviewable.
- **Block-scalar style preserved.** Long `text: >- ...` blocks (e.g. statute text in `legal_documents[].sections[].text`) keep their paragraph wrapping rather than getting mangled by safe_dump's line-width logic.

### Negative

- **One more dependency (`ruamel.yaml`).** Mitigation: ruamel is a mature, widely-used library (1M+ weekly downloads on PyPI), maintained by the same author as the original PyYAML round-trip patches. Low ecosystem risk.
- **Marginally slower writes** (ruamel parses + emits with more metadata than PyYAML). Mitigation: the substrate writes happen on operator commit (interactive), not in a hot path. Microseconds difference; invisible at the demo bar.
- **Orphan comments on deletes** (see "What this does NOT do" above). Mitigation: documented + pinned; common case (value edit, not key removal) is unaffected.

### Mitigations

- `_render_yaml_for_commit()` is a single function with explicit type-driven dispatch. If a future load-bearing ruamel quirk surfaces, the surface area to patch is small.
- The fallback path (target file does not exist) uses the same ruamel instance, so a fresh jurisdiction's first emit matches the round-trip discipline; subsequent edits of the same file then round-trip cleanly.

## Verification

- New pytest coverage in `tests/test_authoring_substrate.py::TestStructuralYAMLEmission`:
  - `test_no_op_load_and_commit_yields_byte_identical_output` -- the canonical L4 gate
  - `test_unchanged_keys_keep_their_comments` -- inline + leading + paragraph comments survive when keys are unchanged
  - `test_added_key_lands_at_end` -- a net-new key gets appended, prior keys keep order + comments
  - `test_removed_key_drops_value_but_leaves_orphan_comment` -- value removal pinned; orphan comment behaviour documented
  - `test_new_file_falls_back_to_clean_dump` -- no source to round-trip against -> clean ruamel dump
  - `test_commit_approved_emits_structurally_through_draftstore` -- end-to-end through the public API

## Related

- ADR-022 -- the substrate this hardens
- ADR-023 -- substrate conflict refusal (v3.2 L2; same release)
- ADR-026 (planned) -- git-projection commit mode (v3.2 L5; depends on this lane for clean diffs)
- `docs/IDEA-GovOps-v3.2-SubstrateHardening.md` -- the v3.2 charter
