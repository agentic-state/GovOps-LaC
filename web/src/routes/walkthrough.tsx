import { createFileRoute, Link } from "@tanstack/react-router";
import { useIntl, FormattedMessage } from "react-intl";
import {
  Scale,
  ScrollText,
  ClipboardCheck,
  Database,
  UserCheck,
  UserX,
  ShieldCheck,
} from "lucide-react";
import { ProvenanceRibbon } from "@/components/govops/ProvenanceRibbon";
import { Breadcrumb } from "@/components/govops/Breadcrumb";

export const Route = createFileRoute("/walkthrough")({
  head: () => ({
    meta: [
      {
        title:
          "Walkthrough — How a brand-new statutory benefit becomes service · GovOps",
      },
      {
        name: "description",
        content:
          "End-to-end walkthrough: a paid-vacation law passes; GovOps captures it, ratifies it, and onboards the first applicants — including the edge case.",
      },
    ],
  }),
  component: Walkthrough,
});

type StepDef = {
  num: string;
  prefix: string;
  Icon: typeof Scale;
  variant: "agent" | "human" | "citizen" | "system" | "hybrid";
  accent: "agentic" | "authority" | "neutral";
};

const STEPS: StepDef[] = [
  { num: "01", prefix: "walkthrough.step1", Icon: Scale, variant: "human", accent: "authority" },
  { num: "02", prefix: "walkthrough.step2", Icon: ScrollText, variant: "agent", accent: "agentic" },
  { num: "03", prefix: "walkthrough.step3", Icon: ClipboardCheck, variant: "human", accent: "authority" },
  { num: "04", prefix: "walkthrough.step4", Icon: Database, variant: "system", accent: "neutral" },
  { num: "05", prefix: "walkthrough.step5", Icon: UserCheck, variant: "citizen", accent: "neutral" },
  { num: "06", prefix: "walkthrough.step6", Icon: UserX, variant: "citizen", accent: "neutral" },
  { num: "07", prefix: "walkthrough.step7", Icon: ShieldCheck, variant: "hybrid", accent: "authority" },
];

function accentVar(accent: StepDef["accent"]) {
  if (accent === "agentic") return "var(--agentic)";
  if (accent === "authority") return "var(--authority)";
  return "var(--foreground-muted)";
}

