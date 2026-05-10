"""ADR-019 / v3.1 Lane 2 -- jurisdiction-metadata diff harness.

For every jurisdiction in ``JURISDICTION_REGISTRY``, the YAML metadata block
at ``lawcode/<code>/config/jurisdiction.yaml`` must project to a
``Jurisdiction`` matching the Python literal field-for-field, and the
``default_language`` carried by the block must match the pack.

This is the byte-identical contract that lets ADR-020 (Lane 3) replace the
hand-written ``JURISDICTION_REGISTRY`` literal with a loader that builds packs
from ``lawcode/`` at startup. If this test goes red, Lane 3 cannot land
without a behaviour change.

Note: this test only covers the *jurisdiction* slot of each pack. The
``authority_chain``, ``legal_documents``, ``rules``, ``cases_factory``, and
``program_name`` slots are covered by Lane 2b (PR #N2.5) once the missing
OAS manifests for BR/ES/FR/DE/UA/JP exist on disk.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from govops.jurisdictions import JURISDICTION_REGISTRY
from govops.programs import JurisdictionMetadata, load_jurisdiction_metadata


REPO_ROOT = Path(__file__).resolve().parent.parent
LAWCODE = REPO_ROOT / "lawcode"


def _metadata_path(code: str) -> Path:
    return LAWCODE / code / "config" / "jurisdiction.yaml"


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
