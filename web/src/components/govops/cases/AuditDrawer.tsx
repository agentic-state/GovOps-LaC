import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { Download, FileText } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { getCaseAudit } from "@/lib/api";
import type { AuditPackage } from "@/lib/types";
import { OutcomePill } from "./OutcomePill";
import { ActionPill } from "./ActionPill";

export function AuditDrawer({ caseId }: { caseId: string }) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const [pkg, setPkg] = useState<AuditPackage | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || pkg) return;
    setLoading(true);
    getCaseAudit(caseId)
      .then(setPkg)
      .finally(() => setLoading(false));
  }, [open, caseId, pkg]);

  const exportJson = () => {
    if (!pkg) return;
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `case-${caseId}-audit.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <FileText className="size-4" aria-hidden />
          {intl.formatMessage({ id: "cases.audit.open" })}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full max-w-xl overflow-y-auto bg-surface print:max-w-none print:border-0 print:bg-background"
      >
        <SheetHeader>
          <SheetTitle
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
            className="text-2xl"
          >
            {intl.formatMessage({ id: "cases.audit.heading" })}
          </SheetTitle>
        </SheetHeader>

        {loading || !pkg ? (
          <div className="mt-6 space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-surface-sunken" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-surface-sunken" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-surface-sunken" />
          </div>
        ) : (
          <>
            <div className="mt-2 flex items-center justify-between gap-2 print:hidden">
              <span
                className="text-xs text-foreground-muted"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                generated {intl.formatDate(pkg.generated_at, { dateStyle: "medium", timeStyle: "short" })}
              </span>
              <Button variant="outline" size="sm" onClick={exportJson}>
                <Download className="size-3.5" aria-hidden />
                {intl.formatMessage({ id: "cases.audit.export_json" })}
              </Button>
            </div>

            <Tabs defaultValue="trail" className="mt-4">
              <TabsList className="grid w-full grid-cols-5 print:hidden">
                <TabsTrigger value="trail">
                  {intl.formatMessage({ id: "cases.audit.tab.trail" })}
                </TabsTrigger>
                <TabsTrigger value="recommendation">
                  {intl.formatMessage({ id: "cases.audit.tab.recommendation" })}
                </TabsTrigger>
                <TabsTrigger value="reviews">
                  {intl.formatMessage({ id: "cases.audit.tab.reviews" })}
                </TabsTrigger>
                <TabsTrigger value="evidence">
                  {intl.formatMessage({ id: "cases.audit.tab.evidence" })}
                </TabsTrigger>
                <TabsTrigger value="authority">
                  {intl.formatMessage({ id: "cases.audit.tab.authority" })}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="trail" className="space-y-2">
                {pkg.audit_trail.length === 0 ? (
                  <p className="text-sm text-foreground-muted">—</p>
                ) : (
                  <ol className="space-y-2">
                    {pkg.audit_trail.map((e, i) => (
                      <li key={i} className="rounded-md border border-border bg-surface p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
                          <span style={{ fontFamily: "var(--font-mono)" }}>{e.event_type}</span>
                          <span>·</span>
                          <span style={{ fontFamily: "var(--font-mono)" }}>{e.actor}</span>
                          <span className="ms-auto">
                            {intl.formatDate(e.timestamp, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </span>
                        </div>
                        <p className="mt-1 text-foreground">{e.detail}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </TabsContent>

              <TabsContent value="recommendation" className="space-y-3">
                {pkg.recommendation ? (
                  <div className="space-y-2 text-sm">
                    <OutcomePill outcome={pkg.recommendation.outcome} />
                    <p
                      className="text-foreground"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {pkg.recommendation.explanation}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-foreground-muted">—</p>
                )}
              </TabsContent>

              <TabsContent value="reviews" className="space-y-2">
                {pkg.review_actions.length === 0 ? (
                  <p className="text-sm text-foreground-muted">—</p>
                ) : (
                  pkg.review_actions.map((r) => (
                    <div key={r.id} className="rounded-md border border-border bg-surface p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <ActionPill action={r.action} />
                        {r.final_outcome && <OutcomePill outcome={r.final_outcome} />}
                      </div>
                      <p className="mt-1 text-foreground">{r.rationale}</p>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="evidence" className="space-y-2">
                {pkg.evidence_summary.length === 0 ? (
                  <p className="text-sm text-foreground-muted">—</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {pkg.evidence_summary.map((e, i) => (
                      <li key={i} className="rounded-md border border-border bg-surface p-2">
                        <pre
                          className="whitespace-pre-wrap text-xs text-foreground"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {JSON.stringify(e, null, 2)}
                        </pre>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="authority" className="space-y-2">
                {pkg.jurisdiction && (
                  <p
                    className="text-sm text-foreground-muted"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {pkg.jurisdiction.id} · {pkg.jurisdiction.name}
                  </p>
                )}
                <ol className="space-y-2">
                  {pkg.authority_chain.map((a) => (
                    <li key={a.id} className="rounded-md border border-border bg-surface p-3 text-sm">
                      <p
                        className="text-xs uppercase tracking-wider text-foreground-muted"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {a.layer}
                      </p>
                      <p className="text-foreground" style={{ fontFamily: "var(--font-serif)" }}>
                        {a.title}
                      </p>
                      <p
                        className="text-xs text-foreground-muted"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {a.citation}
                      </p>
                    </li>
                  ))}
                </ol>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
