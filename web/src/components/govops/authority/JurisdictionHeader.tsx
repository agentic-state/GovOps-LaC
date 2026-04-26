import { useIntl } from "react-intl";
import { ProvenanceRibbon } from "@/components/govops/ProvenanceRibbon";
import type { Jurisdiction } from "@/lib/types";

export function JurisdictionHeader({ jurisdiction }: { jurisdiction: Jurisdiction }) {
  const intl = useIntl();
  return (
    <header className="flex items-stretch">
      <ProvenanceRibbon variant="system" />
      <div className="space-y-3">
        <p
          className="text-xs uppercase tracking-[0.2em] text-foreground-subtle"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          spec govops-010 · authority chain
        </p>
        <h1
          className="text-3xl tracking-tight text-foreground sm:text-4xl"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {jurisdiction.name}
        </h1>
        <p className="max-w-2xl text-base text-foreground-muted">
          {intl.formatMessage({ id: "authority.lede" })}
        </p>
        <dl
          className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm text-foreground-muted sm:grid-cols-2"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <div>
            <dt className="inline text-foreground-subtle">
              {intl.formatMessage({ id: "authority.jurisdiction.country" })}:{" "}
            </dt>
            <dd className="inline text-foreground">{jurisdiction.country}</dd>
          </div>
          <div>
            <dt className="inline text-foreground-subtle">
              {intl.formatMessage({ id: "authority.jurisdiction.level" })}:{" "}
            </dt>
            <dd className="inline text-foreground">{jurisdiction.level}</dd>
          </div>
          <div>
            <dt className="inline text-foreground-subtle">
              {intl.formatMessage({ id: "authority.jurisdiction.legal_tradition" })}:{" "}
            </dt>
            <dd className="inline text-foreground">{jurisdiction.legal_tradition}</dd>
          </div>
          <div>
            <dt className="inline text-foreground-subtle">
              {intl.formatMessage({ id: "authority.jurisdiction.language_regime" })}:{" "}
            </dt>
            <dd className="inline text-foreground">{jurisdiction.language_regime}</dd>
          </div>
        </dl>
      </div>
    </header>
  );
}