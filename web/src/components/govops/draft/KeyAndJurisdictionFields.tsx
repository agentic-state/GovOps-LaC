import { useIntl } from "react-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOMAINS, JURISDICTIONS, type ValueType } from "@/lib/types";
import { ERROR_BORDER_STYLE, ErrorMessage, HelpText, RequiredMark } from "./fieldPrimitives";
import type { DraftFormState } from "./useDraftFormState";
import { VALUE_TYPES } from "./draftHelpers";

/**
 * Identifying / typing fields: key, jurisdiction, domain, value_type.
 * All four are locked when superseding an existing record.
 */
export function KeyAndJurisdictionFields({ state }: { state: DraftFormState }) {
  const intl = useIntl();
  const {
    ids,
    key,
    setKey,
    jurisdiction,
    setJurisdiction,
    domain,
    setDomain,
    valueType,
    setValueType,
    lockedKey,
    lockedJurisdiction,
    lockedDomain,
    lockedValueType,
    errors,
    markTouched,
  } = state;

  return (
    <>
      {/* Key (full width) */}
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={ids.key}>
          {intl.formatMessage({ id: "draft.field.key.label" })}
          <RequiredMark />
        </Label>
        <Input
          id={ids.key}
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onBlur={() => markTouched("key")}
          disabled={lockedKey}
          required
          aria-required="true"
          aria-invalid={!!errors.key}
          aria-describedby={`${ids.key}-help ${errors.key ? `${ids.key}-error` : ""}`.trim()}
          style={{
            fontFamily: "var(--font-mono)",
            ...(errors.key ? ERROR_BORDER_STYLE : {}),
          }}
        />
        <HelpText id={`${ids.key}-help`}>
          {intl.formatMessage({ id: "draft.field.key.help" })}
        </HelpText>
        {errors.key && <ErrorMessage id={`${ids.key}-error`} messageId={errors.key} />}
      </div>

      {/* Jurisdiction */}
      <div className="space-y-1.5">
        <Label htmlFor={ids.jurisdiction}>
          {intl.formatMessage({ id: "draft.field.jurisdiction.label" })}
        </Label>
        <Select value={jurisdiction} onValueChange={setJurisdiction} disabled={lockedJurisdiction}>
          <SelectTrigger id={ids.jurisdiction}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="global">global</SelectItem>
            {JURISDICTIONS.map((j) => (
              <SelectItem key={j} value={j}>
                {j}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Domain */}
      <div className="space-y-1.5">
        <Label htmlFor={ids.domain}>{intl.formatMessage({ id: "draft.field.domain.label" })}</Label>
        <Select value={domain} onValueChange={setDomain} disabled={lockedDomain}>
          <SelectTrigger id={ids.domain}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOMAINS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Value type */}
      <div className="space-y-1.5">
        <Label htmlFor={ids.valueType}>
          {intl.formatMessage({ id: "draft.field.value_type.label" })}
        </Label>
        <Select
          value={valueType}
          onValueChange={(v) => setValueType(v as ValueType)}
          disabled={lockedValueType}
        >
          <SelectTrigger id={ids.valueType}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VALUE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
