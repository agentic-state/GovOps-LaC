"""One-shot seed for notice i18n records (Phase 10C / ADR-012).

Generates lawcode/global/ui-labels-notices.yaml from the in-script
translation table. Run once; the YAML is then the source-of-truth.
Re-running overwrites; PRs to the YAML are the canonical edit path.
"""
from __future__ import annotations

from pathlib import Path


# (key_suffix, en, fr, pt, es, de, uk)
TRANSLATIONS = [
    ("notice.title",
        "Decision Notice", "Avis de décision", "Aviso de Decisão",
        "Notificación de Decisión", "Entscheidungsmitteilung",
        "Повiдомлення про рiшення"),
    ("notice.subtitle",
        "Self-screening result", "Résultat de l'auto-évaluation",
        "Resultado da auto-avaliação", "Resultado de la auto-evaluación",
        "Selbstprüfungs-Ergebnis", "Результат самооцiнки"),
    ("notice.case_id",
        "Case", "Dossier", "Caso", "Caso", "Fall", "Справа"),
    ("notice.evaluation_date",
        "Evaluation date", "Date d'évaluation", "Data da avaliação",
        "Fecha de evaluación", "Bewertungsdatum", "Дата оцiнки"),
    ("notice.template_version",
        "Template version", "Version du modèle", "Versão do modelo",
        "Versión de plantilla", "Vorlagenversion", "Версiя шаблону"),
    ("notice.verdict.eligible",
        "You appear to be eligible.",
        "Vous semblez être admissible.",
        "Você parece ser elegível.",
        "Parece ser elegible.",
        "Sie scheinen anspruchsberechtigt zu sein.",
        "Ви, ймовiрно, маєте право."),
    ("notice.verdict.ineligible",
        "You do not appear to be eligible.",
        "Vous ne semblez pas être admissible.",
        "Você não parece ser elegível.",
        "No parece ser elegible.",
        "Sie scheinen nicht anspruchsberechtigt zu sein.",
        "Ви, ймовiрно, не маєте права."),
    ("notice.verdict.insufficient_evidence",
        "More information is needed.",
        "Plus d'informations sont nécessaires.",
        "É necessário mais informação.",
        "Se necesita más información.",
        "Weitere Angaben erforderlich.",
        "Потрiбно бiльше iнформацiї."),
    ("notice.verdict.escalate",
        "Human review is required.",
        "Une révision humaine est requise.",
        "É necessária revisão humana.",
        "Se requiere revisión humana.",
        "Menschliche Prüfung erforderlich.",
        "Потрiбен людський перегляд."),
    ("notice.pension_type.full",
        "Full pension", "Pension complète", "Pensão integral",
        "Pensión completa", "Volle Rente", "Повна пенсiя"),
    ("notice.pension_type.partial",
        "Partial pension", "Pension partielle", "Pensão parcial",
        "Pensión parcial", "Teilrente", "Часткова пенсiя"),
    ("notice.amount_heading",
        "Projected amount", "Montant projeté", "Valor projetado",
        "Importe proyectado", "Voraussichtlicher Betrag",
        "Прогнозована сума"),
    ("notice.formula_heading",
        "How this is calculated", "Comment ceci est calculé",
        "Como isto é calculado", "Cómo se calcula esto",
        "Wie dies berechnet wird", "Як це розраховано"),
    ("notice.period.monthly",
        "month", "mois", "mês", "mes", "Monat", "мiсяць"),
    ("notice.period.annual",
        "year", "an", "ano", "año", "Jahr", "рiк"),
    ("notice.period.lump_sum",
        "lump sum", "somme forfaitaire", "soma única",
        "suma global", "Einmalbetrag", "одноразова виплата"),
    ("notice.op.const",
        "constant", "constante", "constante", "constante",
        "Konstante", "константа"),
    ("notice.op.ref",
        "lookup", "valeur officielle", "valor oficial",
        "valor oficial", "Nachschlagewert", "офiцiйне значення"),
    ("notice.op.field",
        "case input", "donnée du cas", "dado do caso",
        "dato del caso", "Falleingabe", "вхiд справи"),
    ("notice.op.add",
        "add", "additionner", "somar", "sumar", "addieren", "додати"),
    ("notice.op.subtract",
        "subtract", "soustraire", "subtrair", "restar",
        "subtrahieren", "вiдняти"),
    ("notice.op.multiply",
        "multiply", "multiplier", "multiplicar", "multiplicar",
        "multiplizieren", "помножити"),
    ("notice.op.divide",
        "divide", "diviser", "dividir", "dividir",
        "dividieren", "подiлити"),
    ("notice.op.min",
        "minimum", "minimum", "mínimo", "mínimo",
        "Minimum", "мiнiмум"),
    ("notice.op.max",
        "maximum", "maximum", "máximo", "máximo",
        "Maximum", "максимум"),
    ("notice.op.clamp",
        "clamp", "borner", "limitar", "limitar",
        "begrenzen", "обмежити"),
    ("notice.rules_heading",
        "Rule-by-rule assessment", "Évaluation règle par règle",
        "Avaliação regra a regra", "Evaluación regla por regla",
        "Regelbasierte Bewertung", "Оцiнка по правилах"),
    ("notice.outcome.satisfied",
        "PASS", "RÉUSSI", "APROVADO", "APROBADO",
        "ERFÜLLT", "ВИКОНАНО"),
    ("notice.outcome.not_satisfied",
        "FAIL", "ÉCHEC", "REPROVADO", "RECHAZADO",
        "NICHT ERFÜLLT", "НЕ ВИКОНАНО"),
    ("notice.outcome.insufficient_evidence",
        "NEED", "MANQUE", "NECESSÁRIO", "FALTA",
        "BENÖTIGT", "ПОТРІБНО"),
    ("notice.outcome.not_applicable",
        "N/A", "S.O.", "N/A", "N/A", "N/A", "Н/З"),
    ("notice.missing_evidence_heading",
        "Missing evidence", "Preuves manquantes", "Provas em falta",
        "Evidencia faltante", "Fehlende Nachweise",
        "Бракуючi докази"),
    ("notice.disclaimer_heading",
        "This is decision support, not a determination.",
        "Ceci est un soutien à la décision, pas une décision.",
        "Este é um apoio à decisão, não uma determinação.",
        "Esto es apoyo a la decisión, no una determinación.",
        "Dies ist Entscheidungsunterstützung, keine Entscheidung.",
        "Це пiдтримка рiшення, а не саме рiшення."),
    ("notice.disclaimer_body",
        "GovOps is an independent open-source prototype. This notice is not an official determination. Apply through the program for an authoritative decision.",
        "GovOps est un prototype indépendant en source ouverte. Cet avis n'est pas une décision officielle. Demandez à travers le programme pour une décision faisant autorité.",
        "GovOps é um protótipo independente de código aberto. Este aviso não é uma determinação oficial. Solicite através do programa para uma decisão oficial.",
        "GovOps es un prototipo independiente de código abierto. Este aviso no es una determinación oficial. Solicite a través del programa para una decisión oficial.",
        "GovOps ist ein unabhängiger Open-Source-Prototyp. Diese Mitteilung ist keine amtliche Entscheidung. Beantragen Sie über das Programm eine maßgebliche Entscheidung.",
        "GovOps - незалежний прототип з вiдкритим кодом. Це повiдомлення не є офiцiйним рiшенням. Подайте заявку через програму для отримання офiцiйного рiшення."),
    ("notice.footer_generated",
        "Generated at", "Généré le", "Gerado em", "Generado en",
        "Erstellt am", "Створено"),
    ("notice.footer_hash_note",
        "This notice's sha256 is recorded in the case audit trail. To reproduce: re-render with the recorded template version against the case as it stood on the evaluation date.",
        "Le sha256 de cet avis est enregistré dans la piste d'audit du dossier. Pour reproduire : refaire le rendu avec la version du modèle enregistrée contre le dossier tel qu'il était à la date d'évaluation.",
        "O sha256 deste aviso é registrado na trilha de auditoria do caso. Para reproduzir: renderize novamente com a versão do modelo registrada em relação ao caso como estava na data de avaliação.",
        "El sha256 de este aviso se registra en el rastro de auditoría del caso. Para reproducir: vuelva a renderizar con la versión de plantilla registrada contra el caso tal como estaba en la fecha de evaluación.",
        "Der sha256 dieser Mitteilung wird im Audit-Pfad des Falls aufgezeichnet. Zur Reproduktion: erneut mit der aufgezeichneten Vorlagenversion gegen den Fall in dem Zustand rendern, in dem er am Bewertungsdatum war.",
        "Sha256 цього повiдомлення записано у журналi аудиту справи. Для вiдтворення: повторно згенерувати з записаною версiєю шаблону проти справи у станi на дату оцiнки."),
]

