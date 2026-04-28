"""Lawcode federation: signed packs from third-party publishers (Phase 8 / ADR-009).

A publisher generates an Ed25519 key pair, packages their lawcode files,
computes a sha256 per file, builds a manifest listing publisher_id, version,
files-with-hashes, and signs the canonical-form serialization of the
manifest. A fetcher with the publisher's public key in its trust allowlist
can verify the manifest, download each file, verify per-file hashes, and
write the pack into ``lawcode/.federated/<publisher_id>/`` where the
substrate's startup loader picks it up alongside local YAML.

Signing format and trust posture: ADR-009.

Test surface: the fetch pipeline accepts injected ``manifest_loader`` and
``file_loader`` callables so unit tests can drive it without real HTTP.
The CLI wires the real ``urllib`` loaders.
"""

from __future__ import annotations

import base64
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class FederationError(ValueError):
    """Base class for federation failures.

    The fetch pipeline is fail-closed: any subclass aborts the import
    cleanly; partial fetches are not accepted.
    """


class UntrustedPublisher(FederationError):
    """The manifest's publisher_id is not in the trust allowlist."""


class SignatureMismatch(FederationError):
    """Manifest signature did not verify against the trusted public key."""


class ManifestHashMismatch(FederationError):
    """A downloaded file's sha256 did not match the manifest's claim."""


class MissingSignature(FederationError):
    """Manifest carries no signature and ``--allow-unsigned`` was not set."""


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------


class FederationFile(BaseModel):
    """One entry in a manifest's `files` list."""

    path: str
    sha256: str  # hex digest


class FederationManifest(BaseModel):
    """A signed manifest describing one publisher's pack.

    Per ADR-009, the signature covers the canonical-form serialization of
    every field except ``manifest_signature`` itself.
    """

    publisher_id: str
    pack_name: str
    version: str
    published_at: datetime
    files: list[FederationFile] = Field(default_factory=list)
    manifest_signature_algo: str = "ed25519"
    manifest_signature: Optional[str] = None  # base64-encoded; None until signed


class FetchResult(BaseModel):
    """What ``fetch_pack`` returns on success.

    ``signed=False`` means the manifest had no signature and
    ``allow_unsigned=True`` was passed; records will be stamped
    ``source_signed=False``.
    """

    publisher_id: str
    pack_name: str
    version: str
    files_written: list[str]
    target_dir: str
    signed: bool
    fetched_at: datetime


# ---------------------------------------------------------------------------
# Canonicalization + signing
# ---------------------------------------------------------------------------


def canonicalize_for_signing(manifest_dict: dict[str, Any]) -> bytes:
    """Deterministic byte sequence used for signing/verifying the manifest.

    Per ADR-009 the canonical form is JSON with sorted keys and a tight
    separator; ``manifest_signature`` is excluded so the same bytes are
    produced before and after signing. Datetimes serialize to ISO-8601;
    Pydantic's ``model_dump(mode="json")`` already coerces them, so callers
    should pass the json-mode dump.
    """
    payload = {k: v for k, v in manifest_dict.items() if k != "manifest_signature"}
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")


def sign_manifest(
    manifest: FederationManifest,
    private_key: Ed25519PrivateKey,
) -> FederationManifest:
    """Sign the manifest in place: returns a new manifest with the signature set.

    The original manifest's signature field is ignored (any prior value is
    overwritten). Caller usage:

        signed = sign_manifest(manifest, key)
        # signed.manifest_signature is now the base64-encoded Ed25519 sig
    """
    payload = canonicalize_for_signing(manifest.model_dump(mode="json"))
    sig_bytes = private_key.sign(payload)
    return manifest.model_copy(update={
        "manifest_signature": base64.b64encode(sig_bytes).decode("ascii"),
    })


def verify_manifest_signature(
    manifest: FederationManifest,
    public_key_b64: str,
) -> bool:
    """Verify the manifest's signature against a base64-encoded public key.

    Returns True iff the signature is present, decodes cleanly, and matches.
    Returns False on any failure (missing sig, bad base64, signature mismatch,
    bad key bytes). Callers map False to ``SignatureMismatch`` —
    distinguishing "no signature at all" from "wrong signature" is the
    caller's job (use ``manifest.manifest_signature is None``).
    """
    if not manifest.manifest_signature:
        return False
    try:
        sig_bytes = base64.b64decode(manifest.manifest_signature)
        pk_bytes = base64.b64decode(public_key_b64)
        public_key = Ed25519PublicKey.from_public_bytes(pk_bytes)
        payload = canonicalize_for_signing(manifest.model_dump(mode="json"))
        public_key.verify(sig_bytes, payload)
        return True
    except (InvalidSignature, ValueError):
        return False


# ---------------------------------------------------------------------------
# Hashing
# ---------------------------------------------------------------------------


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# ---------------------------------------------------------------------------
# Fetch pipeline
# ---------------------------------------------------------------------------


