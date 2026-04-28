# ADR-009 — Federation trust model: signed lawcode packs with Ed25519 + publisher allowlist

**Status**: Accepted
**Date**: 2026-04-27
**Track / Gate**: Law-as-Code v2.0 / Phase 8 (federation & registry) / Gate 7

## Context

The v2.0 thesis is that GovOps is a **substrate**, not an application. A jurisdiction is a forkable, citable, dated set of YAML records — and a substrate that only ever loads from the local filesystem is a substrate that only one team can publish to. Phase 8 closes the federation loop: a third party (a foreign government, a province, a research group, an NGO running benefits triage in a post-conflict zone) can publish their own lawcode pack, and a running GovOps instance can fetch it, verify it, and evaluate citizens against it.

Three load-bearing questions have to settle before code lands:

1. **What does "verify" mean?** A network fetch is not a guarantee. Without a cryptographic signature on the manifest, a man-in-the-middle, a hijacked CDN, or a typosquatted URL all silently corrupt the substrate.
2. **Who decides which publishers are trustworthy?** Trust cannot be transitive in a public-good substrate; "anyone with a valid signature" is a different threat model than "the operator chose to trust this publisher". The trust decision must be **local, explicit, and forkable** — same property the rest of the substrate has.
3. **Where does provenance live?** When a fetched ConfigValue answers a citizen's question, the audit trail has to be able to say *where it came from*, not just *what it said*. A retroactive dispute cannot be answered by "we got it from the internet".

## Decision

### Signing: Ed25519 via the `cryptography` library

Three options were on the table:

- **GPG**: ubiquitous, but requires GPG installed on every fetcher, key management is painful, and the public-good audience (universities, NGOs, foreign agencies) is the *least* equipped to maintain a GPG keyring.
- **Sigstore**: keyless via OIDC, modern, but the keyless flow assumes always-online infrastructure that an offline-capable substrate cannot rely on; offline-Sigstore mode is still maturing.
- **Native Ed25519**: pure-Python via the `cryptography` library (already a transitive dep of FastAPI), small keys (32-byte public, 64-byte signature), fast verification, no external tooling, format we control. A publisher generates a key pair once, ships the public key, signs the pack manifest. Reproducible, forkable, no PKI.

**Decision: Ed25519, signed manifest hash, signature in the manifest itself.** A clear migration path to Sigstore exists later when offline-Sigstore matures — the integration seam is the verifier interface, not the format.

### Trust: explicit per-instance allowlist of publisher public keys

Trusted publishers live in `lawcode/global/trusted_keys.yaml` as ConfigValues:

```yaml
- key: global.federation.trusted_key.<publisher_id>
  value:
    public_key_b64: <base64-encoded Ed25519 public key>
    notes: "..."
  value_type: object
  domain: federation
```

To trust a new publisher, an operator opens a PR adding an entry. The PR is the audit trail of the trust decision. There is no online registry, no transitive "anyone with a valid CA-issued cert can publish", no escape hatch where an unknown key is silently accepted. The fetch path is **fail-closed**: an unknown publisher_id produces a `UntrustedPublisher` error and writes nothing.

A `--allow-unsigned` flag exists on the fetch CLI for development and research scenarios where signing infrastructure isn't yet in place. Records fetched with `--allow-unsigned` are stamped with `source_signed=False` so audit queries can filter them out of any production path. The flag is intentionally awkward to type; the fail-closed default is the contract.

### Manifest format

A pack manifest is a YAML document describing one publisher's pack:

```yaml
publisher_id: example-foreign-pension
pack_name: jp-koukinenkin
version: 1.0.0
published_at: "2026-04-27T12:00:00Z"
files:
  - path: lawcode/jp/config/rules.yaml
    sha256: <hex digest>
  - path: lawcode/jp/config/calc.yaml
    sha256: <hex digest>
manifest_signature_algo: ed25519
manifest_signature: <base64-encoded signature>
```

The signature covers a **canonical-form serialization of every field except `manifest_signature` itself**. Verification re-serializes (with `manifest_signature` removed) and checks the signature against the publisher's known public key. The canonical form is deterministic JSON-style key ordering with UTF-8, no trailing whitespace, sorted keys at every level. We codify this in `federation.canonicalize_manifest()` so every publisher and every fetcher uses byte-identical bytes.

Per-file `sha256` digests are verified after download but before any record is loaded into the substrate. A single byte mismatch on any file aborts the entire pack import — partial fetches are not accepted.

### Provenance: stamped onto every fetched ConfigValue

