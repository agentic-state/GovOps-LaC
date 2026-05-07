# Runbook: Federation — publishing or consuming a signed lawcode pack

## When to use

GovOps federation lets a third party (foreign government, province, NGO, research group) publish their own jurisdiction as a signed pack. A running GovOps instance can fetch + verify + enable that pack. This runbook covers both perspectives:

- **Publishing**: you are the third party shipping a pack so others can consume it
- **Consuming**: you operate a GovOps instance and want to onboard a federated pack

If you're just adding a jurisdiction to your own GovOps repo with full source access, that's [`add-jurisdiction.md`](add-jurisdiction.md), not this. Federation is for the case where the publisher and the consumer are different actors.

ADR-009 establishes the trust model: Ed25519-signed manifests, fail-closed on unknown publishers, explicit per-instance allowlist. Read it first if you haven't.

## Pre-flight (publisher path)

| Check | Tool | Why |
|---|---|---|
| Pack contents are stable | (manual) | Publishing creates a versioned snapshot; iterating after publish requires a version bump |
| `cryptography` library available | `python -c "import cryptography; print(cryptography.__version__)"` | Required for Ed25519 sign/verify |
| Hosting target for the manifest + files | (manual) | The manifest URL must be reachable from consumers; static hosting (GitHub Pages, S3, generic HTTPS) is fine |

## Pre-flight (consumer path)

| Check | Tool | Why |
|---|---|---|
| You have the publisher's manifest URL | (publisher gives it to you) | The fetch entry point |
| You have the publisher's Ed25519 public key (b64) | (publisher gives it to you out-of-band) | Trust is granted by adding this to your `lawcode/global/trusted_keys.yaml` |
| Your operator policy allows fetching from this publisher | (manual / governance) | Federation is a substrate-level decision; involves your governance review |

## Steps — publishing a pack

### P1 — Generate an Ed25519 key pair

One-time per publisher identity. Keep the private key safe; the public key gets published.

```python
# generate_keys.py
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization
import base64

private_key = Ed25519PrivateKey.generate()
private_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption(),  # consider passphrase for production
)
public_b64 = base64.b64encode(
    private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
).decode()

with open("publisher_private.pem", "wb") as f:
    f.write(private_pem)
print(f"Public key (b64): {public_b64}")
```

Store `publisher_private.pem` in a vault. Distribute the b64 public key out-of-band to consumers (email, README, secure channel — NOT via the same network path as the pack).

### P2 — Stage the lawcode files

The pack is a directory of YAML files following the standard `lawcode/<jur>/...` shape. Author them locally exactly as you would for a self-hosted jurisdiction (use [`add-jurisdiction.md`](add-jurisdiction.md) as the structural reference).

Validate before signing:

```bash
python scripts/validate_lawcode.py    # against your in-repo schema
```

### P3 — Build the manifest

A pack manifest is a YAML document describing every file in the pack with its sha256 hash:

```yaml
publisher_id: example-foreign-pension       # unique stable identifier
pack_name: jp-koukinenkin
version: 1.0.0
published_at: "2026-04-27T12:00:00Z"
files:
  - path: lawcode/jp/programs/oas.yaml
    sha256: <hex digest of the file's bytes>
  - path: lawcode/jp/config/oas-rules.yaml
    sha256: <hex digest>
  # ...
manifest_signature_algo: ed25519
manifest_signature: <will be filled in by the signing step>
```

Compute file hashes:

```bash
for f in lawcode/jp/**/*.yaml; do
  echo "  - path: $f"
  echo "    sha256: $(sha256sum "$f" | awk '{print $1}')"
done
```

Reference: `src/govops/federation.py` `FederationManifest` for the canonical shape; `canonicalize_for_signing()` for the byte-format the signature covers.

### P4 — Sign the manifest