def fetch_pack(
    publisher_id: str,
    *,
    registry: dict[str, dict[str, Any]],
    trusted_keys: dict[str, str],
    manifest_loader: Callable[[str], dict[str, Any]],
    file_loader: Callable[[str], bytes],
    target_dir: Path,
    allow_unsigned: bool = False,
    dry_run: bool = False,
) -> FetchResult:
    """Fetch + verify + write one publisher's pack.

    Loaders are injected so tests drive the pipeline without real HTTP. The
    CLI wires real ``urllib`` loaders. Per ADR-009 the pipeline is
    fail-closed at every step:

      1. Registry lookup — unknown publisher_id raises UntrustedPublisher.
      2. Manifest load + parse — bad shape raises pydantic ValidationError.
      3. Signature gate — missing signature without allow_unsigned raises
         MissingSignature; signature present but bad raises SignatureMismatch;
         publisher's public key not in trust allowlist raises UntrustedPublisher.
      4. Per-file fetch — each file's sha256 must match the manifest's claim;
         a mismatch raises ManifestHashMismatch.
      5. Write — files are written under target_dir/<publisher_id>/.
         dry_run skips the write but still validates everything else.

    Returns the FetchResult describing what was written.
    """
    if publisher_id not in registry:
        raise UntrustedPublisher(
            f"publisher {publisher_id!r} is not in the registry"
        )
    entry = registry[publisher_id]
    manifest_url = entry.get("manifest_url") or entry.get("source_url")
    if not manifest_url:
        raise FederationError(
            f"registry entry for {publisher_id!r} has no manifest_url or source_url"
        )

    manifest_doc = manifest_loader(manifest_url)
    manifest = FederationManifest.model_validate(manifest_doc)

    # Cross-check publisher_id agrees between registry and manifest.
    if manifest.publisher_id != publisher_id:
        raise UntrustedPublisher(
            f"manifest publisher_id {manifest.publisher_id!r} does not match "
            f"registry entry {publisher_id!r}"
        )

    # Signature gate.
    signed: bool
    if manifest.manifest_signature is None:
        if not allow_unsigned:
            raise MissingSignature(
                f"manifest for {publisher_id!r} is unsigned; pass allow_unsigned=True "
                f"to accept (records will be stamped source_signed=False)"
            )
        signed = False
    else:
        public_key_b64 = trusted_keys.get(publisher_id)
        if not public_key_b64:
            raise UntrustedPublisher(
                f"no trusted public key on file for {publisher_id!r}; "
                f"add it to lawcode/global/trusted_keys.yaml"
            )
        if not verify_manifest_signature(manifest, public_key_b64):
            raise SignatureMismatch(
                f"manifest signature for {publisher_id!r} did not verify against "
                f"the trusted public key"
            )
        signed = True

    # Per-file fetch + hash check.
    file_bytes_by_path: dict[str, bytes] = {}
    for f in manifest.files:
        # Build the file URL relative to the manifest URL — replace the
        # manifest filename with the file path. Keep simple: the registry
        # entry can supply a file_base_url override if the deployment is
        # not co-located with the manifest. v1 uses the manifest's parent.
        file_base = entry.get("file_base_url") or _derive_file_base(manifest_url)
        file_url = f"{file_base.rstrip('/')}/{f.path.lstrip('/')}"
        data = file_loader(file_url)
        actual = sha256_hex(data)
        if actual != f.sha256:
            raise ManifestHashMismatch(
                f"sha256 mismatch on {f.path}: manifest says {f.sha256}, "
                f"got {actual}"
            )
        file_bytes_by_path[f.path] = data

    fetched_at = datetime.now(timezone.utc).replace(microsecond=0)
    written: list[str] = []

    if not dry_run:
        pack_dir = target_dir / publisher_id
        pack_dir.mkdir(parents=True, exist_ok=True)
        for path, data in file_bytes_by_path.items():
            out_path = pack_dir / path
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(data)
            written.append(str(out_path.relative_to(target_dir)))

        # Provenance log — JSON for grep-ability, sits beside the pack.
        provenance = {
            "publisher_id": publisher_id,
            "pack_name": manifest.pack_name,
            "version": manifest.version,
            "published_at": manifest.published_at.isoformat(),
            "fetched_at": fetched_at.isoformat(),
            "manifest_url": manifest_url,
            "signed": signed,
            "files": [{"path": f.path, "sha256": f.sha256} for f in manifest.files],
        }
        (pack_dir / ".provenance.json").write_text(
            json.dumps(provenance, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

    return FetchResult(
        publisher_id=publisher_id,
        pack_name=manifest.pack_name,
        version=manifest.version,
        files_written=written,
        target_dir=str(target_dir),
        signed=signed,
        fetched_at=fetched_at,
    )


def _derive_file_base(manifest_url: str) -> str:
    """Strip the trailing ``/manifest.yaml`` (or whatever filename) to get
    the base URL files live under.

    For ``https://example.org/packs/jp/manifest.yaml`` returns
    ``https://example.org/packs/jp``.
    """
    if "/" not in manifest_url:
        return manifest_url
    return manifest_url.rsplit("/", 1)[0]


# ---------------------------------------------------------------------------
# Real-world loaders (used by the CLI; tests inject in-memory loaders)
# ---------------------------------------------------------------------------


def http_manifest_loader(url: str) -> dict[str, Any]:
    """Fetch and parse a YAML manifest over HTTP(S)."""
    import urllib.request

    import yaml

    with urllib.request.urlopen(url, timeout=30) as resp:  # nosec — opt-in fetch
        data = resp.read().decode("utf-8")
    return yaml.safe_load(data)


def http_file_loader(url: str) -> bytes:
    """Fetch a file's bytes over HTTP(S)."""
    import urllib.request

    with urllib.request.urlopen(url, timeout=30) as resp:  # nosec — opt-in fetch
        return resp.read()


# ---------------------------------------------------------------------------
# Key generation helper (for publishers + tests)
# ---------------------------------------------------------------------------


def generate_keypair() -> tuple[Ed25519PrivateKey, str]:
    """Generate a fresh Ed25519 key pair.

    Returns ``(private_key, public_key_b64)`` so callers can:
      - sign manifests with the private key
      - publish the public key (base64) for operators to add to their
        trusted_keys.yaml allowlist
    """
    from cryptography.hazmat.primitives import serialization

    private_key = Ed25519PrivateKey.generate()
    public_bytes = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return private_key, base64.b64encode(public_bytes).decode("ascii")