function StepHeader({ step }: { step: StepDef }) {
  const intl = useIntl();
  const { Icon, accent, num, prefix } = step;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Icon className="size-5 shrink-0" style={{ color: accentVar(accent) }} aria-hidden />
        <p
          className="text-xs uppercase tracking-[0.22em] text-foreground-subtle"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <FormattedMessage id="walkthrough.step.label" values={{ num }} />
          {" · "}
          {intl.formatMessage({ id: `${prefix}.tag` })}
        </p>
      </div>
      <h2
        className="text-2xl tracking-tight text-foreground sm:text-3xl"
        style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
      >
        {intl.formatMessage({ id: `${prefix}.heading` })}
      </h2>
      <p className="max-w-3xl text-base leading-relaxed text-foreground-muted">
        {intl.formatMessage({ id: `${prefix}.body` })}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Realistic scenario data, hard-coded for the walkthrough's data previews.
// All keys + jurisdictions are illustrative ("ca-psv" = a hypothetical
// "Canadian Paid Statutory Vacation" program). Real ConfigValues land in
// the substrate when the same flow runs through the live console; the data
// shown here mirrors the shape of those records 1:1.
// ---------------------------------------------------------------------------

const SCENARIO_RULES = [
  {
    key: "ca-psv.rule.consecutive-employment.min_years",
    value: 5,
    citation: "Paid Statutory Vacation Act, s. 4(1)",
    rationale: "Minimum tenure with the same employer.",
  },
  {
    key: "ca-psv.rule.benefit.days",
    value: 5,
    citation: "Paid Statutory Vacation Act, s. 3",
    rationale: "Number of paid leave days granted on approval.",
  },
  {
    key: "ca-psv.rule.employer.must_be_registered",
    value: true,
    citation: "Paid Statutory Vacation Act, s. 4(2)",
    rationale: "Employer must hold a valid business registration.",
  },
  {
    key: "ca-psv.evidence.pay_stubs.types",
    value: ["t4", "pay_stub", "employment_letter"],
    citation: "Paid Statutory Vacation Regulations, s. 7",
    rationale: "Acceptable proofs of employment and pay rate.",
  },
];

const CASE_MARIA = {
  id: "case-2026-001",
  applicant: "Maria Santos",
  age: 32,
  employer: "Café Solar Inc.",
  employerRegistered: true,
  consecutiveYears: 8,
  payRate: "$24.00 / hr",
  evidence: ["t4", "pay_stub"],
};

const CASE_CARLOS = {
  id: "case-2026-002",
  applicant: "Carlos Mendes",
  age: 41,
  employer: "Acme Logistics Ltd.",
  employerRegistered: true,
  consecutiveYears: 4,
  payRate: "$31.50 / hr",
  evidence: ["t4", "pay_stub", "employment_letter"],
};

// ---------------------------------------------------------------------------
// Reusable preview blocks
// ---------------------------------------------------------------------------

function StatutoryExcerpt() {
  const intl = useIntl();
  return (
    <figure
      className="rounded-md border border-border bg-surface-sunken p-5"
      aria-label={intl.formatMessage({ id: "walkthrough.step1.excerpt.label" })}
    >
      <figcaption
        className="mb-3 text-xs uppercase tracking-[0.2em] text-foreground-subtle"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {intl.formatMessage({ id: "walkthrough.step1.excerpt.label" })}
      </figcaption>
      <blockquote
        className="border-s-2 ps-4 text-sm leading-relaxed text-foreground"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        <p className="font-medium">
          {intl.formatMessage({ id: "walkthrough.step1.excerpt.title" })}
        </p>
        <p className="mt-2">
          <span className="text-foreground-muted">§ 3.</span>{" "}
          {intl.formatMessage({ id: "walkthrough.step1.excerpt.s3" })}
        </p>
        <p className="mt-2">
          <span className="text-foreground-muted">§ 4(1).</span>{" "}
          {intl.formatMessage({ id: "walkthrough.step1.excerpt.s4_1" })}
        </p>
        <p className="mt-2">
          <span className="text-foreground-muted">§ 4(2).</span>{" "}
          {intl.formatMessage({ id: "walkthrough.step1.excerpt.s4_2" })}
        </p>
        <p className="mt-2">
          <span className="text-foreground-muted">Reg. 7.</span>{" "}
          {intl.formatMessage({ id: "walkthrough.step1.excerpt.r7" })}
        </p>
      </blockquote>
    </figure>
  );
}

function EncoderProposals() {
  const intl = useIntl();
  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <p
        className="mb-3 text-xs uppercase tracking-[0.2em] text-foreground-subtle"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {intl.formatMessage({ id: "walkthrough.step2.proposals.label" })}
      </p>
      <ol role="list" className="space-y-3">
        {SCENARIO_RULES.map((r, idx) => (
          <li
            key={r.key}
            className="flex items-stretch rounded-md border border-border bg-surface-sunken p-3"
          >
            <ProvenanceRibbon variant="agent" />
            <div className="w-full space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="text-xs text-foreground-subtle"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {`#${idx + 1}`}
                </span>
                <code
                  className="text-sm text-foreground"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {r.key}
                </code>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
                <span style={{ fontFamily: "var(--font-mono)" }}>
                  ={" "}
                  {Array.isArray(r.value) ? JSON.stringify(r.value) : String(r.value)}
                </span>
                <span>·</span>
                <span>{r.citation}</span>
              </div>
              <p className="text-xs italic text-foreground-muted">{r.rationale}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ApprovalQueue() {
  const intl = useIntl();
  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <p
        className="mb-3 text-xs uppercase tracking-[0.2em] text-foreground-subtle"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {intl.formatMessage({ id: "walkthrough.step3.queue.label" })}
      </p>
      <ul role="list" className="space-y-2">
        {SCENARIO_RULES.map((r) => (
          <li
            key={r.key}
            className="flex items-center justify-between rounded-md border border-border bg-surface-sunken px-3 py-2"
          >
            <code
              className="truncate text-sm text-foreground"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {r.key}
            </code>
            <span
              className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-foreground-muted"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {intl.formatMessage({ id: "walkthrough.step3.queue.pendingPill" })}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-foreground-muted">
        {intl.formatMessage({ id: "walkthrough.step3.queue.afterReview" })}
      </p>
    </div>
  );
}

function SubstrateRecords() {
  const intl = useIntl();
  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <p
        className="mb-3 text-xs uppercase tracking-[0.2em] text-foreground-subtle"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {intl.formatMessage({ id: "walkthrough.step4.records.label" })}
      </p>
      <ul role="list" className="space-y-2">
        {SCENARIO_RULES.map((r) => (
          <li
            key={r.key}
            className="flex items-stretch rounded-md border border-border bg-surface-sunken px-3 py-2"
          >
            <ProvenanceRibbon variant="human" />
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <code
                className="truncate text-sm text-foreground"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {r.key}
              </code>
              <div className="flex items-center gap-2 text-xs text-foreground-muted">
                <span style={{ fontFamily: "var(--font-mono)" }}>
                  ={" "}
                  {Array.isArray(r.value) ? JSON.stringify(r.value) : String(r.value)}
                </span>
                <span
                  className="rounded-full border border-border bg-surface px-2 py-0.5"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  approved · 2026-04-26
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-foreground-muted">
        {intl.formatMessage({ id: "walkthrough.step4.records.schemaNote" })}
      </p>
    </div>
  );
}

function CaseEvaluation({
  caseData,
  outcome,
}: {
  caseData: typeof CASE_MARIA;
  outcome: "eligible" | "ineligible";
}) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });

  // Hard-coded checks per scenario for narrative clarity.
  const checks =
    outcome === "eligible"
      ? [
          { rule: "ca-psv.rule.consecutive-employment.min_years", status: "pass", needs: 5, has: caseData.consecutiveYears },
          { rule: "ca-psv.rule.employer.must_be_registered", status: "pass", needs: true, has: caseData.employerRegistered },
          { rule: "ca-psv.evidence.pay_stubs.types", status: "pass", needs: 1, has: caseData.evidence.length },
        ]
      : [
          { rule: "ca-psv.rule.consecutive-employment.min_years", status: "fail", needs: 5, has: caseData.consecutiveYears },
          { rule: "ca-psv.rule.employer.must_be_registered", status: "pass", needs: true, has: caseData.employerRegistered },
          { rule: "ca-psv.evidence.pay_stubs.types", status: "pass", needs: 1, has: caseData.evidence.length },
        ];

  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p
            className="text-xs uppercase tracking-[0.2em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {caseData.id}
          </p>
          <p
            className="text-base font-medium text-foreground"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {caseData.applicant}
          </p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-medium"
          style={{
            backgroundColor:
              outcome === "eligible" ? "var(--authority-soft)" : "var(--surface-sunken)",
            color:
              outcome === "eligible"
                ? "var(--authority-foreground)"
                : "var(--foreground-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {outcome === "eligible"
            ? t("walkthrough.case.outcome.eligible")
            : t("walkthrough.case.outcome.ineligible")}
        </span>
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-foreground-muted">{t("walkthrough.case.field.employer")}</dt>
        <dd className="text-foreground">{caseData.employer}</dd>
        <dt className="text-foreground-muted">{t("walkthrough.case.field.years")}</dt>
        <dd className="text-foreground">{caseData.consecutiveYears}</dd>
        <dt className="text-foreground-muted">{t("walkthrough.case.field.payRate")}</dt>
        <dd className="text-foreground">{caseData.payRate}</dd>
        <dt className="text-foreground-muted">{t("walkthrough.case.field.evidence")}</dt>
        <dd className="text-foreground">{caseData.evidence.join(", ")}</dd>
      </dl>

      <ol role="list" className="mt-4 space-y-2 border-t border-border pt-4">
        {checks.map((c) => (
          <li
            key={c.rule}
            className="flex items-start justify-between gap-3 text-sm"
          >
            <code
              className="flex-1 truncate text-foreground-muted"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {c.rule}
            </code>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-xs"
              style={{
                fontFamily: "var(--font-mono)",
                backgroundColor:
                  c.status === "pass" ? "var(--authority-soft)" : "var(--surface-sunken)",
                color:
                  c.status === "pass"
                    ? "var(--authority-foreground)"
                    : "var(--foreground-muted)",
                border:
                  c.status === "fail"
                    ? "1px solid var(--border)"
                    : "1px solid transparent",
              }}
            >
              {c.status === "pass"
                ? t("walkthrough.case.check.pass")
                : `${t("walkthrough.case.check.fail")} · needs ${c.needs}, has ${c.has}`}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function AuditTrail() {
  const intl = useIntl();
  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <p
        className="mb-3 text-xs uppercase tracking-[0.2em] text-foreground-subtle"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {intl.formatMessage({ id: "walkthrough.step7.audit.label" })}
      </p>
      <ul role="list" className="space-y-2 text-sm">
        {[
          { id: "evt-001", text: "walkthrough.step7.audit.evt1" },
          { id: "evt-002", text: "walkthrough.step7.audit.evt2" },
          { id: "evt-003", text: "walkthrough.step7.audit.evt3" },
          { id: "evt-004", text: "walkthrough.step7.audit.evt4" },
          { id: "evt-005", text: "walkthrough.step7.audit.evt5" },
        ].map((evt) => (
          <li key={evt.id} className="flex gap-3">
            <code
              className="shrink-0 text-xs text-foreground-subtle"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {evt.id}
            </code>
            <span className="text-foreground-muted">{intl.formatMessage({ id: evt.text })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function Walkthrough() {
  const intl = useIntl();

  return (
    <div className="space-y-16">
      <Breadcrumb items={[{ label: "nav.walkthrough", i18n: true }]} />

      {/* Hero */}
      <section aria-labelledby="walkthrough-heading" className="flex items-stretch">
        <ProvenanceRibbon variant="hybrid" />
        <div className="space-y-5">
          <p
            className="text-xs uppercase tracking-[0.22em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {intl.formatMessage({ id: "walkthrough.eyebrow" })}
          </p>
          <h1
            id="walkthrough-heading"
            className="text-4xl leading-tight tracking-tight text-foreground sm:text-5xl"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {intl.formatMessage({ id: "walkthrough.heading" })}
          </h1>
          <p className="max-w-3xl text-lg text-foreground-muted">
            {intl.formatMessage({ id: "walkthrough.lead" })}
          </p>
          <div className="rounded-md border border-border bg-surface-sunken p-4 text-sm text-foreground-muted">
            <p className="font-medium text-foreground">
              {intl.formatMessage({ id: "walkthrough.scenario.title" })}
            </p>
            <p className="mt-1">
              {intl.formatMessage({ id: "walkthrough.scenario.body" })}
            </p>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section
        id={STEPS[0].num}
        aria-label={intl.formatMessage({ id: "walkthrough.step1.tag" })}
        className="flex items-stretch"
      >
        <ProvenanceRibbon variant={STEPS[0].variant} />
        <div className="w-full space-y-5">
          <StepHeader step={STEPS[0]} />
          <StatutoryExcerpt />
        </div>
      </section>

      <section
        id={STEPS[1].num}
        aria-label={intl.formatMessage({ id: "walkthrough.step2.tag" })}
        className="flex items-stretch"
      >
        <ProvenanceRibbon variant={STEPS[1].variant} />
        <div className="w-full space-y-5">
          <StepHeader step={STEPS[1]} />
          <EncoderProposals />
          <p className="text-sm text-foreground-muted">
            <Link
              to="/encode"
              className="font-medium hover:underline"
              style={{ color: "var(--agentic)" }}
            >
              {intl.formatMessage({ id: "walkthrough.step2.cta" })}
            </Link>
          </p>
        </div>
      </section>

      <section
        id={STEPS[2].num}
        aria-label={intl.formatMessage({ id: "walkthrough.step3.tag" })}
        className="flex items-stretch"
      >
        <ProvenanceRibbon variant={STEPS[2].variant} />
        <div className="w-full space-y-5">
          <StepHeader step={STEPS[2]} />
          <ApprovalQueue />
          <p className="text-sm text-foreground-muted">
            <Link
              to="/config/approvals"
              className="font-medium hover:underline"
              style={{ color: "var(--authority)" }}
            >
              {intl.formatMessage({ id: "walkthrough.step3.cta" })}
            </Link>
          </p>
        </div>
      </section>

      <section
        id={STEPS[3].num}
        aria-label={intl.formatMessage({ id: "walkthrough.step4.tag" })}
        className="flex items-stretch"
      >
        <ProvenanceRibbon variant={STEPS[3].variant} />
        <div className="w-full space-y-5">
          <StepHeader step={STEPS[3]} />
          <SubstrateRecords />
          <p className="text-sm text-foreground-muted">
            <Link
              to="/config"
              className="font-medium hover:underline"
              style={{ color: "var(--foreground-muted)" }}
            >
              {intl.formatMessage({ id: "walkthrough.step4.cta" })}
            </Link>
          </p>
        </div>
      </section>

      <section
        id={STEPS[4].num}
        aria-label={intl.formatMessage({ id: "walkthrough.step5.tag" })}
        className="flex items-stretch"
      >
        <ProvenanceRibbon variant={STEPS[4].variant} />
        <div className="w-full space-y-5">
          <StepHeader step={STEPS[4]} />
          <CaseEvaluation caseData={CASE_MARIA} outcome="eligible" />
        </div>
      </section>

      <section
        id={STEPS[5].num}
        aria-label={intl.formatMessage({ id: "walkthrough.step6.tag" })}
        className="flex items-stretch"
      >
        <ProvenanceRibbon variant={STEPS[5].variant} />
        <div className="w-full space-y-5">
          <StepHeader step={STEPS[5]} />
          <CaseEvaluation caseData={CASE_CARLOS} outcome="ineligible" />
          <p className="text-sm text-foreground-muted">
            {intl.formatMessage({ id: "walkthrough.step6.note" })}
          </p>
        </div>
      </section>

      <section
        id={STEPS[6].num}
        aria-label={intl.formatMessage({ id: "walkthrough.step7.tag" })}
        className="flex items-stretch"
      >
        <ProvenanceRibbon variant={STEPS[6].variant} />
        <div className="w-full space-y-5">
          <StepHeader step={STEPS[6]} />
          <AuditTrail />
        </div>
      </section>

      {/* Closing CTA */}
      <section className="rounded-md border border-border bg-surface-sunken p-6">
        <h2
          className="text-xl text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {intl.formatMessage({ id: "walkthrough.closing.heading" })}
        </h2>
        <p className="mt-2 text-foreground-muted">
          {intl.formatMessage({ id: "walkthrough.closing.body" })}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/config/approvals"
            className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {intl.formatMessage({ id: "walkthrough.closing.cta.primary" })}
          </Link>
          <Link
            to="/about"
            className="inline-flex h-11 items-center rounded-md border border-border bg-surface px-5 text-sm font-medium text-foreground transition-colors hover:bg-surface-sunken"
          >
            {intl.formatMessage({ id: "walkthrough.closing.cta.secondary" })}
          </Link>
        </div>
      </section>
    </div>
  );
}
