"""Phase H — `govops init` scaffolder + plain-language doc generator tests.

PLAN-v3 §Phase H exit gate: a contributor with neither Python nor Node
runs `docker compose up` and sees the demo; `govops init` produces a
schema-valid skeleton.

These tests pin the scaffolder contract — same files generated, all
schema-valid against the existing Phase 5 validators, plain-language
sidecars produced for every program manifest.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from govops.cli_init import (
    InitError,
    init_jurisdiction,
    render_plain_language_doc,
    write_plain_language_doc,
)
from govops.programs import load_program_manifest

# Tests that load init-scaffolded manifests intentionally reference substrate
# keys the contributor is expected to author after running `govops init`
# (e.g. `pl-oas.rule.age.min_age`). The scaffolder's contract is "TODO markers
# at every hand-fill point" -- those refs are TODOs by design. Strict-mode
# resolve_value treats unmigrated keys as failures, which is the right posture
# for the production substrate but the wrong posture for a TODO skeleton.
_skip_in_strict_mode = pytest.mark.skipif(
    os.getenv("AIA_CONFIG_STRICT") == "1",
    reason="init-generated skeleton references unauthored substrate keys by design",
)

REPO_ROOT = Path(__file__).resolve().parent.parent
LAWCODE = REPO_ROOT / "lawcode"


# ---------------------------------------------------------------------------
# init_jurisdiction — happy path
# ---------------------------------------------------------------------------


class TestInitHappyPath:
    def test_default_shapes_creates_full_skeleton(self, tmp_path: Path):
        written = init_jurisdiction("pl", lawcode_dir=tmp_path)
        names = {p.name for p in written}
        # YAMLs
        assert "jurisdiction.yaml" in names
        assert "oas.yaml" in names
        assert "oas-rules.yaml" in names
        assert "ei.yaml" in names
        assert "ei-rules.yaml" in names
        # Plain-language sidecars
        assert "oas.md" in names
        assert "ei.md" in names

    def test_files_land_under_jurisdiction_directory(self, tmp_path: Path):
        init_jurisdiction("mx", lawcode_dir=tmp_path)
        base = tmp_path / "mx"
        assert (base / "config" / "jurisdiction.yaml").exists()
        assert (base / "programs" / "oas.yaml").exists()
        assert (base / "programs" / "oas.md").exists()
        assert (base / "programs" / "ei.yaml").exists()
        assert (base / "programs" / "ei.md").exists()
        assert (base / "config" / "oas-rules.yaml").exists()
        assert (base / "config" / "ei-rules.yaml").exists()

    def test_oas_only_skips_ei(self, tmp_path: Path):
        written = init_jurisdiction("pl", shapes=["oas"], lawcode_dir=tmp_path)
        names = {p.name for p in written}
        assert "oas.yaml" in names
        assert "ei.yaml" not in names
        assert "ei-rules.yaml" not in names

    def test_ei_only_skips_oas(self, tmp_path: Path):
        written = init_jurisdiction("pl", shapes=["ei"], lawcode_dir=tmp_path)
        names = {p.name for p in written}
        assert "ei.yaml" in names
        assert "oas.yaml" not in names

    @_skip_in_strict_mode
    def test_generated_program_loads_through_manifest_loader(self, tmp_path: Path):
        """Phase A's `load_program_manifest` is the canonical reader. The
        scaffolded YAML must parse cleanly even though every literal value
        is still a TODO marker — schema-valid skeletons are the contract."""
        init_jurisdiction("pl", shapes=["oas"], lawcode_dir=tmp_path)
        program = load_program_manifest(
            tmp_path / "pl" / "programs" / "oas.yaml"
        )
        assert program.program_id == "oas"
        assert program.shape == "old_age_pension"
        assert program.jurisdiction_id == "jur-pl-national"
        # Five OAS rules in the skeleton: age, residency, partial?, legal-status, evidence
        assert len(program.rules) >= 4

    @_skip_in_strict_mode
    def test_generated_ei_loads_with_unemployment_insurance_shape(
        self, tmp_path: Path
    ):
        init_jurisdiction("pl", shapes=["ei"], lawcode_dir=tmp_path)
        program = load_program_manifest(
            tmp_path / "pl" / "programs" / "ei.yaml"
        )
        assert program.program_id == "ei"
        assert program.shape == "unemployment_insurance"

    def test_skeleton_carries_todo_markers(self, tmp_path: Path):
        init_jurisdiction("pl", lawcode_dir=tmp_path)
        oas_yaml = (tmp_path / "pl" / "programs" / "oas.yaml").read_text(
            encoding="utf-8"
        )
        # The scaffolder emits TODO markers wherever a contributor must
        # supply jurisdiction-specific content.
        assert "TODO" in oas_yaml


# ---------------------------------------------------------------------------
# init_jurisdiction — ADR-019 jurisdiction-metadata block
# ---------------------------------------------------------------------------


class TestInitEmitsJurisdictionMetadata:
    """Per ADR-019 the scaffolded jurisdiction.yaml carries a top-level
    `jurisdiction:` block alongside the ConfigValue defaults/values, so the
    lawcode-as-discovery loader (ADR-020) can register the new jurisdiction
    without a Python edit."""

    def _load_yaml(self, path: Path) -> dict:
        import yaml
        with path.open("r", encoding="utf-8") as fh:
            return yaml.safe_load(fh)

    def test_jurisdiction_yaml_has_metadata_block(self, tmp_path: Path):
        init_jurisdiction("pl", lawcode_dir=tmp_path)
        doc = self._load_yaml(tmp_path / "pl" / "config" / "jurisdiction.yaml")
        assert "jurisdiction" in doc, "scaffold must emit ADR-019 metadata block"

    def test_metadata_block_carries_required_fields(self, tmp_path: Path):
        init_jurisdiction("pl", lawcode_dir=tmp_path)
        meta = self._load_yaml(
            tmp_path / "pl" / "config" / "jurisdiction.yaml"
        )["jurisdiction"]
        for field in ("id", "country", "level", "name", "default_language"):
            assert field in meta, f"metadata block must carry {field!r}"
        assert meta["id"] == "jur-pl-national"
        assert meta["country"] == "PL"
        assert "en" in meta["name"]

    def test_scaffolded_metadata_validates_against_lawcode_schema(self, tmp_path: Path):
        """Round-trip the scaffold through the schema validator: a fresh
        `govops init` output passes the Phase 5 gate without edits."""
        import json
        from jsonschema import Draft202012Validator

        init_jurisdiction("pl", lawcode_dir=tmp_path)
        doc = self._load_yaml(tmp_path / "pl" / "config" / "jurisdiction.yaml")

        schema_path = REPO_ROOT / "schema" / "lawcode-v1.0.json"
        with schema_path.open("r", encoding="utf-8") as fh:
            schema = json.load(fh)
        validator = Draft202012Validator(schema)
        errors = list(validator.iter_errors(doc))
        assert not errors, [e.message for e in errors]


# ---------------------------------------------------------------------------
# init_jurisdiction -> registry loader round-trip (regression guard)
# ---------------------------------------------------------------------------


class TestInitLoaderRoundTrip:
    """A fresh ``govops init`` must produce a jurisdiction the
    ``build_registry_from_lawcode`` loader can discover. Pre-fix the
    scaffolder wrote ``lawcode/<code>/jurisdiction.yaml`` while the loader
    read ``lawcode/<code>/config/jurisdiction.yaml`` -- silently producing
    a jurisdiction the running app could not see. This test pins the
    handoff so the v3.0 adoption gap stays closed.
    """

    @_skip_in_strict_mode
    def test_scaffolded_jurisdiction_is_discoverable_after_init(
        self, tmp_path: Path
    ):
        from govops.jurisdictions import build_registry_from_lawcode

        # OAS-only scaffold so the loader's "must have programs/oas.yaml"
        # gate is satisfied. EI is optional in the discovery path.
        init_jurisdiction("pl", shapes=["oas"], lawcode_dir=tmp_path)
        registry = build_registry_from_lawcode(tmp_path)
        assert "pl" in registry, (
            "scaffolded jurisdiction must appear in the registry; "
            "cli_init + loader paths have drifted apart"
        )
        pack = registry["pl"]
        assert pack.jurisdiction.id == "jur-pl-national"
        assert pack.jurisdiction.country == "PL"


# ---------------------------------------------------------------------------
# init_jurisdiction — refusal posture
# ---------------------------------------------------------------------------


class TestInitRefusal:
    def test_refuses_to_overwrite_existing_files(self, tmp_path: Path):
        init_jurisdiction("pl", lawcode_dir=tmp_path)
        # Second invocation must fail rather than clobber the contributor's work.
        with pytest.raises(InitError, match="Refusing to overwrite"):
            init_jurisdiction("pl", lawcode_dir=tmp_path)

    def test_partial_collision_aborts_entire_scaffold(self, tmp_path: Path):
        # Pre-create just one of the targets — a half-existing scaffold
        # must abort, not silently fill in the gaps.
        existing = tmp_path / "pl" / "programs" / "oas.yaml"
        existing.parent.mkdir(parents=True)
        existing.write_text("# pre-existing", encoding="utf-8")
        with pytest.raises(InitError):
            init_jurisdiction("pl", lawcode_dir=tmp_path)
        # The pre-existing file is preserved verbatim
        assert existing.read_text(encoding="utf-8") == "# pre-existing"

    def test_invalid_country_code_rejected(self, tmp_path: Path):
        with pytest.raises(InitError):
            init_jurisdiction("123", lawcode_dir=tmp_path)
        with pytest.raises(InitError):
            init_jurisdiction("", lawcode_dir=tmp_path)
        with pytest.raises(InitError):
            init_jurisdiction("toolongcountry", lawcode_dir=tmp_path)

    def test_unknown_shape_rejected(self, tmp_path: Path):
        with pytest.raises(InitError, match="Unknown shape"):
            init_jurisdiction("pl", shapes=["asylum"], lawcode_dir=tmp_path)


# ---------------------------------------------------------------------------
# Plain-language doc generator
# ---------------------------------------------------------------------------


class TestPlainLanguageDocGenerator:
    def test_renders_sections_for_existing_ca_oas(self):
        manifest = LAWCODE / "ca" / "programs" / "oas.yaml"
        text = render_plain_language_doc(manifest)
        # Headings the reader expects
        assert "## At a glance" in text
        assert "## Authority chain" in text
        assert "## Rules the engine evaluates" in text
        assert "## Demo cases" in text

    def test_renders_substrate_refs_explicitly(self):
        manifest = LAWCODE / "ca" / "programs" / "ei.yaml"
        text = render_plain_language_doc(manifest)
        # `{ref: ca-ei.rule.contribution.min_years}` should be rendered as
        # "← substrate key `ca-ei.rule.contribution.min_years`" so a
        # non-coder can trace where the value comes from.
        assert "substrate key" in text
        assert "ca-ei.rule" in text

    def test_write_plain_language_doc_writes_md_alongside_yaml(self, tmp_path: Path):
        # Use the scaffolder to produce a manifest, then regenerate its doc.
        init_jurisdiction("pl", shapes=["oas"], lawcode_dir=tmp_path)
        manifest = tmp_path / "pl" / "programs" / "oas.yaml"
        # Delete the auto-generated doc, regenerate, confirm it's written.
        doc = manifest.with_suffix(".md")
        doc.unlink()
        out = write_plain_language_doc(manifest)
        assert out == doc
        assert doc.exists()
        assert "## At a glance" in doc.read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# Sidecar convention — every existing program manifest should have an .md
# ---------------------------------------------------------------------------


class TestSidecarConvention:
    """Phase H establishes the convention: every `lawcode/<jur>/programs/*.yaml`
    has a sibling `<id>.md`. These tests verify the repo-wide invariant
    holds AFTER the Phase H sidecar generation pass."""

    def test_every_program_manifest_has_a_sidecar_doc(self):
        manifests = sorted(LAWCODE.glob("*/programs/*.yaml"))
        # Skip files that are includes (formula AST trees), not programs.
        # The convention applies to top-level program manifests only.
        manifests = [m for m in manifests if m.parent.name == "programs"]
        assert manifests, "No manifests found — repo layout changed?"
        missing = [m for m in manifests if not m.with_suffix(".md").exists()]
        assert not missing, (
            f"{len(missing)} program manifest(s) missing plain-language sidecar:\n  "
            + "\n  ".join(str(m) for m in missing)
        )
