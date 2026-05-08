"""Encoder → commit-ready YAML emission (PLAN §8 success criterion #6).

The encoder pipeline produces ``LegalRule`` proposals from legislative
text; once a domain expert approves a proposal, the rule's parameters
flow into the substrate as ConfigValue records. Phases 1-4 made the
substrate the source-of-truth for runtime resolution; this module
closes the loop by emitting the same approvals as **commit-ready YAML
files** a contributor can ``git add`` — making the encoder's output a
proper PR, not a runtime-only mutation.

Output goes to ``lawcode/.proposed/<batch_id>/`` (a sibling of
``lawcode/.federated/``). The contributor reviews the file, optionally
edits, and moves it to the canonical ``lawcode/<jur>/config/`` location
via PR. The substrate's idempotent loader (per ADR-010) means re-loading
the file at next startup is safe — duplicate natural keys are skipped.

The emitter is intentionally narrow: one batch in, one or more YAML
files out, no side effects beyond writing files. It does not commit to
git, does not move files, does not modify ``lawcode/<jur>/`` directly.
The contributor stays in control.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from govops.encoder import EncodingBatch, ProposalStatus


class EmissionError(ValueError):
    """Raised when a batch cannot be emitted (no approvals, missing
    jurisdiction, etc.)."""


# Map from CA-OAS-style jurisdiction id back to the prefix the substrate
# key vocabulary uses. Mirrors govops.legacy_constants._JURISDICTION_PREFIX_TO_ID
# but keyed by full id, not prefix.
_JURISDICTION_ID_TO_PREFIX = {
    "ca-oas": "ca",
    "br-inss": "br",
    "es-jub": "es",
    "fr-cnav": "fr",
    "de-drv": "de",
    "ua-pfu": "ua",
}


def _infer_value_type(value: Any) -> str:
    """Map a Python value back to a substrate ``value_type`` discriminator.

    Matches the schema enum in schema/configvalue-v1.0.json. The encoder
    today produces scalar parameters (numbers, strings, lists); ``object``
    and ``enum`` are accepted in the schema but unlikely to come out of
    LLM extraction. ``prompt`` / ``template`` / ``formula`` are
    deliberately not inferred — those carry editorial weight that the
    encoder shouldn't presume.
    """
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, (int, float)):
        return "number"
    if isinstance(value, list):
        return "list"
    if isinstance(value, dict):
        return "object"
    return "string"


def _rule_id_to_key_segment(rule_id: str) -> str:
    """Strip the conventional ``rule-`` prefix from a LegalRule id.

    ``rule-age-65`` → ``age-65``. The result is the dotted segment after
    the jurisdiction prefix in the substrate key, e.g.
    ``ca.rule.age-65.min_age``.
    """
    return rule_id.removeprefix("rule-") if rule_id.startswith("rule-") else rule_id


def emit_yaml_for_batch(
    batch: EncodingBatch,
    target_root: Path,
) -> Path:
    """Emit a batch's approved rules as a commit-ready YAML file.

    Returns the path written, under
    ``target_root/lawcode/.proposed/<batch_id>/<prefix>-rules.yaml``.
    The contributor reviews the file, optionally edits, and moves it to
    the canonical location.

    Raises ``EmissionError`` when:
      - the batch has zero proposals in APPROVED or EDITED status
      - the batch's ``jurisdiction_id`` is not a known substrate prefix
        (e.g. a typo or a not-yet-registered jurisdiction)

    The output passes the JSON Schema gate at
    ``schema/lawcode-v1.0.json`` — the schema validator can be run
    against the proposed file before merging.
    """
    approved = [
        p for p in batch.proposals
        if p.status in (ProposalStatus.APPROVED, ProposalStatus.EDITED)
    ]
    if not approved:
        raise EmissionError(
            f"batch {batch.id!r} has no approved rules to emit"
        )

    jur_id = batch.jurisdiction_id
    prefix = _JURISDICTION_ID_TO_PREFIX.get(jur_id)
    if prefix is None:
        raise EmissionError(
            f"batch {batch.id!r} has unknown jurisdiction_id {jur_id!r}; "
            f"expected one of {sorted(_JURISDICTION_ID_TO_PREFIX)}"
        )

    values: list[dict[str, Any]] = []
    for proposal in approved:
        rule = proposal.proposed_rule
        rule_segment = _rule_id_to_key_segment(rule.id)
        # Each parameter on the LegalRule becomes a ConfigValue record per
        # ADR-006 (per-parameter granularity). Stable key shape mirrors
        # what `seed.py` consumes via `resolve_param`.
        for param_name, param_value in rule.parameters.items():
            record: dict[str, Any] = {
                "key": f"{prefix}.rule.{rule_segment}.{param_name}",
                "value": param_value,
                "value_type": _infer_value_type(param_value),
            }
            if rule.citation:
                record["citation"] = rule.citation
            rationale = (
                f"Encoded from {batch.document_title}"
                + (f", {proposal.source_section_ref}" if proposal.source_section_ref else "")
                + (f" ({batch.extraction_method})" if batch.extraction_method else "")
            )
            record["rationale"] = rationale
            if proposal.reviewed_by:
                record["author"] = proposal.reviewed_by
            values.append(record)

    doc = {
        "defaults": {
            "domain": "rule",
            "jurisdiction_id": jur_id,
            "effective_from": "1900-01-01",
        },
        "values": values,
    }

    target_dir = target_root / "lawcode" / ".proposed" / batch.id
    target_dir.mkdir(parents=True, exist_ok=True)
    out_path = target_dir / f"{prefix}-rules.yaml"

    yaml_text = (
        f"# yaml-language-server: $schema=../../../schema/lawcode-v1.0.json\n"
        f"# Generated by govops.yaml_emitter from encoding batch {batch.id}.\n"
        f"# Source: {batch.document_title} ({batch.document_citation})\n"
        f"# Method: {batch.extraction_method}\n"
        f"# Review and PR to lawcode/{prefix}/config/ when ready.\n\n"
    )
    yaml_text += yaml.safe_dump(
        doc,
        sort_keys=False,
        allow_unicode=True,
        default_flow_style=False,
    )
    out_path.write_text(yaml_text, encoding="utf-8")
    return out_path
