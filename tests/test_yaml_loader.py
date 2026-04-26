"""Phase 3 — ConfigStore.load_from_yaml() smoke tests.

Per [ADR-003](../docs/design/ADRs/ADR-003-yaml-over-json.md), YAML is the
on-disk format for `lawcode/<jurisdiction>/config/*.yaml`. The loader
accepts a single file or a directory tree, reads each YAML doc, and
inserts the records into the in-memory ConfigStore.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest

from govops.config import ApprovalStatus, ConfigStore, ResolutionSource, ValueType


UTC = timezone.utc


def _write(tmp_path: Path, name: str, content: str) -> Path:
    p = tmp_path / name
    p.write_text(content, encoding="utf-8")
    return p


# ---------------------------------------------------------------------------
# Single-file load
# ---------------------------------------------------------------------------


def test_load_single_file_inserts_records(tmp_path: Path):
    fp = _write(tmp_path, "rules.yaml", """\
defaults:
  domain: rule
  jurisdiction_id: ca-oas
  value_type: number
  effective_from: "1985-01-01"
values:
  - key: ca.rule.age-65.min_age
    value: 65
    citation: "OAS Act, s. 3(1)"
  - key: ca.rule.residency-10.min_years
    value: 10
    citation: "OAS Act, s. 3(1)"
""")
    store = ConfigStore()
    n = store.load_from_yaml(fp)
    assert n == 2
    assert len(store) == 2

    cv = store.list(key_prefix="ca.rule.age-65")[0]
    assert cv.value == 65
    assert cv.domain == "rule"
    assert cv.jurisdiction_id == "ca-oas"
    assert cv.value_type == ValueType.NUMBER
    assert cv.effective_from == datetime(1985, 1, 1, tzinfo=UTC)
    assert cv.citation == "OAS Act, s. 3(1)"


def test_loaded_record_resolves_via_substrate(tmp_path: Path):
    """After load, resolve() returns the substrate value with SUBSTRATE source."""
    fp = _write(tmp_path, "v.yaml", """\
defaults:
  value_type: number
  effective_from: "2000-01-01"
values:
  - key: ca.rule.age-65.min_age
    value: 67
    jurisdiction_id: ca-oas
    domain: rule
""")
    store = ConfigStore()
    store.load_from_yaml(fp)
    result = store.resolve_value(
        "ca.rule.age-65.min_age",
        evaluation_date=datetime(2026, 1, 1, tzinfo=UTC),
        jurisdiction_id="ca-oas",
    )
    assert result.value == 67
    assert result.source == ResolutionSource.SUBSTRATE


# ---------------------------------------------------------------------------
# Directory load
# ---------------------------------------------------------------------------


def test_load_directory_walks_recursively(tmp_path: Path):
    (tmp_path / "ca").mkdir()
    (tmp_path / "br").mkdir()
    _write(tmp_path / "ca", "rules.yaml", """\
defaults: {domain: rule, jurisdiction_id: ca-oas, value_type: number, effective_from: "1900-01-01"}
values:
  - {key: ca.rule.age-65.min_age, value: 65}
""")
    _write(tmp_path / "br", "rules.yaml", """\
defaults: {domain: rule, jurisdiction_id: br-inss, value_type: number, effective_from: "1900-01-01"}
values:
  - {key: br.rule.age.min_age, value: 65}
""")
    _write(tmp_path, "global.yaml", """\
defaults: {domain: ui, value_type: string, effective_from: "1900-01-01"}
values:
  - {key: ui.label.nav.about.en, value: About, language: en}
""")

    store = ConfigStore()
    n = store.load_from_yaml(tmp_path)
    assert n == 3
    assert len(store) == 3
    keys = {cv.key for cv in store.all()}
    assert keys == {
        "ca.rule.age-65.min_age",
        "br.rule.age.min_age",
        "ui.label.nav.about.en",
    }


def test_load_directory_skips_non_yaml(tmp_path: Path):
    _write(tmp_path, "values.yaml", """\
values:
  - {key: foo, value: 1, value_type: number}
