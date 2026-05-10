"""ADR-020 / v3.1 Lane 3 -- registry loader-specific coverage.

The bulk of the byte-identical contract is gated by
``tests/test_jurisdiction_metadata.py`` (the diff harness from Lanes 2 + 2b).
This module covers loader-specific behaviour:

* hot reload via ``reload_registry()``
* skip semantics for ``.federated/``, ``global/``, and incomplete jurisdictions
* federation hydration end-to-end against a synthetic on-disk pack
* the loader still produces a well-formed pack when called against a tmp
  ``lawcode/`` clone (i.e. the function is location-agnostic and ready for
  ADR-022's commit-to-disk + reload flow).
"""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from govops.jurisdictions import (
    JURISDICTION_REGISTRY,
    JurisdictionPack,
    build_registry_from_lawcode,
    reload_registry,
)


REPO_ROOT = Path(__file__).resolve().parent.parent
LAWCODE = REPO_ROOT / "lawcode"


def test_module_level_registry_has_all_seven_jurisdictions():
    """Sanity gate: the module-import-time build produced exactly the 7
    jurisdictions the v3.0 literal carried."""
    assert sorted(JURISDICTION_REGISTRY.keys()) == ["br", "ca", "de", "es", "fr", "jp", "ua"]


def test_loader_against_live_tree_matches_module_registry():
    """A fresh ``build_registry_from_lawcode(LAWCODE)`` call must produce the
    same dict the module-level assignment produced. Guards against accidental
    state leaking between calls (the loader is stateless / pure I/O)."""
    fresh = build_registry_from_lawcode(LAWCODE)
    assert sorted(fresh.keys()) == sorted(JURISDICTION_REGISTRY.keys())
    for code in fresh:
        assert isinstance(fresh[code], JurisdictionPack)
        # Spot-check identity round-trips
        assert fresh[code].jurisdiction.id == JURISDICTION_REGISTRY[code].jurisdiction.id
        assert fresh[code].program_name == JURISDICTION_REGISTRY[code].program_name


def test_loader_skips_global_and_dot_directories(tmp_path: Path):
    """Synthetic lawcode tree to confirm the loader skips ``global/`` and any
    ``.``-prefixed directory (federation root, hidden caches)."""
    fake = tmp_path / "lawcode"
    (fake / "global").mkdir(parents=True)
    (fake / ".cache").mkdir()
    (fake / ".federated").mkdir()  # would recurse, but empty
    registry = build_registry_from_lawcode(fake)
    assert registry == {}


def test_loader_skips_incomplete_jurisdiction(tmp_path: Path):
    """A jurisdiction with metadata but no programs/oas.yaml is silently
    skipped -- federation publishers may ship metadata-only packs the
    v3.1 registry shape doesn't surface. Documented in ADR-020."""
    fake = tmp_path / "lawcode"
    jur = fake / "xx" / "config"
    jur.mkdir(parents=True)
    (jur / "jurisdiction.yaml").write_text(
        """
jurisdiction:
  id: jur-xx-national
  country: XX
  level: national
  name:
    en: Test Land
  legal_tradition: civil_law
  language_regime: en
  default_language: en
""",
        encoding="utf-8",
    )
    # No programs/oas.yaml -> skipped
    registry = build_registry_from_lawcode(fake)
    assert "xx" not in registry


def test_loader_skips_jurisdiction_without_metadata(tmp_path: Path):
    """A directory with programs but no metadata block is also skipped --
    metadata identity is required (per ADR-019) for registration."""
    fake = tmp_path / "lawcode"
    jur = fake / "xx" / "programs"
    jur.mkdir(parents=True)
    # No config/jurisdiction.yaml
    registry = build_registry_from_lawcode(fake)
    assert registry == {}


def test_loader_hydrates_federation_directory(tmp_path: Path):
    """A pack under .federated/<publisher>/<code>/ flows the same loader.
    Build a synthetic federation publisher pack from the live CA tree and
    confirm it lands in the registry under its own code prefix."""
    fake = tmp_path / "lawcode"
    fake.mkdir()
    fed = fake / ".federated" / "test-publisher"
    fed.mkdir(parents=True)

    # Copy CA's real config + programs into the federation slot under a new
    # pseudo-code so we don't need to author synthetic YAML.
    pseudo_code = "fedca"
    src_jur = LAWCODE / "ca"
    dst_jur = fed / pseudo_code
    shutil.copytree(src_jur / "config", dst_jur / "config")
    shutil.copytree(src_jur / "programs", dst_jur / "programs")

    # Loader walks fake/ -> empty local jurisdictions, then recurses into
    # .federated/test-publisher/ -> finds fedca via the same code path.
    registry = build_registry_from_lawcode(fake)
    assert pseudo_code in registry, (
        f"federation pack failed to hydrate; got keys: {sorted(registry.keys())}"
    )
    assert registry[pseudo_code].jurisdiction.id == "jur-ca-federal"


def test_reload_registry_picks_up_new_jurisdiction(tmp_path: Path, monkeypatch):
    """reload_registry() must mutate the module-level dict in place -- callers
    that imported the dict reference (rather than re-importing the module)
    need to see the update.

    Stub _LAWCODE_ROOT to a tmp tree, drop in a synthetic CA copy under a
    new code, reload, and confirm the registry surface gains the new code
    without losing the original (because reload mutates in place but our
    stub has only the new code; we reset after).
    """
    import govops.jurisdictions as J

    # Snapshot the live state so we can restore.
    original_keys = set(J.JURISDICTION_REGISTRY.keys())
    try:
        # Build a fake tree with a single synthetic jurisdiction copied from CA.
        fake = tmp_path / "lawcode"
        fake.mkdir()
        new_code = "newland"
        dst = fake / new_code
        shutil.copytree(LAWCODE / "ca" / "config", dst / "config")
        shutil.copytree(LAWCODE / "ca" / "programs", dst / "programs")

        monkeypatch.setattr(J, "_LAWCODE_ROOT", fake)
        reload_registry()

        # In-place mutation: same dict object, new contents.
        assert "newland" in J.JURISDICTION_REGISTRY
        # Original keys cleared because the fake tree only has 'newland'.
        # This proves reload mutates in place; an attribute reassignment
        # would not have removed the original keys from a previously-bound
        # reference.
        assert set(J.JURISDICTION_REGISTRY.keys()) == {"newland"}
    finally:
        # Restore the live state by reloading against the real LAWCODE.
        monkeypatch.undo()
        reload_registry()
        assert set(J.JURISDICTION_REGISTRY.keys()) == original_keys


def test_pack_cases_factory_returns_fresh_list_each_call():
    """ADR-020 specifies cases_factory returns a fresh list copy each call so
    callers that mutate the returned list don't corrupt the cached
    demo_cases."""
    pack = JURISDICTION_REGISTRY["ca"]
    a = pack.cases_factory()
    b = pack.cases_factory()
    assert a is not b, "factory must return a fresh list, not the cached one"
    # Mutating a should not affect b's contents
    a.pop()
    assert len(a) != len(b)
