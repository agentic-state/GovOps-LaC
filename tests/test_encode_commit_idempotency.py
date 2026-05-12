"""v3.1 L6 Bug 4 -- POST /api/encode/batches/{id}/commit must be idempotent.

Pre-v3.1 the JSON commit endpoint had no guard: re-clicking "Commit to engine"
in /encode/<batchId> re-invoked the endpoint and a fresh ``committed_rule_ids``
response came back, suggesting the commit happened a second time. The repaired
endpoint sets ``EncodingBatch.committed_at`` on first success and returns 409
Conflict on subsequent attempts.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from govops.api import app, encoding_store
from govops.encoder import EncodingBatch, ProposalStatus, RuleProposal
from govops.models import LegalRule, RuleType


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def fresh_batch():
    """Inject a synthetic batch with one approved proposal so the commit
    endpoint has something to commit. Use a unique id per test to avoid
    cross-test interference."""
    rule = LegalRule(
        id="test-rule-idempotency",
        source_document_id="doc-test",
        source_section_ref="s. 1",
        rule_type=RuleType.AGE_THRESHOLD,
        description="test rule",
        formal_expression="age >= 65",
        citation="test citation",
        parameters={"min_age": 65},
    )
    proposal = RuleProposal(
        id="prop-test-1",
        proposed_rule=rule,
        status=ProposalStatus.APPROVED,
        source_text="dummy",
    )
    batch = EncodingBatch(
        id="batch-idempotency-test",
        jurisdiction_id="jur-ca-federal",
        document_title="Test Doc",
        document_citation="test cite",
        proposals=[proposal],
    )
    encoding_store.batches[batch.id] = batch
    yield batch
    encoding_store.batches.pop(batch.id, None)


def test_commit_succeeds_first_time(client, fresh_batch):
    r = client.post(f"/api/encode/batches/{fresh_batch.id}/commit")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["committed_rule_ids"] == ["test-rule-idempotency"]
    # committed_at was set on the batch
    assert fresh_batch.committed_at is not None
    assert isinstance(fresh_batch.committed_at, datetime)


def test_recommit_returns_409(client, fresh_batch):
    """Bug 4 fix: a second commit attempt is rejected with 409 Conflict."""
    r1 = client.post(f"/api/encode/batches/{fresh_batch.id}/commit")
    assert r1.status_code == 200

    r2 = client.post(f"/api/encode/batches/{fresh_batch.id}/commit")
    assert r2.status_code == 409, r2.text
    detail = r2.json()["detail"]
    assert detail["error"] == "batch already committed"
    assert detail["batch_id"] == fresh_batch.id
    assert "committed_at" in detail


def test_commit_logs_audit_event(client, fresh_batch):
    """First commit emits a `batch_committed` audit entry so the encode
    history surface can render it."""
    pre_count = sum(
        1 for e in encoding_store.audit
        if e.batch_id == fresh_batch.id and e.event == "batch_committed"
    )
    client.post(f"/api/encode/batches/{fresh_batch.id}/commit")
    post_count = sum(
        1 for e in encoding_store.audit
        if e.batch_id == fresh_batch.id and e.event == "batch_committed"
    )
    assert post_count == pre_count + 1


def test_commit_unknown_batch_404(client):
    r = client.post("/api/encode/batches/does-not-exist/commit")
    assert r.status_code == 404


def test_committed_batch_preserves_committed_at_across_calls(client, fresh_batch):
    """Re-attempt commits do not bump or zero committed_at."""
    client.post(f"/api/encode/batches/{fresh_batch.id}/commit")
    first = fresh_batch.committed_at
    client.post(f"/api/encode/batches/{fresh_batch.id}/commit")  # 409
    assert fresh_batch.committed_at == first
