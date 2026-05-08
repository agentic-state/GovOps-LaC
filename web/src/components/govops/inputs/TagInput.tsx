import { useRef, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

/**
 * Comma- or Enter-separated tag input. Backspace on an empty input deletes
 * the last tag. Escape blurs (does NOT cancel the form, per spec).
 */
export function TagInput({
  value,
  onChange,
  placeholder,
  ariaLabelledBy,
  ariaDescribedBy,
  ariaInvalid,
  id,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  id?: string;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function commit(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    if (value.includes(tag)) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      e.preventDefault();
      onChange(value.slice(0, -1));
    } else if (e.key === "Escape") {
      inputRef.current?.blur();
    }
  }

  return (
    <div
      className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-sm focus-within:ring-1 focus-within:ring-ring"
      style={ariaInvalid ? { borderColor: "var(--verdict-rejected)" } : undefined}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center gap-1 rounded-sm bg-surface-sunken px-1.5 py-0.5 text-xs text-foreground"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange(value.filter((_, idx) => idx !== i));
            }}
            className="text-foreground-subtle hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={draft}
        placeholder={value.length === 0 ? placeholder : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => draft.trim() && commit(draft)}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid || undefined}
        className="min-w-[8ch] flex-1 bg-transparent text-sm outline-none placeholder:text-foreground-subtle"
      />
    </div>
  );
}
