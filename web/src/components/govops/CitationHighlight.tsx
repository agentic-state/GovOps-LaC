/**
 * Wraps the matched query substring inside `text` with a semantic <mark>.
 * Falls back to the unmodified text when there's no match or no query.
 * The <mark> carries an aria-label so screen readers announce the highlight
 * intent ("matches: <query>") instead of just reading the substring inline.
 */
export function CitationHighlight({
  text,
  query,
  matchLabel,
}: {
  text: string;
  query: string;
  /** Optional override for the screen-reader label on the <mark>. */
  matchLabel?: string;
}) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) return <>{text}</>;
  const matched = text.slice(idx, idx + needle.length);
  const label = matchLabel ?? `matches search: ${needle}`;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        aria-label={label}
        data-citation-match=""
        style={{
          backgroundColor: "var(--surface-sunken)",
          color: "var(--foreground)",
          padding: "0 0.15em",
          borderRadius: "2px",
        }}
      >
        {matched}
      </mark>
      {text.slice(idx + needle.length)}
    </>
  );
}