LANGS = ["en", "fr", "pt", "es", "de", "uk"]


def build_yaml() -> str:
    values = []
    for row in TRANSLATIONS:
        key_suffix = row[0]
        for lang, val in zip(LANGS, row[1:]):
            values.append({
                "key": f"ui.label.{key_suffix}.{lang}",
                "value": val,
            })
    values.sort(key=lambda v: v["key"])

    out_lines = [
        "# yaml-language-server: $schema=../../schema/lawcode-v1.0.json",
        "# global/ui-labels-notices.yaml — citizen decision-notice strings (Phase 10C / ADR-012).",
        "# One record per (key, lang); 6 locales × ~30 strings = ~180 records.",
        "# pt/es/de/uk are best-effort initial translations. Translators welcome to PR refinements.",
        "",
        "defaults:",
        "  domain: ui",
        "  jurisdiction_id: global",
        "  effective_from: '1900-01-01'",
        "  value_type: string",
        "values:",
    ]
    for v in values:
        # Quote the value so colons / special chars are safe; escape any single quotes.
        safe_value = v["value"].replace("'", "''")
        out_lines.append(f"- key: {v['key']}")
        out_lines.append(f"  value: '{safe_value}'")
    return "\n".join(out_lines) + "\n"


if __name__ == "__main__":
    out_path = Path(__file__).resolve().parent.parent / "lawcode" / "global" / "ui-labels-notices.yaml"
    yaml_text = build_yaml()
    out_path.write_text(yaml_text, encoding="utf-8")
    n = yaml_text.count("- key:")
    print(f"wrote {n} records to {out_path}")
