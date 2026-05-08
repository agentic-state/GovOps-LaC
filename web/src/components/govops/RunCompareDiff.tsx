import { useIntl, FormattedMessage } from "react-intl";
import type { FixtureRunResult } from "@/lib/api";

/**
 * Side-by-side comparison of two fixture runs. Highlights proposal-set
 * deltas (added / removed by `rule_type + citation` identity) and
 * surfaces metric drift (count, latency, tokens) at a glance.
 *
 * Pure presentation: parents pick which two history entries to compare.
 */
function proposalKey(p: FixtureRunResult["proposals"][number]) {
  return `${p.rule_type}::${p.citation}`;
}

export function RunCompareDiff({
  left,
  right,
}: {
  left: FixtureRunResult;
  right: FixtureRunResult;
}) {
  const intl = useIntl();
  const leftKeys = new Set(left.proposals.map(proposalKey));
  const rightKeys = new Set(right.proposals.map(proposalKey));
  const removed = left.proposals.filter((p) => !rightKeys.has(proposalKey(p)));
  const added = right.proposals.filter((p) => !leftKeys.has(proposalKey(p)));
  const unchanged = left.proposals.filter((p) => rightKeys.has(proposalKey(p)));

  const Metric = ({ label, a, b }: { label: string; a: number | string; b: number | string }) => (
    <div className="grid grid-cols-3 gap-2 text-xs" style={{ fontFamily: "var(--font-mono)" }}>
      <span className="text-foreground-subtle">{label}</span>
      <span className="text-foreground">{a}</span>
      <span className="text-foreground">{b}</span>
    </div>
  );

  return (
    <section
      aria-label={intl.formatMessage({ id: "prompt.fixture.compare.heading" })}
      className="space-y-3 rounded-md border border-border bg-background p-3"
    >
      <header className="space-y-1">
        <h3
          className="text-sm font-semibold text-foreground"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {intl.formatMessage({ id: "prompt.fixture.compare.heading" })}
        </h3>
        <div
          className="grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.14em] text-foreground-subtle"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span />
          <span>A</span>
          <span>B</span>
        </div>
      </header>

      <div className="space-y-1 rounded border border-border p-2">
        <Metric label="proposals" a={left.proposals_count} b={right.proposals_count} />
        <Metric label="latency ms" a={left.latency_ms} b={right.latency_ms} />
        <Metric label="tokens" a={left.token_count ?? "—"} b={right.token_count ?? "—"} />
        <Metric label="fixture" a={left.fixture_id} b={right.fixture_id} />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div
          className="rounded border p-2"
          style={{
            borderColor: "var(--diff-removed-bg)",
            backgroundColor: "color-mix(in oklch, var(--diff-removed-bg) 30%, transparent)",
          }}
        >
          <p
            className="mb-1 text-[10px] uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--diff-removed-fg)" }}
          >
            <FormattedMessage
              id="prompt.fixture.compare.removed"
              values={{ count: removed.length }}
            />
          </p>
          <ul role="list" className="space-y-1 text-xs" style={{ fontFamily: "var(--font-mono)" }}>
            {removed.length === 0 && <li className="italic text-foreground-subtle">—</li>}
            {removed.map((p, i) => (
              <li key={i} className="text-foreground">
                − {p.rule_type} <span className="text-foreground-subtle">({p.citation})</span>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="rounded border p-2"
          style={{
            borderColor: "var(--diff-added-bg)",
            backgroundColor: "color-mix(in oklch, var(--diff-added-bg) 30%, transparent)",
          }}
        >
          <p
            className="mb-1 text-[10px] uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--diff-added-fg)" }}
          >
            <FormattedMessage id="prompt.fixture.compare.added" values={{ count: added.length }} />
          </p>
          <ul role="list" className="space-y-1 text-xs" style={{ fontFamily: "var(--font-mono)" }}>
            {added.length === 0 && <li className="italic text-foreground-subtle">—</li>}
            {added.map((p, i) => (
              <li key={i} className="text-foreground">
                + {p.rule_type} <span className="text-foreground-subtle">({p.citation})</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-[11px] text-foreground-subtle">
        <FormattedMessage
          id="prompt.fixture.compare.unchanged"
          values={{ count: unchanged.length }}
        />
      </p>
    </section>
  );
}
