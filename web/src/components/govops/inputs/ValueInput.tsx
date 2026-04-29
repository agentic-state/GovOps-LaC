import { useIntl } from "react-intl";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ValueType } from "@/lib/types";
import { TagInput } from "./TagInput";

type Props = {
  id: string;
  type: ValueType;
  value: unknown;
  onChange: (next: unknown) => void;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
};

/**
 * Dispatches on `value_type` to render the appropriate primitive input. All
 * variants share the same id/aria contract so the parent <label> works.
 */
export function ValueInput({ id, type, value, onChange, ariaDescribedBy, ariaInvalid }: Props) {
  const intl = useIntl();

  if (type === "bool") {
    return (
      <label className="inline-flex items-center gap-2 text-sm text-foreground">
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid || undefined}
          className="size-4 rounded border-input"
        />
        <span>{value === true ? "true" : "false"}</span>
      </label>
    );
  }

  if (type === "number") {
    return (
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        placeholder={intl.formatMessage({ id: "draft.field.value.placeholder.number" })}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid || undefined}
        style={ariaInvalid ? { borderColor: "var(--verdict-rejected)" } : undefined}
      />
    );
  }

  if (type === "list" || type === "enum") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <TagInput
        id={id}
        value={arr}
        onChange={onChange as (v: string[]) => void}
        placeholder={intl.formatMessage({ id: "draft.field.value.placeholder.list" })}
        ariaDescribedBy={ariaDescribedBy}
        ariaInvalid={ariaInvalid}
      />
    );
  }

  if (type === "prompt") {
    const text = typeof value === "string" ? value : "";
    return (
      <div className="space-y-1">
        <Textarea
          id={id}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={intl.formatMessage({ id: "draft.field.value.placeholder.prompt" })}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid || undefined}
          className="min-h-[50vh]"
          style={{
            fontFamily: "var(--font-mono)",
            ...(ariaInvalid ? { borderColor: "var(--verdict-rejected)" } : {}),
          }}
        />
        <p
          className="text-right text-xs text-foreground-subtle"
          aria-live="polite"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {text.length} chars
        </p>
      </div>
    );
  }

  if (type === "formula") {
    const text =
      typeof value === "string" ? value : value == null ? "" : JSON.stringify(value, null, 2);
    return (
      <Textarea
        id={id}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder='{ "op": "add", "args": [1, 2] }'
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid || undefined}
        className="min-h-[180px]"
        style={{
          fontFamily: "var(--font-mono)",
          ...(ariaInvalid ? { borderColor: "var(--verdict-rejected)" } : {}),
        }}
      />
    );
  }

  // string (default)
  return (
    <Input
      id={id}
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={intl.formatMessage({ id: "draft.field.value.placeholder.string" })}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid || undefined}
      style={ariaInvalid ? { borderColor: "var(--verdict-rejected)" } : undefined}
    />
  );
}
