import { useIntl } from "react-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGES } from "@/lib/types";
import { ERROR_BORDER_STYLE, ErrorMessage, HelpText, RequiredMark } from "./fieldPrimitives";
import type { DraftFormState } from "./useDraftFormState";

/**
 * The "why" fields. Citation gates rule-domain submissions; language only
 * applies to ui-domain copy. Rationale is mandatory on every record.
 */
export function ProvenanceFields({ state }: { state: DraftFormState }) {
  const intl = useIntl();
  const {
    ids,
    citation,
    setCitation,
    rationale,
    setRationale,
    language,
    setLanguage,
    domain,
    errors,
    markTouched,
  } = state;

  return (
    <>
      {/* Citation */}
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={ids.citation}>
          {intl.formatMessage({ id: "draft.field.citation.label" })}
          <RequiredMark when={domain === "rule"} />
        </Label>
        <Input
          id={ids.citation}
          type="text"
          value={citation}
          onChange={(e) => setCitation(e.target.value)}
          onBlur={() => markTouched("citation")}
          aria-required={domain === "rule" || undefined}
          aria-invalid={!!errors.citation}
          aria-describedby={`${ids.citation}-help ${
            errors.citation ? `${ids.citation}-error` : ""
          }`.trim()}
          style={{
            fontFamily: "var(--font-mono)",
            ...(errors.citation ? ERROR_BORDER_STYLE : {}),
          }}
        />
        <HelpText id={`${ids.citation}-help`}>
          {intl.formatMessage({ id: "draft.field.citation.help" })}
        </HelpText>
        {errors.citation && (
          <ErrorMessage id={`${ids.citation}-error`} messageId={errors.citation} />
        )}
      </div>

      {/* Language (only for ui domain) */}
      {domain === "ui" && (
        <div className="space-y-1.5">
          <Label htmlFor={ids.language}>
            {intl.formatMessage({ id: "draft.field.language.label" })}
          </Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger id={ids.language}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[...LANGUAGES, "ar"].map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Rationale (full width) */}
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={ids.rationale}>
          {intl.formatMessage({ id: "draft.field.rationale.label" })}
          <RequiredMark />
        </Label>
        <Textarea
          id={ids.rationale}
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          onBlur={() => markTouched("rationale")}
          required
          aria-required="true"
          aria-invalid={!!errors.rationale}
          aria-describedby={`${ids.rationale}-help ${
            errors.rationale ? `${ids.rationale}-error` : ""
          }`.trim()}
          className="min-h-[120px]"
          style={errors.rationale ? ERROR_BORDER_STYLE : undefined}
        />
        <HelpText id={`${ids.rationale}-help`}>
          {intl.formatMessage({ id: "draft.field.rationale.help" })}
        </HelpText>
        {errors.rationale && (
          <ErrorMessage
            id={`${ids.rationale}-error`}
            messageId={errors.rationale}
            values={{ min: 20 }}
          />
        )}
      </div>
    </>
  );
}
