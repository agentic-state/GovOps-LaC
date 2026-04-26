import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import {
  getAuthorityChain,
  health,
  listCases,
  listConfigValues,
  listFixtures,
  listLegalDocuments,
  listRules,
  switchJurisdiction,
} from "@/lib/api";
import type {
  AuthorityReference,
  CaseListItem,
  ConfigValue,
  HealthResponse,
  Jurisdiction,
  LegalDocument,
  LegalRule,
} from "@/lib/types";
import type { FixtureBatchSummary } from "@/lib/api";
import { buildActivityFeed, deriveStats, isRecent } from "@/lib/aggregations";
import { StatTile } from "@/components/govops/admin/StatTile";
import { JurisdictionSwitcher } from "@/components/govops/admin/JurisdictionSwitcher";
import { RefreshButton } from "@/components/govops/admin/RefreshButton";
import { SystemHealthStrip } from "@/components/govops/admin/SystemHealthStrip";
import { RecentActivity } from "@/components/govops/admin/RecentActivity";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — GovOps" },
      {
        name: "description",
        content: "Operator overview: counts, recent activity, and system health.",
      },
    ],
  }),
  component: AdminPage,
});

interface Bundle {
  health: HealthResponse | null;
  authority: { jurisdiction: Jurisdiction; chain: AuthorityReference[] } | null;
  documents: LegalDocument[];
  rules: LegalRule[];
  configValues: ConfigValue[];
  cases: CaseListItem[];
  batches: FixtureBatchSummary[];
  errors: Record<string, string>;
}

const EMPTY_BUNDLE: Bundle = {
  health: null,
  authority: null,
  documents: [],
  rules: [],
  configValues: [],
  cases: [],
  batches: [],
  errors: {},
};

async function safe<T>(
  key: string,
  fn: () => Promise<T>,
  fallback: T,
  errors: Record<string, string>,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    errors[key] = e instanceof Error ? e.message : "failed";
    return fallback;
  }
}

async function loadBundle(): Promise<Bundle> {
  const errors: Record<string, string> = {};
  const [h, auth, docs, rls, cv, cs, bs] = await Promise.all([
    safe("health", () => health(), null as HealthResponse | null, errors),
    safe(
      "authority",
      () => getAuthorityChain(),
      null as { jurisdiction: Jurisdiction; chain: AuthorityReference[] } | null,
      errors,
    ),
    safe("documents", () => listLegalDocuments().then((r) => r.documents), [] as LegalDocument[], errors),
    safe("rules", () => listRules().then((r) => r.rules), [] as LegalRule[], errors),
    safe(
      "configValues",
      () => listConfigValues({}).then((r) => r.values),
      [] as ConfigValue[],
      errors,
    ),
    safe("cases", () => listCases().then((r) => r.cases), [] as CaseListItem[], errors),
    safe("batches", () => listFixtures(), [] as FixtureBatchSummary[], errors),
  ]);
  return {
    health: h,
    authority: auth,
    documents: docs,
    rules: rls,
    configValues: cv,
    cases: cs,
    batches: bs,
    errors,
  };
}

