import type { ImpactResponse } from "./types";
import { MOCK_CONFIG_VALUES } from "./mock-config-values";

// v3.1 L5: country-level labels. Mock keys are program-scoped
// jurisdiction_ids (e.g. "ca-oas"); the bucket key is the country prefix
// ("ca"), so the labels here are country names.
const COUNTRY_LABELS: Record<string, string> = {
  ca: "Canada",
  us: "United States",
  uk: "United Kingdom",
  fr: "France",
  de: "Germany",
  br: "Brazil",
  es: "Spain",
  ua: "Ukraine",
  jp: "Japan",
};

function countryFromJurisdiction(jid: string | null): string | null {
  if (jid === null || jid === "global") return null;
  return jid.split("-", 1)[0];
}

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
    const country = countryFromJurisdiction(m.jurisdiction_id);
    if (!groups.has(country)) groups.set(country, []);
    groups.get(country)!.push(m);
  }
  const allResults = Array.from(groups.entries())
    .map(([country, values]) => ({
      country_code: country,
      country_label:
        country === null
          ? "Global / cross-jurisdictional"
          : (COUNTRY_LABELS[country] ?? country),
      values,
    }))
    .sort((a, b) => {
      if (a.country_code === null) return -1;
      if (b.country_code === null) return 1;
      return a.country_label.localeCompare(b.country_label);
    });
  const limit = Math.max(1, Math.min(200, opts.limit ?? DEFAULT_IMPACT_LIMIT));
  const page = Math.max(1, opts.page ?? 1);
  const page_count = Math.max(1, Math.ceil(allResults.length / limit));
  const start = (page - 1) * limit;
  const results = allResults.slice(start, start + limit);
  return {
    query: normalized,
    total: matches.length,
    country_count: allResults.length,
    results,
    limit,
    page,
    page_count,
  };
}
