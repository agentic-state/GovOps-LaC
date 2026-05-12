"""Federation demo seed (LO-006).

When ``GOVOPS_SEED_FEDERATION_DEMO=1`` is set at startup, write a
synthetic publisher into ``$GOVOPS_LAWCODE_DIR/REGISTRY.yaml`` and a
stub imported pack into ``$GOVOPS_LAWCODE_DIR/.federated/`` so the
``/admin/federation`` UI is exercisable end-to-end without operator
input.

Gated behind an env var (analogous to ``GOVOPS_SEED_DEMO=1`` for the
approvals queue) so production deploys are unaffected. ``GOVOPS_LAWCODE_DIR``
must be set when the seed env var is set -- the seed writes into that
directory ONLY (never the on-repo ``lawcode/`` tree). Federation paths
in ``api.py`` already consult ``GOVOPS_LAWCODE_DIR`` first.

Idempotent: re-running the seed against an already-seeded directory
is a no-op (the stub publisher_id and pack dir are stable).
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

DEMO_PUBLISHER_ID = "demo-publisher-l8"
DEMO_PUBLISHER_NAME = "L8 Demo Publisher (E2E fixture)"
# Localhost port 1 is reserved -- a TCP connect attempt fails with
# ECONNREFUSED in well under a second, so the federation Re-fetch flow
# surfaces a fail-closed toast immediately. (Compare: example.invalid
# triggers a 30 s DNS timeout in urllib, which exceeds the test budget.)
DEMO_MANIFEST_URL = "http://127.0.0.1:1/demo-publisher/manifest.yaml"


def maybe_seed_federation_demo() -> None:
    """If ``GOVOPS_SEED_FEDERATION_DEMO=1`` is set, write the demo seed.

    No-op otherwise. Raises ``RuntimeError`` if the env var is set but
    ``GOVOPS_LAWCODE_DIR`` is not (we refuse to write into the on-repo
    lawcode/ tree by accident).
    """
    if os.environ.get("GOVOPS_SEED_FEDERATION_DEMO") != "1":
        return
    lawcode_dir_str = os.environ.get("GOVOPS_LAWCODE_DIR")
    if not lawcode_dir_str:
        raise RuntimeError(
            "GOVOPS_SEED_FEDERATION_DEMO=1 requires GOVOPS_LAWCODE_DIR to be set "
            "(refusing to write into the on-repo lawcode/ tree).",
        )
    lawcode_dir = Path(lawcode_dir_str)
    seed_federation_demo(lawcode_dir)


def seed_federation_demo(lawcode_dir: Path) -> None:
    """Write the demo seed into ``lawcode_dir``. Idempotent."""
    lawcode_dir.mkdir(parents=True, exist_ok=True)
    (lawcode_dir / "global").mkdir(exist_ok=True)
    federated_dir = lawcode_dir / ".federated"
    federated_dir.mkdir(exist_ok=True)

    _write_registry(lawcode_dir / "REGISTRY.yaml")
    _write_imported_pack(federated_dir / DEMO_PUBLISHER_ID)


def _write_registry(path: Path) -> None:
    """Write a one-publisher REGISTRY.yaml; preserve any non-demo entries.

    The demo entry is REWRITTEN every call (so a manifest_url change in
    this module's constants takes effect on the next backend start --
    otherwise stale on-disk state from a previous run would mask the
    update). Any non-demo entries the operator added by hand are kept.
    """
    import yaml

    if path.exists():
        existing = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    else:
        existing = {}
    values = [
        v
        for v in (existing.get("values") or [])
        if not (isinstance(v, dict) and v.get("publisher_id") == DEMO_PUBLISHER_ID)
    ]
    values.append(
        {
            "publisher_id": DEMO_PUBLISHER_ID,
            "name": DEMO_PUBLISHER_NAME,
            "manifest_url": DEMO_MANIFEST_URL,
            "notes": "E2E fixture -- not a real publisher (LO-006).",
        },
    )
    doc = {"values": values}
    path.write_text(yaml.safe_dump(doc, sort_keys=False), encoding="utf-8")


def _write_imported_pack(pack_dir: Path) -> None:
    """Drop a synthetic provenance.json into ``pack_dir`` so it lists."""
    pack_dir.mkdir(exist_ok=True)
    prov_path = pack_dir / ".provenance.json"
    if prov_path.exists():
        return
    provenance = {
        "publisher_id": DEMO_PUBLISHER_ID,
        "publisher_name": DEMO_PUBLISHER_NAME,
        "manifest_url": DEMO_MANIFEST_URL,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "manifest_sha256": "0" * 64,
        "signed": False,
        "files": [],
        "size_bytes": 0,
    }
    prov_path.write_text(json.dumps(provenance, indent=2), encoding="utf-8")
