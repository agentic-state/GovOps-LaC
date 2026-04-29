"""Phase 4 — prompts as ConfigValues.

Per [PLAN.md §Phase 4](../PLAN.md): every encoder prompt resolves through
the substrate (loaded from ``lawcode/global/prompts.yaml``); every batch
records the ConfigValue keys it used so the audit trail can pin
reproducibility.

Per [ADR-008](../docs/design/ADRs/ADR-008-prompt-as-config-dual-approval.md):
prompt records also carry author + approved_by metadata for the dual-
approval policy (procedural enforcement until the Phase 6 admin UI ships).
"""

from __future__ import annotations


from govops.config import ResolutionSource
from govops.encoder import (
    EncodingStore,
    EXTRACTION_SYSTEM_PROMPT,
    EXTRACTION_SYSTEM_PROMPT_KEY,
    EXTRACTION_USER_PROMPT_TEMPLATE,
    EXTRACTION_USER_PROMPT_TEMPLATE_KEY,
    extract_rules_manual,
)
from govops.legacy_constants import _resolver, resolve_param


# ---------------------------------------------------------------------------
# Substrate sourcing
# ---------------------------------------------------------------------------


def test_extraction_prompts_resolve_from_substrate():
    """Both prompt keys are loaded from lawcode/global/prompts.yaml."""
    sys_result = _resolver.resolve_value(EXTRACTION_SYSTEM_PROMPT_KEY)
    user_result = _resolver.resolve_value(EXTRACTION_USER_PROMPT_TEMPLATE_KEY)
    assert sys_result.source == ResolutionSource.SUBSTRATE
    assert user_result.source == ResolutionSource.SUBSTRATE
    assert "rule extraction engine" in sys_result.value.lower()
    assert "{document_title}" in user_result.value


def test_module_level_constants_match_substrate():
    """The encoder.py module-level constants are snapshots of the substrate."""
    assert EXTRACTION_SYSTEM_PROMPT == resolve_param(EXTRACTION_SYSTEM_PROMPT_KEY)
    assert EXTRACTION_USER_PROMPT_TEMPLATE == resolve_param(
        EXTRACTION_USER_PROMPT_TEMPLATE_KEY
    )


def test_prompt_records_carry_author_and_approver():
    """Per ADR-008, prompt records carry author + approved_by metadata."""
    cv_list = _resolver.list(domain="prompt")
    assert len(cv_list) == 2
    for cv in cv_list:
        assert cv.author, f"Prompt {cv.key} missing author"
        assert cv.approved_by, f"Prompt {cv.key} missing approved_by"


# ---------------------------------------------------------------------------
# Reproducibility — prompt keys recorded in the batch / audit
# ---------------------------------------------------------------------------


def test_add_proposals_records_prompt_keys():
    """When the LLM path completes, the batch records both prompt keys so the
    audit trail can pin which ConfigValue versions produced this batch's
    proposals."""
    store = EncodingStore()
    batch = store.create_batch(
        jurisdiction_id="ca",
        document_title="Test Act",
        document_citation="Test, s. 1",
        input_text="Article 1: minimum age 65.",
    )
    proposals = extract_rules_manual(batch)

    store.add_proposals(
        batch.id,
        proposals,
        method="llm:claude",
        prompt="<rendered user prompt>",
        raw_response="[]",
        prompt_key=EXTRACTION_USER_PROMPT_TEMPLATE_KEY,
        system_prompt_key=EXTRACTION_SYSTEM_PROMPT_KEY,
    )

    saved = store.batches[batch.id]
    assert saved.extraction_prompt_key == EXTRACTION_USER_PROMPT_TEMPLATE_KEY
    assert saved.extraction_system_prompt_key == EXTRACTION_SYSTEM_PROMPT_KEY


def test_audit_log_includes_prompt_keys_for_llm_batches():
    """The 'extraction_complete' audit entry records both prompt keys."""
    store = EncodingStore()
    batch = store.create_batch(
        jurisdiction_id="ca",
        document_title="Test Act",
        document_citation="Test, s. 1",
        input_text="x",
    )
    store.add_proposals(
        batch.id,
        proposals=[],
        method="llm:claude",
        prompt="<p>",
        raw_response="[]",
        prompt_key=EXTRACTION_USER_PROMPT_TEMPLATE_KEY,
        system_prompt_key=EXTRACTION_SYSTEM_PROMPT_KEY,
    )

    extraction_entries = [
        e for e in store.audit if e.event == "extraction_complete"
    ]
    assert len(extraction_entries) == 1
    data = extraction_entries[0].data
    assert data["prompt_key"] == EXTRACTION_USER_PROMPT_TEMPLATE_KEY
    assert data["system_prompt_key"] == EXTRACTION_SYSTEM_PROMPT_KEY


def test_manual_path_does_not_record_prompt_keys():
    """The manual extraction path doesn't use prompts; the batch reflects that."""
    store = EncodingStore()
    batch = store.create_batch(
        jurisdiction_id="ca",
        document_title="Test",
        document_citation="x",
        input_text="x",
    )
    store.add_proposals(batch.id, proposals=[], method="manual")
    saved = store.batches[batch.id]
    assert saved.extraction_method == "manual"
    assert saved.extraction_prompt_key == ""
    assert saved.extraction_system_prompt_key == ""


# ---------------------------------------------------------------------------
# Prompt-key reproducibility — the SAME key produces the SAME prompt text
# (single process; substrate snapshot is stable until a write/restart)
# ---------------------------------------------------------------------------


def test_user_prompt_template_renders_deterministically():
    """Re-resolving the same key yields byte-identical text."""
    a = resolve_param(EXTRACTION_USER_PROMPT_TEMPLATE_KEY)
    b = resolve_param(EXTRACTION_USER_PROMPT_TEMPLATE_KEY)
    assert a == b


def test_system_prompt_renders_deterministically():
    a = resolve_param(EXTRACTION_SYSTEM_PROMPT_KEY)
    b = resolve_param(EXTRACTION_SYSTEM_PROMPT_KEY)
    assert a == b
