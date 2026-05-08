"""Phase I cutover guarantees (v0.5.0 release).

Pins the contracts that landed at the v3 cutover so any future regression
shows up as a failing test, not as a silent slip.
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# OASEngine alias removal
# ---------------------------------------------------------------------------


class TestOASEngineAliasRemoved:
    """ADR-016 §"Deprecation" scheduled removal at the Phase I cutover."""

    def test_oasengine_not_exported_from_engine(self):
        from govops import engine as engine_mod
        assert not hasattr(engine_mod, "OASEngine"), (
            "OASEngine alias was removed at Phase I cutover. Re-introducing "
            "it requires a new ADR."
        )

    def test_engine_module_does_not_emit_deprecation_warnings(self):
        """Pre-Phase-I, importing engine.py emitted DeprecationWarning lines
        on every legacy caller. Post-Phase-I, the alias is gone — no
        warning chatter on a fresh import."""
        import importlib
        import warnings as w

        from govops import engine as engine_mod

        with w.catch_warnings(record=True) as caught:
            w.simplefilter("always")
            importlib.reload(engine_mod)
        oas_warnings = [
            x for x in caught if "OASEngine" in str(x.message)
        ]
        assert oas_warnings == [], (
            f"Expected zero OASEngine warnings; got: "
            f"{[str(w.message) for w in oas_warnings]}"
        )


# ---------------------------------------------------------------------------
# Demo seed extension — EI cases × 6 jurisdictions
# ---------------------------------------------------------------------------


@pytest.fixture
def demo_seed_client(monkeypatch):
    """Spin up a TestClient with GOVOPS_SEED_DEMO=1 so the lifespan + the
    jurisdiction-seed path register the EI demo cases alongside OAS.

    Avoids `importlib.reload(api_mod)` — that swaps the module-level
    `store` / `encoding_store` for fresh instances and leaves other
    test modules holding stale `from govops.api import store` bindings.
    Instead, we set the env var via monkeypatch (auto-reverted) and
    re-trigger the seed path on the existing module-level `store`,
    so subsequent tests see consistent module state.
    """
    monkeypatch.setenv("GOVOPS_SEED_DEMO", "1")
    from govops import api as api_mod

    api_mod._seed_jurisdiction(api_mod.DEFAULT_JURISDICTION)
    with TestClient(api_mod.app) as c:
        yield c, api_mod
    # Restore the default-seed shape (no EI cases) for whatever runs next.
    api_mod._seed_jurisdiction(api_mod.DEFAULT_JURISDICTION)


class TestDemoSeedIncludesEi:
    """PLAN-v3 §Phase I: when GOVOPS_SEED_DEMO=1, the case list shows
    OAS + EI cases for every jurisdiction that has both manifests."""

    def test_ca_demo_seed_lists_oas_and_ei_cases(self, demo_seed_client):
        client, _ = demo_seed_client
        r = client.get("/api/cases")
        ids = {c["id"] for c in r.json()["cases"]}
        # OAS cases (seed.py)
        assert "demo-case-001" in ids
        # EI cases (lawcode/ca/programs/ei.yaml)
        assert "demo-ca-ei-001" in ids
        assert "demo-ca-ei-004" in ids

    @pytest.mark.parametrize("jur", ["br", "es", "fr", "de", "ua"])
    def test_other_active_jurisdictions_seed_their_ei_cases(
        self, demo_seed_client, jur
    ):
        client, _ = demo_seed_client
        client.post(f"/api/jurisdiction/{jur}")
        r = client.get("/api/cases")
        ids = {c["id"] for c in r.json()["cases"]}
        assert any(
            cid.startswith(f"demo-{jur}-ei-") for cid in ids
        ), f"{jur}: expected demo-{jur}-ei-* cases in /api/cases"

    def test_jp_demo_seed_does_not_have_ei_cases(self, demo_seed_client):
        """JP is the architectural control — no EI manifest, so the demo
        seed has nothing to add for that program."""
        client, _ = demo_seed_client
        client.post("/api/jurisdiction/jp")
        r = client.get("/api/cases")
        ids = {c["id"] for c in r.json()["cases"]}
        assert not any(cid.startswith("demo-jp-ei-") for cid in ids)


class TestDemoSeedDefaultUnchanged:
    """When GOVOPS_SEED_DEMO is unset, behaviour is byte-identical to v2 —
    4 cases per jurisdiction, no EI cases. Pre-v3 tests rely on this."""

    def test_default_ca_has_four_cases(self, monkeypatch):
        monkeypatch.delenv("GOVOPS_SEED_DEMO", raising=False)
        from govops import api as api_mod

        api_mod._seed_jurisdiction(api_mod.DEFAULT_JURISDICTION)
        with TestClient(api_mod.app) as c:
            r = c.get("/api/cases")
            assert len(r.json()["cases"]) == 4
