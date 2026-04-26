import type { CaseListItem, ConfigValue, HealthResponse } from "./types";
import type { FixtureBatchSummary } from "./api";

export interface DashboardStats {
  jurisdictions: number;
  authorityLinks: number;
  legalDocuments: number;
  rules: number;
  configValues: number;
  cases: number;
  recommendations: number;
  reviews: number;
  pendingApprovals: number;
  encodingBatches: number;
  auditEntries: number;
}

export function deriveStats(input: {
  health: HealthResponse | null;
  authorityLinks: number;
  documents: number;
  rules: number;
  configValues: ConfigValue[];
  cases: CaseListItem[];
  reviews: number;
  batches: FixtureBatchSummary[];
  auditEntries: number;
}): DashboardStats {
  return {
    jurisdictions: input.health?.available_jurisdictions.length ?? 0,
    authorityLinks: input.authorityLinks,
    legalDocuments: input.documents,
    rules: input.rules,
    configValues: input.configValues.length,
    cases: input.cases.length,
    recommendations: input.cases.filter((c) => c.has_recommendation).length,
    reviews: input.reviews,
    pendingApprovals: input.configValues.filter(
      (c) => c.status === "draft" || c.status === "pending",
    ).length,
    encodingBatches: input.batches.length,
    auditEntries: input.auditEntries,
  };
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function isRecent(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < SEVEN_DAYS_MS;
}

export interface ActivityEvent {
  timestamp: string;
  actor: string;
  event_type: string;
  detail: string;
  source: { to: string; params?: Record<string, string> };
}

export function buildActivityFeed(input: {
  configValues: ConfigValue[];
  batches: FixtureBatchSummary[];
}): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const v of input.configValues) {
    events.push({
      timestamp: v.created_at,
      actor: v.author,
      event_type: `config.${v.status}`,
      detail: `${v.key} (${v.domain}) — ${v.rationale}`.slice(0, 80),
      source: { to: "/config" },
    });
  }
  for (const b of input.batches) {
    events.push({
      timestamp: b.created_at,
      actor: "agent:encoder",
      event_type: "encode.batch",
      detail: `${b.document_title} — ${b.document_citation}`.slice(0, 80),
      source: { to: "/" },
    });
  }

  events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return events.slice(0, 20);
}
