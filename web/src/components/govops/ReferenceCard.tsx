import { ExternalLink } from "lucide-react";
import { ProvenanceRibbon } from "./ProvenanceRibbon";

/**
 * ReferenceCard — peer-grade citation card for an external framework or
 * paper that GovOps takes seriously. Renders a verbatim quote (kept in
 * source language, never translated), an attribution line, an optional
 * one-line claim describing how GovOps relates to the cited work, and
 * a primary external link (with an optional secondary in-repo link).
 *
 * Used on /about §4 to position GovOps relative to SPRIND Law as Code
 * and the Agentic State paper without implying endorsement.
 */
export interface ReferenceCardProps {
  name: string;
  subtitle: string;
  quote: string;
  attribution: string;
  claim?: string;
  externalHref: string;
  inRepoLink?: { label: string; href: string };
}

export function ReferenceCard({
  name,
  subtitle,
  quote,
  attribution,
  claim,
  externalHref,
  inRepoLink,
}: ReferenceCardProps) {
  const displayHref = externalHref.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <article className="flex items-stretch rounded-lg border border-border bg-surface">
      <ProvenanceRibbon variant="hybrid" />
      <div className="flex-1 p-5 space-y-3">
        <header>
          <h3
            className="text-lg text-foreground"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {name}
          </h3>
          <p
            className="text-xs uppercase tracking-[0.18em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {subtitle}
          </p>
        </header>
        <blockquote className="border-l-2 border-authority ps-4 italic text-sm text-foreground">
          “{quote}”
        </blockquote>
        <p className="text-xs text-foreground-muted">{attribution}</p>
        {claim && <p className="text-sm text-foreground">{claim}</p>}
        <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 border-t border-border">
          <a
            href={externalHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-authority hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            {displayHref}
            <ExternalLink size={12} aria-hidden="true" />
          </a>
          {inRepoLink && (
            <a
              href={inRepoLink.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              {inRepoLink.label}
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          )}
        </footer>
      </div>
    </article>
  );
}