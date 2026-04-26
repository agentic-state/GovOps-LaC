import { Input } from "@/components/ui/input";

/**
 * Wraps a native <input type="datetime-local"> and serialises to ISO-8601 UTC.
 * Browser values are local-time without offset; we treat them as UTC for the
 * `effective_from` field (per spec, defaults to today midnight UTC).
 */
export function DateTimeInput({
  id,
  value,
  onChange,
  ariaDescribedBy,
  ariaInvalid,
  required,
}: {
  id: string;
  /** ISO-8601 string, e.g. "2026-04-26T00:00:00.000Z" */
  value: string;
  onChange: (iso: string) => void;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  required?: boolean;
}) {
  // Convert ISO → "YYYY-MM-DDTHH:mm" for the input.
  const local = value ? value.slice(0, 16) : "";
  return (
    <Input
      id={id}
      type="datetime-local"
      value={local}
      required={required}
      aria-required={required || undefined}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid || undefined}
      onChange={(e) => {
        const v = e.target.value;
        if (!v) return onChange("");
        // Treat the entered wall-clock time as UTC for ISO-8601 with Z suffix.
        onChange(`${v}:00.000Z`);
      }}
      style={ariaInvalid ? { borderColor: "var(--verdict-rejected)" } : undefined}
    />
  );
}
