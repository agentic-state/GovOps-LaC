import { useState } from "react";
import { useIntl } from "react-intl";
import { useRouterState } from "@tanstack/react-router";
import { HelpCircle, ArrowRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { DataFlowDiagram } from "./DataFlowDiagram";

/**
 * Persistent help affordance. The drawer opens from the right and shows
 * route-aware content: a brief summary of the current screen, the user
 * journey it sits inside, "what you can do here" bullets, and "what
 * connects to it" links upstream/downstream.
 *
 * Content is keyed off the current pathname; an unknown route falls back
 * to a generic "GovOps overview" panel.
 */

type HelpEntry = {
  /** Route patterns that match this entry. Order matters — first match wins. */
  match: (pathname: string) => boolean;
  /** Suffix for help.* i18n keys (e.g. "home" → help.home.summary). */
  suffix: string;
  bulletCount: number;
};

const ENTRIES: HelpEntry[] = [
  { match: (p) => p === "/", suffix: "home", bulletCount: 4 },
  { match: (p) => p.startsWith("/walkthrough"), suffix: "walkthrough", bulletCount: 4 },
  { match: (p) => p.startsWith("/authority"), suffix: "authority", bulletCount: 3 },
  { match: (p) => p.startsWith("/about"), suffix: "about", bulletCount: 3 },
  { match: (p) => p.startsWith("/policies"), suffix: "policies", bulletCount: 3 },
  { match: (p) => p.startsWith("/cases"), suffix: "cases", bulletCount: 4 },
  { match: (p) => p.startsWith("/encode"), suffix: "encode", bulletCount: 4 },
  { match: (p) => p.startsWith("/config/draft"), suffix: "configDraft", bulletCount: 4 },
  { match: (p) => p.startsWith("/config/approvals"), suffix: "configApprovals", bulletCount: 4 },
  { match: (p) => p.startsWith("/config/prompts"), suffix: "configPrompts", bulletCount: 4 },
  { match: (p) => p.startsWith("/config/diff"), suffix: "configDiff", bulletCount: 3 },
  { match: (p) => p.startsWith("/config"), suffix: "config", bulletCount: 4 },
  { match: (p) => p.startsWith("/admin"), suffix: "admin", bulletCount: 3 },
];

export function HelpDrawer() {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const entry = ENTRIES.find((e) => e.match(pathname)) ?? ENTRIES[0];
  const t = (id: string) => intl.formatMessage({ id });
  const buttonLabel = t("help.button.label");

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={buttonLabel}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-foreground transition-colors hover:bg-surface-sunken"
        title={buttonLabel}
      >
        <HelpCircle className="size-4" aria-hidden />
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetTitle className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
          {t(`help.${entry.suffix}.title`)}
        </SheetTitle>
        <SheetDescription className="text-sm leading-relaxed text-foreground-muted">
          {t(`help.${entry.suffix}.summary`)}
        </SheetDescription>

        <div className="mt-6 space-y-6">
          <section aria-labelledby="help-actions-heading">
            <h3
              id="help-actions-heading"
              className="text-xs uppercase tracking-[0.22em] text-foreground-subtle"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {t("help.section.actions")}
            </h3>
            <ul role="list" className="mt-3 space-y-2 text-sm text-foreground">
              {Array.from({ length: entry.bulletCount }, (_, i) => i + 1).map((n) => (
                <li key={n} className="flex gap-2">
                  <ArrowRight
                    className="mt-1 size-3 shrink-0"
                    style={{ color: "var(--agentic)" }}
                    aria-hidden
                  />
                  <span>{t(`help.${entry.suffix}.bullet${n}`)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="help-flow-heading">
            <h3
              id="help-flow-heading"
              className="text-xs uppercase tracking-[0.22em] text-foreground-subtle"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {t("help.section.dataflow")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
              {t("help.section.dataflow.body")}
            </p>
            <div className="mt-3">
              <DataFlowDiagram />
            </div>
          </section>

          <section aria-labelledby="help-tip-heading">
            <h3
              id="help-tip-heading"
              className="text-xs uppercase tracking-[0.22em] text-foreground-subtle"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {t("help.section.tip")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
              {t("help.tip.breadcrumb")}
            </p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
