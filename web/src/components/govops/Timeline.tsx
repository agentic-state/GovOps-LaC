import type { ConfigValue } from "@/lib/types";
import { TimelineCard } from "./TimelineCard";

/**
 * Vertical timeline. Newest-first. The vertical rule connects all cards via a
 * single absolutely-positioned line on the inline-start side, so RTL mirrors
 * automatically.
 */
export function Timeline({
  versions,
  selectedIds,
  onSelectToggle,
}: {
  versions: ConfigValue[];
  selectedIds: string[];
  onSelectToggle: (id: string) => void;
}) {
  return (
    <ol role="list" className="relative space-y-4 ps-6">
      <span aria-hidden className="absolute inset-y-3 start-2 w-px bg-border" />
      {versions.map((v, idx) => {
        const provenance = v.author.startsWith("agent:") ? "agent" : "human";
        return (
          <li key={v.id} className="relative">
            <span
              aria-hidden
              className="absolute -start-[18px] top-5 size-2.5 rounded-full"
              style={{
                backgroundColor: provenance === "agent" ? "var(--agentic)" : "var(--authority)",
              }}
            />
            <TimelineCard
              cv={v}
              isCurrent={idx === 0}
              selected={selectedIds.includes(v.id)}
              onSelectToggle={onSelectToggle}
            />
          </li>
        );
      })}
    </ol>
  );
}