Four new optional fields land on `ConfigValue`, all loader-set:

- `source_publisher: Optional[str]` — `publisher_id` from the manifest
- `source_repo: Optional[str]` — URL the manifest was fetched from
- `source_commit: Optional[str]` — git commit hash if the source is a git ref (optional)
- `fetched_at: Optional[datetime]` — UTC timestamp of the fetch

When a record originated from a local YAML file (the default for the demo), all four are `None`. When a record was federated, all four are populated. The audit endpoint surfaces them so a citizen-side dispute can answer *"this answer came from publisher X, fetched on date D, manifest signature verified against the known public key K"*.

A fifth helper field, `source_signed: Optional[bool]`, distinguishes records loaded with `--allow-unsigned` (`False`) from properly signed records (`True`) and locally-authored records (`None`). The type tri-state matters: `False` and `None` are not the same — `None` says "this was authored locally and never went through federation"; `False` says "this came from federation but the signature gate was bypassed".

### Fetch CLI: `govops fetch`

```
govops fetch <publisher_id> [--registry <path>] [--allow-unsigned] [--dry-run]
```

Reads `lawcode/REGISTRY.yaml`, finds the entry for `publisher_id`, downloads the manifest from `source_url`, verifies the signature against the trusted key for `publisher_id`, downloads each file, verifies sha256, writes to `lawcode/.federated/<publisher_id>/`, and on success appends a `federation_fetch_recorded` entry to a per-pack provenance log at `lawcode/.federated/<publisher_id>/.provenance.json`.

`--dry-run` validates without writing; `--allow-unsigned` accepts unsigned manifests but stamps `source_signed=False`.

### Fetch is a deliberate operation, not a startup behaviour

Fetching never happens automatically at process start. The substrate hydrates from `lawcode/` (including `lawcode/.federated/`) at startup; what's *in* `lawcode/.federated/` was put there by an explicit `govops fetch` call. This keeps the operator in the loop on every cross-organization data flow — there is no path where a running instance silently picks up a new publisher's records because their server changed.

## Consequences

**Positive**:

- **Forkable trust.** Every operator's trust decision is a YAML diff in their own repo. There is no central authority, no token broker, no organization that can revoke or grant the right to publish.
- **Auditable provenance.** Every federated record carries publisher + URL + timestamp + signed-state. A citizen-side dispute resolves to file-level evidence.
- **Fail-closed default.** Untrusted publishers, missing signatures, mismatched hashes all produce errors and write nothing. There is no quiet degradation.
- **Reproducible.** A given manifest hash + given files produces a given substrate state. A re-fetch on a clean machine yields byte-identical local YAML.

**Negative**:

- **Key management is the operator's responsibility.** A publisher who loses their private key has to issue a new key pair, get the new public key into operators' allowlists, and re-sign their pack. We don't ship a key-rotation protocol in v1; this is acceptable for a prototype but warrants its own ADR before broad adoption.
- **No revocation.** If a publisher's key is compromised, every operator who trusts that publisher must update their allowlist locally. There is no "revoke this key globally" facility. Acceptable for the demo; a future ADR may introduce a trust-store-as-CRL pattern.
- **Federation cost is operator-borne.** Bandwidth, storage, and trust-decision review are local. A demo run that federates a 100MB pack costs the demo operator that 100MB. This is a feature, not a bug — central federation costs are how vendor lock-in starts.

**Neutral**:

- The `cryptography` library is already a transitive dep through FastAPI's TLS chain, so federation costs nothing in the dependency tree.
- The signing format is documented but not standardised; if/when a relevant standard emerges (Sigstore-offline, JOSE, COSE), the verifier interface accommodates a swap.

## Cross-references

- [PLAN.md](../../../PLAN.md) §Phase 8 — entry/exit
- [ADR-003](ADR-003-yaml-over-json.md) — YAML on disk, applies to federated packs identically
- [ADR-006](ADR-006-per-parameter-granularity.md) — per-parameter granularity, federated records same shape as local
- [ADR-010](ADR-010-sqlite-from-phase-6.md) — SQLite hydration; federation extends the lawcode root that the hydrator scans
- `src/govops/federation.py` (new) — manifest types, signing/verifying, fetch pipeline
- `lawcode/REGISTRY.yaml` (new) — per-publisher registry entries
- `lawcode/global/trusted_keys.yaml` (new) — publisher allowlist
- `tests/test_federation.py` (new) — signing roundtrip, manifest verification, fetch happy/sad paths
