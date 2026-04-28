"""Phase 5 schema gate (and Phase 6+ contributor tool).

Validates every YAML file under ``lawcode/`` against:
  1. ``schema/lawcode-v1.0.json`` — file shape (defaults + values list)
  2. ``schema/configvalue-v1.0.json`` — each merged record (defaults + per-value overrides)

Default behaviour: exits 0 on full success; non-zero on the first violation.
Wired into CI; runnable locally for editor-fast feedback.

Flags:
  --file <path>   Validate a single YAML file (relative to repo root, or absolute).
                  Useful when pre-flighting a single edit before push.
  --summary       On success, print a per-domain × per-jurisdiction record-count
                  table. Helps non-Python contributors see the substrate's shape.
  --quiet         Suppress the success message; still prints errors. CI default.

Errors surface per record, not per file — editors can fix multiple issues in
one pass. Each error includes the offending key plus a value preview.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
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


def _format_path(p: Path) -> str:
    """Render a path relative to repo root if possible, else absolute."""
    try:
        return str(p.relative_to(REPO_ROOT))
    except ValueError:
        return str(p)


def _format_value_preview(v: Any, limit: int = 60) -> str:
    """One-line preview of a value for the diagnostic context."""
    s = json.dumps(v, ensure_ascii=False, default=str) if not isinstance(v, str) else v
    s = s.replace("\n", " ")
    return s if len(s) <= limit else s[: limit - 1] + "…"


def _format_error(path: Path, error: Any) -> str:
    location = "/".join(str(p) for p in error.absolute_path) or "<root>"
    return f"{_format_path(path)}: {location}: {error.message}"


def _format_record_error(
    path: Path,
    idx: int,
    raw: dict[str, Any],
    error: Any,
) -> str:
    """Format a single record's validation error with editor-friendly context."""
    location = "/".join(str(p) for p in error.absolute_path) or "<root>"
    key = raw.get("key", "?")
    field = error.absolute_path[0] if error.absolute_path else None
    field_value = (
        raw.get(field) if isinstance(field, str) and field in raw else None
    )
    context = ""
    if field_value is not None:
        context = f" — got: {_format_value_preview(field_value)}"
    return (
        f"{_format_path(path)}: values[{idx}] (key={key}): "
        f"{location}: {error.message}{context}"
    )


def validate_file(
    path: Path,
    file_validator: Draft202012Validator,
    record_validator: Draft202012Validator,
) -> tuple[list[str], int]:
    """Validate a single YAML file.

    Returns (errors, record_count). On parse failure or shape failure, returns
    after surfacing the failure (no record loop). On record-level failures,
    surfaces ALL errors per record so editors fix multiple issues in one pass.
    """
    try:
        with path.open("r", encoding="utf-8") as fh:
            doc = yaml.safe_load(fh)
    except yaml.YAMLError as exc:
        return ([f"{_format_path(path)}: YAML parse failure: {exc}"], 0)

    if doc is None:
        return ([f"{_format_path(path)}: empty document"], 0)

    errors: list[str] = []

    for err in file_validator.iter_errors(doc):
        errors.append(_format_error(path, err))
    if errors:
        return (errors, 0)

    defaults = doc.get("defaults") or {}
    values = doc.get("values") or []
    for idx, raw in enumerate(values):
        if not isinstance(raw, dict):
            errors.append(
                f"{_format_path(path)}: values[{idx}]: entry must be a mapping, "
                f"got {type(raw).__name__}"
            )
            continue
        merged = {**defaults, **raw}
        for err in record_validator.iter_errors(merged):
            errors.append(_format_record_error(path, idx, raw, err))

    return (errors, len(values))


def _collect_records(yaml_files: list[Path]) -> list[dict[str, Any]]:
    """Re-read YAML files and return merged records for the summary view.

    Validation already passed by the time we call this; we just want to count.
    """
    out: list[dict[str, Any]] = []
    for fp in yaml_files:
        with fp.open("r", encoding="utf-8") as fh:
            doc = yaml.safe_load(fh) or {}
        defaults = doc.get("defaults") or {}
        for raw in doc.get("values") or []:
            if not isinstance(raw, dict):
                continue
            out.append({**defaults, **raw})
    return out


