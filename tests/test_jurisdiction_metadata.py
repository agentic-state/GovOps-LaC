"""ADR-019 + ADR-020 prep / v3.1 Lane 2 + 2b -- pack equivalence diff harness.

For every jurisdiction in ``JURISDICTION_REGISTRY``, the YAML on disk must
project to a ``JurisdictionPack`` that matches the Python literal slot-by-slot:

* metadata block (``lawcode/<code>/config/jurisdiction.yaml``):
  ``Jurisdiction`` identity (id, name, country, level, ...) and the
  ``default_language`` field.
* program manifest (``lawcode/<code>/programs/oas.yaml``):
  ``authority_chain``, ``legal_documents``, ``rules``, ``demo_cases``, and
  the ``program_name`` carried as ``name[default_locale]``.

This is the byte-identical contract that lets ADR-020 (Lane 3) replace the
hand-written ``JURISDICTION_REGISTRY`` literal with a loader that builds packs
from ``lawcode/`` at startup. If this test goes red, Lane 3 cannot land
without a behaviour change.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from govops.jurisdictions import JURISDICTION_REGISTRY
from govops.programs import (
    JurisdictionMetadata,
    load_jurisdiction_metadata,
    load_program_manifest,
)


REPO_ROOT = Path(__file__).resolve().parent.parent
LAWCODE = REPO_ROOT / "lawcode"


def _metadata_path(code: str) -> Path:
    return LAWCODE / code / "config" / "jurisdiction.yaml"


def _oas_manifest_path(code: str) -> Path:
    return LAWCODE / code / "programs" / "oas.yaml"


@pytest.mark.parametrize("code", sorted(JURISDICTION_REGISTRY.keys()))
def test_yaml_metadata_exists(code: str):
    """Every jurisdiction registered in Python must have a YAML metadata file
    on disk. If a jurisdiction is added to the registry without an ADR-019
    block, this surface gates that mistake before ADR-020 propagates it."""
    assert _metadata_path(code).exists(), (
        f"missing ADR-019 metadata: {_metadata_path(code)}"
    )


@pytest.mark.parametrize("code", sorted(JURISDICTION_REGISTRY.keys()))
def test_yaml_metadata_loads(code: str):
    """The metadata block parses through the Pydantic loader without error."""
    meta = load_jurisdiction_metadata(_metadata_path(code))
    assert isinstance(meta, JurisdictionMetadata)


@pytest.mark.parametrize("code", sorted(JURISDICTION_REGISTRY.keys()))
def test_yaml_jurisdiction_projects_to_python_jurisdiction(code: str):
    """The byte-identical contract: YAML projection produces the same
    ``Jurisdiction`` the Python literal carries today.

    Field-by-field comparison so a single mismatch surfaces precisely.
    """
    pack = JURISDICTION_REGISTRY[code]
    meta = load_jurisdiction_metadata(_metadata_path(code))
    derived = meta.to_jurisdiction()

    py = pack.jurisdiction
    assert derived.id == py.id, f"{code}: id mismatch ({derived.id!r} vs {py.id!r})"
    assert derived.name == py.name, (
        f"{code}: name mismatch ({derived.name!r} vs {py.name!r})"
    )
    assert derived.country == py.country, f"{code}: country mismatch"
    assert derived.level == py.level, f"{code}: level mismatch"
    assert derived.parent_id == py.parent_id, f"{code}: parent_id mismatch"
    assert derived.legal_tradition == py.legal_tradition, (
        f"{code}: legal_tradition mismatch"
        f"\n  yaml: {derived.legal_tradition!r}"
        f"\n  py:   {py.legal_tradition!r}"
    )
    assert derived.language_regime == py.language_regime, (
        f"{code}: language_regime mismatch"
        f"\n  yaml: {derived.language_regime!r}"
        f"\n  py:   {py.language_regime!r}"
    )


@pytest.mark.parametrize("code", sorted(JURISDICTION_REGISTRY.keys()))
def test_yaml_default_language_matches_python(code: str):
    """``default_language`` carried by the metadata block must match the
    ``JurisdictionPack.default_language`` Python field, since ADR-020's
    loader will source it from the YAML."""
    pack = JURISDICTION_REGISTRY[code]
    meta = load_jurisdiction_metadata(_metadata_path(code))
    assert meta.default_language == pack.default_language, (
        f"{code}: default_language mismatch ({meta.default_language!r} vs "
        f"{pack.default_language!r})"
    )


# ---------------------------------------------------------------------------
# Loader behaviour -- targeted negative coverage
# ---------------------------------------------------------------------------


def test_load_missing_file_raises(tmp_path: Path):
    """Missing files surface as ProgramManifestError, not silent None."""
    from govops.programs import ProgramManifestError
    with pytest.raises(ProgramManifestError, match="not found"):
        load_jurisdiction_metadata(tmp_path / "nope.yaml")


def test_load_file_without_block_raises(tmp_path: Path):
    """A YAML file without a `jurisdiction:` block raises rather than
    returning a half-built object."""
    from govops.programs import ProgramManifestError
    p = tmp_path / "no_block.yaml"
    p.write_text("defaults:\n  domain: ui\nvalues: []\n", encoding="utf-8")
    with pytest.raises(ProgramManifestError, match="missing top-level"):
        load_jurisdiction_metadata(p)


def test_display_name_picks_default_language_first():
    """display_name picks `name[default_language]` over en or other locales."""
    meta = JurisdictionMetadata(
        id="jur-test-national",
        country="XX",
        level="national",
        name={"en": "English Name", "fr": "Nom francais", "es": "Nombre espanol"},
        default_language="fr",
    )
    assert meta.display_name() == "Nom francais"


def test_display_name_falls_back_to_en():
    """When default_language has no entry, en is the next preference."""
    meta = JurisdictionMetadata(
        id="jur-test-national",
        country="XX",
        level="national",
        name={"en": "English Name", "es": "Nombre espanol"},
        default_language="fr",  # not in name
    )
    assert meta.display_name() == "English Name"


def test_display_name_falls_back_to_first_locale():
    """No default_language match and no en -- first locale wins."""
    meta = JurisdictionMetadata(
        id="jur-test-national",
        country="XX",
        level="national",
        name={"es": "Nombre espanol"},
        default_language="fr",
    )
    assert meta.display_name() == "Nombre espanol"


# ---------------------------------------------------------------------------
# Lane 2b -- program-manifest pack-equivalence harness
# ---------------------------------------------------------------------------
#
# Every jurisdiction now has a programs/oas.yaml manifest on disk. The diff
# harness below asserts that for each jurisdiction, the YAML manifest loads
# into a Program object whose authority_chain / legal_documents / rules /
# demo_cases match the running JURISDICTION_REGISTRY[code] pack field-by-field.
#
# Once these tests are green, ADR-020 (Lane 3) can substitute the Python
# JURISDICTION_REGISTRY literal with a loader that reads the YAML at startup
# and produces the same packs the engine is consuming today.


@pytest.mark.parametrize("code", sorted(JURISDICTION_REGISTRY.keys()))
def test_oas_manifest_exists_for_every_jurisdiction(code: str):
    """Every jurisdiction registered in Python carries an OAS YAML manifest."""
    assert _oas_manifest_path(code).exists(), (
        f"missing OAS manifest: {_oas_manifest_path(code)} -- run "
        "scripts/migration/generate_program_manifests.py"
    )


@pytest.mark.parametrize("code", sorted(JURISDICTION_REGISTRY.keys()))
def test_oas_manifest_loads_through_canonical_loader(code: str):
    """The manifest parses cleanly through the load_program_manifest path the
    engine uses at runtime. If this fails, Lane 3 cannot trust the manifest as
    the source of truth."""
    program = load_program_manifest(_oas_manifest_path(code))
    assert program.program_id == "oas"
    assert program.shape == "old_age_pension"
    assert program.jurisdiction_id == JURISDICTION_REGISTRY[code].jurisdiction.id


@pytest.mark.parametrize("code", sorted(JURISDICTION_REGISTRY.keys()))
def test_oas_manifest_authority_chain_matches_python(code: str):
    """The YAML authority chain produces the same AuthorityReference list as
    the Python pack. Compares id + layer + title + citation + parent_id; the
    auto-generated id field must match because the YAML carries the exact
    Python id."""
    pack = JURISDICTION_REGISTRY[code]
    program = load_program_manifest(_oas_manifest_path(code))
    py_chain = pack.authority_chain
    yaml_chain = program.authority_chain
    assert len(py_chain) == len(yaml_chain), (
        f"{code}: chain length mismatch ({len(py_chain)} vs {len(yaml_chain)})"
    )
    for py, ya in zip(py_chain, yaml_chain):
        assert py.id == ya.id, f"{code}: chain id mismatch ({py.id!r} vs {ya.id!r})"
        assert py.layer == ya.layer, f"{code}/{py.id}: layer mismatch"
        assert py.title == ya.title, f"{code}/{py.id}: title mismatch"
        assert py.citation == ya.citation, f"{code}/{py.id}: citation mismatch"
        assert py.parent_id == ya.parent_id, f"{code}/{py.id}: parent mismatch"


@pytest.mark.parametrize("code", sorted(JURISDICTION_REGISTRY.keys()))
def test_oas_manifest_legal_documents_match_python(code: str):
    pack = JURISDICTION_REGISTRY[code]
    program = load_program_manifest(_oas_manifest_path(code))
    py_docs = pack.legal_documents
    yaml_docs = program.legal_documents
    assert len(py_docs) == len(yaml_docs)
    for py, ya in zip(py_docs, yaml_docs):
        assert py.id == ya.id, f"{code}: doc id mismatch"
        assert py.title == ya.title
        assert py.citation == ya.citation
        assert py.document_type == ya.document_type
        assert len(py.sections) == len(ya.sections), (
            f"{code}/{py.id}: section count mismatch"
        )
        for ps, ys in zip(py.sections, ya.sections):
            assert ps.section_ref == ys.section_ref
            assert ps.heading == ys.heading
            assert ps.text == ys.text


@pytest.mark.parametrize("code", sorted(JURISDICTION_REGISTRY.keys()))
def test_oas_manifest_rules_match_python(code: str):
    """Rules are the most regression-prone slot -- parameter resolution path
    must produce byte-identical dicts. If this drifts, the engine's evaluation
    output drifts."""
    pack = JURISDICTION_REGISTRY[code]
    program = load_program_manifest(_oas_manifest_path(code))
    py_rules = pack.rules
    yaml_rules = program.rules
    assert len(py_rules) == len(yaml_rules), (
        f"{code}: rule count mismatch ({len(py_rules)} vs {len(yaml_rules)})"
    )
    for py, ya in zip(py_rules, yaml_rules):
        assert py.id == ya.id, f"{code}: rule id mismatch"
        assert py.rule_type == ya.rule_type, f"{code}/{py.id}: rule_type"
        assert py.description == ya.description, f"{code}/{py.id}: description"
        assert py.formal_expression == ya.formal_expression, f"{code}/{py.id}: expr"
        assert py.citation == ya.citation, f"{code}/{py.id}: citation"
        assert py.source_document_id == ya.source_document_id, f"{code}/{py.id}: src doc"
        assert py.source_section_ref == ya.source_section_ref, f"{code}/{py.id}: src sec"
        assert py.param_key_prefix == ya.param_key_prefix, f"{code}/{py.id}: prefix"
        # Parameters: keys must match; values from a substrate-resolved manifest
        # match the Python pack because both went through resolve_param().
        assert set(py.parameters.keys()) == set(ya.parameters.keys()), (
            f"{code}/{py.id}: parameter keys mismatch"
        )
        for key in py.parameters:
            assert py.parameters[key] == ya.parameters[key], (
                f"{code}/{py.id}/{key}: parameter value mismatch "
                f"({py.parameters[key]!r} vs {ya.parameters[key]!r})"
            )


@pytest.mark.parametrize("code", sorted(JURISDICTION_REGISTRY.keys()))
def test_oas_manifest_demo_cases_match_python(code: str):
    pack = JURISDICTION_REGISTRY[code]
    program = load_program_manifest(_oas_manifest_path(code))
    py_cases = pack.cases_factory()
    yaml_cases = program.demo_cases
    assert len(py_cases) == len(yaml_cases), (
        f"{code}: demo case count mismatch ({len(py_cases)} vs {len(yaml_cases)})"
    )
    for py, ya in zip(py_cases, yaml_cases):
        assert py.id == ya.id, f"{code}: case id mismatch"
        assert py.applicant.id == ya.applicant.id
        assert py.applicant.legal_name == ya.applicant.legal_name
        assert py.applicant.legal_status == ya.applicant.legal_status
        assert py.applicant.country_of_birth == ya.applicant.country_of_birth
        assert py.applicant.date_of_birth == ya.applicant.date_of_birth
        assert len(py.residency_periods) == len(ya.residency_periods)
        for pp, yp in zip(py.residency_periods, ya.residency_periods):
            assert pp.country == yp.country
            assert pp.start_date == yp.start_date
            assert pp.end_date == yp.end_date
            assert pp.verified == yp.verified
        assert len(py.evidence_items) == len(ya.evidence_items)
        for pe, ye in zip(py.evidence_items, ya.evidence_items):
            assert pe.evidence_type == ye.evidence_type
            assert pe.description == ye.description
            assert pe.provided == ye.provided
            assert pe.verified == ye.verified


@pytest.mark.parametrize("code", sorted(JURISDICTION_REGISTRY.keys()))
def test_oas_manifest_program_name_carries_default_language(code: str):
    """Pack.program_name (single string) must equal manifest.name[default_language].
    This is what L3's loader will use to populate JurisdictionPack.program_name
    after the registry rewire."""
    pack = JURISDICTION_REGISTRY[code]
    program = load_program_manifest(_oas_manifest_path(code))
    default_lang = pack.default_language
    assert default_lang in program.name, (
        f"{code}: manifest.name lacks entry for default_language={default_lang!r}"
    )
    assert program.name[default_lang] == pack.program_name, (
        f"{code}: program_name mismatch "
        f"(yaml[{default_lang}]={program.name[default_lang]!r} vs "
        f"py.program_name={pack.program_name!r})"
    )
