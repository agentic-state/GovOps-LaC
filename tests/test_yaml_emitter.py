"""Tests for the encoder → commit-ready YAML emission (PLAN §8 #6).

Coverage targets:
  - Per-parameter granularity: one ConfigValue record per LegalRule
    parameter, key shape ``<prefix>.rule.<rule-segment>.<param-name>``
  - Output passes the JSON schema gate at schema/lawcode-v1.0.json
  - Approved + edited proposals emit; pending + rejected do not
  - Empty/all-pending batch raises EmissionError
  - Unknown jurisdiction raises EmissionError
  - HTTP endpoint returns 404 / 400 / 200 + path + content
  - Re-loading the emitted YAML through ConfigStore.load_from_yaml is
    a round-trip (records resolve from substrate)
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient

from govops.api import app, encoding_store
from govops.config import ConfigStore
from govops.encoder import (
    EncodingBatch,
    ProposalStatus,
    RuleProposal,
)
from govops.models import LegalRule, RuleType
from govops.yaml_emitter import EmissionError, emit_yaml_for_batch


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _make_batch(jurisdiction_id: str = "ca-oas") -> EncodingBatch:
    """A batch with one approved + one rejected proposal — exercises the
    status filter."""
    rule_approved = LegalRule(
        id="rule-age-65",
        source_document_id="doc-oas-act",
        source_section_ref="s. 3(1)",
        rule_type=RuleType.AGE_THRESHOLD,
        description="Applicant must be 65 years of age or older",
        formal_expression="applicant.age >= 65",
        citation="Old Age Security Act, R.S.C. 1985, c. O-9, s. 3(1)",
        parameters={"min_age": 65},
    )
    rule_rejected = LegalRule(
        id="rule-spurious",
        source_document_id="doc-oas-act",
        source_section_ref="s. 999",
        rule_type=RuleType.AGE_THRESHOLD,
        description="A spurious rule the LLM proposed",
        formal_expression="false",
        citation="bogus",
        parameters={"min_age": 999},
    )
    return EncodingBatch(
        id="batch-test-001",
        jurisdiction_id=jurisdiction_id,
        document_title="Old Age Security Act",
        document_citation="R.S.C. 1985, c. O-9",
        extraction_method="llm:claude",
        proposals=[
            RuleProposal(
                batch_id="batch-test-001",
                source_section_ref="s. 3(1)",
                proposed_rule=rule_approved,
                status=ProposalStatus.APPROVED,
                reviewed_by="domain-expert",
                reviewed_at=datetime(2026, 4, 28, tzinfo=timezone.utc),
            ),
            RuleProposal(
                batch_id="batch-test-001",
                source_section_ref="s. 999",
                proposed_rule=rule_rejected,
                status=ProposalStatus.REJECTED,
                reviewed_by="domain-expert",
                reviewed_at=datetime(2026, 4, 28, tzinfo=timezone.utc),
            ),
        ],
    )


# ---------------------------------------------------------------------------
# Direct emitter
# ---------------------------------------------------------------------------


class TestEmitYamlForBatch:
    def test_emits_approved_only_to_proposed_dir(self, tmp_path):
        batch = _make_batch()
        out = emit_yaml_for_batch(batch, tmp_path)
        assert out.exists()
        assert out.relative_to(tmp_path) == Path("lawcode/.proposed/batch-test-001/ca-rules.yaml")

        doc = yaml.safe_load(out.read_text(encoding="utf-8"))
        # Defaults pass through to every record.
        assert doc["defaults"]["jurisdiction_id"] == "ca-oas"
        assert doc["defaults"]["domain"] == "rule"
        # Only the approved rule emitted; rejected dropped.
        assert len(doc["values"]) == 1
        record = doc["values"][0]
        assert record["key"] == "ca.rule.age-65.min_age"
        assert record["value"] == 65
        assert record["value_type"] == "number"
        assert "Old Age Security Act" in record["citation"]
        assert "domain-expert" == record["author"]
        # Rationale traces back to the source.
        assert "Old Age Security Act" in record["rationale"]
        assert "s. 3(1)" in record["rationale"]
        assert "llm:claude" in record["rationale"]

    def test_emitted_yaml_passes_schema_gate(self, tmp_path):
        """The emitted file must validate against schema/lawcode-v1.0.json
        — that's the only way a contributor can `git add` it without
        breaking CI."""
        batch = _make_batch()
        out = emit_yaml_for_batch(batch, tmp_path)

        repo_root = Path(__file__).resolve().parent.parent
        file_schema = json.loads((repo_root / "schema" / "lawcode-v1.0.json").read_text())
        record_schema = json.loads((repo_root / "schema" / "configvalue-v1.0.json").read_text())

        import jsonschema
        doc = yaml.safe_load(out.read_text(encoding="utf-8"))
        jsonschema.validate(doc, file_schema)
        # Also validate each merged record against the record schema.
        for raw in doc["values"]:
            merged = {**doc["defaults"], **raw}
            jsonschema.validate(merged, record_schema)

    def test_emitter_handles_multiple_parameters_per_rule(self, tmp_path):
        rule = LegalRule(
            id="rule-residency-pension-type",
            source_document_id="doc-oas-act",
            source_section_ref="s. 3(2)",
            rule_type=RuleType.RESIDENCY_PARTIAL,
            description="Full at 40 years; partial 10–39",
            formal_expression="see s. 3(2)",
            citation="OAS Act, s. 3(2)",
            parameters={"full_years": 40, "min_years": 10},
        )
        batch = EncodingBatch(
            id="batch-multi-param",
            jurisdiction_id="ca-oas",
            document_title="OAS Act",
            document_citation="R.S.C. 1985, c. O-9",
            extraction_method="manual",
            proposals=[
                RuleProposal(
                    batch_id="batch-multi-param",
                    source_section_ref="s. 3(2)",
                    proposed_rule=rule,
                    status=ProposalStatus.APPROVED,
                    reviewed_by="reviewer",
                ),
            ],
        )
        out = emit_yaml_for_batch(batch, tmp_path)
        doc = yaml.safe_load(out.read_text(encoding="utf-8"))
        keys = sorted(r["key"] for r in doc["values"])
        assert keys == [
            "ca.rule.residency-pension-type.full_years",
            "ca.rule.residency-pension-type.min_years",
        ]

    def test_emitter_round_trips_through_configstore(self, tmp_path):
        """The emitted YAML must be loadable by ConfigStore.load_from_yaml
        — that's the contract that makes the encoder output truly commit-
        ready, not just shape-correct."""
        batch = _make_batch()
        out = emit_yaml_for_batch(batch, tmp_path)
        store = ConfigStore()
        n = store.load_from_yaml(out)
        assert n == 1
        record = store.resolve(
            "ca.rule.age-65.min_age",
            evaluation_date=datetime.now(timezone.utc),
            jurisdiction_id="ca-oas",
        )
        assert record is not None
        assert record.value == 65

    def test_no_approvals_raises_emission_error(self, tmp_path):
        batch = EncodingBatch(
            id="empty-batch",
            jurisdiction_id="ca-oas",
            document_title="X",
            proposals=[],
        )
        with pytest.raises(EmissionError, match="no approved rules"):
            emit_yaml_for_batch(batch, tmp_path)

    def test_unknown_jurisdiction_raises_emission_error(self, tmp_path):
        batch = _make_batch(jurisdiction_id="atlantis-pension")
        with pytest.raises(EmissionError, match="unknown jurisdiction_id"):
            emit_yaml_for_batch(batch, tmp_path)


# ---------------------------------------------------------------------------
# HTTP endpoint
# ---------------------------------------------------------------------------


class TestEmitYamlEndpoint:
    def test_404_for_unknown_batch(self, client):
        r = client.post("/api/encode/batches/nonexistent/emit-yaml")
        assert r.status_code == 404

    def test_400_for_batch_with_no_approvals(self, client):
        # Create a batch directly in the encoding store with no approvals.
        batch = encoding_store.create_batch(
            jurisdiction_id="ca-oas",
            document_title="Test",
            document_citation="—",
            input_text="—",
        )
        r = client.post(f"/api/encode/batches/{batch.id}/emit-yaml")
        assert r.status_code == 400
        assert "no approved rules" in r.json()["detail"]

    def test_200_returns_path_and_content(self, client, tmp_path, monkeypatch):
        # Inject a populated batch + redirect emission to tmp_path.
        batch = _make_batch()
        encoding_store.batches[batch.id] = batch

        # Redirect the emitter's target root by monkeypatching LAWCODE_DIR
        # — the endpoint computes target_root = LAWCODE_DIR.parent.
        from govops import api as api_module
        monkeypatch.setattr(api_module, "LAWCODE_DIR", tmp_path / "lawcode")
        (tmp_path / "lawcode").mkdir()

        r = client.post(f"/api/encode/batches/{batch.id}/emit-yaml")
        assert r.status_code == 200
        body = r.json()
        assert body["batch_id"] == batch.id
        assert body["path"].endswith("ca-rules.yaml")
        assert "ca.rule.age-65.min_age" in body["content"]
        assert "domain: rule" in body["content"]