def _print_summary(records: list[dict[str, Any]]) -> None:
    """Emit a per-domain × per-jurisdiction count table after a successful run."""
    domain_counts: dict[str, int] = defaultdict(int)
    domain_jur: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for r in records:
        domain = r.get("domain", "(no-domain)")
        jur = r.get("jurisdiction_id") or "global"
        domain_counts[domain] += 1
        domain_jur[domain][jur] += 1

    total = sum(domain_counts.values())
    print()
    print(f"summary · {total} record(s) across {len(domain_counts)} domain(s)")
    print()
    print(f"  {'domain':<12} {'jurisdiction':<14} {'count':>6}")
    print(f"  {'-' * 12} {'-' * 14} {'-' * 6}")
    for domain in sorted(domain_counts):
        for jur in sorted(domain_jur[domain]):
            print(f"  {domain:<12} {jur:<14} {domain_jur[domain][jur]:>6}")
        print(f"  {domain:<12} {'(subtotal)':<14} {domain_counts[domain]:>6}")
        print()


def _resolve_files(arg_file: str | None) -> list[Path]:
    """Build the list of YAML files to validate."""
    if arg_file:
        path = Path(arg_file)
        if not path.is_absolute():
            path = (REPO_ROOT / arg_file).resolve()
        if not path.exists():
            raise FileNotFoundError(f"file not found: {path}")
        return [path]
    return sorted(LAWCODE_DIR.rglob("*.yaml")) + sorted(LAWCODE_DIR.rglob("*.yml"))


def _heartbeat(
    *,
    result: str,
    files: int,
    records: int,
    duration_ms: int,
    errors: int = 0,
) -> str:
    """Single-line, machine-parseable proof-of-execution.

    Logfmt-style; always emitted at the end (even in --quiet) so a CI run that
    silently dies reads differently from a CI run that silently succeeded.
    Minimum signal-to-noise for grep + dashboards.
    """
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    fields = [
        f"ts={ts}",
        f"tool=validate_lawcode",
        f"result={result}",
        f"files={files}",
        f"records={records}",
        f"errors={errors}",
        f"duration_ms={duration_ms}",
    ]
    return "[heartbeat] " + " ".join(fields)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate lawcode/ YAML against the published JSON Schemas.",
    )
    parser.add_argument(
        "--file",
        help="Validate a single YAML file (relative to repo root or absolute path).",
    )
    parser.add_argument(
        "--summary",
        action="store_true",
        help="On success, print a per-domain × per-jurisdiction record-count table.",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress the success message. Errors still print to stderr.",
    )
    args = parser.parse_args(argv)

    started = time.perf_counter()

    def emit_heartbeat(result: str, files: int, records: int, errors: int = 0) -> None:
        duration_ms = int((time.perf_counter() - started) * 1000)
        print(
            _heartbeat(
                result=result,
                files=files,
                records=records,
                duration_ms=duration_ms,
                errors=errors,
            )
        )

    if not LAWCODE_SCHEMA.exists() or not CONFIGVALUE_SCHEMA.exists():
        print(f"FAIL: schema files missing under {SCHEMA_DIR}", file=sys.stderr)
        emit_heartbeat("missing_schema", 0, 0, errors=1)
        return 2

    file_validator = Draft202012Validator(_load_json(LAWCODE_SCHEMA))
    record_validator = Draft202012Validator(_load_json(CONFIGVALUE_SCHEMA))

    try:
        yaml_files = _resolve_files(args.file)
    except FileNotFoundError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        emit_heartbeat("file_not_found", 0, 0, errors=1)
        return 2

    if not yaml_files:
        target = args.file or str(LAWCODE_DIR)
        print(f"FAIL: no YAML files under {target}", file=sys.stderr)
        emit_heartbeat("no_files", 0, 0, errors=1)
        return 2

    total_errors = 0
    total_records = 0
    for path in yaml_files:
        errors, count = validate_file(path, file_validator, record_validator)
        total_records += count
        if errors:
            for line in errors:
                print(f"  {line}", file=sys.stderr)
            total_errors += len(errors)

    if total_errors:
        print(
            f"\nFAIL: {total_errors} schema violation(s) across "
            f"{len(yaml_files)} file(s)",
            file=sys.stderr,
        )
        emit_heartbeat("fail", len(yaml_files), total_records, errors=total_errors)
        return 1

    if not args.quiet:
        print(
            f"OK: {len(yaml_files)} lawcode YAML file(s) "
            f"validate against schema v1.0 ({total_records} records)"
        )

    if args.summary:
        _print_summary(_collect_records(yaml_files))

    emit_heartbeat("ok", len(yaml_files), total_records)
    return 0


if __name__ == "__main__":
    sys.exit(main())
