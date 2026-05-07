// Text-rendered wordmark: "Gov0ps" — the middle character is a literal zero
// (U+0030), with the agentic accent on it. This bakes the law-as-code idea
// directly into the mark (spec govops-013, supersedes govops-002). The PNG
// variants in /public are reserved for og:image / favicons; the live UI uses
// text for crispness, RTL handling, and accessibility. Screen readers
// announce the brand name "GovOps" via aria-label, not "Gov zero PS".
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: "var(--font-serif)",
        fontWeight: 600,
        letterSpacing: "-0.01em",
        whiteSpace: "nowrap",
        fontVariantNumeric: "lining-nums",
      }}
      aria-label="GovOps"
    >
      Gov<span style={{ color: "var(--agentic)" }}>0</span>ps
    </span>
  );
}
