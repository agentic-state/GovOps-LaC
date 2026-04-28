"""CLI entry points for GovOps.

Two console scripts are exposed:

* ``govops-demo``     — runs the demo server (legacy entry, preserved verbatim).
* ``govops``          — multi-command dispatcher (``govops demo``, ``govops impact-of``).

The ``demo`` subcommand is identical in behaviour to ``govops-demo``.
"""

from __future__ import annotations

import argparse
import os
import sys


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_DEMO_BANNER = (
    "  GovOps - Policy-Driven Service Delivery Machine\n"
    "  Pension Eligibility Case Study Demo"
)


def _add_demo_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Bind port (default: 8000)")
    parser.add_argument(
        "--reload", action="store_true", help="Enable auto-reload for development"
    )


def _run_demo(host: str, port: int, reload: bool) -> int:
    try:
        import uvicorn
    except ImportError:
        print("Error: uvicorn is required. Install with: pip install govops", file=sys.stderr)
        return 1

    print()
    print(_DEMO_BANNER)
    print()
    print(f"  Open http://{host}:{port} in your browser")
    print()
    print(f"  API docs:        http://{host}:{port}/docs")
    print(f"  Authority chain: http://{host}:{port}/authority")
    print()

    uvicorn.run(
        "govops.api:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info",
    )
    return 0


def _run_impact(citation: str, db_path: str | None, json_out: bool) -> int:
    """Phase 7 CLI: print every ConfigValue referencing ``citation``.

    The store hydrates from ``db_path`` if provided (or ``GOVOPS_DB_PATH``),
    otherwise an ephemeral in-memory store is hydrated from ``lawcode/`` so
    a freshly-cloned repo prints meaningful results without setup.
    """
    from pathlib import Path

    from govops.config import ConfigStore

    resolved_db = db_path or os.environ.get("GOVOPS_DB_PATH")
    store = ConfigStore(db_path=resolved_db)

    if resolved_db is None:
        lawcode = Path(__file__).resolve().parent.parent.parent / "lawcode"
        if lawcode.is_dir():
            store.load_from_yaml(lawcode)

    rows = store.find_by_citation(citation)

    if json_out:
        import json

        payload = [
            {
                "id": r.id,
                "key": r.key,
                "jurisdiction_id": r.jurisdiction_id,
                "value": r.value,
                "value_type": r.value_type,
                "effective_from": r.effective_from.isoformat() if r.effective_from else None,
                "effective_to": r.effective_to.isoformat() if r.effective_to else None,
                "citation": r.citation,
                "status": r.status,
            }
            for r in rows
        ]
        print(json.dumps({"query": citation, "total": len(rows), "results": payload}, indent=2))
        return 0

    if not rows:
        print(f"No ConfigValues reference «{citation}».")
        return 0

    print(f"  {len(rows)} record(s) referencing «{citation}»")
    print()
    current_scope: object = object()
    for r in rows:
        scope = r.jurisdiction_id or "global"
        if scope != current_scope:
            print(f"  [{scope}]")
            current_scope = scope
        date = r.effective_from.date().isoformat() if r.effective_from else "?"
        print(f"    {date}  {r.key}  →  {r.value!r}")
        print(f"               citation: {r.citation}")
    print()
    return 0


# ---------------------------------------------------------------------------
# Entry points
# ---------------------------------------------------------------------------

def main():
    """Legacy ``govops-demo`` entry: starts the demo server."""
    parser = argparse.ArgumentParser(
        description="GovOps - Policy-Driven Service Delivery Machine",
    )
    _add_demo_args(parser)
    args = parser.parse_args()
    raise SystemExit(_run_demo(args.host, args.port, args.reload))


