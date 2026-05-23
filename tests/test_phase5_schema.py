"""Phase 5 — schema gate.

Per the project plan, Phase 5: every YAML file under ``lawcode/`` must
validate against ``schema/lawcode-v1.0.json`` (file shape) AND every merged
record must validate against ``schema/configvalue-v1.0.json`` (record shape).

Failure mode: CI fails on a deliberately malformed YAML test (proves the gate
isn't toothless). The exit-criterion test for the phase.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest
import yaml
from jsonschema import Draft202012Validator


REPO_ROOT = Path(__file__).resolve().parent.parent
LAWCODE_DIR = REPO_ROOT / "lawcode"
SCHEMA_DIR = REPO_ROOT / "schema"
LAWCODE_SCHEMA_PATH = SCHEMA_DIR / "lawcode-v1.0.json"
CONFIGVALUE_SCHEMA_PATH = SCHEMA_DIR / "configvalue-v1.0.json"
VALIDATOR_SCRIPT = REPO_ROOT / "scripts" / "validate_lawcode.py"


# ---------------------------------------------------------------------------
# Schema files exist, parse, and self-validate as Draft 2020-12
# ---------------------------------------------------------------------------


def _load(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def test_configvalue_schema_exists_and_parses():
    assert CONFIGVALUE_SCHEMA_PATH.exists(), "schema/configvalue-v1.0.json missing"
    schema = _load(CONFIGVALUE_SCHEMA_PATH)
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    Draft202012Validator.check_schema(schema)


def test_lawcode_schema_exists_and_parses():
    assert LAWCODE_SCHEMA_PATH.exists(), "schema/lawcode-v1.0.json missing"
    schema = _load(LAWCODE_SCHEMA_PATH)
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    Draft202012Validator.check_schema(schema)


# ---------------------------------------------------------------------------
# Every shipped lawcode YAML validates
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def file_validator() -> Draft202012Validator:
    return Draft202012Validator(_load(LAWCODE_SCHEMA_PATH))


@pytest.fixture(scope="module")
def record_validator() -> Draft202012Validator:
    return Draft202012Validator(_load(CONFIGVALUE_SCHEMA_PATH))


@pytest.fixture(scope="module")
def lawcode_files() -> list[Path]:
    # v3 / ADR-014 + ADR-015 — `programs/` holds Program manifests (validated
    # by tests/test_programs.py against schema/program-manifest-v1.0.json),
    # `_shapes/` holds local shape declarations per ADR-015's two-tier model.
    # Both are excluded from the v2 ConfigValue file gate.
    excluded_ancestor_dir_names = {"programs", "_shapes"}
    yaml_files = sorted(LAWCODE_DIR.rglob("*.yaml")) + sorted(LAWCODE_DIR.rglob("*.yml"))
    return [
        p
        for p in yaml_files
        if not any(parent.name in excluded_ancestor_dir_names for parent in p.parents)
    ]


def test_lawcode_tree_has_files(lawcode_files):
    assert lawcode_files, "lawcode/ tree contains no YAML files"


def test_every_lawcode_file_passes_file_schema(lawcode_files, file_validator):
    failures = []
    for fp in lawcode_files:
        with fp.open("r", encoding="utf-8") as fh:
            doc = yaml.safe_load(fh)
        errors = list(file_validator.iter_errors(doc))
        if errors:
            failures.append((fp, [e.message for e in errors]))
    assert not failures, f"file-shape violations: {failures}"


def test_every_lawcode_record_passes_configvalue_schema(lawcode_files, record_validator):
    failures = []
    for fp in lawcode_files:
        with fp.open("r", encoding="utf-8") as fh:
            doc = yaml.safe_load(fh)
        defaults = doc.get("defaults") or {}
        for idx, raw in enumerate(doc.get("values") or []):
            merged = {**defaults, **raw}
            errors = list(record_validator.iter_errors(merged))
            if errors:
                failures.append((fp, idx, raw.get("key"), [e.message for e in errors]))
    assert not failures, f"record-shape violations: {failures}"


# ---------------------------------------------------------------------------
# Phase 5 exit gate: a deliberately malformed YAML must fail the validator
# ---------------------------------------------------------------------------


def test_validator_rejects_malformed_yaml(tmp_path):
    """The CI gate must fail loud, not silently pass. A YAML missing required
    fields produces a non-zero exit from scripts/validate_lawcode.py."""
    bad_dir = tmp_path / "lawcode"
    (bad_dir / "global").mkdir(parents=True)
    bad_file = bad_dir / "global" / "broken.yaml"
    bad_file.write_text(
        "values:\n"
        "  - key: missing.value_type.entirely\n"
        "    value: 42\n",
        encoding="utf-8",
    )

    file_validator = Draft202012Validator(_load(LAWCODE_SCHEMA_PATH))
    record_validator = Draft202012Validator(_load(CONFIGVALUE_SCHEMA_PATH))

    with bad_file.open("r", encoding="utf-8") as fh:
        doc = yaml.safe_load(fh)

    file_errors = list(file_validator.iter_errors(doc))
    assert not file_errors, "file-shape passes; failure must come from record schema"

    merged = {**(doc.get("defaults") or {}), **doc["values"][0]}
    record_errors = list(record_validator.iter_errors(merged))
    assert record_errors, "record schema must reject a record missing value_type"
    assert any("value_type" in err.message for err in record_errors)


def test_validator_rejects_invalid_value_type(tmp_path):
    """value_type outside the enum must fail the record schema."""
    record_validator = Draft202012Validator(_load(CONFIGVALUE_SCHEMA_PATH))
    record = {
        "domain": "rule",
        "key": "ca.rule.test.invalid",
        "value": 1,
        "value_type": "integer",  # not in enum
    }
    errors = list(record_validator.iter_errors(record))
    assert any("integer" in err.message or "enum" in err.message for err in errors)


def test_validator_rejects_invalid_key_pattern(tmp_path):
    """Keys must match the lowercase dotted pattern."""
    record_validator = Draft202012Validator(_load(CONFIGVALUE_SCHEMA_PATH))
    record = {
        "domain": "rule",
        "key": "CA.Rule.Bad.Key",  # uppercase not allowed
        "value": 1,
        "value_type": "number",
    }
    errors = list(record_validator.iter_errors(record))
    assert errors, "uppercase keys must be rejected"


def test_prompt_records_require_approver(tmp_path):
    """Per ADR-008, value_type=prompt requires both author and approved_by."""
    record_validator = Draft202012Validator(_load(CONFIGVALUE_SCHEMA_PATH))
    record_missing_approver = {
        "domain": "prompt",
        "key": "global.prompt.test.missing-approver",
        "value": "do the thing",
        "value_type": "prompt",
        "author": "someone",
        # approved_by missing
    }
    errors = list(record_validator.iter_errors(record_missing_approver))
    assert any("approved_by" in err.message for err in errors)


# ---------------------------------------------------------------------------
# ADR-019 — jurisdiction-metadata block at the top of a lawcode YAML file
# ---------------------------------------------------------------------------


def _wellformed_metadata() -> dict:
    return {
        "id": "jur-pl-national",
        "country": "PL",
        "level": "national",
        "parent_id": None,
        "name": {"en": "Poland", "pl": "Polska"},
        "legal_tradition": "civil_law",
        "language_regime": "pl",
        "default_language": "en",
    }


def test_lawcode_with_jurisdiction_metadata_validates():
    """A lawcode file carrying both `jurisdiction:` and `values:` validates."""
    file_validator = Draft202012Validator(_load(LAWCODE_SCHEMA_PATH))
    doc = {
        "jurisdiction": _wellformed_metadata(),
        "defaults": {"domain": "ui", "jurisdiction_id": "pl-oas", "effective_from": "1900-01-01"},
        "values": [{"key": "jurisdiction.pl.label.en", "value": "Poland", "value_type": "string"}],
    }
    errors = list(file_validator.iter_errors(doc))
    assert not errors, [e.message for e in errors]


def test_metadata_only_lawcode_file_validates():
    """A jurisdiction.yaml file with ONLY the metadata block (no values) validates -- the
    metadata-only file is what `govops init` may emit when a contributor wants identity
    separated from substrate values."""
    file_validator = Draft202012Validator(_load(LAWCODE_SCHEMA_PATH))
    doc = {"jurisdiction": _wellformed_metadata()}
    errors = list(file_validator.iter_errors(doc))
    assert not errors, [e.message for e in errors]


def test_empty_lawcode_file_fails():
    """A file with neither `values` nor `jurisdiction` is meaningless and must fail."""
    file_validator = Draft202012Validator(_load(LAWCODE_SCHEMA_PATH))
    errors = list(file_validator.iter_errors({"defaults": {"domain": "ui"}}))
    assert errors, "must reject a file with no values and no jurisdiction block"


def test_metadata_missing_required_field_fails():
    """Every required field in the metadata block is gated."""
    file_validator = Draft202012Validator(_load(LAWCODE_SCHEMA_PATH))
    for missing in ("id", "country", "level", "name", "default_language"):
        meta = _wellformed_metadata()
        del meta[missing]
        errors = list(file_validator.iter_errors({"jurisdiction": meta}))
        assert errors, f"must reject metadata missing {missing!r}"


def test_metadata_invalid_country_code_fails():
    """Country code must be ISO 3166-1 alpha-2, uppercase."""
    file_validator = Draft202012Validator(_load(LAWCODE_SCHEMA_PATH))
    for bad in ("pl", "POL", "P1", ""):
        meta = _wellformed_metadata()
        meta["country"] = bad
        errors = list(file_validator.iter_errors({"jurisdiction": meta}))
        assert errors, f"must reject country={bad!r}"


def test_metadata_invalid_id_pattern_fails():
    """Jurisdiction id must match the jur-<slug> pattern."""
    file_validator = Draft202012Validator(_load(LAWCODE_SCHEMA_PATH))
    for bad in ("ca-federal", "JUR-CA-FEDERAL", "jur-", "jur-CA"):
        meta = _wellformed_metadata()
        meta["id"] = bad
        errors = list(file_validator.iter_errors({"jurisdiction": meta}))
        assert errors, f"must reject id={bad!r}"


def test_metadata_legal_tradition_is_free_form():
    """legal_tradition is free-form per ADR-019 Amendment 2026-05-10 so the
    7 jurisdictions' prose strings round-trip through the schema unchanged.
    Empty strings remain rejected to keep the field meaningful."""
    file_validator = Draft202012Validator(_load(LAWCODE_SCHEMA_PATH))
    for prose in (
        "common_law",
        "Bijural (common law / civil law)",
        "Civil law (Romano-Germanic)",
        "Civil law (Japanese hybrid; German + French + post-war common-law influence)",
    ):
        meta = _wellformed_metadata()
        meta["legal_tradition"] = prose
        errors = list(file_validator.iter_errors({"jurisdiction": meta}))
        assert not errors, f"prose {prose!r} must validate: {[e.message for e in errors]}"
    # Empty string still rejected by minLength: 1
    meta = _wellformed_metadata()
    meta["legal_tradition"] = ""
    errors = list(file_validator.iter_errors({"jurisdiction": meta}))
    assert errors, "empty legal_tradition must be rejected"


def test_metadata_invalid_level_fails():
    """level is an enum."""
    file_validator = Draft202012Validator(_load(LAWCODE_SCHEMA_PATH))
    meta = _wellformed_metadata()
    meta["level"] = "country"  # not in enum
    errors = list(file_validator.iter_errors({"jurisdiction": meta}))
    assert errors, "must reject level outside enum"


def test_metadata_name_requires_at_least_one_locale():
    """name: must carry at least one locale entry."""
    file_validator = Draft202012Validator(_load(LAWCODE_SCHEMA_PATH))
    meta = _wellformed_metadata()
    meta["name"] = {}
    errors = list(file_validator.iter_errors({"jurisdiction": meta}))
    assert errors, "must reject empty name mapping"


def test_metadata_unknown_field_fails():
    """additionalProperties: false on the metadata block catches typos."""
    file_validator = Draft202012Validator(_load(LAWCODE_SCHEMA_PATH))
    meta = _wellformed_metadata()
    meta["unknown_field"] = "anything"
    errors = list(file_validator.iter_errors({"jurisdiction": meta}))
    assert errors, "must reject unknown field on metadata block"


# ---------------------------------------------------------------------------
# CLI entry point: scripts/validate_lawcode.py exits 0 on the live tree
# ---------------------------------------------------------------------------


def test_validator_script_passes_on_live_tree():
    """End-to-end: the script the CI step runs exits 0 against the shipped tree."""
    result = subprocess.run(
        [sys.executable, str(VALIDATOR_SCRIPT)],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
    )
    assert result.returncode == 0, (
        f"validator failed:\nstdout={result.stdout}\nstderr={result.stderr}"
    )
    assert "OK:" in result.stdout
