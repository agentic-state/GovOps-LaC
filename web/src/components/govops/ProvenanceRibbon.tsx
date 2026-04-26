import { useIntl } from "react-intl";

export type ProvenanceVariant = "agent" | "human" | "hybrid" | "system" | "citizen" | "none";

const variantClass: Record<Exclude<ProvenanceVariant, "none">, string> = {
  agent: "bg-agentic",
  human: "bg-authority",
  hybrid: "bg-[linear-gradient(to_bottom,var(--agentic)_50%,var(--authority)_50%)]",
  system: "bg-foreground-muted",
  citizen: "bg-verdict-enacted",
};

export function ProvenanceRibbon({ variant }: { variant: ProvenanceVariant }) {
  const intl = useIntl();
  if (variant === "none") return null;
  return (
    <span
      role="img"
      aria-label={intl.formatMessage({ id: `provenance.${variant}` })}
      className={`block w-[3px] self-stretch rounded-full ${variantClass[variant]}`}
      style={{ marginInlineEnd: "0.75rem" }}
    />
  );
}