def dispatch(argv: list[str] | None = None) -> int:
    """``govops`` entry: multi-command dispatcher."""
    parser = argparse.ArgumentParser(
        prog="govops",
        description="GovOps - Policy-Driven Service Delivery Machine",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    demo_p = sub.add_parser("demo", help="Run the demo server")
    _add_demo_args(demo_p)

    impact_p = sub.add_parser(
        "impact-of",
        help="Find ConfigValues referencing a statutory citation",
    )
    impact_p.add_argument("citation", help="Citation substring (case-insensitive)")
    impact_p.add_argument(
        "--db",
        default=None,
        help="SQLite path; defaults to GOVOPS_DB_PATH or an ephemeral hydrated from lawcode/",
    )
    impact_p.add_argument(
        "--json",
        action="store_true",
        dest="json_out",
        help="Emit JSON instead of human-readable output",
    )

    fetch_p = sub.add_parser(
        "fetch",
        help="Fetch a federated lawcode pack (Phase 8 / ADR-009)",
    )
    fetch_p.add_argument("publisher_id", help="Publisher id from lawcode/REGISTRY.yaml")
    fetch_p.add_argument(
        "--registry",
        default=None,
        help="Override path to REGISTRY.yaml (default: lawcode/REGISTRY.yaml)",
    )
    fetch_p.add_argument(
        "--trusted-keys",
        default=None,
        help="Override path to trusted_keys.yaml (default: lawcode/global/trusted_keys.yaml)",
    )
    fetch_p.add_argument(
        "--target-dir",
        default=None,
        help="Where to write the pack (default: lawcode/.federated)",
    )
    fetch_p.add_argument(
        "--allow-unsigned",
        action="store_true",
        help="Accept unsigned manifests; records will be stamped source_signed=False",
    )
    fetch_p.add_argument(
        "--dry-run",
        action="store_true",
        help="Verify the fetch would succeed; do not write any files",
    )

    args = parser.parse_args(argv)
    if args.command == "demo":
        return _run_demo(args.host, args.port, args.reload)
    if args.command == "impact-of":
        return _run_impact(args.citation, args.db, args.json_out)
    if args.command == "fetch":
        return _run_fetch(
            publisher_id=args.publisher_id,
            registry_path=args.registry,
            trusted_keys_path=args.trusted_keys,
            target_dir=args.target_dir,
            allow_unsigned=args.allow_unsigned,
            dry_run=args.dry_run,
        )
    parser.error(f"unknown command: {args.command}")
    return 2


def _run_fetch(
    *,
    publisher_id: str,
    registry_path: str | None,
    trusted_keys_path: str | None,
    target_dir: str | None,
    allow_unsigned: bool,
    dry_run: bool,
) -> int:
    """Handler for ``govops fetch <publisher_id>``."""
    from pathlib import Path

    import yaml

    from govops.federation import (
        FederationError,
        fetch_pack,
        http_file_loader,
        http_manifest_loader,
    )

    repo_root = Path(__file__).resolve().parent.parent.parent
    reg_path = Path(registry_path) if registry_path else repo_root / "lawcode" / "REGISTRY.yaml"
    keys_path = (
        Path(trusted_keys_path) if trusted_keys_path
        else repo_root / "lawcode" / "global" / "trusted_keys.yaml"
    )
    out_dir = Path(target_dir) if target_dir else repo_root / "lawcode" / ".federated"

    if not reg_path.exists():
        print(f"error: registry not found at {reg_path}", file=sys.stderr)
        return 2
    registry_doc = yaml.safe_load(reg_path.read_text(encoding="utf-8")) or {}
    registry = {
        e["publisher_id"]: e
        for e in registry_doc.get("values", [])
        if isinstance(e, dict) and "publisher_id" in e
    }

    trusted_keys: dict[str, str] = {}
    if keys_path.exists():
        keys_doc = yaml.safe_load(keys_path.read_text(encoding="utf-8")) or {}
        defaults = keys_doc.get("defaults") or {}
        for entry in keys_doc.get("values", []) or []:
            merged = {**defaults, **entry}
            key_field = merged.get("key", "")
            value = merged.get("value") or {}
            # Trust key shape: global.federation.trusted_key.<publisher_id>
            if key_field.startswith("global.federation.trusted_key."):
                pid = key_field.rsplit(".", 1)[-1]
                pk = value.get("public_key_b64") if isinstance(value, dict) else None
                if pk:
                    trusted_keys[pid] = pk

    try:
        result = fetch_pack(
            publisher_id,
            registry=registry,
            trusted_keys=trusted_keys,
            manifest_loader=http_manifest_loader,
            file_loader=http_file_loader,
            target_dir=out_dir,
            allow_unsigned=allow_unsigned,
            dry_run=dry_run,
        )
    except FederationError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print()
    print(f"  Fetched: {result.publisher_id} / {result.pack_name} v{result.version}")
    print(f"  Signed:  {result.signed}")
    print(f"  Files:   {len(result.files_written)}")
    if dry_run:
        print(f"  (dry-run; no files written)")
    else:
        for f in result.files_written:
            print(f"    {f}")
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(dispatch())
