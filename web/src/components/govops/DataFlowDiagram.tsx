import { useIntl } from "react-intl";
import {
  Scale,
  ScrollText,
  ClipboardCheck,
  Database,
  Cog,
  UserCheck,
  ShieldCheck,
} from "lucide-react";

/**
 * The pipeline visualised. Showing the path a single law takes from
 * legislative passage to a citizen-facing decision (and into the audit log).
 *
 * Implemented as flexbox + CSS arrows so it scales cleanly down to a
 * single-column mobile layout. Stays accessible — every step is a list item
 * with title and role; arrows are decorative.
 */

type Stage = {
  id: string;
  Icon: typeof Scale;
  /** Which provenance register this step lives in */
  register: "human" | "agent" | "system" | "citizen";
};

const STAGES: Stage[] = [
  { id: "law", Icon: Scale, register: "human" },
  { id: "encoder", Icon: ScrollText, register: "agent" },
  { id: "review", Icon: ClipboardCheck, register: "human" },
  { id: "substrate", Icon: Database, register: "system" },
  { id: "engine", Icon: Cog, register: "system" },
  { id: "case", Icon: UserCheck, register: "citizen" },
  { id: "audit", Icon: ShieldCheck, register: "human" },
];

function registerColor(register: Stage["register"]) {
  switch (register) {
    case "agent":
      return "var(--agentic)";
    case "human":
      return "var(--authority)";
    case "system":
      return "var(--foreground-muted)";
    case "citizen":
      return "var(--foreground-muted)";
  }
}

function registerLabel(register: Stage["register"], intl: ReturnType<typeof useIntl>) {
  return intl.formatMessage({ id: `dataflow.register.${register}` });
}

export function DataFlowDiagram() {
  const intl = useIntl();

  return (
    <figure
      aria-label={intl.formatMessage({ id: "dataflow.label" })}
      className="rounded-md border border-border bg-surface p-6"
    >
      <figcaption className="mb-4 space-y-1">
        <p
          className="text-xs uppercase tracking-[0.22em] text-foreground-subtle"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {intl.formatMessage({ id: "dataflow.eyebrow" })}
        </p>
        <p className="text-sm text-foreground-muted">
          {intl.formatMessage({ id: "dataflow.caption" })}
        </p>
      </figcaption>

      <ol
        role="list"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7"
      >
        {STAGES.map(({ id, Icon, register }, idx) => {
          const color = registerColor(register);
          return (
            <li key={id} className="relative">
              <div
                className="flex h-full flex-col gap-2 rounded-md border border-border bg-surface-sunken p-3"
                style={{ borderTopWidth: "3px", borderTopColor: color }}
              >
                <div className="flex items-center gap-2">
                  <Icon className="size-4 shrink-0" style={{ color }} aria-hidden />
                  <p
                    className="text-xs uppercase tracking-[0.18em] text-foreground-subtle"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {`0${idx + 1}`}
                  </p>
                </div>
                <p
                  className="text-sm font-medium leading-tight text-foreground"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {intl.formatMessage({ id: `dataflow.stage.${id}.title` })}
                </p>
                <p className="text-xs leading-snug text-foreground-muted">
                  {intl.formatMessage({ id: `dataflow.stage.${id}.body` })}
                </p>
                <p
                  className="mt-auto text-[10px] uppercase tracking-[0.22em]"
                  style={{ color, fontFamily: "var(--font-mono)" }}
                >
                  {registerLabel(register, intl)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div
        className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-foreground-muted"
        aria-label={intl.formatMessage({ id: "dataflow.legend.label" })}
      >
        <span
          className="text-[10px] uppercase tracking-[0.22em]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {intl.formatMessage({ id: "dataflow.legend.title" })}:
        </span>
        {(["human", "agent", "system", "citizen"] as const).map((r) => (
          <span key={r} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: registerColor(r) }}
            />
            {registerLabel(r, intl)}
          </span>
        ))}
      </div>
    </figure>
  );
}
