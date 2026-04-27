import { createFileRoute, Link, Outlet, useChildMatches } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import { ArrowRight } from "lucide-react";
import { ScreenShell } from "@/components/govops/ScreenShell";
import { SCREEN_JURISDICTIONS, type ScreenJurisdictionId } from "@/lib/types";

const JURISDICTION_LABELS: Record<ScreenJurisdictionId, string> = {
  ca: "Canada",
  br: "Brasil",
  es: "España",
  fr: "France",
  de: "Deutschland",
  ua: "Україна",
};

export const Route = createFileRoute("/screen")({
  head: () => ({
    meta: [
      { title: "Self-screen for benefits — GovOps" },
      {
        name: "description",
        content:
          "Anonymous, no-PII pre-check that returns a plain-language eligibility hint and an evidence checklist. Not a determination.",
      },
    ],
  }),
  component: ScreenLayout,
});

function ScreenLayout() {
  // When a child route (e.g. /screen/$jurisdictionId) is active, render only
  // the Outlet — the child supplies its own ScreenShell. Otherwise render
  // the landing/jurisdiction-picker.
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;
  return <ScreenLanding />;
}

function ScreenLanding() {
  const intl = useIntl();
  return (
    <ScreenShell>
      <header className="mb-6">
        <h1 className="font-serif text-3xl text-foreground">
          {intl.formatMessage({ id: "screen.heading" })}
        </h1>
        <p className="mt-2 text-foreground-muted max-w-2xl">
          {intl.formatMessage({ id: "screen.lede" })}
        </p>
      </header>

      <section
        aria-labelledby="screen-disclaimer-heading"
        className="rounded-lg border border-border bg-surface-sunken p-5 mb-8"
      >
        <h2
          id="screen-disclaimer-heading"
          className="font-serif text-lg text-foreground mb-2"
        >
          {intl.formatMessage({ id: "screen.disclaimer.title" })}
        </h2>
        <p className="text-sm text-foreground-muted whitespace-pre-line">
          {intl.formatMessage({ id: "screen.disclaimer.body" })}
        </p>
      </section>

      <section aria-labelledby="screen-pick">
        <h2 id="screen-pick" className="font-serif text-xl text-foreground mb-3">
          {intl.formatMessage({ id: "screen.jurisdiction.heading" })}
        </h2>
        <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SCREEN_JURISDICTIONS.map((j) => (
            <li key={j}>
              <Link
                to="/screen/$jurisdictionId"
                params={{ jurisdictionId: j }}
                className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3 hover:border-foreground/40 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-foreground">{JURISDICTION_LABELS[j]}</span>
                <ArrowRight
                  className="size-4 text-foreground-muted group-hover:text-foreground"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </ScreenShell>
  );
}
