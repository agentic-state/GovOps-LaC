"""Tests for lawcode federation (Phase 8 / ADR-009).

Coverage:
  - canonicalize_for_signing produces deterministic bytes; manifest_signature
    is excluded so signing+verifying produces consistent payload
  - sign / verify roundtrip with a freshly-generated keypair
  - verify rejects: missing signature, wrong key, tampered manifest
  - fetch_pack happy path: writes files into the target dir, .provenance.json
    captured, sha256 verified per file
  - fetch_pack rejects: untrusted publisher_id (not in registry), publisher_id
    mismatch between registry and manifest, missing signature without
    allow_unsigned, signature against wrong key, sha256 mismatch on a file
  - allow_unsigned path: signed=False on the result, .provenance.json
    records signed=False
  - dry_run: no files written; result still describes what would happen
  - load_from_yaml provenance: stamped on every record
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest
import yaml

from govops.config import ConfigStore
from govops.federation import (
    FederationFile,
    FederationManifest,
    ManifestHashMismatch,
    MissingSignature,
    SignatureMismatch,
    UntrustedPublisher,
    canonicalize_for_signing,
    fetch_pack,
    generate_keypair,
    sha256_hex,
    sign_manifest,
    verify_manifest_signature,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def keypair():
    """Fresh keypair per test — no state shared between tests."""
    return generate_keypair()


@pytest.fixture
def sample_files() -> dict[str, bytes]:
    """A tiny lawcode pack: one rules file."""
    return {
        "lawcode/jp/config/rules.yaml": (
            b"defaults:\n"
            b"  domain: rule\n"
            b"  jurisdiction_id: jp-koukinenkin\n"
            b"  effective_from: '1900-01-01'\n"
            b"values:\n"
            b"- key: jp.rule.age.min_age\n"
            b"  value: 65\n"
            b"  value_type: number\n"
        ),
    }


def _build_manifest(files: dict[str, bytes], publisher_id: str = "example-jp") -> FederationManifest:
    return FederationManifest(
        publisher_id=publisher_id,
        pack_name="koukinenkin",
        version="1.0.0",
        published_at=datetime(2026, 4, 27, 12, 0, 0, tzinfo=timezone.utc),
        files=[FederationFile(path=p, sha256=sha256_hex(b)) for p, b in files.items()],
    )


def _build_loaders(manifest: FederationManifest, files: dict[str, bytes]):
    """Build in-memory loaders the fetch pipeline can use without HTTP."""
    manifest_url = "https://example.org/packs/jp/manifest.yaml"

    def manifest_loader(url: str) -> dict:
        assert url == manifest_url, f"unexpected manifest URL: {url}"
        return manifest.model_dump(mode="json")

    def file_loader(url: str) -> bytes:
        # url shape: <base>/<file_path>; strip the base
        for path, data in files.items():
            if url.endswith(path):
                return data
        raise AssertionError(f"unexpected file URL: {url}")

    return manifest_url, manifest_loader, file_loader


# ---------------------------------------------------------------------------
# Canonicalization + signing
# ---------------------------------------------------------------------------


class TestCanonicalization:
    def test_canonical_form_excludes_signature(self):
        manifest = _build_manifest({"a": b"hello"})
        signed = sign_manifest(manifest, generate_keypair()[0])
        assert signed.manifest_signature is not None
        # Canonical bytes from signed and unsigned forms must agree.
        before = canonicalize_for_signing(manifest.model_dump(mode="json"))
        after = canonicalize_for_signing(signed.model_dump(mode="json"))
        assert before == after

    def test_canonical_form_is_deterministic(self):
        manifest = _build_manifest({"x": b"1", "y": b"2", "z": b"3"})
        # Re-construct from a dict with shuffled key order; canonical bytes
        # must still be identical.
        d1 = manifest.model_dump(mode="json")
        d2 = dict(reversed(list(d1.items())))
        assert canonicalize_for_signing(d1) == canonicalize_for_signing(d2)


class TestSigning:
    def test_sign_then_verify_succeeds(self, keypair):
        priv, pub_b64 = keypair
        manifest = _build_manifest({"a": b"hi"})
        signed = sign_manifest(manifest, priv)
        assert verify_manifest_signature(signed, pub_b64) is True

    def test_verify_rejects_unsigned_manifest(self, keypair):
        _, pub_b64 = keypair
        manifest = _build_manifest({"a": b"hi"})
        assert verify_manifest_signature(manifest, pub_b64) is False

    def test_verify_rejects_wrong_key(self, keypair):
        priv, _ = keypair
        _, other_pub = generate_keypair()
        manifest = _build_manifest({"a": b"hi"})
        signed = sign_manifest(manifest, priv)
        assert verify_manifest_signature(signed, other_pub) is False

    def test_verify_rejects_tampered_manifest(self, keypair):
        priv, pub_b64 = keypair
        manifest = _build_manifest({"a": b"hi"})
        signed = sign_manifest(manifest, priv)
        # Mutate version after signing — signature should fail verification.
        tampered = signed.model_copy(update={"version": "9.9.9"})
        assert verify_manifest_signature(tampered, pub_b64) is False


# ---------------------------------------------------------------------------
# fetch_pack — full pipeline
# ---------------------------------------------------------------------------


class TestFetchPack:
    def test_happy_path_writes_files_and_provenance(self, tmp_path, keypair, sample_files):
        priv, pub_b64 = keypair
        manifest = sign_manifest(_build_manifest(sample_files), priv)
        manifest_url, mloader, floader = _build_loaders(manifest, sample_files)

        result = fetch_pack(
            "example-jp",
            registry={"example-jp": {"manifest_url": manifest_url}},
            trusted_keys={"example-jp": pub_b64},
            manifest_loader=mloader,
            file_loader=floader,
            target_dir=tmp_path,
        )

        assert result.signed is True
        assert result.publisher_id == "example-jp"
        assert len(result.files_written) == len(sample_files)

        # Files actually exist on disk under target_dir/<publisher_id>/.
        pack_dir = tmp_path / "example-jp"
        for path in sample_files:
            assert (pack_dir / path).exists()
        # Provenance log is present and records the signed state + per-file hashes.
        prov = pack_dir / ".provenance.json"
        assert prov.exists()
        import json
        prov_data = json.loads(prov.read_text(encoding="utf-8"))
        assert prov_data["signed"] is True
        assert prov_data["publisher_id"] == "example-jp"
        assert len(prov_data["files"]) == len(sample_files)

    def test_unknown_publisher_raises_untrusted(self, tmp_path):
        with pytest.raises(UntrustedPublisher, match="not in the registry"):
            fetch_pack(
                "nobody",
                registry={},
                trusted_keys={},
                manifest_loader=lambda url: {},
                file_loader=lambda url: b"",
                target_dir=tmp_path,
            )

    def test_publisher_id_mismatch_raises_untrusted(self, tmp_path, keypair, sample_files):
        priv, pub_b64 = keypair
        # Manifest claims publisher_id "alice" but registry calls it "bob".
        manifest = sign_manifest(_build_manifest(sample_files, publisher_id="alice"), priv)
        manifest_url, mloader, floader = _build_loaders(manifest, sample_files)
        with pytest.raises(UntrustedPublisher, match="does not match"):
            fetch_pack(
                "bob",
                registry={"bob": {"manifest_url": manifest_url}},
                trusted_keys={"bob": pub_b64},
                manifest_loader=mloader,
                file_loader=floader,
                target_dir=tmp_path,
            )

    def test_unsigned_manifest_without_allow_unsigned_raises(self, tmp_path, sample_files):
        # Manifest never signed.
        manifest = _build_manifest(sample_files)
        manifest_url, mloader, floader = _build_loaders(manifest, sample_files)
        with pytest.raises(MissingSignature, match="unsigned"):
            fetch_pack(
                "example-jp",
                registry={"example-jp": {"manifest_url": manifest_url}},
                trusted_keys={},  # no key, but doesn't matter — the unsigned check fires first
                manifest_loader=mloader,
                file_loader=floader,
                target_dir=tmp_path,
                allow_unsigned=False,
            )

    def test_unsigned_with_allow_unsigned_succeeds_with_signed_false(self, tmp_path, sample_files):
        manifest = _build_manifest(sample_files)  # never signed
        manifest_url, mloader, floader = _build_loaders(manifest, sample_files)
        result = fetch_pack(
            "example-jp",
            registry={"example-jp": {"manifest_url": manifest_url}},
            trusted_keys={},
            manifest_loader=mloader,
            file_loader=floader,
            target_dir=tmp_path,
            allow_unsigned=True,
        )
        assert result.signed is False
        # Provenance log records signed=False.
        import json
        prov = json.loads((tmp_path / "example-jp" / ".provenance.json").read_text(encoding="utf-8"))
        assert prov["signed"] is False

    def test_no_trusted_key_raises_untrusted(self, tmp_path, keypair, sample_files):
        priv, _ = keypair
        manifest = sign_manifest(_build_manifest(sample_files), priv)
        manifest_url, mloader, floader = _build_loaders(manifest, sample_files)
        with pytest.raises(UntrustedPublisher, match="no trusted public key"):
            fetch_pack(
                "example-jp",
                registry={"example-jp": {"manifest_url": manifest_url}},
                trusted_keys={},  # no key for example-jp
                manifest_loader=mloader,
                file_loader=floader,
                target_dir=tmp_path,
            )

    def test_wrong_signing_key_raises_signature_mismatch(self, tmp_path, sample_files):
        priv_a, _ = generate_keypair()
        _, pub_b = generate_keypair()
        manifest = sign_manifest(_build_manifest(sample_files), priv_a)
        manifest_url, mloader, floader = _build_loaders(manifest, sample_files)
        with pytest.raises(SignatureMismatch):
            fetch_pack(
                "example-jp",
                registry={"example-jp": {"manifest_url": manifest_url}},
                trusted_keys={"example-jp": pub_b},  # wrong pubkey
                manifest_loader=mloader,
                file_loader=floader,
                target_dir=tmp_path,
            )

    def test_file_hash_mismatch_raises_and_does_not_write(self, tmp_path, keypair, sample_files):
        priv, pub_b64 = keypair
        # Build manifest with the correct hashes...
        manifest = sign_manifest(_build_manifest(sample_files), priv)
        manifest_url, mloader, _ = _build_loaders(manifest, sample_files)
        # ...but then have the file_loader return tampered bytes.
        tampered = {p: b + b"\n# tampered\n" for p, b in sample_files.items()}
        _, _, tampered_loader = _build_loaders(manifest, tampered)
        with pytest.raises(ManifestHashMismatch, match="sha256 mismatch"):
            fetch_pack(
                "example-jp",
                registry={"example-jp": {"manifest_url": manifest_url}},
                trusted_keys={"example-jp": pub_b64},
                manifest_loader=mloader,
                file_loader=tampered_loader,
                target_dir=tmp_path,
            )
        # Fail-closed: nothing written.
        assert not (tmp_path / "example-jp").exists()

    def test_dry_run_does_not_write(self, tmp_path, keypair, sample_files):
        priv, pub_b64 = keypair
        manifest = sign_manifest(_build_manifest(sample_files), priv)
        manifest_url, mloader, floader = _build_loaders(manifest, sample_files)
        result = fetch_pack(
            "example-jp",
            registry={"example-jp": {"manifest_url": manifest_url}},
            trusted_keys={"example-jp": pub_b64},
            manifest_loader=mloader,
            file_loader=floader,
            target_dir=tmp_path,
            dry_run=True,
        )
        assert result.signed is True
        assert result.files_written == []  # no writes during dry-run
        assert not (tmp_path / "example-jp").exists()


# ---------------------------------------------------------------------------
# load_from_yaml provenance integration
# ---------------------------------------------------------------------------


class TestLoadProvenance:
    def test_provenance_kwargs_stamp_every_record(self, tmp_path):
        """Records loaded with provenance carry the federation fields.
        Local-origin records (no provenance kwarg) leave them all None."""
        # Write a small YAML pack.
        pack = tmp_path / "rules.yaml"
        pack.write_text(
            "defaults:\n"
            "  domain: rule\n"
            "  jurisdiction_id: jp-koukinenkin\n"
            "  effective_from: '1900-01-01'\n"
            "values:\n"
            "- key: jp.rule.age.min_age\n"
            "  value: 65\n"
            "  value_type: number\n",
            encoding="utf-8",
        )
        store = ConfigStore()
        provenance = {
            "source_publisher": "example-jp",
            "source_repo": "https://example.org/packs/jp/manifest.yaml",
            "source_commit": None,
            "fetched_at": datetime(2026, 4, 27, 12, 0, 0, tzinfo=timezone.utc),
            "source_signed": True,
        }
        n = store.load_from_yaml(pack, provenance=provenance)
        assert n == 1

        # Re-read the record back and check provenance fields are stamped.
        record = store.resolve(
            "jp.rule.age.min_age",
            evaluation_date=datetime.now(timezone.utc),
            jurisdiction_id="jp-koukinenkin",
        )
        assert record is not None
        assert record.source_publisher == "example-jp"
        assert record.source_signed is True
        assert record.fetched_at is not None
        assert record.source_repo == "https://example.org/packs/jp/manifest.yaml"

    def test_local_load_leaves_provenance_none(self, tmp_path):
        pack = tmp_path / "rules.yaml"
        pack.write_text(
            "defaults:\n"
            "  domain: rule\n"
            "  jurisdiction_id: local-test\n"
            "  effective_from: '1900-01-01'\n"
            "values:\n"
            "- key: local.rule.x\n"
            "  value: 1\n"
            "  value_type: number\n",
            encoding="utf-8",
        )
        store = ConfigStore()
        n = store.load_from_yaml(pack)  # no provenance kwarg
        assert n == 1
        record = store.resolve(
            "local.rule.x",
            evaluation_date=datetime.now(timezone.utc),
            jurisdiction_id="local-test",
        )
        assert record is not None
        assert record.source_publisher is None
        assert record.source_signed is None
        assert record.fetched_at is None
