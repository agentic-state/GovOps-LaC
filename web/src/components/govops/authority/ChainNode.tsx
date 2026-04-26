import { useIntl, FormattedDate } from "react-intl";
import { ProvenanceRibbon } from "@/components/govops/ProvenanceRibbon";
import type { AuthorityReference } from "@/lib/types";

/**
 * Single node in the authority chain. Button so it's keyboard-focusable and
 * activates highlight in the side panels.
 */
export function ChainNode({
  node,
  selected,
  onSelect,
}: {
  node: AuthorityReference;
  selected: boolean;
  onSelect: () => void;
}) {
  const intl = useIntl();
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full items-stretch rounded-md border bg-surface-raised text-start
        transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-ring ${selected ? "border-authority ring-1 ring-authority" : "border-border"}`}
    >
      <ProvenanceRibbon variant="human" />
      <div className="flex-1 space-y-1 px-4 py-3">
        <p
          className="text-[10px] uppercase tracking-[0.18em] text-foreground-subtle"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {intl.formatMessage({ id: `authority.layer.${node.layer}` })}
        </p>
        <p
          className="text-base text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {node.title}
        </p>
        <p
          className="text-xs text-foreground-muted"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {node.citation}
          {node.effective_date && (
            <>
              {" · "}
              <FormattedDate value={node.effective_date} year="numeric" month="short" />
            </>
          )}
        </p>
      </div>
    </button>
  );
}