import { useIntl } from "react-intl";
import { ChainNode } from "./ChainNode";
import type { AuthorityReference } from "@/lib/types";

/**
 * Vertical chain. Each node sits in a row with a connecting hairline rendered
 * via a CSS border on a sibling. We deliberately avoid a graph library —
 * the chain is depth-ordered, top-to-bottom, and works on every viewport.
 */
export function ChainGraph({
  chain,
  selectedId,
  onSelect,
}: {
  chain: AuthorityReference[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const intl = useIntl();
  return (
    <section aria-labelledby="chain-heading" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2
          id="chain-heading"
          className="text-xs uppercase tracking-[0.18em] text-foreground-subtle"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {intl.formatMessage({ id: "authority.chain.heading" })}
        </h2>
        {selectedId && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-xs text-foreground-muted underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {intl.formatMessage({ id: "authority.filter.reset" })}
          </button>
        )}
      </div>

      <ol className="space-y-2">
        {chain.map((node, idx) => (
          <li key={node.id} className="relative">
            <ChainNode
              node={node}
              selected={selectedId === node.id}
              onSelect={() => onSelect(selectedId === node.id ? null : node.id)}
            />
            {idx < chain.length - 1 && (
              <span
                aria-hidden
                className="ms-4 block h-3 w-px bg-border"
              />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}