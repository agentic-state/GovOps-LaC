"""Internationalization support for GovOps.

Supported languages: en, fr, pt, es, de, uk
"""

from __future__ import annotations

SUPPORTED_LANGUAGES = {
    "en": "English",
    "fr": "Francais",
    "pt": "Portugues",
    "es": "Espanol",
    "de": "Deutsch",
    "uk": "Ukrainska",
}

DEFAULT_LANGUAGE = "en"

# ---------------------------------------------------------------------------
# Translation strings
# ---------------------------------------------------------------------------

_TRANSLATIONS: dict[str, dict[str, str]] = {
    # Navigation
    "nav.about": {
        "en": "About",
        "fr": "A propos",
        "pt": "Sobre",
        "es": "Acerca de",
        "de": "Info",
        "uk": "Про нас",
    },
    "nav.cases": {
        "en": "Cases",
        "fr": "Dossiers",
        "pt": "Casos",
        "es": "Casos",
        "de": "Falle",
        "uk": "Справи",
    },
    "nav.authority": {
        "en": "Authority Chain",
        "fr": "Chaine d'autorite",
        "pt": "Cadeia de autoridade",
        "es": "Cadena de autoridad",
        "de": "Autoritatskette",
        "uk": "Ланцюг повноважень",
    },
    "nav.api": {
        "en": "API",
        "fr": "API",
        "pt": "API",
        "es": "API",
        "de": "API",
        "uk": "API",
    },

    # Common
    "common.back_to_cases": {
        "en": "Back to cases",
        "fr": "Retour aux dossiers",
        "pt": "Voltar aos casos",
        "es": "Volver a casos",
        "de": "Zuruck zu den Fallen",
        "uk": "Назад до справ",
    },
    "common.jurisdiction": {
        "en": "Jurisdiction",
        "fr": "Juridiction",
        "pt": "Jurisdicao",
        "es": "Jurisdiccion",
        "de": "Rechtsgebiet",
        "uk": "Юрисдикцiя",
    },
    "common.evaluate": {
        "en": "Evaluate Case",
        "fr": "Evaluer le dossier",
        "pt": "Avaliar caso",
        "es": "Evaluar caso",
        "de": "Fall bewerten",
        "uk": "Оцiнити справу",
    },
    "common.view": {
        "en": "View",
        "fr": "Voir",
        "pt": "Ver",
        "es": "Ver",
        "de": "Ansehen",
        "uk": "Переглянути",
    },
    "common.status": {
        "en": "Status",
        "fr": "Statut",
        "pt": "Estado",
        "es": "Estado",
        "de": "Status",
        "uk": "Статус",
    },

    # Case dashboard
    "dashboard.title": {
        "en": "Case Dashboard",
        "fr": "Tableau de bord des dossiers",
        "pt": "Painel de casos",
        "es": "Panel de casos",
        "de": "Fallubersicht",
        "uk": "Панель справ",
    },
    "dashboard.active_cases": {
        "en": "Active Cases",
        "fr": "Dossiers actifs",
        "pt": "Casos ativos",
        "es": "Casos activos",
        "de": "Aktive Falle",
        "uk": "Активнi справи",
    },
    "dashboard.case_id": {
        "en": "Case ID",
        "fr": "No de dossier",
        "pt": "ID do caso",
        "es": "ID del caso",
        "de": "Fall-ID",
        "uk": "ID справи",
    },
    "dashboard.applicant": {
        "en": "Applicant",
        "fr": "Demandeur",
        "pt": "Requerente",
        "es": "Solicitante",
        "de": "Antragsteller",
        "uk": "Заявник",
    },
    "dashboard.dob": {
        "en": "Date of Birth",
        "fr": "Date de naissance",
        "pt": "Data de nascimento",
        "es": "Fecha de nacimiento",
        "de": "Geburtsdatum",
        "uk": "Дата народження",
    },
    "dashboard.legal_status": {
        "en": "Legal Status",
        "fr": "Statut juridique",
        "pt": "Situacao legal",
        "es": "Situacion legal",
        "de": "Rechtsstatus",
        "uk": "Правовий статус",
    },
    "dashboard.actions": {
        "en": "Actions",
        "fr": "Actions",
        "pt": "Acoes",
        "es": "Acciones",
        "de": "Aktionen",
        "uk": "Дii",
    },

    # Case detail
    "case.applicant_profile": {
        "en": "Applicant Profile",
        "fr": "Profil du demandeur",
        "pt": "Perfil do requerente",
        "es": "Perfil del solicitante",
        "de": "Antragstellerprofil",
        "uk": "Профiль заявника",
    },
    "case.residency_history": {
        "en": "Residency History",
        "fr": "Historique de residence",
        "pt": "Historico de residencia",
        "es": "Historial de residencia",
        "de": "Aufenthaltshistorie",
        "uk": "Iсторiя проживання",
    },
    "case.evidence": {
        "en": "Evidence",
        "fr": "Preuves",
        "pt": "Evidencias",
        "es": "Evidencias",
        "de": "Nachweise",
        "uk": "Докази",
    },
    "case.recommendation": {
        "en": "Recommendation",
        "fr": "Recommandation",
        "pt": "Recomendacao",
        "es": "Recomendacion",
        "de": "Empfehlung",
        "uk": "Рекомендацiя",
    },
    "case.human_review": {
        "en": "Human Review",
        "fr": "Revision humaine",
        "pt": "Revisao humana",
        "es": "Revision humana",
        "de": "Menschliche Prufung",
        "uk": "Перевiрка людиною",
    },
    "case.audit_trail": {
        "en": "Audit Trail",
        "fr": "Piste d'audit",
        "pt": "Trilha de auditoria",
        "es": "Pista de auditoria",
        "de": "Prufpfad",
        "uk": "Аудиторський слiд",
    },
    "case.rule_assessment": {
        "en": "Rule-by-Rule Assessment",
        "fr": "Evaluation regle par regle",
        "pt": "Avaliacao regra por regra",
        "es": "Evaluacion regla por regla",
        "de": "Regel-fur-Regel-Bewertung",
        "uk": "Оцiнка за правилами",
    },
    "case.missing_evidence": {
        "en": "Missing Evidence",
        "fr": "Preuves manquantes",
        "pt": "Evidencias ausentes",
        "es": "Evidencias faltantes",
        "de": "Fehlende Nachweise",
        "uk": "Вiдсутнi докази",
    },
    "case.full_audit": {
        "en": "Full Audit Package",
        "fr": "Dossier d'audit complet",
        "pt": "Pacote de auditoria completo",
        "es": "Paquete de auditoria completo",
        "de": "Vollstandiges Prufpaket",
        "uk": "Повний аудиторський пакет",
    },

    # Review actions
    "review.approve": {
        "en": "Approve recommendation",
        "fr": "Approuver la recommandation",
        "pt": "Aprovar recomendacao",
        "es": "Aprobar recomendacion",
        "de": "Empfehlung genehmigen",
        "uk": "Затвердити рекомендацiю",
    },
    "review.modify": {
        "en": "Modify outcome",
        "fr": "Modifier le resultat",
        "pt": "Modificar resultado",
        "es": "Modificar resultado",
        "de": "Ergebnis andern",
        "uk": "Змiнити результат",
    },
    "review.reject": {
        "en": "Reject recommendation",
        "fr": "Rejeter la recommandation",
        "pt": "Rejeitar recomendacao",
        "es": "Rechazar recomendacion",
        "de": "Empfehlung ablehnen",
        "uk": "Вiдхилити рекомендацiю",
    },
    "review.request_info": {
        "en": "Request more information",
        "fr": "Demander plus d'informations",
        "pt": "Solicitar mais informacoes",
        "es": "Solicitar mas informacion",
        "de": "Weitere Informationen anfordern",
        "uk": "Запросити додаткову iнформацiю",
    },
    "review.escalate": {
        "en": "Escalate to supervisor",
        "fr": "Transmettre au superviseur",
        "pt": "Escalar para supervisor",
        "es": "Escalar al supervisor",
        "de": "An Vorgesetzten eskalieren",
        "uk": "Передати керiвнику",
    },
    "review.decision": {
        "en": "Decision",
        "fr": "Decision",
        "pt": "Decisao",
        "es": "Decision",
        "de": "Entscheidung",
        "uk": "Рiшення",
    },
    "review.rationale": {
        "en": "Rationale",
        "fr": "Justification",
        "pt": "Justificativa",
        "es": "Justificacion",
        "de": "Begrundung",
        "uk": "Обгрунтування",
    },
    "review.submit": {
        "en": "Submit Review",
        "fr": "Soumettre la revision",
        "pt": "Enviar revisao",
        "es": "Enviar revision",
        "de": "Prufung einreichen",
        "uk": "Надiслати перевiрку",
    },

    # Outcomes
    "outcome.eligible": {
        "en": "ELIGIBLE",
        "fr": "ADMISSIBLE",
        "pt": "ELEGIVEL",
        "es": "ELEGIBLE",
        "de": "BERECHTIGT",
        "uk": "ПРИДАТНИЙ",
    },
    "outcome.ineligible": {
        "en": "INELIGIBLE",
        "fr": "INADMISSIBLE",
        "pt": "INELEGIVEL",
        "es": "NO ELEGIBLE",
        "de": "NICHT BERECHTIGT",
        "uk": "НЕПРИДАТНИЙ",
    },
    "outcome.insufficient_evidence": {
        "en": "INSUFFICIENT EVIDENCE",
        "fr": "PREUVES INSUFFISANTES",
        "pt": "EVIDENCIAS INSUFICIENTES",
        "es": "EVIDENCIA INSUFICIENTE",
        "de": "UNZUREICHENDE NACHWEISE",
        "uk": "НЕДОСТАТНЬО ДОКАЗIВ",
    },
    "outcome.escalate": {
        "en": "ESCALATE",
        "fr": "A TRANSMETTRE",
        "pt": "ESCALAR",
        "es": "ESCALAR",
        "de": "ESKALIEREN",
        "uk": "ПЕРЕДАТИ",
    },
    "outcome.pass": {
        "en": "PASS",
        "fr": "CONFORME",
        "pt": "APROVADO",
        "es": "APROBADO",
        "de": "BESTANDEN",
        "uk": "ПРОЙДЕНО",
    },
    "outcome.fail": {
        "en": "FAIL",
        "fr": "NON CONFORME",
        "pt": "REPROVADO",
        "es": "FALLO",
        "de": "FEHLGESCHLAGEN",
        "uk": "НЕ ПРОЙДЕНО",
    },
    "outcome.needs_evidence": {
        "en": "NEEDS EVIDENCE",
        "fr": "PREUVES REQUISES",
        "pt": "NECESSITA EVIDENCIA",
        "es": "NECESITA EVIDENCIA",
        "de": "NACHWEIS ERFORDERLICH",
        "uk": "ПОТРIБНI ДОКАЗИ",
    },

    # Statuses
    "status.intake": {
        "en": "Intake",
        "fr": "Reception",
        "pt": "Entrada",
        "es": "Recepcion",
        "de": "Eingang",
        "uk": "Прийом",
    },
    "status.recommendation_ready": {
        "en": "Recommendation Ready",
        "fr": "Recommandation prete",
        "pt": "Recomendacao pronta",
        "es": "Recomendacion lista",
        "de": "Empfehlung bereit",
        "uk": "Рекомендацiя готова",
    },
    "status.decided": {
        "en": "Decided",
        "fr": "Decide",
        "pt": "Decidido",
        "es": "Decidido",
        "de": "Entschieden",
        "uk": "Вирiшено",
    },
    "status.escalated": {
        "en": "Escalated",
        "fr": "Transmis",
        "pt": "Escalado",
        "es": "Escalado",
        "de": "Eskaliert",
        "uk": "Передано",
    },

    # Footer
    "footer.tagline": {
        "en": "Policy-Driven Service Delivery Machine",
        "fr": "Machine de prestation de services axee sur les politiques",
        "pt": "Maquina de prestacao de servicos orientada por politicas",
        "es": "Maquina de prestacion de servicios impulsada por politicas",
        "de": "Richtliniengesteuerte Dienstleistungsmaschine",
        "uk": "Полiтично-орiєнтована машина надання послуг",
    },
    "footer.license": {
        "en": "Open Public Good (Apache 2.0)",
        "fr": "Bien public ouvert (Apache 2.0)",
        "pt": "Bem publico aberto (Apache 2.0)",
        "es": "Bien publico abierto (Apache 2.0)",
        "de": "Offenes offentliches Gut (Apache 2.0)",
        "uk": "Вiдкрите суспiльне благо (Apache 2.0)",
    },
}


def t(key: str, lang: str = DEFAULT_LANGUAGE) -> str:
    """Get a translated string."""
    entry = _TRANSLATIONS.get(key)
    if not entry:
        return key
    return entry.get(lang, entry.get("en", key))


def get_translator(lang: str):
    """Return a translation function bound to a language."""
    def _t(key: str) -> str:
        return t(key, lang)
    return _t
