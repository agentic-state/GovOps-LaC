"""v3.1 Lane 2b -- one-shot generator for missing OAS program manifests.

Today (v3.0):
  - Only ``lawcode/ca/programs/oas.yaml`` exists. The OAS data for the other
    6 jurisdictions (BR, ES, FR, DE, UA, JP) lives only in Python literals
    at ``src/govops/jurisdictions.py``.
  - JP has no ``programs/`` directory at all (no OAS, no EI manifest).

After this script (v3.1):
  - Every jurisdiction in ``JURISDICTION_REGISTRY`` has a corresponding
    ``lawcode/<code>/programs/oas.yaml`` manifest.
  - JP also gains ``programs/ei.yaml`` so the same code paths work for it.
  - The YAML carries authority chain, legal documents, rules (with
    param_key_prefix + ref-style parameters), and demo cases serialized
    from the running ``cases_factory()`` callables.
  - Once the diff harness in ``tests/test_jurisdiction_metadata.py`` is
    extended to assert pack-equivalence at the *program* layer too, ADR-020
    (Lane 3) can replace the Python literal with the lawcode loader.

Usage:
  python scripts/migration/generate_program_manifests.py [--dry-run] [--force]

Flags:
  --dry-run   Print the targets that would be written; touch nothing.
  --force     Overwrite existing manifests. Default refuses (so re-running
              never silently clobbers a hand-edited file).

The script emits block-style YAML (yaml.dump default). The schema is
style-agnostic; v3.2 may polish flow-style for `parameters: { ref: ... }`
refs but the v3.1 demo bar accepts the block style as-is.
"""

from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path
from typing import Any

import yaml


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
LAWCODE = REPO_ROOT / "lawcode"


def _date_to_str(d: Any) -> Any:
    """Pydantic ``date`` -> ISO 8601 string for YAML."""
    if isinstance(d, date):
        return d.isoformat()
    return d


def _serialize_authority(refs: list, jurisdiction_id: str) -> list[dict]:
    out = []
    for r in refs:
        item: dict[str, Any] = {
            "id": r.id,
            "layer": r.layer,
            "title": r.title,
            "citation": r.citation,
        }
        if r.effective_date:
            item["effective_date"] = _date_to_str(r.effective_date)
        if r.url:
            item["url"] = r.url
        if r.parent_id:
            item["parent"] = r.parent_id
        out.append(item)
    return out


def _serialize_legal_documents(docs: list) -> list[dict]:
    out = []
    for d in docs:
        item: dict[str, Any] = {
            "id": d.id,
            "type": d.document_type.value,
            "title": d.title,
            "citation": d.citation,
        }
        if d.effective_date:
            item["effective_date"] = _date_to_str(d.effective_date)
        if d.sections:
            item["sections"] = [
                {
                    "id": s.id,
                    "ref": s.section_ref,
                    "heading": s.heading,
                    "text": s.text,
                }
                for s in d.sections
            ]
        out.append(item)
    return out


def _serialize_rules(rules: list) -> list[dict]:
    out = []
    for r in rules:
        item: dict[str, Any] = {
            "id": r.id,
            "rule_type": r.rule_type.value,
            "description": r.description,
            "formal_expression": r.formal_expression,
            "citation": r.citation,
            "source_document_id": r.source_document_id,
            "source_section_ref": r.source_section_ref,
        }
        if r.param_key_prefix:
            item["param_key_prefix"] = r.param_key_prefix
            # When a rule has a param_key_prefix, its parameters dict is the
            # set of resolved values from `<prefix>.<param_name>` substrate
            # keys. Reverse the mapping by emitting `{ref: <prefix>.<name>}`
            # back into the manifest so load_program_manifest re-resolves
            # them at load time.
            item["parameters"] = {
                name: {"ref": f"{r.param_key_prefix}.{name}"}
                for name in r.parameters.keys()
            }
        elif r.parameters:
            # Inline parameters with no prefix -- emit literally.
            item["parameters"] = dict(r.parameters)
        out.append(item)
    return out


def _serialize_demo_cases(cases: list) -> list[dict]:
    out = []
    for c in cases:
        applicant = {
            "id": c.applicant.id,
            "date_of_birth": _date_to_str(c.applicant.date_of_birth),
            "legal_name": c.applicant.legal_name,
            "legal_status": c.applicant.legal_status,
            "country_of_birth": c.applicant.country_of_birth,
        }
        residency = []
        for p in c.residency_periods:
            row: dict[str, Any] = {
                "country": p.country,
                "start_date": _date_to_str(p.start_date),
            }
            if p.end_date:
                row["end_date"] = _date_to_str(p.end_date)
            if p.verified:
                row["verified"] = True
            if p.evidence_ids:
                row["evidence_ids"] = list(p.evidence_ids)
            residency.append(row)
        evidence = []
        for e in c.evidence_items:
            row = {
                "id": e.id,
                "type": e.evidence_type,
                "description": e.description,
                "provided": e.provided,
            }
            if e.verified:
                row["verified"] = True
            if e.source_reference:
                row["source_reference"] = e.source_reference
            evidence.append(row)
        item: dict[str, Any] = {
            "id": c.id,
            "applicant": applicant,
            "residency_periods": residency,
            "evidence_items": evidence,
        }
        out.append(item)
    return out


