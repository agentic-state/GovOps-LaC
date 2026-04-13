"""Pre-loaded encoding example for the demo.

Shows a completed encoding batch: one article of the OAS Act encoded,
reviewed, and committed — so the Encode page isn't empty on first visit.
"""

from govops.encoder import (
    EncodingStore,
    ProposalStatus,
    RuleProposal,
)
from govops.models import LegalRule, RuleType


OAS_EXAMPLE_TEXT = """Old Age Security Act (R.S.C., 1985, c. O-9)

Section 3(1) - Payment of pension:
Subject to this Act and the regulations, a monthly pension may be paid to
every person who, being sixty-five years of age or over, has resided in Canada
after reaching eighteen years of age and after July 1, 1977 for periods the
aggregate of which is not less than ten years.

Section 3(2) - Amount of pension:
The amount of the pension that may be paid to a pensioner is
(a) where the pensioner has resided in Canada after reaching eighteen years
of age and after July 1, 1977 for periods the aggregate of which is not less
than forty years, a full pension, and
(b) in any other case, a proportion of a full pension equal to one-fortieth
of a full pension for each complete year of residence in Canada after the
pensioner reached eighteen years of age."""


def seed_encoding_example(encoding_store: EncodingStore):
    """Create a pre-loaded example batch showing the full encode workflow."""
    batch = encoding_store.create_batch(
        jurisdiction_id="ca",
        document_title="Old Age Security Act - Sections 3(1) and 3(2)",
        document_citation="R.S.C., 1985, c. O-9",
        input_text=OAS_EXAMPLE_TEXT,
    )

    proposals = [
        RuleProposal(
            batch_id=batch.id,
            source_text="every person who, being sixty-five years of age or over",
            source_section_ref="s. 3(1)",
            proposed_rule=LegalRule(
                source_document_id="doc-oas-act",
                source_section_ref="s. 3(1)",
                rule_type=RuleType.AGE_THRESHOLD,
                description="Applicant must be 65 years of age or older",
                formal_expression="applicant.age >= 65",
                citation="OAS Act, R.S.C. 1985, c. O-9, s. 3(1)",
                parameters={"min_age": 65},
            ),
        ),
        RuleProposal(
            batch_id=batch.id,
            source_text="has resided in Canada after reaching eighteen years of age ... for periods the aggregate of which is not less than ten years",
            source_section_ref="s. 3(1)",
            proposed_rule=LegalRule(
                source_document_id="doc-oas-act",
                source_section_ref="s. 3(1)",
                rule_type=RuleType.RESIDENCY_MINIMUM,
                description="Minimum 10 years of Canadian residency after age 18",
                formal_expression="canadian_residency_years_after_18 >= 10",
                citation="OAS Act, R.S.C. 1985, c. O-9, s. 3(1)",
                parameters={"min_years": 10, "home_countries": ["CA", "CANADA", "CAN"]},
            ),
        ),
        RuleProposal(
            batch_id=batch.id,
            source_text="not less than forty years, a full pension, and (b) ... a proportion of a full pension equal to one-fortieth",
            source_section_ref="s. 3(2)",
            proposed_rule=LegalRule(
                source_document_id="doc-oas-act",
                source_section_ref="s. 3(2)",
                rule_type=RuleType.RESIDENCY_PARTIAL,
                description="Full pension at 40+ years; partial at 10-39 years (1/40 per year)",
                formal_expression="pension_ratio = min(residency_years, 40) / 40",
                citation="OAS Act, R.S.C. 1985, c. O-9, s. 3(2)",
                parameters={"full_years": 40, "min_years": 10},
            ),
        ),
    ]

    encoding_store.add_proposals(
        batch.id, proposals, method="example:pre-loaded",
        prompt="(Pre-loaded example — not from LLM extraction)",
        raw_response="(Pre-loaded example showing the encoding workflow end-to-end)",
    )

    # Approve first two, leave the third pending for the user to try
    encoding_store.review_proposal(
        batch.id, proposals[0].id, ProposalStatus.APPROVED,
        reviewer="demo", notes="Core age threshold — straightforward extraction",
    )
    encoding_store.review_proposal(
        batch.id, proposals[1].id, ProposalStatus.APPROVED,
        reviewer="demo", notes="Residency minimum — includes home_countries parameter",
    )
    # proposals[2] left PENDING so the user can try approving it