""")
    _write(tmp_path, "README.md", "# not a YAML file")
    _write(tmp_path, "ignored.txt", "skip me")
    store = ConfigStore()
    n = store.load_from_yaml(tmp_path)
    assert n == 1


def test_load_empty_yaml_is_noop(tmp_path: Path):
    """An empty YAML file (or one with only a comment) is ignored, not an error."""
    _write(tmp_path, "empty.yaml", "# only a comment\n")
    store = ConfigStore()
    n = store.load_from_yaml(tmp_path)
    assert n == 0


# ---------------------------------------------------------------------------
# Defaults merging
# ---------------------------------------------------------------------------


def test_defaults_merge_into_each_record(tmp_path: Path):
    fp = _write(tmp_path, "v.yaml", """\
defaults:
  domain: rule
  jurisdiction_id: ca-oas
  value_type: number
  effective_from: "1985-01-01"
  citation: "default citation"
values:
  - {key: ca.rule.age-65.min_age, value: 65}
  - {key: ca.rule.residency-10.min_years, value: 10, citation: "explicit override"}
""")
    store = ConfigStore()
    store.load_from_yaml(fp)
    age = store.list(key_prefix="ca.rule.age-65")[0]
    res = store.list(key_prefix="ca.rule.residency-10")[0]
    assert age.citation == "default citation"
    assert res.citation == "explicit override"


def test_value_types_other_than_number(tmp_path: Path):
    fp = _write(tmp_path, "v.yaml", """\
defaults: {domain: rule, jurisdiction_id: ca-oas, effective_from: "1900-01-01"}
values:
  - {key: ca.rule.legal.accepted_statuses, value: ["citizen", "permanent_resident"], value_type: list}
  - {key: ca.rule.something.flag, value: true, value_type: bool}
""")
    store = ConfigStore()
    store.load_from_yaml(fp)
    by_key = {cv.key: cv for cv in store.all()}
    assert by_key["ca.rule.legal.accepted_statuses"].value == ["citizen", "permanent_resident"]
    assert by_key["ca.rule.legal.accepted_statuses"].value_type == ValueType.LIST
    assert by_key["ca.rule.something.flag"].value is True


# ---------------------------------------------------------------------------
# Error paths
# ---------------------------------------------------------------------------


def test_missing_path_raises(tmp_path: Path):
    store = ConfigStore()
    with pytest.raises(FileNotFoundError):
        store.load_from_yaml(tmp_path / "nope.yaml")


def test_top_level_must_have_values(tmp_path: Path):
    fp = _write(tmp_path, "v.yaml", "defaults: {}\n")  # no 'values'
    store = ConfigStore()
    with pytest.raises(ValueError, match="values"):
        store.load_from_yaml(fp)


def test_missing_key_raises(tmp_path: Path):
    fp = _write(tmp_path, "v.yaml", """\
defaults: {value_type: number, effective_from: "1900-01-01"}
values:
  - {value: 65}
""")
    store = ConfigStore()
    with pytest.raises(ValueError, match="missing 'key'"):
        store.load_from_yaml(fp)


def test_missing_value_type_raises(tmp_path: Path):
    fp = _write(tmp_path, "v.yaml", """\
defaults: {effective_from: "1900-01-01"}
values:
  - {key: foo, value: 1}
""")
    store = ConfigStore()
    with pytest.raises(ValueError, match="value_type"):
        store.load_from_yaml(fp)


def test_status_default_is_approved(tmp_path: Path):
    fp = _write(tmp_path, "v.yaml", """\
defaults: {value_type: number, effective_from: "1900-01-01"}
values:
  - {key: foo.bar, value: 1}
""")
    store = ConfigStore()
    store.load_from_yaml(fp)
    assert store.all()[0].status == ApprovalStatus.APPROVED


# ---------------------------------------------------------------------------
# ADR-003 §Mitigations: YAML 1.2 / no anchor surprises
# ---------------------------------------------------------------------------


def test_yaml_12_norway_problem_handled_when_quoted(tmp_path: Path):
    """YAML 1.1 turned 'no' into False; YAML 1.2 (PyYAML safe_load) keeps strings.
    ADR-003 also requires reviewers to quote ambiguous strings — we test the safe case."""
    fp = _write(tmp_path, "v.yaml", """\
defaults: {value_type: string, effective_from: "1900-01-01"}
values:
  - {key: ui.label.toggle.en, value: "no"}
  - {key: ui.label.country.no, value: "Norway"}
""")
    store = ConfigStore()
    store.load_from_yaml(fp)
    by_key = {cv.key: cv for cv in store.all()}
    assert by_key["ui.label.toggle.en"].value == "no"
    assert by_key["ui.label.country.no"].value == "Norway"
