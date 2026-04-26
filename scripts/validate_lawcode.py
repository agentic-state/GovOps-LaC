"""Phase 5 schema gate.

Validates every YAML file under ``lawcode/`` against:
  1. ``schema/lawcode-v1.0.json`` — file shape (defaults + values list)
  2. ``schema/configvalue-v1.0.json`` — each merged record (defaults + per-value overrides)

Exits non-zero on the first violation. Wired into CI as a separate job;
also runnable locally as ``python scripts/validate_lawcode.py``.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft202012Validator


REPO_ROOT = Path(__file__).resolve().parent.parent
LAWCODE_DIR = REPO_ROOT / "lawcode"
SCHEMA_DIR = REPO_ROOT / "schema"
LAWCODE_SCHEMA = SCHEMA_DIR / "lawcode-v1.0.json"
CONFIGVALUE_SCHEMA = SCHEMA_DIR / "configvalue-v1.0.json"


def _load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _format_error(path: Path, error: Any) -> str:
    location = "/".join(str(p) for p in error.absolute_path) or "<root>"
    return f"{path.relative_to(REPO_ROOT)}: {location}: {error.message}"


def validate_file(
    path: Path,
    file_validator: Draft202012Validator,
    record_validator: Draft202012Validator,
) -> list[str]:
    """Validate a single YAML file. Returns a list of error strings (empty = valid)."""
    with path.open("r", encoding="utf-8") as fh:
        doc = yaml.safe_load(fh)
    if doc is None:
        return [f"{path.relative_to(REPO_ROOT)}: empty document"]

    errors: list[str] = []

    for err in file_validator.iter_errors(doc):
        errors.append(_format_error(path, err))
    if errors:
        return errors

    defaults = doc.get("defaults") or {}
    for idx, raw in enumerate(doc.get("values") or []):
        merged = {**defaults, **raw}
        for err in record_validator.iter_errors(merged):
            location = "/".join(str(p) for p in err.absolute_path) or "<root>"
            errors.append(
                f"{path.relative_to(REPO_ROOT)}: values[{idx}] (key={raw.get('key', '?')}): "
                f"{location}: {err.message}"
            )

    return errors


def main() -> int:
    if not LAWCODE_SCHEMA.exists() or not CONFIGVALUE_SCHEMA.exists():
        print(f"FAIL: schema files missing under {SCHEMA_DIR}", file=sys.stderr)
        return 2

    file_validator = Draft202012Validator(_load_json(LAWCODE_SCHEMA))
    record_validator = Draft202012Validator(_load_json(CONFIGVALUE_SCHEMA))

    yaml_files = sorted(LAWCODE_DIR.rglob("*.yaml")) + sorted(LAWCODE_DIR.rglob("*.yml"))
    if not yaml_files:
        print(f"FAIL: no YAML files under {LAWCODE_DIR}", file=sys.stderr)
        return 2

    total_errors = 0
    for path in yaml_files:
        errors = validate_file(path, file_validator, record_validator)
        if errors:
            for line in errors:
                print(f"  {line}", file=sys.stderr)
            total_errors += len(errors)

    if total_errors:
        print(f"\nFAIL: {total_errors} schema violation(s) across {len(yaml_files)} file(s)", file=sys.stderr)
        return 1

    print(f"OK: {len(yaml_files)} lawcode YAML file(s) validate against schema v1.0")
    return 0


if __name__ == "__main__":
    sys.exit(main())
