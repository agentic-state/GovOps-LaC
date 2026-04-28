"""Phase-6+ contract gate: detect OpenAPI drift between live FastAPI and the snapshot.

Risk register §9 row 2 (PLAN.md): "Lovable contract drifts from backend
OpenAPI" — mitigation was specified as "CI diff gate on openapi.json
after Phase 6". This script implements that gate.

Compares the freshly-generated OpenAPI document for the running app
against the committed snapshot at ``docs/api/openapi-v0.3.0-draft.json``.
Exits non-zero if they differ; prints the first divergence path so the
fix is obvious.

Local rebase command when drift is real:

    python -c "import json; from govops.api import app; \
        json.dump(app.openapi(), open('docs/api/openapi-v0.3.0-draft.json','w'), \
        indent=2, ensure_ascii=False, sort_keys=False)"

This script is wired into CI (.github/workflows/ci.yml) so the snapshot
is enforced as part of the test gate. It is intentionally strict — any
drift, even a description tweak, breaks the build. Lovable consumes the
snapshot; silent description changes still count.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT_PATH = REPO_ROOT / "docs" / "api" / "openapi-v0.3.0-draft.json"


def _diff_path(a, b, path: str = "") -> str | None:
    """Return the first divergent path, or None if a == b.

    Walks dicts and lists in lockstep. The path is dot-separated for
    dicts and bracketed for list indices, so the message is greppable.
    """
    if type(a) is not type(b):
        return f"{path or '<root>'}: type mismatch ({type(a).__name__} vs {type(b).__name__})"
    if isinstance(a, dict):
        keys_a, keys_b = set(a), set(b)
        only_a = keys_a - keys_b
        only_b = keys_b - keys_a
        if only_a:
            return f"{path}: keys only in live: {sorted(only_a)[:5]}"
        if only_b:
            return f"{path}: keys only in snapshot: {sorted(only_b)[:5]}"
        for k in sorted(keys_a):
            sub = _diff_path(a[k], b[k], f"{path}.{k}" if path else k)
            if sub:
                return sub
        return None
    if isinstance(a, list):
        if len(a) != len(b):
            return f"{path}: list length {len(a)} vs {len(b)}"
        for i, (x, y) in enumerate(zip(a, b)):
            sub = _diff_path(x, y, f"{path}[{i}]")
            if sub:
                return sub
        return None
    if a != b:
        preview_a = repr(a)[:80]
        preview_b = repr(b)[:80]
        return f"{path}: {preview_a} != {preview_b}"
    return None


def main() -> int:
    if not SNAPSHOT_PATH.exists():
        print(f"error: snapshot missing at {SNAPSHOT_PATH}", file=sys.stderr)
        return 2

    # Import after the path check so a missing snapshot doesn't trigger app import.
    from govops.api import app

    live = app.openapi()
    # The version is intentionally pinned in the snapshot; live spec uses
    # the FastAPI default ("0.1.0"). Normalize so the version field never
    # trips the diff — it is a regenerator-managed field, not a contract.
    live["info"]["version"] = "0.3.0-draft"

    snapshot = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))

    diff = _diff_path(live, snapshot)
    if diff:
        print(f"OpenAPI drift detected:\n  {diff}", file=sys.stderr)
        print(
            "\nRebase the snapshot if the drift is intentional:\n"
            '  python -c "import json; from govops.api import app; '
            "json.dump(app.openapi(), open('docs/api/openapi-v0.3.0-draft.json','w'), "
            'indent=2, ensure_ascii=False, sort_keys=False)"',
            file=sys.stderr,
        )
        return 1

    print(f"OK: live OpenAPI matches snapshot at {SNAPSHOT_PATH.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
