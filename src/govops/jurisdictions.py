"""Multi-jurisdiction seed data for GovOps.

Each jurisdiction defines its own:
  - Jurisdiction object
  - Authority chain (constitution -> law -> regulation -> program -> service)
  - Legal documents with statutory text
  - Formalized rules with parameters
  - Demo cases covering all decision paths
  - Default language

Pension programs encoded:
  - Canada: Old Age Security (OAS) - age 65, 10y residency
  - Brazil: Aposentadoria por Idade (INSS) - age 65m/62f, 15y contribution
  - Spain: Pension de jubilacion - age 66, 15y contribution
  - France: Retraite de base - age 64, 2y minimum contribution
  - Germany: Gesetzliche Rente - age 67, 5y contribution
  - Ukraine: Pensiia za vikom - age 60, 25y contribution (men)
  - Japan: Kosei Nenkin Hoken (Employees' Pension Insurance) - age 65,
    10y contribution
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date

from govops.legacy_constants import resolve_param  # populates LEGACY_CONSTANTS
from govops.models import (
    Applicant,
    AuthorityReference,
    CaseBundle,
    DocumentType,
    EvidenceItem,
    Jurisdiction,
    LegalDocument,
    LegalRule,
    LegalSection,
    ResidencyPeriod,
    RuleType,
)


# ===================================================================
# BRAZIL
# ===================================================================

BRAZIL_FEDERAL = Jurisdiction(
    id="jur-br-federal",
    name="Republica Federativa do Brasil",
    country="BR",
    level="federal",
    legal_tradition="Civil law (Romano-Germanic)",
    language_regime="Portuguese",
)

BRAZIL_AUTHORITY_CHAIN = [
    AuthorityReference(
        id="auth-br-constitution",
        jurisdiction_id="jur-br-federal",
        layer="constitution",
        title="Constituicao da Republica Federativa do Brasil de 1988",
        citation="CF/1988, Art. 201",
        effective_date=date(1988, 10, 5),
        url="https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
    ),
    AuthorityReference(
        id="auth-br-law-8213",
        jurisdiction_id="jur-br-federal",
        layer="act",
        title="Lei de Beneficios da Previdencia Social",
        citation="Lei n. 8.213/1991",
        effective_date=date(1991, 7, 24),
        url="https://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm",
        parent_id="auth-br-constitution",
    ),
    AuthorityReference(
        id="auth-br-ec-103",
        jurisdiction_id="jur-br-federal",
        layer="act",
        title="Emenda Constitucional n. 103/2019 (Reforma da Previdencia)",
        citation="EC n. 103/2019",
        effective_date=date(2019, 11, 13),
        parent_id="auth-br-constitution",
    ),
    AuthorityReference(
        id="auth-br-inss",
        jurisdiction_id="jur-br-federal",
        layer="program",
        title="Instituto Nacional do Seguro Social (INSS)",
        citation="Lei n. 8.029/1990, Art. 17",
        parent_id="auth-br-law-8213",
    ),
    AuthorityReference(
        id="auth-br-aposentadoria",
        jurisdiction_id="jur-br-federal",
        layer="service",
        title="Aposentadoria por Idade",
        citation="Lei n. 8.213/1991, Art. 48; EC 103/2019, Art. 19",
        parent_id="auth-br-inss",
    ),
]

BRAZIL_LEGAL_DOCS = [
    LegalDocument(
        id="doc-br-lei-8213",
        jurisdiction_id="jur-br-federal",
        document_type=DocumentType.STATUTE,
        title="Lei de Beneficios da Previdencia Social",
        citation="Lei n. 8.213/1991",
        effective_date=date(1991, 7, 24),
        sections=[
            LegalSection(
                id="sec-br-art48",
                section_ref="Art. 48",
                heading="Aposentadoria por idade",
                text=(
                    "A aposentadoria por idade sera devida ao segurado que, cumprida a "
                    "carencia exigida nesta Lei, completar 65 (sessenta e cinco) anos de "
                    "idade, se homem, e 62 (sessenta e dois) anos, se mulher. (Redacao "
                    "dada pela Emenda Constitucional n. 103, de 2019)"
                ),
            ),
            LegalSection(
                id="sec-br-art25",
                section_ref="Art. 25, II",
                heading="Carencia",
                text=(
                    "A concessao da aposentadoria por idade depende de carencia de 180 "
                    "contribuicoes mensais (15 anos)."
                ),
            ),
        ],
    ),
]

BRAZIL_RULES = [
    LegalRule(
        id="rule-br-age",
        source_document_id="doc-br-lei-8213",
        source_section_ref="Art. 48",
        rule_type=RuleType.AGE_THRESHOLD,
        description="Idade minima: 65 anos (homens) ou 62 anos (mulheres)",
        formal_expression="age >= 65 (male) or age >= 62 (female)",
        citation="Lei n. 8.213/1991, Art. 48; EC 103/2019",
        param_key_prefix="br.rule.age",
        parameters={"min_age": resolve_param("br.rule.age.min_age")},  # Using male threshold for demo
    ),
    LegalRule(
        id="rule-br-contribution",
        source_document_id="doc-br-lei-8213",
        source_section_ref="Art. 25, II",
        rule_type=RuleType.RESIDENCY_MINIMUM,
        description="Minimo de 15 anos (180 meses) de contribuicao ao INSS",
        formal_expression="contribution_years >= 15",
        citation="Lei n. 8.213/1991, Art. 25, II",
        param_key_prefix="br.rule.contribution",
        parameters={
            "min_years": resolve_param("br.rule.contribution.min_years"),
            "home_countries": resolve_param("br.rule.contribution.home_countries"),
        },
    ),
    LegalRule(
        id="rule-br-contribution-calc",
        source_document_id="doc-br-lei-8213",
        source_section_ref="Art. 48",
        rule_type=RuleType.RESIDENCY_PARTIAL,
        description="Beneficio integral com 40 anos de contribuicao; proporcional com 15-39 anos",
        formal_expression="pension_ratio = min(contribution_years, 40) / 40",
        citation="EC 103/2019, Art. 26",
        param_key_prefix="br.rule.contribution-calc",
        parameters={
            "full_years": resolve_param("br.rule.contribution-calc.full_years"),
            "min_years": resolve_param("br.rule.contribution-calc.min_years"),
        },
    ),
    LegalRule(
        id="rule-br-status",
        source_document_id="doc-br-lei-8213",
        source_section_ref="Art. 48",
        rule_type=RuleType.LEGAL_STATUS,
        description="Segurado deve estar inscrito no INSS (cidadao ou residente permanente)",
        formal_expression="legal_status in ['citizen', 'permanent_resident']",
        citation="Lei n. 8.213/1991, Art. 11",
        param_key_prefix="br.rule.status",
        parameters={"accepted_statuses": resolve_param("br.rule.status.accepted_statuses")},
    ),
    LegalRule(
        id="rule-br-evidence",
        source_document_id="doc-br-lei-8213",
        source_section_ref="Art. 48",
        rule_type=RuleType.EVIDENCE_REQUIRED,
        description="Comprovante de idade (certidao de nascimento ou documento de identidade)",
        formal_expression="has_evidence('birth_certificate') or has_evidence('id_card')",
        citation="Lei n. 8.213/1991, Art. 62",
        param_key_prefix="br.rule.evidence",
        parameters={"required_types": resolve_param("br.rule.evidence.required_types")},
    ),
]


def _brazil_demo_cases() -> list[CaseBundle]:
    return [
        CaseBundle(
            id="demo-br-001",
            jurisdiction_id="jur-br-federal",
            applicant=Applicant(
                id="app-br-001", date_of_birth=date(1955, 6, 12),
                legal_name="Carlos Alberto Silva", legal_status="citizen", country_of_birth="BR",
            ),
            residency_periods=[ResidencyPeriod(country="Brazil", start_date=date(1955, 6, 12), verified=True)],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", description="Certidao de nascimento", provided=True, verified=True),
                EvidenceItem(evidence_type="tax_record", description="CNIS - contribuicoes INSS 1975-2025", provided=True, verified=True),
            ],
        ),
        CaseBundle(
            id="demo-br-002",
            jurisdiction_id="jur-br-federal",
            applicant=Applicant(
                id="app-br-002", date_of_birth=date(1980, 3, 20),
                legal_name="Ana Lucia Ferreira", legal_status="citizen", country_of_birth="BR",
            ),
            residency_periods=[ResidencyPeriod(country="Brazil", start_date=date(1980, 3, 20), verified=True)],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", description="Certidao de nascimento", provided=True, verified=True),
                EvidenceItem(evidence_type="tax_record", description="CNIS", provided=True),
            ],
        ),
        CaseBundle(
            id="demo-br-003",
            jurisdiction_id="jur-br-federal",
            applicant=Applicant(
                id="app-br-003", date_of_birth=date(1958, 9, 5),
                legal_name="Joao Pedro Oliveira", legal_status="permanent_resident", country_of_birth="PT",
            ),
            residency_periods=[
                ResidencyPeriod(country="Portugal", start_date=date(1958, 9, 5), end_date=date(1995, 1, 1)),
                ResidencyPeriod(country="Brazil", start_date=date(1995, 1, 1), verified=True),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", description="Certidao de nascimento (Portugal, traduzida)", provided=True, verified=True),
                EvidenceItem(evidence_type="tax_record", description="CNIS 1995-2025", provided=True, verified=True),
                EvidenceItem(evidence_type="residency_declaration", description="RNE - Registro Nacional de Estrangeiros", provided=True),
            ],
        ),
        CaseBundle(
            id="demo-br-004",
            jurisdiction_id="jur-br-federal",
            applicant=Applicant(
                id="app-br-004", date_of_birth=date(1950, 12, 1),
                legal_name="Maria das Gracas Costa", legal_status="citizen", country_of_birth="BR",
            ),
            residency_periods=[ResidencyPeriod(country="Brazil", start_date=date(1950, 12, 1))],
            evidence_items=[
                EvidenceItem(evidence_type="tax_record", description="CNIS parcial", provided=True),
            ],
        ),
    ]


# ===================================================================
# SPAIN
# ===================================================================

SPAIN = Jurisdiction(
    id="jur-es-national",
    name="Reino de Espana",
    country="ES",
    level="federal",
    legal_tradition="Civil law (Continental European)",
    language_regime="Castellano (Spanish); co-official languages in autonomous communities",
)

SPAIN_AUTHORITY_CHAIN = [
    AuthorityReference(
        id="auth-es-constitution",
        jurisdiction_id="jur-es-national",
        layer="constitution",
        title="Constitucion Espanola de 1978",
        citation="CE 1978, Art. 41, Art. 50",
        effective_date=date(1978, 12, 29),
        url="https://www.boe.es/buscar/act.php?id=BOE-A-1978-31229",
    ),
    AuthorityReference(
        id="auth-es-lgss",
        jurisdiction_id="jur-es-national",
        layer="act",
        title="Ley General de la Seguridad Social",
        citation="Real Decreto Legislativo 8/2015",
        effective_date=date(2015, 10, 30),
        url="https://www.boe.es/buscar/act.php?id=BOE-A-2015-11724",
        parent_id="auth-es-constitution",
    ),
    AuthorityReference(
        id="auth-es-seg-social",
        jurisdiction_id="jur-es-national",
        layer="program",
        title="Seguridad Social - Instituto Nacional de la Seguridad Social (INSS)",
        citation="LGSS, Art. 1",
        parent_id="auth-es-lgss",
    ),
    AuthorityReference(
        id="auth-es-jubilacion",
        jurisdiction_id="jur-es-national",
        layer="service",
        title="Pension de jubilacion ordinaria",
        citation="LGSS, Arts. 205-209",
        parent_id="auth-es-seg-social",
    ),
]

SPAIN_LEGAL_DOCS = [
    LegalDocument(
        id="doc-es-lgss",
        jurisdiction_id="jur-es-national",
        document_type=DocumentType.STATUTE,
        title="Ley General de la Seguridad Social",
        citation="Real Decreto Legislativo 8/2015",
        effective_date=date(2015, 10, 30),
        sections=[
            LegalSection(
                id="sec-es-art205",
                section_ref="Art. 205.1",
                heading="Pension de jubilacion",
                text=(
                    "Tendran derecho a la pension de jubilacion las personas incluidas en "
                    "el Regimen General que, ademas de la general, reuna la edad de 66 anos "
                    "y 4 meses o 65 anos cuando se acrediten 38 anos y 3 meses de cotizacion."
                ),
            ),
            LegalSection(
                id="sec-es-art205-carencia",
                section_ref="Art. 205.1.b",
                heading="Periodo minimo de cotizacion",
                text=(
                    "Tener cubierto un periodo minimo de cotizacion de 15 anos, de los cuales "
                    "al menos 2 anos deberan estar comprendidos dentro de los 15 anos "
                    "inmediatamente anteriores al momento de causar el derecho."
                ),
            ),
        ],
    ),
]

SPAIN_RULES = [
    LegalRule(
        id="rule-es-age",
        source_document_id="doc-es-lgss",
        source_section_ref="Art. 205.1",
        rule_type=RuleType.AGE_THRESHOLD,
        description="Edad minima de jubilacion: 66 anos y 4 meses (regla general 2025)",
        formal_expression="age >= 66",
        citation="LGSS, Art. 205.1.a",
        param_key_prefix="es.rule.age",
        parameters={"min_age": resolve_param("es.rule.age.min_age")},
    ),
    LegalRule(
        id="rule-es-contribution-min",
        source_document_id="doc-es-lgss",
        source_section_ref="Art. 205.1.b",
        rule_type=RuleType.RESIDENCY_MINIMUM,
        description="Periodo minimo de cotizacion: 15 anos",
        formal_expression="contribution_years >= 15",
        citation="LGSS, Art. 205.1.b",
        param_key_prefix="es.rule.contribution-min",
        parameters={
                "min_years": resolve_param("es.rule.contribution-min.min_years"),
                "home_countries": resolve_param("es.rule.contribution-min.home_countries"),
            },
    ),
    LegalRule(
        id="rule-es-contribution-calc",
        source_document_id="doc-es-lgss",
        source_section_ref="Art. 205.1.b",
        rule_type=RuleType.RESIDENCY_PARTIAL,
        description="Pension completa con 36+ anos de cotizacion; proporcional con 15-35 anos",
        formal_expression="pension_ratio = min(contribution_years, 36) / 36",
        citation="LGSS, Art. 210",
        param_key_prefix="es.rule.contribution-calc",
        parameters={
            "full_years": resolve_param("es.rule.contribution-calc.full_years"),
            "min_years": resolve_param("es.rule.contribution-calc.min_years"),
        },
    ),
    LegalRule(
        id="rule-es-status",
        source_document_id="doc-es-lgss",
        source_section_ref="Art. 205.1",
        rule_type=RuleType.LEGAL_STATUS,
        description="Afiliado al Regimen General de la Seguridad Social",
        formal_expression="legal_status in ['citizen', 'permanent_resident']",
        citation="LGSS, Art. 7",
        param_key_prefix="es.rule.status",
        parameters={"accepted_statuses": resolve_param("es.rule.status.accepted_statuses")},
    ),
    LegalRule(
        id="rule-es-evidence",
        source_document_id="doc-es-lgss",
        source_section_ref="Art. 205.1",
        rule_type=RuleType.EVIDENCE_REQUIRED,
        description="Documento de identidad (DNI, NIE, o pasaporte)",
        formal_expression="has_evidence('birth_certificate') or has_evidence('id_card')",
        citation="LGSS, Disposicion adicional",
        param_key_prefix="es.rule.evidence",
        parameters={"required_types": resolve_param("es.rule.evidence.required_types")},
    ),
]


def _spain_demo_cases() -> list[CaseBundle]:
    return [
        CaseBundle(
            id="demo-es-001",
            jurisdiction_id="jur-es-national",
            applicant=Applicant(
                id="app-es-001", date_of_birth=date(1957, 4, 18),
                legal_name="Antonio Garcia Lopez", legal_status="citizen", country_of_birth="ES",
            ),
            residency_periods=[ResidencyPeriod(country="Spain", start_date=date(1957, 4, 18), verified=True)],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", description="Certificado de nacimiento", provided=True, verified=True),
                EvidenceItem(evidence_type="tax_record", description="Vida laboral - TGSS 1977-2025", provided=True, verified=True),
            ],
        ),
        CaseBundle(
            id="demo-es-002",
            jurisdiction_id="jur-es-national",
            applicant=Applicant(
                id="app-es-002", date_of_birth=date(1970, 11, 3),
                legal_name="Maria Carmen Rodriguez", legal_status="citizen", country_of_birth="ES",
            ),
            residency_periods=[ResidencyPeriod(country="Spain", start_date=date(1970, 11, 3), verified=True)],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", description="Certificado de nacimiento", provided=True, verified=True),
                EvidenceItem(evidence_type="tax_record", description="Vida laboral", provided=True),
            ],
        ),
        CaseBundle(
            id="demo-es-003",
            jurisdiction_id="jur-es-national",
            applicant=Applicant(
                id="app-es-003", date_of_birth=date(1956, 7, 22),
                legal_name="Mohammed El Fassi", legal_status="permanent_resident", country_of_birth="MA",
            ),
            residency_periods=[
                ResidencyPeriod(country="Morocco", start_date=date(1956, 7, 22), end_date=date(2000, 3, 1)),
                ResidencyPeriod(country="Spain", start_date=date(2000, 3, 1), verified=True),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", description="Acta de nacimiento (traducida)", provided=True, verified=True),
                EvidenceItem(evidence_type="tax_record", description="Vida laboral 2000-2025", provided=True, verified=True),
                EvidenceItem(evidence_type="residency_declaration", description="NIE - tarjeta de residencia", provided=True),
            ],
        ),
        CaseBundle(
            id="demo-es-004",
            jurisdiction_id="jur-es-national",
            applicant=Applicant(
                id="app-es-004", date_of_birth=date(1952, 2, 14),
                legal_name="Pilar Fernandez Ruiz", legal_status="citizen", country_of_birth="ES",
            ),
            residency_periods=[ResidencyPeriod(country="Spain", start_date=date(1952, 2, 14))],
            evidence_items=[
                EvidenceItem(evidence_type="tax_record", description="Vida laboral parcial", provided=True),
            ],
        ),
    ]


# ===================================================================
# FRANCE
# ===================================================================

FRANCE = Jurisdiction(
    id="jur-fr-national",
    name="Republique francaise",
    country="FR",
    level="federal",
    legal_tradition="Civil law (Napoleonic code)",
    language_regime="Francais",
)

FRANCE_AUTHORITY_CHAIN = [
    AuthorityReference(
        id="auth-fr-constitution",
        jurisdiction_id="jur-fr-national",
        layer="constitution",
        title="Constitution de la Ve Republique",
        citation="Constitution du 4 octobre 1958, Preambule de 1946, al. 11",
        effective_date=date(1958, 10, 4),
        url="https://www.legifrance.gouv.fr/loda/id/LEGITEXT000006071194",
    ),
    AuthorityReference(
        id="auth-fr-css",
        jurisdiction_id="jur-fr-national",
        layer="act",
        title="Code de la securite sociale",
        citation="CSS, Livre III, Titre V",
        effective_date=date(1985, 1, 1),
        url="https://www.legifrance.gouv.fr/codes/id/LEGITEXT000006073189/",
        parent_id="auth-fr-constitution",
    ),
    AuthorityReference(
        id="auth-fr-reform-2023",
        jurisdiction_id="jur-fr-national",
        layer="act",
        title="Loi de financement rectificative de la securite sociale pour 2023",
        citation="Loi n. 2023-270 du 14 avril 2023",
        effective_date=date(2023, 9, 1),
        parent_id="auth-fr-constitution",
    ),
    AuthorityReference(
        id="auth-fr-cnav",
        jurisdiction_id="jur-fr-national",
        layer="program",
        title="Caisse nationale d'assurance vieillesse (CNAV)",
        citation="CSS, Art. L. 222-1",
        parent_id="auth-fr-css",
    ),
    AuthorityReference(
        id="auth-fr-retraite",
        jurisdiction_id="jur-fr-national",
        layer="service",
        title="Retraite de base - pension de vieillesse",
        citation="CSS, Art. L. 351-1 et seq.",
        parent_id="auth-fr-cnav",
    ),
]

FRANCE_LEGAL_DOCS = [
    LegalDocument(
        id="doc-fr-css",
        jurisdiction_id="jur-fr-national",
        document_type=DocumentType.STATUTE,
        title="Code de la securite sociale",
        citation="CSS, Livre III, Titre V",
        sections=[
            LegalSection(
                id="sec-fr-l351-1",
                section_ref="Art. L. 351-1",
                heading="Conditions d'ouverture du droit",
                text=(
                    "L'assurance vieillesse garantit une pension de retraite a l'assure qui "
                    "en demande la liquidation a partir de l'age de 64 ans. "
                    "(Modifie par Loi n. 2023-270 du 14 avril 2023)"
                ),
            ),
            LegalSection(
                id="sec-fr-l351-1-duree",
                section_ref="Art. L. 351-1, al. 2",
                heading="Duree d'assurance",
                text=(
                    "Le montant de la pension est calcule en fonction de la duree d'assurance, "
                    "avec un taux plein pour 172 trimestres (43 annees) de cotisation."
                ),
            ),
        ],
    ),
]

FRANCE_RULES = [
    LegalRule(
        id="rule-fr-age",
        source_document_id="doc-fr-css",
        source_section_ref="Art. L. 351-1",
        rule_type=RuleType.AGE_THRESHOLD,
        description="Age legal de depart a la retraite : 64 ans (reforme 2023)",
        formal_expression="age >= 64",
        citation="CSS, Art. L. 351-1; Loi n. 2023-270",
        param_key_prefix="fr.rule.age",
        parameters={"min_age": resolve_param("fr.rule.age.min_age")},
    ),
    LegalRule(
        id="rule-fr-trimestres-min",
        source_document_id="doc-fr-css",
        source_section_ref="Art. L. 351-1, al. 2",
        rule_type=RuleType.RESIDENCY_MINIMUM,
        description="Duree minimale d'assurance : 2 ans (8 trimestres) pour ouvrir le droit",
        formal_expression="contribution_years >= 2",
        citation="CSS, Art. L. 351-1",
        param_key_prefix="fr.rule.trimestres-min",
        parameters={
            "min_years": resolve_param("fr.rule.trimestres-min.min_years"),
            "home_countries": resolve_param("fr.rule.trimestres-min.home_countries"),
        },
    ),
    LegalRule(
        id="rule-fr-trimestres-calc",
        source_document_id="doc-fr-css",
        source_section_ref="Art. L. 351-1, al. 2",
        rule_type=RuleType.RESIDENCY_PARTIAL,
        description="Taux plein a 43 ans de cotisation (172 trimestres); proratise en dessous",
        formal_expression="pension_ratio = min(contribution_years, 43) / 43",
        citation="CSS, Art. L. 351-1",
        param_key_prefix="fr.rule.trimestres-calc",
        parameters={
            "full_years": resolve_param("fr.rule.trimestres-calc.full_years"),
            "min_years": resolve_param("fr.rule.trimestres-calc.min_years"),
        },
    ),
    LegalRule(
        id="rule-fr-status",
        source_document_id="doc-fr-css",
        source_section_ref="Art. L. 351-1",
        rule_type=RuleType.LEGAL_STATUS,
        description="Assure du regime general (citoyen ou resident)",
        formal_expression="legal_status in ['citizen', 'permanent_resident']",
        citation="CSS, Art. L. 311-2",
        param_key_prefix="fr.rule.status",
        parameters={"accepted_statuses": resolve_param("fr.rule.status.accepted_statuses")},
    ),
    LegalRule(
        id="rule-fr-evidence",
        source_document_id="doc-fr-css",
        source_section_ref="Art. L. 351-1",
        rule_type=RuleType.EVIDENCE_REQUIRED,
        description="Piece d'identite (acte de naissance, carte d'identite, ou passeport)",
        formal_expression="has_evidence('birth_certificate')",
        citation="CSS, Art. R. 351-1",
        param_key_prefix="fr.rule.evidence",
        parameters={"required_types": resolve_param("fr.rule.evidence.required_types")},
    ),
]


def _france_demo_cases() -> list[CaseBundle]:
    return [
        CaseBundle(
            id="demo-fr-001",
            jurisdiction_id="jur-fr-national",
            applicant=Applicant(
                id="app-fr-001", date_of_birth=date(1958, 5, 20),
                legal_name="Jean-Claude Dupont", legal_status="citizen", country_of_birth="FR",
            ),
            residency_periods=[ResidencyPeriod(country="France", start_date=date(1958, 5, 20), verified=True)],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", description="Acte de naissance", provided=True, verified=True),
                EvidenceItem(evidence_type="tax_record", description="Releve de carriere CNAV 1978-2025", provided=True, verified=True),
            ],
        ),
        CaseBundle(
            id="demo-fr-002",
            jurisdiction_id="jur-fr-national",
            applicant=Applicant(
                id="app-fr-002", date_of_birth=date(1975, 8, 14),
                legal_name="Sophie Martin", legal_status="citizen", country_of_birth="FR",
            ),
            residency_periods=[ResidencyPeriod(country="France", start_date=date(1975, 8, 14), verified=True)],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", description="Acte de naissance", provided=True, verified=True),
                EvidenceItem(evidence_type="tax_record", description="Releve de carriere", provided=True),
            ],
        ),
        CaseBundle(
            id="demo-fr-003",
            jurisdiction_id="jur-fr-national",
            applicant=Applicant(
                id="app-fr-003", date_of_birth=date(1957, 1, 30),
                legal_name="Fatima Benali", legal_status="permanent_resident", country_of_birth="DZ",
            ),
            residency_periods=[
                ResidencyPeriod(country="Algeria", start_date=date(1957, 1, 30), end_date=date(1990, 6, 1)),
                ResidencyPeriod(country="France", start_date=date(1990, 6, 1), verified=True),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", description="Acte de naissance (traduit)", provided=True, verified=True),
                EvidenceItem(evidence_type="tax_record", description="Releve de carriere CNAV 1990-2025", provided=True, verified=True),
                EvidenceItem(evidence_type="residency_declaration", description="Titre de sejour", provided=True),
            ],
        ),
        CaseBundle(
            id="demo-fr-004",
            jurisdiction_id="jur-fr-national",
            applicant=Applicant(
                id="app-fr-004", date_of_birth=date(1953, 11, 7),
                legal_name="Pierre Lefevre", legal_status="citizen", country_of_birth="FR",
            ),
            residency_periods=[ResidencyPeriod(country="France", start_date=date(1953, 11, 7))],
            evidence_items=[
                EvidenceItem(evidence_type="tax_record", description="Releve partiel", provided=True),
            ],
        ),
    ]


# ===================================================================
# GERMANY
# ===================================================================

GERMANY = Jurisdiction(
    id="jur-de-federal",
    name="Bundesrepublik Deutschland",
    country="DE",
    level="federal",
    legal_tradition="Civil law (Germanic tradition)",
    language_regime="Deutsch",
)

GERMANY_AUTHORITY_CHAIN = [
    AuthorityReference(
        id="auth-de-grundgesetz",
        jurisdiction_id="jur-de-federal",
        layer="constitution",
        title="Grundgesetz für die Bundesrepublik Deutschland",
        citation="GG, Art. 20 Abs. 1 (Sozialstaatsprinzip)",
        effective_date=date(1949, 5, 23),
        url="https://www.gesetze-im-internet.de/gg/",
    ),
    AuthorityReference(
        id="auth-de-sgb6",
        jurisdiction_id="jur-de-federal",
        layer="act",
        title="Sozialgesetzbuch Sechstes Buch - Gesetzliche Rentenversicherung",
        citation="SGB VI",
        effective_date=date(1992, 1, 1),
        url="https://www.gesetze-im-internet.de/sgb_6/",
        parent_id="auth-de-grundgesetz",
    ),
    AuthorityReference(
        id="auth-de-drv",
        jurisdiction_id="jur-de-federal",
        layer="program",
        title="Deutsche Rentenversicherung (DRV)",
        citation="SGB VI, §§ 125 ff. (Träger der Rentenversicherung)",
        parent_id="auth-de-sgb6",
    ),
    AuthorityReference(
        id="auth-de-regelaltersrente",
        jurisdiction_id="jur-de-federal",
        layer="service",
        title="Regelaltersrente",
        citation="SGB VI, Para. 35, Para. 235",
        parent_id="auth-de-drv",
    ),
]

GERMANY_LEGAL_DOCS = [
    LegalDocument(
        id="doc-de-sgb6",
        jurisdiction_id="jur-de-federal",
        document_type=DocumentType.STATUTE,
        title="Sozialgesetzbuch Sechstes Buch (SGB VI)",
        citation="SGB VI",
        effective_date=date(1992, 1, 1),
        sections=[
            LegalSection(
                id="sec-de-p35",
                section_ref="Para. 35",
                heading="Regelaltersrente",
                text=(
                    "Versicherte haben Anspruch auf Regelaltersrente, wenn sie die "
                    "Regelaltersgrenze erreicht und die allgemeine Wartezeit von "
                    "fünf Jahren erfüllt haben."
                ),
            ),
            LegalSection(
                id="sec-de-p235",
                section_ref="Para. 235",
                heading="Regelaltersgrenze",
                text=(
                    "Die Regelaltersgrenze wird ab dem Geburtsjahrgang 1964 auf "
                    "67 Jahre angehoben (stufenweise Anhebung von 65 auf 67 Jahre)."
                ),
            ),
        ],
    ),
]

GERMANY_RULES = [
    LegalRule(
        id="rule-de-age",
        source_document_id="doc-de-sgb6",
        source_section_ref="Para. 35, Para. 235",
        rule_type=RuleType.AGE_THRESHOLD,
        # Modelled at the 67-year endpoint. § 235 SGB VI prescribes a graduated
        # transition for cohorts 1947–1963 (Regelaltersgrenze 65y1m–66y10m);
        # the cohort-aware lookup is deferred to Phase 10B with RuleType.CALCULATION.
        description="Regelaltersgrenze: 67 Jahre (Jahrgang 1964 und später)",
        formal_expression="age >= 67",
        citation="SGB VI, § 35, § 235",
        param_key_prefix="de.rule.age",
        parameters={"min_age": resolve_param("de.rule.age.min_age")},
    ),
    LegalRule(
        id="rule-de-wartezeit",
        source_document_id="doc-de-sgb6",
        source_section_ref="Para. 35",
        rule_type=RuleType.RESIDENCY_MINIMUM,
        description="Allgemeine Wartezeit: mindestens 5 Jahre Beitragszeit",
        formal_expression="contribution_years >= 5",
        citation="SGB VI, § 35, § 50",
        param_key_prefix="de.rule.wartezeit",
        parameters={
                "min_years": resolve_param("de.rule.wartezeit.min_years"),
                "home_countries": resolve_param("de.rule.wartezeit.home_countries"),
            },
    ),
    LegalRule(
        id="rule-de-beitragszeit",
        source_document_id="doc-de-sgb6",
        source_section_ref="§ 64",
        rule_type=RuleType.RESIDENCY_PARTIAL,
        # Modelled simplification: the pro-ration shape (45 → full, 5–44 → partial)
        # is a coarse stand-in for the German Rentenformel — pension amount is
        # actually the product of Entgeltpunkte × Zugangsfaktor × aktueller
        # Rentenwert, cited in § 64 SGB VI. The 45-year threshold separately
        # unlocks the *Altersrente für besonders langjährig Versicherte* under
        # § 236b SGB VI (earlier retirement, not a higher percentage). The full
        # formula lands in Phase 10B with RuleType.CALCULATION.
        description="Anteilige Rente nach Rentenformel (vereinfacht: bis 45 Beitragsjahre)",
        formal_expression="pension_ratio = min(contribution_years, 45) / 45",
        citation="SGB VI, § 64 (Rentenformel); vgl. § 236b (besonders langjährig Versicherte)",
        param_key_prefix="de.rule.beitragszeit",
        parameters={
            "full_years": resolve_param("de.rule.beitragszeit.full_years"),
            "min_years": resolve_param("de.rule.beitragszeit.min_years"),
        },
    ),
    LegalRule(
        id="rule-de-status",
        source_document_id="doc-de-sgb6",
        source_section_ref="§ 1",
        rule_type=RuleType.LEGAL_STATUS,
        # Modelled simplification: German pension entitlement under § 1 SGB VI
        # is contribution-based (you must be/have been a *Versicherter* through
        # employment or equivalent activity), not status-based. We use legal_status
        # here as a coarse proxy across all six jurisdictions; for DE the
        # accurate gate is a verified Versicherungsverlauf, which the engine
        # reads from rule-de-evidence + rule-de-wartezeit. RuleType.INSURED_STATUS
        # would replace this proxy if added in a later phase.
        description="Versicherter der gesetzlichen Rentenversicherung (Proxy: legal_status)",
        formal_expression="legal_status in ['citizen', 'permanent_resident']",
        citation="SGB VI, § 1 (Versicherungspflichtige Personen)",
        param_key_prefix="de.rule.status",
        parameters={"accepted_statuses": resolve_param("de.rule.status.accepted_statuses")},
    ),
    LegalRule(
        id="rule-de-evidence",
        source_document_id="doc-de-sgb6",
        source_section_ref="§ 99 SGB VI; §§ 60–65 SGB I",
        rule_type=RuleType.EVIDENCE_REQUIRED,
        description="Personalausweis oder Reisepass, Geburtsurkunde (Mitwirkungspflicht)",
        formal_expression="has_evidence('birth_certificate') or has_evidence('id_card')",
        citation="SGB I, §§ 60–65 (Mitwirkungspflichten); SGB VI, § 99 (Beginn der Rente)",
        param_key_prefix="de.rule.evidence",
        parameters={"required_types": resolve_param("de.rule.evidence.required_types")},
    ),
]


def _germany_demo_cases() -> list[CaseBundle]:
    return [
        CaseBundle(
            id="demo-de-001",
            jurisdiction_id="jur-de-federal",
            applicant=Applicant(
                id="app-de-001", date_of_birth=date(1957, 3, 10),
                legal_name="Hans Mueller", legal_status="citizen", country_of_birth="DE",
            ),
            residency_periods=[ResidencyPeriod(country="Germany", start_date=date(1957, 3, 10), verified=True)],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", description="Geburtsurkunde", provided=True, verified=True),
                EvidenceItem(evidence_type="tax_record", description="Versicherungsverlauf DRV 1977-2025", provided=True, verified=True),
            ],
        ),
        CaseBundle(
            id="demo-de-002",
            jurisdiction_id="jur-de-federal",
            applicant=Applicant(
                id="app-de-002", date_of_birth=date(1972, 6, 25),
                legal_name="Petra Schmidt", legal_status="citizen", country_of_birth="DE",
            ),
            residency_periods=[ResidencyPeriod(country="Germany", start_date=date(1972, 6, 25), verified=True)],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", description="Geburtsurkunde", provided=True, verified=True),
                EvidenceItem(evidence_type="tax_record", description="Versicherungsverlauf", provided=True),
            ],
        ),
        CaseBundle(
            id="demo-de-003",
            jurisdiction_id="jur-de-federal",
            applicant=Applicant(
                id="app-de-003", date_of_birth=date(1956, 9, 15),
                legal_name="Mehmet Yilmaz", legal_status="permanent_resident", country_of_birth="TR",
            ),
            residency_periods=[
                ResidencyPeriod(country="Turkey", start_date=date(1956, 9, 15), end_date=date(1985, 4, 1)),
                ResidencyPeriod(country="Germany", start_date=date(1985, 4, 1), verified=True),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", description="Geburtsurkunde (übersetzt)", provided=True, verified=True),
                EvidenceItem(evidence_type="tax_record", description="Versicherungsverlauf DRV 1985-2025", provided=True, verified=True),
                EvidenceItem(evidence_type="residency_declaration", description="Aufenthaltstitel", provided=True),
            ],
        ),
        CaseBundle(
            id="demo-de-004",
            jurisdiction_id="jur-de-federal",
            applicant=Applicant(
                id="app-de-004", date_of_birth=date(1950, 8, 3),
                legal_name="Ingrid Weber", legal_status="citizen", country_of_birth="DE",
            ),
            residency_periods=[ResidencyPeriod(country="Germany", start_date=date(1950, 8, 3))],
            evidence_items=[
                EvidenceItem(evidence_type="tax_record", description="Versicherungsverlauf (unvollständig)", provided=True),
            ],
        ),
    ]


# ===================================================================
# UKRAINE
# ===================================================================

UKRAINE = Jurisdiction(
    id="jur-ua-national",
    name="Ukraina",
    country="UA",
    level="federal",
    legal_tradition="Civil law (Continental European / post-Soviet)",
    language_regime="Ukrainska mova (Ukrainian)",
)

UKRAINE_AUTHORITY_CHAIN = [
    AuthorityReference(
        id="auth-ua-constitution",
        jurisdiction_id="jur-ua-national",
        layer="constitution",
        title="Konstytutsiia Ukrainy",
        citation="Konstytutsiia Ukrainy, st. 46",
        effective_date=date(1996, 6, 28),
        url="https://zakon.rada.gov.ua/laws/show/254%D0%BA/96-%D0%B2%D1%80",
    ),
    AuthorityReference(
        id="auth-ua-pension-law",
        jurisdiction_id="jur-ua-national",
        layer="act",
        title="Zakon Ukrainy 'Pro zahalnooboviazkove derzhavne pensiine strakhuvannia'",
        citation="Zakon No. 1058-IV vid 09.07.2003",
        effective_date=date(2004, 1, 1),
        url="https://zakon.rada.gov.ua/laws/show/1058-15",
        parent_id="auth-ua-constitution",
    ),
    AuthorityReference(
        id="auth-ua-pfu",
        jurisdiction_id="jur-ua-national",
        layer="program",
        title="Pensiinyi fond Ukrainy (PFU)",
        citation="Zakon No. 1058-IV, Rozdil VIII",
        parent_id="auth-ua-pension-law",
    ),
    AuthorityReference(
        id="auth-ua-pension-age",
        jurisdiction_id="jur-ua-national",
        layer="service",
        title="Pensiia za vikom (starosna pensiia)",
        citation="Zakon No. 1058-IV, st. 26",
        parent_id="auth-ua-pfu",
    ),
]

UKRAINE_LEGAL_DOCS = [
    LegalDocument(
        id="doc-ua-pension-law",
        jurisdiction_id="jur-ua-national",
        document_type=DocumentType.STATUTE,
        title="Zakon Ukrainy 'Pro zahalnooboviazkove derzhavne pensiine strakhuvannia'",
        citation="Zakon No. 1058-IV vid 09.07.2003",
        effective_date=date(2004, 1, 1),
        sections=[
            LegalSection(
                id="sec-ua-st26",
                section_ref="st. 26",
                heading="Umovy pryznachennia pensii za vikom",
                text=(
                    "Pravo na pensiiu za vikom maie osoba, yaka dosiahla 60 rokiv ta maie "
                    "strakhovyi stazh ne menshe 25 rokiv (choloviky) abo 20 rokiv (zhinky) "
                    "na 1 sichnia 2028 roku."
                ),
            ),
            LegalSection(
                id="sec-ua-st28",
                section_ref="st. 28",
                heading="Rozmir pensii za vikom",
                text=(
                    "Rozmir pensii za vikom vyznachaietsia za formuloiu: "
                    "P = Zs x Ks x Kv, de Zs - zarobitna plata, Ks - koefitsiient "
                    "strakhovoho stazhu, Kv - koefitsiient viku."
                ),
            ),
        ],
    ),
]

UKRAINE_RULES = [
    LegalRule(
        id="rule-ua-age",
        source_document_id="doc-ua-pension-law",
        source_section_ref="st. 26",
        rule_type=RuleType.AGE_THRESHOLD,
        description="Pensiinyi vik: 60 rokiv",
        formal_expression="age >= 60",
        citation="Zakon No. 1058-IV, st. 26",
        param_key_prefix="ua.rule.age",
        parameters={"min_age": resolve_param("ua.rule.age.min_age")},
    ),
    LegalRule(
        id="rule-ua-stazh-min",
        source_document_id="doc-ua-pension-law",
        source_section_ref="st. 26",
        rule_type=RuleType.RESIDENCY_MINIMUM,
        description="Minimalnyi strakhovyi stazh: 25 rokiv (choloviky)",
        formal_expression="contribution_years >= 25",
        citation="Zakon No. 1058-IV, st. 26",
        param_key_prefix="ua.rule.stazh-min",
        parameters={
            "min_years": resolve_param("ua.rule.stazh-min.min_years"),
            "home_countries": resolve_param("ua.rule.stazh-min.home_countries"),
        },
    ),
    LegalRule(
        id="rule-ua-stazh-calc",
        source_document_id="doc-ua-pension-law",
        source_section_ref="st. 28",
        rule_type=RuleType.RESIDENCY_PARTIAL,
        description="Povna pensiia z 35+ rokamy stazhu; proportsionalna z 25-34 rokamy",
        formal_expression="pension_ratio = min(contribution_years, 35) / 35",
        citation="Zakon No. 1058-IV, st. 28",
        param_key_prefix="ua.rule.stazh-calc",
        parameters={
            "full_years": resolve_param("ua.rule.stazh-calc.full_years"),
            "min_years": resolve_param("ua.rule.stazh-calc.min_years"),
        },
    ),
    LegalRule(
        id="rule-ua-status",
        source_document_id="doc-ua-pension-law",
        source_section_ref="st. 26",
        rule_type=RuleType.LEGAL_STATUS,
        description="Hromadianyn Ukrainy abo osoba z postiinymy pravom na prozhyvannia",
        formal_expression="legal_status in ['citizen', 'permanent_resident']",
        citation="Zakon No. 1058-IV, st. 4",
        param_key_prefix="ua.rule.status",
        parameters={"accepted_statuses": resolve_param("ua.rule.status.accepted_statuses")},
    ),
    LegalRule(
        id="rule-ua-evidence",
        source_document_id="doc-ua-pension-law",
        source_section_ref="st. 26",
        rule_type=RuleType.EVIDENCE_REQUIRED,
        description="Pasport hromadianyna Ukrainy abo svidotstvo pro narodzhennia",
        formal_expression="has_evidence('birth_certificate') or has_evidence('passport')",
        citation="Zakon No. 1058-IV, st. 45",
        param_key_prefix="ua.rule.evidence",
        parameters={"required_types": resolve_param("ua.rule.evidence.required_types")},
    ),
]


def _ukraine_demo_cases() -> list[CaseBundle]:
    return [
        CaseBundle(
            id="demo-ua-001",
            jurisdiction_id="jur-ua-national",
            applicant=Applicant(
                id="app-ua-001", date_of_birth=date(1960, 4, 22),
                legal_name="Oleksandr Kovalenko", legal_status="citizen", country_of_birth="UA",
            ),
            residency_periods=[ResidencyPeriod(country="Ukraine", start_date=date(1960, 4, 22), verified=True)],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", description="Svidotstvo pro narodzhennia", provided=True, verified=True),
                EvidenceItem(evidence_type="tax_record", description="Dovidka pro strakhovyi stazh PFU 1980-2025", provided=True, verified=True),
            ],
        ),
        CaseBundle(
            id="demo-ua-002",
            jurisdiction_id="jur-ua-national",
            applicant=Applicant(
                id="app-ua-002", date_of_birth=date(1978, 12, 5),
                legal_name="Nataliia Shevchenko", legal_status="citizen", country_of_birth="UA",
            ),
            residency_periods=[ResidencyPeriod(country="Ukraine", start_date=date(1978, 12, 5), verified=True)],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", description="Svidotstvo pro narodzhennia", provided=True, verified=True),
                EvidenceItem(evidence_type="tax_record", description="Dovidka PFU", provided=True),
            ],
        ),
        CaseBundle(
            id="demo-ua-003",
            jurisdiction_id="jur-ua-national",
            applicant=Applicant(
                id="app-ua-003", date_of_birth=date(1959, 7, 18),
                legal_name="Vasyl Bondarenko", legal_status="citizen", country_of_birth="UA",
            ),
            residency_periods=[
                ResidencyPeriod(country="Ukraine", start_date=date(1959, 7, 18), end_date=date(2005, 1, 1)),
                ResidencyPeriod(country="Poland", start_date=date(2005, 1, 1), end_date=date(2015, 6, 1)),
                ResidencyPeriod(country="Ukraine", start_date=date(2015, 6, 1), verified=True),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", description="Svidotstvo pro narodzhennia", provided=True, verified=True),
                EvidenceItem(evidence_type="tax_record", description="Dovidka PFU (neповна)", provided=True, verified=True),
                EvidenceItem(evidence_type="residency_declaration", description="Dovidka pro prozhyvannia", provided=True),
            ],
        ),
        CaseBundle(
            id="demo-ua-004",
            jurisdiction_id="jur-ua-national",
            applicant=Applicant(
                id="app-ua-004", date_of_birth=date(1955, 2, 28),
                legal_name="Halyna Tkachenko", legal_status="citizen", country_of_birth="UA",
            ),
            residency_periods=[ResidencyPeriod(country="Ukraine", start_date=date(1955, 2, 28))],
            evidence_items=[
                EvidenceItem(evidence_type="tax_record", description="Dovidka PFU (chastkova)", provided=True),
            ],
        ),
    ]


# ===================================================================
# JAPAN
# ===================================================================

JAPAN = Jurisdiction(
    id="jur-jp-national",
    name="Nihon-koku (Japan)",
    country="JP",
    level="federal",
    legal_tradition="Civil law (Japanese hybrid; German + French + post-war common-law influence)",
    language_regime="Nihongo (Japanese)",
)

JAPAN_AUTHORITY_CHAIN = [
    AuthorityReference(
        id="auth-jp-constitution",
        jurisdiction_id="jur-jp-national",
        layer="constitution",
        title="Nihon-koku Kenpo (Constitution of Japan)",
        citation="Kenpo, Art. 25 (right to maintain minimum standards of living)",
        effective_date=date(1947, 5, 3),
        url="https://elaws.e-gov.go.jp/document?lawid=321CONSTITUTION",
    ),
    AuthorityReference(
        id="auth-jp-kokumin-nenkin-ho",
        jurisdiction_id="jur-jp-national",
        layer="act",
        title="Kokumin Nenkin Ho (National Pension Act)",
        citation="Showa 34-nen Horitsu Dai 141-go (1959 Act No. 141)",
        effective_date=date(1961, 4, 1),
        url="https://elaws.e-gov.go.jp/document?lawid=334AC0000000141",
        parent_id="auth-jp-constitution",
    ),
    AuthorityReference(
        id="auth-jp-kosei-nenkin-ho",
        jurisdiction_id="jur-jp-national",
        layer="act",
        title="Kosei Nenkin Hoken Ho (Employees' Pension Insurance Act)",
        citation="Showa 29-nen Horitsu Dai 115-go (1954 Act No. 115)",
        effective_date=date(1954, 5, 19),
        url="https://elaws.e-gov.go.jp/document?lawid=329AC0000000115",
        parent_id="auth-jp-constitution",
    ),
    AuthorityReference(
        id="auth-jp-act-84-2017",
        jurisdiction_id="jur-jp-national",
        layer="act",
        title="Heisei 29-nen Horitsu Dai 84-go (Act No. 84, 2017) — qualifying-period reduction",
        citation="Heisei 29-nen Horitsu Dai 84-go",
        effective_date=date(2017, 8, 1),
        parent_id="auth-jp-constitution",
    ),
    AuthorityReference(
        id="auth-jp-nenkin-kiko",
        jurisdiction_id="jur-jp-national",
        layer="program",
        title="Nihon Nenkin Kiko (Japan Pension Service)",
        citation="Nihon Nenkin Kiko Ho (2007 Act No. 109)",
        parent_id="auth-jp-kosei-nenkin-ho",
    ),
    AuthorityReference(
        id="auth-jp-rourei-kiso",
        jurisdiction_id="jur-jp-national",
        layer="service",
        title="Rourei Kiso Nenkin / Rourei Kosei Nenkin (Old-age Basic + Employees' Pension)",
        citation="Kokumin Nenkin Ho, Art. 26; Kosei Nenkin Hoken Ho, Art. 42",
        parent_id="auth-jp-nenkin-kiko",
    ),
]

JAPAN_LEGAL_DOCS = [
    LegalDocument(
        id="doc-jp-kokumin-nenkin",
        jurisdiction_id="jur-jp-national",
        document_type=DocumentType.STATUTE,
        title="Kokumin Nenkin Ho (National Pension Act)",
        citation="Showa 34-nen Horitsu Dai 141-go",
        effective_date=date(1961, 4, 1),
        sections=[
            LegalSection(
                id="sec-jp-kn-art26",
                section_ref="Art. 26",
                heading="Rourei kiso nenkin no shikyu yoken (Old-age Basic Pension eligibility)",
                text=(
                    "Rourei kiso nenkin wa, hokenryo nofu zumi kikan to hokenryo "
                    "menjo kikan o gassan shita kikan ga 10-nen ijo de aru mono ga "
                    "65-sai ni tasshita toki ni, sono mono ni shikyu suru. "
                    "(Heisei 29-nen Horitsu Dai 84-go ni yori 25-nen kara 10-nen "
                    "ni tanshuku.)"
                ),
            ),
            LegalSection(
                id="sec-jp-kn-art27",
                section_ref="Art. 27",
                heading="Rourei kiso nenkin no gaku (Old-age Basic Pension amount)",
                text=(
                    "Rourei kiso nenkin no gaku wa, hokenryo nofu kikan ga 480-getsu "
                    "(40-nen) ni tassuru baai ni mangaku to shi, sore yori mijikai "
                    "kikan ni tsuite wa kikan ni hirei shita gaku to suru. "
                    "Reiwa 8-nendo no mangaku wa tsukigaku 70,608-en (Showa 31-nen "
                    "4-gatsu 2-nichi iko umare no baai)."
                ),
            ),
        ],
    ),
    LegalDocument(
        id="doc-jp-kosei-nenkin",
        jurisdiction_id="jur-jp-national",
        document_type=DocumentType.STATUTE,
        title="Kosei Nenkin Hoken Ho (Employees' Pension Insurance Act)",
        citation="Showa 29-nen Horitsu Dai 115-go",
        effective_date=date(1954, 5, 19),
        sections=[
            LegalSection(
                id="sec-jp-kn-art42",
                section_ref="Art. 42",
                heading="Rourei kosei nenkin no shikyu yoken (Old-age Employees' Pension eligibility)",
                text=(
                    "Rourei kosei nenkin wa, hihokensha kikan o yusuru mono ga "
                    "Kokumin Nenkin Ho no rourei kiso nenkin no jukyu shikaku o "
                    "ete, 65-sai ni tasshita toki ni shikyu suru."
                ),
            ),
        ],
    ),
]

JAPAN_RULES = [
    LegalRule(
        id="rule-jp-age",
        source_document_id="doc-jp-kokumin-nenkin",
        source_section_ref="Art. 26",
        rule_type=RuleType.AGE_THRESHOLD,
        description="Standard pensionable age: 65",
        formal_expression="age >= 65",
        citation="Kokumin Nenkin Ho, Art. 26; Kosei Nenkin Hoken Ho, Art. 42",
        param_key_prefix="jp.rule.age",
        parameters={"min_age": resolve_param("jp.rule.age.min_age")},
    ),
    LegalRule(
        id="rule-jp-contribution",
        source_document_id="doc-jp-kokumin-nenkin",
        source_section_ref="Art. 26",
        rule_type=RuleType.RESIDENCY_MINIMUM,
        description="Minimum qualifying period: 10 years (reduced from 25 by Act No. 84, 2017)",
        formal_expression="contribution_years >= 10",
        citation="Kokumin Nenkin Ho, Art. 26; Heisei 29-nen Horitsu Dai 84-go",
        param_key_prefix="jp.rule.contribution",
        parameters={
            "min_years": resolve_param("jp.rule.contribution.min_years"),
            "home_countries": resolve_param("jp.rule.contribution.home_countries"),
        },
    ),
    LegalRule(
        id="rule-jp-contribution-calc",
        source_document_id="doc-jp-kokumin-nenkin",
        source_section_ref="Art. 27",
        rule_type=RuleType.RESIDENCY_PARTIAL,
        description="Full pension at 40 years (480 months); proportional between 10 and 40 years",
        formal_expression="pension_ratio = min(contribution_years, 40) / 40",
        citation="Kokumin Nenkin Ho, Art. 27",
        param_key_prefix="jp.rule.contribution-calc",
        parameters={
            "full_years": resolve_param("jp.rule.contribution-calc.full_years"),
            "min_years": resolve_param("jp.rule.contribution-calc.min_years"),
        },
    ),
    LegalRule(
        id="rule-jp-status",
        source_document_id="doc-jp-kosei-nenkin",
        source_section_ref="Art. 9",
        rule_type=RuleType.LEGAL_STATUS,
        # Modelled simplification: Japanese pension entitlement under
        # Kosei Nenkin Hoken Ho Art. 9 is contribution-based (you must
        # be / have been a hihokensha through covered employment), not
        # status-based. We use legal_status here as the same coarse proxy
        # as Germany; the accurate gate is a verified hihokensha record,
        # which the engine reads from rule-jp-evidence + rule-jp-contribution.
        description="Hihokensha of the Japanese pension system (proxy: legal_status)",
        formal_expression="legal_status in ['citizen', 'permanent_resident']",
        citation="Kokumin Nenkin Ho, Art. 7; Kosei Nenkin Hoken Ho, Art. 9",
        param_key_prefix="jp.rule.status",
        parameters={"accepted_statuses": resolve_param("jp.rule.status.accepted_statuses")},
    ),
    LegalRule(
        id="rule-jp-evidence",
        source_document_id="doc-jp-kokumin-nenkin",
        source_section_ref="Art. 16 (Sekorei kisoku) / Kosei Nenkin Hoken Ho Sekorei kisoku Art. 30",
        rule_type=RuleType.EVIDENCE_REQUIRED,
        # Modelled simplification matching BR/ES/DE: the engine enforces
        # an AND-required-types check, so the substrate stores one
        # canonical identity document. Residence card (zairyu card /
        # juminhyo) is recognised in practice but maps to the same slot
        # — see lawcode/jp/config/rules.yaml rationale.
        description="Birth certificate (koseki tohon)",
        formal_expression="has_evidence('birth_certificate')",
        citation="Kokumin Nenkin Ho Sekorei kisoku, Art. 16; Kosei Nenkin Hoken Ho Sekorei kisoku, Art. 30",
        param_key_prefix="jp.rule.evidence",
        parameters={"required_types": resolve_param("jp.rule.evidence.required_types")},
    ),
]


def _japan_demo_cases() -> list[CaseBundle]:
    return [
        # Eligible — full pension. 65y old, lifelong JP resident, complete
        # contribution record from age 20 (45 years > 40-year threshold),
        # full identity evidence.
        CaseBundle(
            id="demo-jp-001",
            jurisdiction_id="jur-jp-national",
            applicant=Applicant(
                id="app-jp-001", date_of_birth=date(1958, 11, 4),
                legal_name="Tanaka Hiroshi", legal_status="citizen", country_of_birth="JP",
            ),
            residency_periods=[ResidencyPeriod(country="Japan", start_date=date(1958, 11, 4), verified=True)],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", description="Koseki tohon", provided=True, verified=True),
                EvidenceItem(evidence_type="tax_record", description="Nenkin teikibin (Nihon Nenkin Kiko) 1980-2025", provided=True, verified=True),
            ],
        ),
        # Under age — ineligible. 45y old, full evidence, but age threshold not met.
        CaseBundle(
            id="demo-jp-002",
            jurisdiction_id="jur-jp-national",
            applicant=Applicant(
                id="app-jp-002", date_of_birth=date(1981, 2, 19),
                legal_name="Sato Yuki", legal_status="citizen", country_of_birth="JP",
            ),
            residency_periods=[ResidencyPeriod(country="Japan", start_date=date(1981, 2, 19), verified=True)],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", description="Koseki tohon", provided=True, verified=True),
                EvidenceItem(evidence_type="tax_record", description="Nenkin teikibin", provided=True),
            ],
        ),
        # Partial pension — 67y old, immigrated 2010, ~15 years of qualifying
        # contribution period (>10 minimum, <40 full). Status: permanent
        # resident. Full evidence including residence card.
        CaseBundle(
            id="demo-jp-003",
            jurisdiction_id="jur-jp-national",
            applicant=Applicant(
                id="app-jp-003", date_of_birth=date(1957, 8, 12),
                legal_name="Kim Min-jun", legal_status="permanent_resident", country_of_birth="KR",
            ),
            residency_periods=[
                ResidencyPeriod(country="Korea", start_date=date(1957, 8, 12), end_date=date(2010, 4, 1)),
                ResidencyPeriod(country="Japan", start_date=date(2010, 4, 1), verified=True),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", description="Birth certificate (Korean, translated)", provided=True, verified=True),
                EvidenceItem(evidence_type="residence_card", description="Zairyu card (special permanent resident)", provided=True, verified=True),
                EvidenceItem(evidence_type="tax_record", description="Nenkin teikibin 2010-2025", provided=True, verified=True),
            ],
        ),
        # Insufficient evidence — 68y old, citizen, but only a partial tax
        # record provided; no birth certificate or residence card.
        CaseBundle(
            id="demo-jp-004",
            jurisdiction_id="jur-jp-national",
            applicant=Applicant(
                id="app-jp-004", date_of_birth=date(1956, 5, 30),
                legal_name="Watanabe Aiko", legal_status="citizen", country_of_birth="JP",
            ),
            residency_periods=[ResidencyPeriod(country="Japan", start_date=date(1956, 5, 30))],
            evidence_items=[
                EvidenceItem(evidence_type="tax_record", description="Nenkin teikibin (incomplete)", provided=True),
            ],
        ),
    ]


# ===================================================================
# Registry
# ===================================================================

class JurisdictionPack:
    """All data needed to run a jurisdiction demo."""
    def __init__(
        self,
        jurisdiction: Jurisdiction,
        authority_chain: list[AuthorityReference],
        legal_documents: list[LegalDocument],
        rules: list[LegalRule],
        cases_factory: Callable[[], list[CaseBundle]],
        default_language: str,
        program_name: str,
    ):
        self.jurisdiction = jurisdiction
        self.authority_chain = authority_chain
        self.legal_documents = legal_documents
        self.rules = rules
        self.cases_factory = cases_factory
        self.default_language = default_language
        self.program_name = program_name

    def make_cases(self) -> list[CaseBundle]:
        return self.cases_factory()


# Late import: seed.py imports from this module, so importing at top would cycle.
from govops.seed import (  # noqa: E402
    AUTHORITY_CHAIN as CA_AUTHORITY_CHAIN,
    CANADA_FEDERAL,
    LEGAL_DOCUMENTS as CA_LEGAL_DOCUMENTS,
    OAS_RULES as CA_RULES,
    make_demo_cases as _ca_demo_cases,
)

JURISDICTION_REGISTRY: dict[str, JurisdictionPack] = {
    "ca": JurisdictionPack(
        jurisdiction=CANADA_FEDERAL,
        authority_chain=CA_AUTHORITY_CHAIN,
        legal_documents=CA_LEGAL_DOCUMENTS,
        rules=CA_RULES,
        cases_factory=_ca_demo_cases,
        default_language="en",
        program_name="Old Age Security (OAS)",
    ),
    "br": JurisdictionPack(
        jurisdiction=BRAZIL_FEDERAL,
        authority_chain=BRAZIL_AUTHORITY_CHAIN,
        legal_documents=BRAZIL_LEGAL_DOCS,
        rules=BRAZIL_RULES,
        cases_factory=_brazil_demo_cases,
        default_language="pt",
        program_name="Aposentadoria por Idade (INSS)",
    ),
    "es": JurisdictionPack(
        jurisdiction=SPAIN,
        authority_chain=SPAIN_AUTHORITY_CHAIN,
        legal_documents=SPAIN_LEGAL_DOCS,
        rules=SPAIN_RULES,
        cases_factory=_spain_demo_cases,
        default_language="es",
        program_name="Pension de jubilacion",
    ),
    "fr": JurisdictionPack(
        jurisdiction=FRANCE,
        authority_chain=FRANCE_AUTHORITY_CHAIN,
        legal_documents=FRANCE_LEGAL_DOCS,
        rules=FRANCE_RULES,
        cases_factory=_france_demo_cases,
        default_language="fr",
        program_name="Retraite de base (CNAV)",
    ),
    "de": JurisdictionPack(
        jurisdiction=GERMANY,
        authority_chain=GERMANY_AUTHORITY_CHAIN,
        legal_documents=GERMANY_LEGAL_DOCS,
        rules=GERMANY_RULES,
        cases_factory=_germany_demo_cases,
        default_language="de",
        program_name="Regelaltersrente (DRV)",
    ),
    "ua": JurisdictionPack(
        jurisdiction=UKRAINE,
        authority_chain=UKRAINE_AUTHORITY_CHAIN,
        legal_documents=UKRAINE_LEGAL_DOCS,
        rules=UKRAINE_RULES,
        cases_factory=_ukraine_demo_cases,
        default_language="uk",
        program_name="Pensiia za vikom (PFU)",
    ),
    "jp": JurisdictionPack(
        jurisdiction=JAPAN,
        authority_chain=JAPAN_AUTHORITY_CHAIN,
        legal_documents=JAPAN_LEGAL_DOCS,
        rules=JAPAN_RULES,
        cases_factory=_japan_demo_cases,
        # PLAN §11 forbids new languages; jp falls back to en across the
        # 6 supported locales. Native-script labels (e.g. program_name)
        # stay in romaji here and are not translated, mirroring the BR
        # / ES precedent of leaving program identifiers untranslated.
        default_language="en",
        program_name="Kosei Nenkin Hoken (Employees' Pension Insurance)",
    ),
}