function AdminPage() {
  const intl = useIntl();
  const [bundle, setBundle] = useState<Bundle>(EMPTY_BUNDLE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    try {
      const b = await loadBundle();
      setBundle(b);
    } finally {
      if (mode === "initial") setLoading(false);
      else setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("initial");
  }, [load]);

  const handleRefresh = useCallback(() => {
    setAnnouncement(intl.formatMessage({ id: "admin.refreshing" }));
    void load("refresh").then(() =>
      setAnnouncement(intl.formatMessage({ id: "admin.refresh" })),
    );
  }, [load, intl]);

  const handleSwitch = useCallback(
    async (code: string) => {
      setSwitching(true);
      try {
        await switchJurisdiction(code);
        await load("refresh");
        setAnnouncement(`Jurisdiction switched to ${code}`);
      } finally {
        setSwitching(false);
      }
    },
    [load],
  );

  const stats = useMemo(
    () =>
      deriveStats({
        health: bundle.health,
        authorityLinks: bundle.authority?.chain.length ?? 0,
        documents: bundle.documents.length,
        rules: bundle.rules.length,
        configValues: bundle.configValues,
        cases: bundle.cases,
        reviews: 0,
        batches: bundle.batches,
        auditEntries: 0,
      }),
    [bundle],
  );

  const recentBuckets = useMemo(
    () => ({
      configValues: bundle.configValues.some((v) => isRecent(v.created_at)),
      batches: bundle.batches.some((b) => isRecent(b.created_at)),
    }),
    [bundle.configValues, bundle.batches],
  );

  const activity = useMemo(
    () =>
      buildActivityFeed({
        configValues: bundle.configValues,
        batches: bundle.batches,
      }),
    [bundle.configValues, bundle.batches],
  );

  const errorCount = Object.keys(bundle.errors).length;

  const tiles: Array<{
    labelKey: string;
    value: number;
    to: string;
    provenance: "system" | "human" | "agent" | "hybrid";
    recent: boolean;
    errKey?: string;
  }> = [
    {
      labelKey: "admin.tile.jurisdictions",
      value: stats.jurisdictions,
      to: "/authority",
      provenance: "system",
      recent: false,
      errKey: "health",
    },
    {
      labelKey: "admin.tile.authority_links",
      value: stats.authorityLinks,
      to: "/authority",
      provenance: "human",
      recent: false,
      errKey: "authority",
    },
    {
      labelKey: "admin.tile.legal_documents",
      value: stats.legalDocuments,
      to: "/authority",
      provenance: "human",
      recent: false,
      errKey: "documents",
    },
    {
      labelKey: "admin.tile.rules",
      value: stats.rules,
      to: "/authority",
      provenance: "human",
      recent: false,
      errKey: "rules",
    },
    {
      labelKey: "admin.tile.config_values",
      value: stats.configValues,
      to: "/config",
      provenance: "hybrid",
      recent: recentBuckets.configValues,
      errKey: "configValues",
    },
    {
      labelKey: "admin.tile.cases",
      value: stats.cases,
      to: "/cases",
      provenance: "hybrid",
      recent: false,
      errKey: "cases",
    },
    {
      labelKey: "admin.tile.recommendations",
      value: stats.recommendations,
      to: "/cases",
      provenance: "agent",
      recent: false,
      errKey: "cases",
    },
    {
      labelKey: "admin.tile.reviews",
      value: stats.reviews,
      to: "/cases",
      provenance: "human",
      recent: false,
    },
    {
      labelKey: "admin.tile.pending_approvals",
      value: stats.pendingApprovals,
      to: "/config/approvals",
      provenance: "hybrid",
      recent: recentBuckets.configValues,
      errKey: "configValues",
    },
    {
      labelKey: "admin.tile.encoding_batches",
      value: stats.encodingBatches,
      to: "/config/prompts",
      provenance: "agent",
      recent: recentBuckets.batches,
      errKey: "batches",
    },
    {
      labelKey: "admin.tile.audit_entries",
      value: stats.auditEntries,
      to: "/cases",
      provenance: "system",
      recent: false,
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1
            className="text-3xl tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {intl.formatMessage({ id: "admin.heading" })}
          </h1>
          <p className="text-sm text-foreground-muted">
            {intl.formatMessage({ id: "admin.lede" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {bundle.health && bundle.health.available_jurisdictions.length > 0 && (
            <JurisdictionSwitcher
              current={bundle.health.jurisdiction}
              available={bundle.health.available_jurisdictions}
              onSwitch={handleSwitch}
              switching={switching}
            />
          )}
          <RefreshButton onRefresh={handleRefresh} refreshing={refreshing} />
        </div>
      </header>

      {errorCount > 0 && (
        <p
          role="alert"
          className="rounded-md border px-3 py-2 text-xs"
          style={{
            color: "var(--verdict-pending)",
            borderColor: "color-mix(in oklab, var(--verdict-pending) 40%, transparent)",
            backgroundColor: "color-mix(in oklab, var(--verdict-pending) 10%, transparent)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {intl.formatMessage({ id: "admin.error.partial" }, { count: errorCount })}
        </p>
      )}

      <section
        aria-labelledby="tiles-heading"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <h2 id="tiles-heading" className="sr-only">
          Stats
        </h2>
        {tiles.map((t) => (
          <StatTile
            key={t.labelKey}
            labelKey={t.labelKey}
            value={t.value}
            to={t.to}
            provenance={t.provenance}
            recentActivity={t.recent}
            loading={loading}
            errorMsg={t.errKey ? bundle.errors[t.errKey] ?? null : null}
          />
        ))}
      </section>

      <RecentActivity events={activity} />

      <SystemHealthStrip health={bundle.health} />

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
