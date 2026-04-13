"""Tests for the rule encoding pipeline."""

import pytest

from govops.encoder import (
    EncodingBatch,
    EncodingStore,
    ProposalStatus,
    extract_rules_manual,
    parse_llm_response,
)


def _make_batch() -> EncodingBatch:
    return EncodingBatch(
        jurisdiction_id="jur-test",
        document_title="Test Act",
        document_citation="Test Act, s. 1",
        input_text="Article 1: The minimum age is 65 years.",
    )


class TestParseLLMResponse:
    def test_parses_valid_json_array(self):
        raw = '''[
            {
                "rule_type": "age_threshold",
                "description": "Minimum age is 65",
                "formal_expression": "age >= 65",
                "citation": "s. 1",
                "parameters": {"min_age": 65},
                "source_text": "The minimum age is 65 years."
            }
        ]'''
        batch = _make_batch()
        proposals = parse_llm_response(raw, batch)
        assert len(proposals) == 1
        assert proposals[0].proposed_rule.rule_type.value == "age_threshold"
        assert proposals[0].proposed_rule.parameters["min_age"] == 65
        assert proposals[0].proposed_rule.description == "Minimum age is 65"

    def test_parses_markdown_code_block(self):
        raw = '''Here are the extracted rules:

```json
[
    {
        "rule_type": "residency_minimum",
        "description": "10 years residency required",
        "formal_expression": "residency >= 10",
        "citation": "s. 3(1)",
        "parameters": {"min_years": 10},
        "source_text": "not less than ten years"
    }
]
```

These rules cover the basic eligibility.'''
        batch = _make_batch()
        proposals = parse_llm_response(raw, batch)
        assert len(proposals) == 1
        assert proposals[0].proposed_rule.rule_type.value == "residency_minimum"

    def test_parses_multiple_rules(self):
        raw = '''[
            {"rule_type": "age_threshold", "description": "Age 65", "formal_expression": "age >= 65", "citation": "s. 1", "parameters": {"min_age": 65}},
            {"rule_type": "residency_minimum", "description": "10 years", "formal_expression": "years >= 10", "citation": "s. 2", "parameters": {"min_years": 10}},
            {"rule_type": "legal_status", "description": "Citizen", "formal_expression": "status in [citizen]", "citation": "s. 3", "parameters": {"accepted_statuses": ["citizen"]}}
        ]'''
        batch = _make_batch()
        proposals = parse_llm_response(raw, batch)
        assert len(proposals) == 3

    def test_handles_empty_response(self):
        proposals = parse_llm_response("", _make_batch())
        assert proposals == []

    def test_handles_no_json(self):
        proposals = parse_llm_response("I could not extract any rules.", _make_batch())
        assert proposals == []

    def test_handles_invalid_json(self):
        proposals = parse_llm_response("[{broken json", _make_batch())
        assert proposals == []

    def test_handles_unknown_rule_type(self):
        raw = '[{"rule_type": "unknown_type", "description": "test", "formal_expression": "x", "citation": "s.1", "parameters": {}}]'
        batch = _make_batch()
        proposals = parse_llm_response(raw, batch)
        assert len(proposals) == 1  # falls back to age_threshold

    def test_preserves_source_text(self):
        raw = '[{"rule_type": "age_threshold", "description": "test", "formal_expression": "x", "citation": "s.1", "parameters": {}, "source_text": "The exact legislative text"}]'
        batch = _make_batch()
        proposals = parse_llm_response(raw, batch)
        assert proposals[0].source_text == "The exact legislative text"

    def test_builds_citation_from_batch(self):
        raw = '[{"rule_type": "age_threshold", "description": "test", "formal_expression": "x", "citation": "Art. 26", "parameters": {}}]'
        batch = _make_batch()
        proposals = parse_llm_response(raw, batch)
        assert "Test Act, s. 1" in proposals[0].proposed_rule.citation
        assert "Art. 26" in proposals[0].proposed_rule.citation


class TestEncodingStore:
    def test_create_batch(self):
        store = EncodingStore()
        batch = store.create_batch("jur-test", "Test Act", "s. 1", "Article 1")
        assert batch.id in store.batches
        assert len(store.audit) == 1
        assert store.audit[0].event == "batch_created"

    def test_add_proposals(self):
        store = EncodingStore()
        batch = store.create_batch("jur-test", "Test Act", "s. 1", "Article 1")
        proposals = extract_rules_manual(batch)
        store.add_proposals(batch.id, proposals, method="manual")
        assert len(batch.proposals) == 1
        assert batch.extraction_method == "manual"

    def test_review_approve(self):
        store = EncodingStore()
        batch = store.create_batch("jur-test", "Test Act", "s. 1", "Article 1")
        proposals = extract_rules_manual(batch)
        store.add_proposals(batch.id, proposals, method="manual")
        pid = proposals[0].id
        result = store.review_proposal(batch.id, pid, ProposalStatus.APPROVED, reviewer="tester")
        assert result.status == ProposalStatus.APPROVED
        assert result.reviewed_by == "tester"

    def test_review_reject(self):
        store = EncodingStore()
        batch = store.create_batch("jur-test", "Test Act", "s. 1", "Article 1")
        proposals = extract_rules_manual(batch)
        store.add_proposals(batch.id, proposals, method="manual")
        pid = proposals[0].id
        store.review_proposal(batch.id, pid, ProposalStatus.REJECTED, notes="Incorrect")
        approved = store.get_approved_rules(batch.id)
        assert len(approved) == 0

    def test_get_approved_rules(self):
        store = EncodingStore()
        batch = store.create_batch("jur-test", "Test Act", "s. 1", "Article 1")
        proposals = extract_rules_manual(batch)
        store.add_proposals(batch.id, proposals, method="manual")
        pid = proposals[0].id
        store.review_proposal(batch.id, pid, ProposalStatus.APPROVED)
        approved = store.get_approved_rules(batch.id)
        assert len(approved) == 1

    def test_audit_trail_complete(self):
        store = EncodingStore()
        batch = store.create_batch("jur-test", "Test Act", "s. 1", "Article 1")
        proposals = extract_rules_manual(batch)
        store.add_proposals(batch.id, proposals, method="manual")
        store.review_proposal(batch.id, proposals[0].id, ProposalStatus.APPROVED)
        events = [e.event for e in store.audit]
        assert "batch_created" in events
        assert "extraction_complete" in events
        assert "proposal_approved" in events
