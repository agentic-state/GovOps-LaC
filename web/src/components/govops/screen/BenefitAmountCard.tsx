import { useIntl } from "react-intl";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLocale } from "@/lib/i18n";
import type { BenefitAmount, FormulaTraceStep } from "@/lib/types";

export interface BenefitAmountCardProps {
  benefitAmount: BenefitAmount;
  jurisdictionLabel: string;
  pensionType?: "full" | "partial" | "";
  partialRatio?: string | null;
}

function formatCurrency(value: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "code",
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

function formatNumber(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(value);
  } catch {
    return String(value);
  }
}

/**
 * Passive renderer over a backend `benefit_amount`. Does not compute, estimate
 * or modify. Citizen-facing surface for the projected benefit figure plus the
 * formula trace and statutory citations behind it.
 */
export function BenefitAmountCard({
  benefitAmount,
  jurisdictionLabel,
  pensionType,
  partialRatio,
}: BenefitAmountCardProps) {
  const intl = useIntl();
  const { locale } = useLocale();

  const headlineNumber = formatCurrency(benefitAmount.value, benefitAmount.currency, locale);
  const periodSuffix = intl.formatMessage({
    id: `screen.benefit.period.${benefitAmount.period}`,
  });

  // Caption: explain the partial badge even when the backend omitted the ratio.
  const ratioCaption =
    pensionType === "partial"
      ? partialRatio
        ? intl.formatMessage({ id: "screen.benefit.ratio_caption" }, { ratio: partialRatio })
        : intl.formatMessage({ id: "screen.benefit.ratio_unknown" })
      : null;

  const copyFormulaJson = async () => {
    try {
      await navigator.clipboard?.writeText(
        JSON.stringify(
          {
            value: benefitAmount.value,
            currency: benefitAmount.currency,
            period: benefitAmount.period,
            formula_trace: benefitAmount.formula_trace,
            citations: benefitAmount.citations,
          },
          null,
          2,
        ),
      );
      toast.success(intl.formatMessage({ id: "screen.benefit.copy_ok" }));
    } catch {
      toast.error(intl.formatMessage({ id: "screen.benefit.copy_err" }));
    }
  };

  return (
    <section
      aria-labelledby="benefit-amount-heading"
      className="mt-6 rounded-lg border border-border bg-surface-raised p-5"
    >
      <header className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <p
            id="benefit-amount-heading"
            className="text-xs uppercase tracking-[0.18em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {intl.formatMessage({ id: "screen.benefit.heading" })}
          </p>
          {pensionType && (
            <Badge variant={pensionType === "full" ? "default" : "secondary"}>
              {intl.formatMessage({ id: `screen.benefit.type.${pensionType}` })}
            </Badge>
          )}
        </div>
        <p
          className="text-3xl tracking-tight text-foreground sm:text-4xl"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          <span>{headlineNumber}</span>
          <span className="ms-1 text-base text-foreground-muted">{periodSuffix}</span>
        </p>
        <p className="text-xs text-foreground-muted">{jurisdictionLabel}</p>
        {ratioCaption && <p className="text-sm text-foreground-muted">{ratioCaption}</p>}
      </header>

      <Collapsible className="mt-4">
        <CollapsibleTrigger className="group inline-flex items-center gap-1 text-sm text-authority hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
          {intl.formatMessage({ id: "screen.benefit.disclose_calculation" })}
          <ChevronDown
            className="size-3 transition-transform group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-3">
          {benefitAmount.formula_trace.length === 0 ? (
            <p className="text-sm text-foreground-muted">
              {intl.formatMessage({ id: "screen.benefit.trace_unavailable" })}
            </p>
          ) : (
            <ol
              className="space-y-2"
              aria-label={intl.formatMessage({ id: "screen.benefit.trace_aria" })}
            >
              {benefitAmount.formula_trace.map((step, i) => (
                <FormulaTraceRow key={i} step={step} index={i + 1} locale={locale} />
              ))}
            </ol>
          )}

          {benefitAmount.citations.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-xs uppercase tracking-[0.18em] text-foreground-subtle">
                  {intl.formatMessage({ id: "screen.benefit.citations_heading" })}
                </h4>
                <ul className="space-y-1 text-sm text-foreground">
                  {benefitAmount.citations.map((c) => (
                    <li key={c} style={{ fontFamily: "var(--font-mono)" }}>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={copyFormulaJson}
              aria-label={intl.formatMessage({ id: "screen.benefit.copy_formula" })}
            >
              <Copy className="size-3" aria-hidden />
              <span className="ms-1 text-xs">
                {intl.formatMessage({ id: "screen.benefit.copy_formula" })}
              </span>
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

function FormulaTraceRow({
  step,
  index,
  locale,
}: {
  step: FormulaTraceStep;
  index: number;
  locale: string;
}) {
  const intl = useIntl();
  const opLabel = intl.formatMessage({ id: `screen.benefit.op.${step.op}` });
  const inputsText = step.inputs
    .map((inp) => (typeof inp === "number" ? formatNumber(inp, locale) : String(inp)))
    .join(", ");
  const srSentence = intl.formatMessage(
    { id: "screen.benefit.trace_step_aria" },
    {
      n: index,
      op: opLabel,
      inputs: inputsText,
      out: formatNumber(step.output, locale),
    },
  );

  return (
    <li className="text-sm" style={{ fontFamily: "var(--font-mono)" }}>
      <span className="sr-only">{srSentence}</span>
      <div className="flex flex-wrap items-baseline gap-2" aria-hidden>
        <span className="text-foreground-muted">{opLabel}</span>
        <span className="text-foreground-subtle">(</span>
        {step.inputs.map((inp, i) => (
          <span key={i}>
            {typeof inp === "number" ? (
              <span className="text-foreground">{formatNumber(inp, locale)}</span>
            ) : (
              <span
                className="rounded bg-surface-sunken px-1 text-xs text-foreground"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {inp}
              </span>
            )}
            {i < step.inputs.length - 1 && <span className="ms-1 text-foreground-subtle">,</span>}
          </span>
        ))}
        <span className="text-foreground-subtle">)</span>
        <span className="text-foreground-subtle">→</span>
        <span className="text-foreground">{formatNumber(step.output, locale)}</span>
      </div>
      {(step.citation || step.note) && (
        <div
          className="mt-1 border-l-2 border-muted pl-2 text-xs text-foreground-muted"
          aria-hidden
        >
          {step.citation && <span>{step.citation}</span>}
          {step.note && <span className="ms-2 italic">{step.note}</span>}
        </div>
      )}
    </li>
  );
}
