import { useIntl, FormattedMessage } from "react-intl";
import type { StoredRun } from "./useFixtureHistory";

/**
 * Renders the metrics + proposal list + raw-response disclosure for a
 * single fixture run.
 */
export function FixtureResult({ result }: { result: StoredRun }) {
  const intl = useIntl();
  return (
    <section className="space-y-2 rounded-md border border-border bg-background p-3">
      <h3
        className="text-sm font-semibold text-foreground"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {intl.formatMessage({ id: "prompt.fixture.result.heading" })}
      </h3>
      <dl className="grid grid-cols-2 gap-2 text-xs" style={{ fontFamily: "var(--font-mono)" }}>
        <div>
          <dt className="text-foreground-subtle">proposals</dt>
          <dd className="text-foreground">
            <FormattedMessage
              id="prompt.fixture.result.proposals"
              values={{ count: result.proposals_count }}
            />
          </dd>
        </div>
        <div>
          <dt className="text-foreground-subtle">latency</dt>
          <dd className="text-foreground">
            <FormattedMessage
              id="prompt.fixture.result.latency"
              values={{ ms: result.latency_ms }}
            />
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-foreground-subtle">tokens</dt>
          <dd className="text-foreground">
            {result.token_count != null ? (
              <FormattedMessage
                id="prompt.fixture.result.tokens"
                values={{ tokens: result.token_count }}
              />
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>

      <ul role="list" className="space-y-1.5 text-xs">
        {result.proposals.map((p, i) => (
          <li
            key={i}
            className="rounded border border-border bg-surface p-2"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <div className="text-foreground">{p.rule_type}</div>
            <div className="text-foreground-muted">{p.description}</div>
            <div className="text-foreground-subtle">{p.citation}</div>
          </li>
        ))}
      </ul>

      <details className="text-xs">
        <summary className="cursor-pointer text-foreground-subtle">raw response</summary>
        <pre
          className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-surface-sunken p-2"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {result.raw_response}
        </pre>
      </details>
    </section>
  );
}
