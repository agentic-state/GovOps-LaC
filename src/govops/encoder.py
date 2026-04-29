"""GovOps Rule Encoding Pipeline.

Deterministic process for turning legislative text into formalized rules:

1. INGEST   - Paste or upload legislative text with citation metadata
2. EXTRACT  - AI proposes structured rules from the text (pluggable LLM backend)
3. REVIEW   - Human expert reviews each proposed rule (approve / edit / reject)
4. COMMIT   - Approved rules are added to the active rule set with full provenance

Every step is logged. Every proposal traces to the source text.
Every approval records who approved it and when.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from govops.models import LegalRule, LegalSection, RuleType


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


# ---------------------------------------------------------------------------
# Pipeline models
# ---------------------------------------------------------------------------

class ProposalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    EDITED = "edited"
    REJECTED = "rejected"


class RuleProposal(BaseModel):
    """A single proposed rule extracted from legislative text."""
    id: str = Field(default_factory=_new_id)
    batch_id: str = ""
    source_text: str = ""  # The exact legislative text this rule was extracted from
    source_section_ref: str = ""  # e.g. "st. 26, para. 1"
    proposed_rule: LegalRule
    status: ProposalStatus = ProposalStatus.PENDING
    reviewer_notes: str = ""
    reviewed_by: str = ""
    reviewed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=_utcnow)


class EncodingBatch(BaseModel):
    """A batch of rule proposals from one encoding session."""
    id: str = Field(default_factory=_new_id)
    created_at: datetime = Field(default_factory=_utcnow)
    jurisdiction_id: str = ""
    document_title: str = ""
    document_citation: str = ""
    input_text: str = ""
    input_sections: list[LegalSection] = []
    proposals: list[RuleProposal] = []
    extraction_method: str = ""  # "llm:claude", "llm:openai", "manual"
    extraction_prompt: str = ""  # The user-prompt text actually sent
    extraction_prompt_key: str = ""  # ConfigValue key (e.g. global.prompt.encoder.extraction_user_template)
    extraction_system_prompt_key: str = ""  # ConfigValue key for the system prompt
    raw_llm_response: str = ""  # Full LLM response for auditability


class EncodingAuditEntry(BaseModel):
    timestamp: datetime = Field(default_factory=_utcnow)
    batch_id: str
    event: str  # "batch_created", "extraction_complete", "proposal_approved", "proposal_rejected", "rule_committed"
    actor: str  # "system", "llm:claude", reviewer name
    detail: str = ""
    data: dict = {}


# ---------------------------------------------------------------------------
# Extraction prompts (Phase 4 / ADR-008)
# ---------------------------------------------------------------------------
# Source of truth: lawcode/global/prompts.yaml. Resolved at module import via
# the substrate; per ADR-008, edits to those records require dual approval
# (domain expert + maintainer). Module-level constants stay for backwards
# compat with any external caller that imported them, but they're snapshots
# of the current registry value.

from govops.legacy_constants import resolve_param

EXTRACTION_SYSTEM_PROMPT_KEY = "global.prompt.encoder.extraction_system"
EXTRACTION_USER_PROMPT_TEMPLATE_KEY = "global.prompt.encoder.extraction_user_template"

EXTRACTION_SYSTEM_PROMPT = resolve_param(EXTRACTION_SYSTEM_PROMPT_KEY)
EXTRACTION_USER_PROMPT_TEMPLATE = resolve_param(EXTRACTION_USER_PROMPT_TEMPLATE_KEY)


# ---------------------------------------------------------------------------
# Encoding store
# ---------------------------------------------------------------------------

class EncodingStore:
    """In-memory store for the encoding pipeline."""

    def __init__(self):
        self.batches: dict[str, EncodingBatch] = {}
        self.audit: list[EncodingAuditEntry] = []

    def create_batch(
        self,
        jurisdiction_id: str,
        document_title: str,
        document_citation: str,
        input_text: str,
    ) -> EncodingBatch:
        batch = EncodingBatch(
            jurisdiction_id=jurisdiction_id,
            document_title=document_title,
            document_citation=document_citation,
            input_text=input_text,
        )
        self.batches[batch.id] = batch
        self._log(batch.id, "batch_created", "system",
                  f"New encoding batch for {document_title}")
        return batch

    def add_proposals(
        self,
        batch_id: str,
        proposals: list[RuleProposal],
        method: str,
        prompt: str = "",
        raw_response: str = "",
        prompt_key: str = "",
        system_prompt_key: str = "",
    ):
        batch = self.batches.get(batch_id)
        if not batch:
            return
        for p in proposals:
            p.batch_id = batch_id
        batch.proposals.extend(proposals)
        batch.extraction_method = method
        batch.extraction_prompt = prompt
        batch.extraction_prompt_key = prompt_key
        batch.extraction_system_prompt_key = system_prompt_key
        batch.raw_llm_response = raw_response
        log_data: dict = {"count": len(proposals)}
        if prompt_key:
            log_data["prompt_key"] = prompt_key
        if system_prompt_key:
            log_data["system_prompt_key"] = system_prompt_key
        self._log(batch_id, "extraction_complete", f"method:{method}",
                  f"{len(proposals)} rules proposed", log_data)

    def review_proposal(
        self,
        batch_id: str,
        proposal_id: str,
        status: ProposalStatus,
        reviewer: str = "expert",
        notes: str = "",
        edited_rule: LegalRule | None = None,
    ) -> RuleProposal | None:
        batch = self.batches.get(batch_id)
        if not batch:
            return None
        for p in batch.proposals:
            if p.id == proposal_id:
                p.status = status
                p.reviewer_notes = notes
                p.reviewed_by = reviewer
                p.reviewed_at = _utcnow()
                if edited_rule and status == ProposalStatus.EDITED:
                    p.proposed_rule = edited_rule
                self._log(batch_id, f"proposal_{status.value}", reviewer,
                          f"Rule {proposal_id}: {p.proposed_rule.description[:80]}",
                          {"proposal_id": proposal_id})
                return p
        return None

    def get_approved_rules(self, batch_id: str) -> list[LegalRule]:
        batch = self.batches.get(batch_id)
        if not batch:
            return []
        return [
            p.proposed_rule
            for p in batch.proposals
            if p.status in (ProposalStatus.APPROVED, ProposalStatus.EDITED)
        ]

    def _log(self, batch_id: str, event: str, actor: str, detail: str = "", data: dict | None = None):
        self.audit.append(EncodingAuditEntry(
            batch_id=batch_id,
            event=event,
            actor=actor,
            detail=detail,
            data=data or {},
        ))


# ---------------------------------------------------------------------------
# LLM extraction (pluggable backend)
# ---------------------------------------------------------------------------

def parse_llm_response(raw_response: str, batch: EncodingBatch) -> list[RuleProposal]:
    """Parse an LLM response into RuleProposal objects."""
    # Try to find JSON array in the response
    text = raw_response.strip()

    # Handle markdown code blocks
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()

    # Find the JSON array
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1:
        return []
    text = text[start:end + 1]

    try:
        items = json.loads(text)
    except json.JSONDecodeError:
        return []

    proposals = []
    for item in items:
        if not isinstance(item, dict):
            continue
        rule_type_str = item.get("rule_type", "")
        try:
            rule_type = RuleType(rule_type_str)
        except ValueError:
            rule_type = RuleType.AGE_THRESHOLD  # fallback

        rule = LegalRule(
            source_document_id=f"doc-{batch.jurisdiction_id}",
            source_section_ref=item.get("citation", ""),
            rule_type=rule_type,
            description=item.get("description", ""),
            formal_expression=item.get("formal_expression", ""),
            citation=f"{batch.document_citation}, {item.get('citation', '')}",
            parameters=item.get("parameters", {}),
        )
        proposal = RuleProposal(
            batch_id=batch.id,
            source_text=item.get("source_text", ""),
            source_section_ref=item.get("citation", ""),
            proposed_rule=rule,
        )
        proposals.append(proposal)

    return proposals


async def extract_rules_with_llm(
    batch: EncodingBatch,
    api_key: str,
    model: str = "claude-sonnet-4-20250514",
    base_url: str = "https://api.anthropic.com",
) -> tuple[list[RuleProposal], str, str, str, str]:
    """Call an LLM to extract rules from legislative text.

    Returns (proposals, user_prompt_used, raw_response, user_prompt_key,
    system_prompt_key) — the keys identify which substrate ConfigValues
    sourced each prompt, so the audit trail can pin reproducibility.
    """
    import httpx

    # Resolve fresh from the substrate so any post-startup admin write is
    # picked up on the next batch (the in-memory store reseeds on restart;
    # within one process, calls return the current snapshot).
    user_template = resolve_param(EXTRACTION_USER_PROMPT_TEMPLATE_KEY)
    system_prompt = resolve_param(EXTRACTION_SYSTEM_PROMPT_KEY)

    prompt = user_template.format(
        document_title=batch.document_title,
        document_citation=batch.document_citation,
        jurisdiction_name=batch.jurisdiction_id,
        text=batch.input_text,
    )

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{base_url}/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": 4096,
                "system": system_prompt,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        resp.raise_for_status()
        data = resp.json()

    raw_response = data.get("content", [{}])[0].get("text", "")
    proposals = parse_llm_response(raw_response, batch)
    return (
        proposals,
        prompt,
        raw_response,
        EXTRACTION_USER_PROMPT_TEMPLATE_KEY,
        EXTRACTION_SYSTEM_PROMPT_KEY,
    )


def extract_rules_manual(batch: EncodingBatch) -> list[RuleProposal]:
    """Create empty proposals for manual encoding (no LLM)."""
    return [
        RuleProposal(
            batch_id=batch.id,
            source_text=batch.input_text[:500],
            source_section_ref="(manual entry)",
            proposed_rule=LegalRule(
                source_document_id=f"doc-{batch.jurisdiction_id}",
                source_section_ref="",
                rule_type=RuleType.AGE_THRESHOLD,
                description="(enter rule description)",
                formal_expression="(enter expression)",
                citation=batch.document_citation,
                parameters={},
            ),
        )
    ]