```python
# sign_manifest.py
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from govops.federation import sign_manifest, canonicalize_for_signing
import yaml

with open("publisher_private.pem", "rb") as f:
    private_key = load_pem_private_key(f.read(), password=None)

with open("manifest.yaml") as f:
    manifest = yaml.safe_load(f)

signed = sign_manifest(manifest, private_key=private_key)
with open("manifest.yaml", "w") as f:
    yaml.safe_dump(signed.model_dump(), f)
print("Signed.")
```

The `manifest_signature` field is now populated with a base64-encoded Ed25519 signature over the canonicalized manifest bytes.

### P5 — Host the pack

Upload `manifest.yaml` + every file it references to a static-hosting target. The manifest URL must be reachable; the files' `path` fields are interpreted relative to the manifest URL's parent (or to an explicit `file_base_url` if you set one in the publisher's registry entry).

Test:

```bash
curl -s https://your-host/manifest.yaml | head
```

### P6 — Publish your public key + manifest URL

Make these two pieces of information available to consumers:

- The b64 Ed25519 public key
- The full manifest URL

A README or a webpage announcing the pack is the standard form. Sign the announcement with the same key (e.g. on a Git repo) so consumers can cross-check.

## Steps — consuming a pack

### C1 — Add the publisher's trusted public key

Per ADR-009, trust is granted by editing `lawcode/global/trusted_keys.yaml` in your operator repo:

```yaml
- key: global.federation.trusted_key.example-foreign-pension
  jurisdiction_id: null
  value:
    public_key_b64: <b64 key the publisher gave you>
    notes: "Trust granted 2026-05-15 after governance review GOV-2026-014. Source: <where you got the key>"
  value_type: object
  domain: federation
  effective_from: "2026-05-15T00:00:00Z"
  citation: "Local trust decision; see governance review GOV-2026-014"
  author: <your name>
  rationale: "Approved by <governance body> for <use case>"
  status: active
  approved_by: <approver>
  approved_at: "2026-05-15T00:00:00Z"
```

Open a PR; merge after the standard governance review your operator policy requires. **The PR is the audit trail of the trust decision.**

### C2 — Add the publisher to the registry

Edit `lawcode/REGISTRY.yaml`:

```yaml
- publisher_id: example-foreign-pension
  name: "Example Foreign Pension Authority"
  manifest_url: "https://your-host/manifest.yaml"
  notes: "Federated pack covering JP koukinenkin under SA"
```

The registry tells the federation fetcher *which* publishers are recognized; the trusted_keys file tells it *which* are trusted. Both are required (necessary AND sufficient — being only in one is fail-closed).

### C3 — Fetch the pack

Via API (admin-token-gated when `GOVOPS_ADMIN_TOKEN` is set):

```bash
curl -s -X POST "$BASE/api/admin/federation/fetch/example-foreign-pension" \
  -H "X-Govops-Admin-Token: $GOVOPS_ADMIN_TOKEN"
```

The fetcher:
- Downloads `manifest.yaml` from the registry's `manifest_url`
- Verifies the manifest signature against the trusted public key
- Downloads every file the manifest references
- Verifies each file's sha256 matches the manifest

If verification fails, the fetch is fail-closed: nothing is written, and the response includes a structured error (`UntrustedPublisher`, `SignatureMismatch`, `ManifestHashMismatch`, `MissingSignature`).

### C4 — Inspect the fetched pack

Via UI: browse to `/admin/federation`. The page lists fetched packs with their status. Click a pack to see the manifest content and the per-file verification result.

Via API:

```bash
curl -s "$BASE/api/admin/federation/packs" \
  -H "X-Govops-Admin-Token: $GOVOPS_ADMIN_TOKEN" | jq
```

The fetched pack is in a staged state — fetched and verified, but not yet active. Records are namespaced by publisher id; they don't pollute your local substrate yet.

### C5 — Enable the pack

```bash
curl -s -X POST "$BASE/api/admin/federation/packs/example-foreign-pension/enable" \
  -H "X-Govops-Admin-Token: $GOVOPS_ADMIN_TOKEN"
```

Once enabled, the pack's ConfigValues become resolvable through the substrate (queries with the appropriate publisher namespace), and the pack's program manifests register with the engine.

### C6 — Verify with the bench

The bench's J34-J38 (federation registry, fetch, enable, disable, fail-closed) exercise the federation surface. After enabling a pack, J35-J37 should flip from SKIP to PASS (because the registry now has a publisher to act on).

### C7 — Disable / remove if needed

```bash
curl -s -X POST "$BASE/api/admin/federation/packs/example-foreign-pension/disable" \
  -H "X-Govops-Admin-Token: $GOVOPS_ADMIN_TOKEN"
```

Disabling a pack removes its records from active resolution but keeps them in the audit log — same append-only invariant as the rest of the substrate. To fully remove, also remove the trusted key + registry entries (separate PR).

## Post-checks

### Publisher

- [ ] Manifest is hosted at a stable URL
- [ ] Manifest verifies against the published public key
- [ ] All referenced files are reachable
- [ ] At least one consumer has successfully fetched + verified

### Consumer

- [ ] Trusted key entry merged via PR (audit-trailed governance decision)
- [ ] Registry entry added
- [ ] Fetch completed without verification errors
- [ ] Pack enabled
- [ ] Bench J34-J38 reflect the new state
- [ ] Citizens / officers querying the new jurisdiction's programs see the federated values

## Rollback

### Publisher: a published pack has wrong content

You cannot edit a published pack — any change invalidates the signature. The rollback path is:

1. Author corrected files locally
2. Bump the manifest version (`1.0.0` → `1.0.1`)
3. Recompute file hashes
4. Re-sign the new manifest
5. Re-host (consumers will re-fetch and re-verify against the new manifest)
6. Notify consumers that they should re-fetch

If the correction is urgent, also publish a deprecation notice for the old manifest version so consumers know to discard cached state.

### Consumer: a fetched pack has wrong content

Disable the pack (C7), then either:

- Wait for the publisher to ship a corrected version
- Or fork the pack into your own substrate (essentially: copy the YAML files into `lawcode/<their-jurisdiction>/` under your own publisher id, lose the federation property but gain control)

The publisher's audit trail of the wrong-pack incident is the publisher's responsibility; your audit trail is "we disabled the pack at T, here's why."

## Common gotchas

- **Forgetting to canonicalize manifest bytes before signing.** `canonicalize_for_signing()` produces a stable byte representation that the verifier expects; signing the YAML directly produces unverifiable signatures because YAML serialization isn't deterministic. Always sign through the helper.

- **Trusting a key without a governance review.** ADR-009's threat model assumes the operator's allowlist decision is deliberate. Adding a key because "it was in the README" is not a trust decision — it's a vibe. The PR adding the key is the audit moment; treat it like any other governance-touching change.

- **Hosting the public key on the same domain as the manifest.** A compromise of that domain compromises both. Distribute public keys via a different channel (signed Git commits in a public repo, signed email, etc.) so a network-level attacker can't substitute both.

- **Forgetting that registry + trusted keys are AND, not OR.** A publisher in the registry without a trusted key is fail-closed. A trusted key without a registry entry is unreachable. You need both — see ADR-009's "necessary but not sufficient" framing.

- **Treating `--allow-unsigned` as a deployment option.** The flag exists for development. Production federation should never accept unsigned records; if you find yourself reaching for `--allow-unsigned` in production, you have an upstream signing problem that should be fixed at the source.

- **Manifest version drift.** A consumer's cached fetch is for version X; the publisher ships X+1; nobody re-fetches. The substrate diverges. Mitigation: include a periodic re-fetch in the consumer's operations cycle, or watch a publisher's change feed.

## Last validated

- **Pending end-to-end run** — federation infrastructure shipped in v2.0 (Phase 8) and is exercised by `tests/test_federation.py` + the bench's J34-J38. End-to-end across two real instances has not yet been validated; the bench currently SKIPS J35-J37 because no publishers are registered against the production HF deploy. The runbook captures the contract from `src/govops/federation.py`, ADR-009, and `lawcode/REGISTRY.yaml` — first cross-instance run will be the first end-to-end validation.
