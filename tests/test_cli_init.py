"""Phase H — `govops init` scaffolder + plain-language doc generator tests.

PLAN-v3 §Phase H exit gate: a contributor with neither Python nor Node
runs `docker compose up` and sees the demo; `govops init` produces a
schema-valid skeleton.

These tests pin the scaffolder contract — same files generated, all
schema-valid against the existing Phase 5 validators, plain-language
sidecars produced for every program manifest.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from govops.cli_init import (
    InitError,
    init_jurisdiction,
    render_plain_language_doc,
    write_plain_language_doc,
)
from govops.programs import load_program_manifest

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
        assert (base / "jurisdiction.yaml").exists()
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
