import type { ValueType } from "@/lib/types";

const styles: Record<ValueType, string> = {
  number: "bg-agentic-soft text-agentic-foreground",
  string: "bg-surface-sunken text-foreground-muted",
  bool: "bg-authority-soft text-authority-foreground",
  list: "bg-surface-sunken text-foreground-muted",
  enum: "bg-authority-soft text-authority-foreground",
  prompt: "bg-agentic-soft text-agentic-foreground",
  formula: "bg-agentic-soft text-agentic-foreground",
};

export function ValueTypeBadge({ type }: { type: ValueType }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] ${styles[type]}`}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {type}
    </span>
  );
}
