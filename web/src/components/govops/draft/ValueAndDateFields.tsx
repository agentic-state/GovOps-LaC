import { useIntl } from "react-intl";

import { Label } from "@/components/ui/label";
import { DateTimeInput } from "../inputs/DateTimeInput";
import { ValueInput } from "../inputs/ValueInput";
import { ErrorMessage, HelpText, RequiredMark } from "./fieldPrimitives";
import type { DraftFormState } from "./useDraftFormState";

/**
 * The two "what" fields: when the value takes effect (effective_from) and
 * the value itself. Both are required for every domain.
 */
export function ValueAndDateFields({ state }: { state: DraftFormState }) {
  const intl = useIntl();
  const { ids, valueType, value, setValue, effectiveFrom, setEffectiveFrom, errors, markTouched } =
    state;

  return (
    <>
      {/* Effective from */}
      <div className="space-y-1.5">
        <Label htmlFor={ids.effectiveFrom}>
          {intl.formatMessage({ id: "draft.field.effective_from.label" })}
          <RequiredMark />
        </Label>
        <DateTimeInput
          id={ids.effectiveFrom}
          value={effectiveFrom}
          onChange={(v) => {
            setEffectiveFrom(v);
            markTouched("effective_from");
          }}
          ariaDescribedBy={`${ids.effectiveFrom}-help ${
            errors.effective_from ? `${ids.effectiveFrom}-error` : ""
          }`.trim()}
          ariaInvalid={!!errors.effective_from}
          required
        />
        <HelpText id={`${ids.effectiveFrom}-help`}>
          {intl.formatMessage({ id: "draft.field.effective_from.help" })}
        </HelpText>
        {errors.effective_from && (
          <>
            <ErrorMessage id={`${ids.effectiveFrom}-error`} messageId={errors.effective_from} />
            {(errors.effective_from === "validators.effective_from.format" ||
              errors.effective_from === "validators.effective_from.invalid") && (
              <p
                className="text-[11px] text-foreground-muted"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {intl.formatMessage({
                  id: "draft.field.effective_from.format_help",
                })}
              </p>
            )}
          </>
        )}
      </div>

      {/* Value (full width) */}
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={ids.value}>
          {intl.formatMessage({ id: "draft.field.value.label" })}
          <RequiredMark />
        </Label>
        <ValueInput
          id={ids.value}
          type={valueType}
          value={value}
          onChange={(v) => {
            setValue(v);
            markTouched("value");
          }}
          ariaDescribedBy={errors.value ? `${ids.value}-error` : undefined}
          ariaInvalid={!!errors.value}
        />
        {errors.value && <ErrorMessage id={`${ids.value}-error`} messageId={errors.value} />}
      </div>
    </>
  );
}
