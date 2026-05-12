/**
 * v3.1.x L9 authority chain editor helpers.
 *
 * Lives outside the route file so the route can keep react-refresh's
 * "only export components" rule without hiding the helper from vitest.
 */

export type AuthorityEntry = {
  id: string;
  layer: string;
  title: string;
  citation: string;
  effective_date?: string;
  url?: string;
  parent?: string;
};

export function cleanEntry(e: AuthorityEntry): AuthorityEntry {
  const out: AuthorityEntry = {
    id: e.id.trim(),
    layer: e.layer,
    title: e.title.trim(),
    citation: e.citation.trim(),
  };
  if (e.effective_date && e.effective_date.trim()) {
    out.effective_date = e.effective_date.trim();
  }
  if (e.url && e.url.trim()) {
    out.url = e.url.trim();
  }
  if (e.parent && e.parent.trim()) {
    out.parent = e.parent.trim();
  }
  return out;
}
