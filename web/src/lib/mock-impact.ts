import type { ImpactResponse } from "./types";
import { MOCK_CONFIG_VALUES } from "./mock-config-values";

const JURISDICTION_LABELS: Record<string, string> = {
  "ca-oas": "Canada — Old Age Security",
  "us-fed": "United States — Federal",
  "uk-gov": "United Kingdom — Government",
  "fr-gouv": "France — Gouvernement",
  "de-bund": "Germany — Bund",
  "br-fed": "Brazil — Federal",
};

export const DEFAULT_IMPACT_LIMIT = 25;

export function MOCK_IMPACT_RESPONSE(
  query: string,
  opts: { limit?: number; page?: number } = {},
): ImpactResponse {
  const normalized = query.trim().replace(/\s+/g, " ");
  const needle = normalized.toLowerCase();
  const matches = MOCK_CONFIG_VALUES.filter(
    (v) => v.citation && v.citation.toLowerCase().includes(needle),
  );
  const groups = new Map<string | null, typeof matches>();
  for (const m of matches) {
    const key = m.jurisdiction_id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }
  const allResults = Array.from(groups.entries())
    .map(([jid, values]) => ({
      jurisdiction_id: jid,
      jurisdiction_label:
        jid === null ? "Global / cross-jurisdictional" : (JURISDICTION_LABELS[jid] ?? jid),
      values,
    }))
    .sort((a, b) => {
      if (a.jurisdiction_id === null) return -1;
      if (b.jurisdiction_id === null) return 1;
      return a.jurisdiction_label.localeCompare(b.jurisdiction_label);
    });
  const limit = Math.max(1, Math.min(200, opts.limit ?? DEFAULT_IMPACT_LIMIT));
  const page = Math.max(1, opts.page ?? 1);
  const page_count = Math.max(1, Math.ceil(allResults.length / limit));
  const start = (page - 1) * limit;
  const results = allResults.slice(start, start + limit);
  return {
    query: normalized,
    total: matches.length,
    jurisdiction_count: allResults.length,
    results,
    limit,
    page,
    page_count,
  };
}
