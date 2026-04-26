import { useIntl } from "react-intl";
import type { CaseBundle } from "@/lib/types";
import { ResidencyTimeline } from "./ResidencyTimeline";
import { EvidenceTable } from "./EvidenceTable";

export function ApplicantPane({ bundle }: { bundle: CaseBundle }) {
  const intl = useIntl();
  const a = bundle.applicant;
  return (
    <section
      aria-labelledby="applicant-heading"
      className="space-y-6 rounded-md border border-border bg-surface-raised p-5"
    >
      <header className="space-y-1">
        <h2
          id="applicant-heading"
          className="text-xl text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {intl.formatMessage({ id: "cases.applicant.heading" })}
        </h2>
        <p
          className="text-2xl text-foreground"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {a.legal_name}
        </p>
      </header>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wider text-foreground-muted">
            {intl.formatMessage({ id: "cases.applicant.dob" })}
          </dt>
          <dd className="text-foreground">
            {intl.formatDate(a.date_of_birth, { dateStyle: "long" })}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-foreground-muted">
            {intl.formatMessage({ id: "cases.applicant.legal_status" })}
          </dt>
          <dd>
            <span className="inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-xs">
              {a.legal_status}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-foreground-muted">
            {intl.formatMessage({ id: "cases.applicant.country_of_birth" })}
          </dt>
          <dd className="text-foreground">{a.country_of_birth}</dd>
        </div>
      </dl>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">
          {intl.formatMessage({ id: "cases.residency.heading" })}
        </h3>
        <ResidencyTimeline periods={bundle.residency_periods} />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">
          {intl.formatMessage({ id: "cases.evidence.heading" })}
        </h3>
        <EvidenceTable items={bundle.evidence_items} />
      </div>
    </section>
  );
}
