"""Tests for the locale-aware HTML rewriter that closes M02.

The HF-hosted demo serves a single `dist/client/index.html` produced at
build time with `<html lang="en">` and an EN root title. These tests pin
the contract that the SPA fallback rewrites those head pieces based on
each request's `govops-locale` cookie -- the runtime substitute for
per-request SSR.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from govops.spa import mount_spa
from govops.spa_locale import (
    _normalize_locale,
    _title_key_for_path,
    localized_title_for,
    parse_locale_cookie,
    rewrite_html_for_locale,
)


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------


class TestParseLocaleCookie:
    def test_returns_none_for_missing_header(self):
        assert parse_locale_cookie(None) is None
        assert parse_locale_cookie("") is None

    def test_returns_none_when_other_cookies_present(self):
        assert parse_locale_cookie("session=abc; theme=dark") is None

    def test_extracts_locale_value(self):
        assert parse_locale_cookie("govops-locale=fr") == "fr"

    def test_extracts_amid_other_cookies(self):
        assert (
            parse_locale_cookie("session=abc; govops-locale=es-MX; theme=dark")
            == "es-MX"
        )

    def test_strips_whitespace(self):
        assert parse_locale_cookie("  govops-locale=de  ") == "de"


class TestNormalizeLocale:
    def test_returns_en_for_empty(self):
        assert _normalize_locale(None) == "en"
        assert _normalize_locale("") == "en"

    def test_passes_through_supported(self):
        assert _normalize_locale("fr") == "fr"
        assert _normalize_locale("es-MX") == "es-MX"
        assert _normalize_locale("uk") == "uk"

    def test_picks_first_from_accept_language_list(self):
        # Browser Accept-Language: "fr-CA,fr;q=0.9,en;q=0.8"
        assert _normalize_locale("fr-CA,fr;q=0.9,en;q=0.8") == "fr"

    def test_two_letter_es_maps_to_es_mx(self):
        assert _normalize_locale("es") == "es-MX"
        assert _normalize_locale("es-AR") == "es-MX"

    def test_two_letter_pt_maps_to_pt_br(self):
        assert _normalize_locale("pt") == "pt-BR"
        assert _normalize_locale("pt-PT") == "pt-BR"

    def test_unknown_falls_back_to_en(self):
        assert _normalize_locale("zh-CN") == "en"
        assert _normalize_locale("xx") == "en"


class TestTitleKeyForPath:
    def test_about_route(self):
        assert _title_key_for_path("/about") == "about.title"

    def test_check_route(self):
        assert _title_key_for_path("/check") == "check.heading"

    def test_check_life_event_route(self):
        assert _title_key_for_path("/check/life-event") == "check.lifeEvent.heading"

    def test_compare_program_route_matches_prefix(self):
        # /compare/oas, /compare/ei -- both share the same title key
        assert _title_key_for_path("/compare/oas") == "compare.heading"
        assert _title_key_for_path("/compare/ei") == "compare.heading"

    def test_admin_federation_route(self):
        assert _title_key_for_path("/admin/federation") == "admin.federation.heading"

    def test_trailing_slash_stripped(self):
        assert _title_key_for_path("/about/") == "about.title"

    def test_root_returns_none(self):
        # Root falls back to the static __root.tsx title; no key lookup.
        assert _title_key_for_path("/") is None
        assert _title_key_for_path("") is None

    def test_unknown_route_returns_none(self):
        assert _title_key_for_path("/walkthrough") is None
        assert _title_key_for_path("/cases/abc-123") is None


# ---------------------------------------------------------------------------
# Composite: localized_title_for
# ---------------------------------------------------------------------------


def _fake_catalogs() -> dict[str, dict[str, str]]:
    return {
        "en": {
            "about.title": "About GovOps",
            "check.heading": "What am I entitled to?",
            "compare.heading": "Compare jurisdictions",
        },
        "fr": {
            "about.title": "À propos de GovOps",
            "check.heading": "À quoi ai-je droit ?",
        },
        "de": {
            "about.title": "Über GovOps",
        },
    }


class TestLocalizedTitleFor:
    def test_returns_locale_specific_title_when_present(self):
        title = localized_title_for("/about", "fr", _fake_catalogs())
        assert title == "À propos de GovOps"

    def test_falls_back_to_en_when_locale_missing_key(self):
        # /compare/ei isn't in the FR fake catalog -- falls through to EN
        title = localized_title_for("/compare/ei", "fr", _fake_catalogs())
        assert title == "Compare jurisdictions"

    def test_root_path_returns_root_title_for_locale(self):
        title = localized_title_for("/", "fr", _fake_catalogs())
        assert "GovOps" in title
        # Root titles are hardcoded per-locale, not key-driven
        assert title != "About GovOps"

    def test_root_path_root_title_for_en(self):
        title = localized_title_for("/", "en", _fake_catalogs())
        assert "GovOps" in title
        assert "Law as code" in title


# ---------------------------------------------------------------------------
# rewrite_html_for_locale
# ---------------------------------------------------------------------------


_PRERENDERED_SHELL = (
    '<!doctype html><html lang="en" dir="ltr"><head>'
    "<title>GovOps — Law as code, with provenance you can read</title>"
    "</head><body>...</body></html>"
)


class TestRewriteHtmlForLocale:
    def test_swaps_html_lang(self):
        out = rewrite_html_for_locale(_PRERENDERED_SHELL, "/about", "fr", _fake_catalogs())
        assert 'lang="fr"' in out
        assert 'lang="en"' not in out

    def test_swaps_title_to_localized_value(self):
        out = rewrite_html_for_locale(_PRERENDERED_SHELL, "/about", "fr", _fake_catalogs())
        assert "<title>À propos de GovOps</title>" in out
        assert "Law as code" not in out

    def test_en_request_keeps_root_en_title_for_unknown_route(self):
        # /walkthrough has no title key -- falls back to the root title in EN
        out = rewrite_html_for_locale(_PRERENDERED_SHELL, "/walkthrough", "en", _fake_catalogs())
        assert "Law as code" in out
        assert 'lang="en"' in out

    def test_root_path_localizes_the_root_title(self):
        out = rewrite_html_for_locale(_PRERENDERED_SHELL, "/", "fr", _fake_catalogs())
        assert 'lang="fr"' in out
        # FR root title from the hardcoded map
        assert "droit comme code" in out

    def test_idempotent_on_already_localized_html(self):
        once = rewrite_html_for_locale(_PRERENDERED_SHELL, "/about", "fr", _fake_catalogs())
        twice = rewrite_html_for_locale(once, "/about", "fr", _fake_catalogs())
        assert once == twice


# ---------------------------------------------------------------------------
# End-to-end: TestClient hitting the SPA fallback
# ---------------------------------------------------------------------------


@pytest.fixture
def spa_dist(tmp_path: Path) -> Path:
    """Build a minimal `dist/client/` so mount_spa attaches the fallback."""
    dist = tmp_path / "dist" / "client"
    dist.mkdir(parents=True)
    # Mirror the real prerender's <head> shape so the regex swaps target
    # the exact same string forms we see in production.
    (dist / "index.html").write_text(
        '<!doctype html><html lang="en" dir="ltr"><head>'
        "<title>GovOps — Law as code, with provenance you can read</title>"
        "</head><body><div id=\"root\"></div></body></html>",
        encoding="utf-8",
    )
    return dist


def test_spa_fallback_serves_default_en_when_no_cookie(spa_dist):
    app = FastAPI()
    assert mount_spa(app, dist_path=str(spa_dist)) is True
    client = TestClient(app)
    r = client.get("/about")
    assert r.status_code == 200
    assert 'lang="en"' in r.text
    # The middleware looks up /about's title key (`about.title`) and
    # localizes -- the prerender's root title is replaced even in EN
    # because the route has its own head().
    assert "About GovOps" in r.text


def test_spa_fallback_root_path_keeps_root_title_for_en(spa_dist):
    app = FastAPI()
    assert mount_spa(app, dist_path=str(spa_dist)) is True
    client = TestClient(app)
    r = client.get("/")
    assert r.status_code == 200
    assert 'lang="en"' in r.text
    # Root path falls through to the root title (no per-route key).
    assert "Law as code" in r.text


def test_spa_fallback_localizes_lang_and_title_for_fr_cookie(spa_dist):
    app = FastAPI()
    assert mount_spa(app, dist_path=str(spa_dist)) is True
    client = TestClient(app)
    r = client.get("/about", cookies={"govops-locale": "fr"})
    assert r.status_code == 200
    assert 'lang="fr"' in r.text
    # The exact FR title is in the production fr.json -- this assertion
    # mirrors the bench M02 assertion.
    assert "propos" in r.text.lower(), r.text[:500]


def test_spa_fallback_honors_accept_language_when_no_cookie(spa_dist):
    app = FastAPI()
    assert mount_spa(app, dist_path=str(spa_dist)) is True
    client = TestClient(app)
    r = client.get("/about", headers={"accept-language": "fr-CA,fr;q=0.9,en;q=0.8"})
    assert r.status_code == 200
    assert 'lang="fr"' in r.text


def test_spa_fallback_cookie_takes_precedence_over_accept_language(spa_dist):
    app = FastAPI()
    assert mount_spa(app, dist_path=str(spa_dist)) is True
    client = TestClient(app)
    r = client.get(
        "/about",
        cookies={"govops-locale": "de"},
        headers={"accept-language": "fr"},
    )
    assert r.status_code == 200
    assert 'lang="de"' in r.text


def test_spa_fallback_falls_back_to_en_for_unsupported_cookie(spa_dist):
    app = FastAPI()
    assert mount_spa(app, dist_path=str(spa_dist)) is True
    client = TestClient(app)
    r = client.get("/about", cookies={"govops-locale": "xx"})
    assert r.status_code == 200
    assert 'lang="en"' in r.text


def test_spa_fallback_does_not_rewrite_static_files(spa_dist):
    # Drop a non-HTML asset in dist root; it must be served as-is, not
    # treated as the SPA shell.
    (spa_dist / "robots.txt").write_text("User-agent: *\nDisallow:\n", encoding="utf-8")
    app = FastAPI()
    assert mount_spa(app, dist_path=str(spa_dist)) is True
    client = TestClient(app)
    r = client.get("/robots.txt", cookies={"govops-locale": "fr"})
    assert r.status_code == 200
    # No HTML rewriting on a plain-text asset.
    assert "User-agent" in r.text
    assert "<html" not in r.text