# ---------------------------------------------------------------------------
# Per-program shape mapping (used when a jurisdiction's pack carries no
# program_id explicitly -- the running v3.0 model has only one program per
# pack, OAS, with shape `old_age_pension`).
# ---------------------------------------------------------------------------


SHAPE_FOR_PROGRAM = {
    "oas": "old_age_pension",
    "ei": "unemployment_insurance",
}


def _serialize_program_manifest(
    program_id: str,
    pack: Any,
    cases: list,
) -> dict[str, Any]:
    """Build the dict-shape that ``yaml.dump`` will emit for one program.

    The per-program manifest shape mirrors ``schema/program-manifest-v1.0.json``.
    """
    jurisdiction_id = pack.jurisdiction.id
    name_locale = pack.default_language or "en"
    return {
        "schema_version": "1.0",
        "program_id": program_id,
        "jurisdiction_id": jurisdiction_id,
        "shape": SHAPE_FOR_PROGRAM[program_id],
        "status": "active",
        "name": {name_locale: pack.program_name},
        "authority_chain": _serialize_authority(pack.authority_chain, jurisdiction_id),
        "legal_documents": _serialize_legal_documents(pack.legal_documents),
        "rules": _serialize_rules(pack.rules),
        "demo_cases": _serialize_demo_cases(cases),
    }


# ---------------------------------------------------------------------------
# YAML emission
# ---------------------------------------------------------------------------


def _yaml_header(jur_code: str, program_id: str) -> str:
    return (
        f"# yaml-language-server: $schema=../../../schema/program-manifest-v1.0.json\n"
        f"#\n"
        f"# {jur_code.upper()} -- {program_id.upper()} program manifest "
        f"(v3.1 Lane 2b migration from src/govops/jurisdictions.py).\n"
        f"# Per ADR-014, structure (rules / authority / legal documents / demo\n"
        f"# cases) lives here. Parameter values live in the ConfigValue substrate\n"
        f"# (lawcode/{jur_code}/config/{program_id}-rules.yaml) and are referenced\n"
        f"# via {{ref: '<key>'}}. ADR-020 (lawcode-as-discovery) reads this file\n"
        f"# at startup to register the program with the running engine.\n"
        f"\n"
    )


def _dump_manifest(manifest: dict, target: Path, jur_code: str, program_id: str) -> None:
    body = yaml.dump(
        manifest,
        sort_keys=False,
        default_flow_style=False,
        allow_unicode=True,
        width=4096,
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(_yaml_header(jur_code, program_id) + body, encoding="utf-8")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def _which_to_generate(force: bool) -> list[tuple[str, str, Path]]:
    """Return a list of (jur_code, program_id, target_path) tuples."""
    from govops.jurisdictions import JURISDICTION_REGISTRY

    targets: list[tuple[str, str, Path]] = []
    for code, _pack in JURISDICTION_REGISTRY.items():
        oas = LAWCODE / code / "programs" / "oas.yaml"
        if force or not oas.exists():
            targets.append((code, "oas", oas))
        # JP intentionally does NOT get an EI manifest in v3.1. The v3 charter
        # excluded JP from the EI rollout as the architectural control proving
        # canonical-shape symmetry; tests/test_phase_d_ei_rollout.py gates that
        # posture. v3.1 retires the JURISDICTION_REGISTRY literal but does not
        # extend EI to JP -- that's its own scope decision (v3.2 or v4 charter)
        # and is out of band for v3.1's adoption story.
    return targets


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args(argv)

    sys.path.insert(0, str(REPO_ROOT / "src"))
    from govops.jurisdictions import JURISDICTION_REGISTRY

    targets = _which_to_generate(force=args.force)
    if not targets:
        print("Nothing to generate -- all manifests exist. Use --force to overwrite.")
        return 0

    print(f"Plan: {len(targets)} manifest(s) to emit:")
    for code, pid, path in targets:
        rel = path.relative_to(REPO_ROOT)
        print(f"  {code}/{pid:3s} -> {rel}")
    if args.dry_run:
        return 0

    from govops.cli_init import write_plain_language_doc

    for code, pid, target in targets:
        pack = JURISDICTION_REGISTRY[code]
        # The pack.cases_factory() returns the demo cases as-of-call. Call
        # once and freeze for serialization.
        cases = pack.cases_factory()
        manifest = _serialize_program_manifest(pid, pack, cases)
        _dump_manifest(manifest, target, code, pid)
        # Every program manifest needs a sibling plain-language `.md` per
        # the Phase H sidecar convention; tests/test_cli_init.py
        # ::test_every_program_manifest_has_a_sidecar_doc gates that.
        sidecar = write_plain_language_doc(target)
        print(
            f"  wrote {target.relative_to(REPO_ROOT)} + "
            f"{sidecar.relative_to(REPO_ROOT)}"
        )

    print(f"\nDone. {len(targets)} manifest(s) + sidecars emitted.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
