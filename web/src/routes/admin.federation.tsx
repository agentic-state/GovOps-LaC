import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import {
  fetchFederationPack,
  listFederationPacks,
  listFederationRegistry,
  setFederationPackEnabled,
} from "@/lib/api";
import type { FederationPack, FederationRegistryEntry } from "@/lib/federation-types";
import { RegistryTable } from "@/components/govops/federation/RegistryTable";
import { PacksTable } from "@/components/govops/federation/PacksTable";
import { FetchPackForm } from "@/components/govops/federation/FetchPackForm";
import { t, localeFromMatches } from "@/lib/head-i18n";

export const Route = createFileRoute("/admin/federation")({
  head: ({ matches }) => {
    const l = localeFromMatches(matches);
    return {
      meta: [
        { title: t("admin.federation.heading", l) },
        { name: "description", content: t("admin.federation.lede", l) },
      ],
    };
  },
  component: FederationPage,
});

function FederationPage() {
  const intl = useIntl();
  const [registry, setRegistry] = useState<FederationRegistryEntry[]>([]);
  const [packs, setPacks] = useState<FederationPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // form
  const [publisherId, setPublisherId] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [allowUnsigned, setAllowUnsigned] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([listFederationRegistry(), listFederationPacks()]);
      setRegistry(r.entries);
      setPacks(p.packs);
      setPublisherId((prev) => prev || r.entries[0]?.publisher_id || "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const lastFetchedById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const r of registry) m.set(r.publisher_id, r.last_fetched_at);
    for (const p of packs) m.set(p.publisher_id, p.fetched_at);
    return m;
  }, [registry, packs]);

  const onFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publisherId) return;
    setSubmitting(true);
    try {
      const res = await fetchFederationPack(publisherId, { dryRun, allowUnsigned });
      toast.success(
        intl.formatMessage(
          { id: "admin.federation.fetch.success" },
          {
            publisher: res.publisher_id,
            pack: res.pack_name,
            version: res.version,
            files: res.file_count,
            signed: String(res.signed),
          },
        ),
      );
      // Surface the diff hint as a separate toast so reviewers notice scope changes.
      if (res.diff) {
        const delta = res.diff.file_count_delta;
        const sign = delta > 0 ? "+" : "";
        toast.message(
          intl.formatMessage(
            { id: "admin.federation.fetch.diff" },
            {
              previous: res.diff.previous_version ?? "—",
              delta: `${sign}${delta}`,
            },
          ),
          {
            description: res.diff.signing_key_changed
              ? intl.formatMessage({ id: "admin.federation.fetch.signing_changed" })
              : undefined,
          },
        );
      }
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setSubmitting(false);
    }
  };

  const onRefetch = async (pid: string) => {
    try {
      await fetchFederationPack(pid, { dryRun: false, allowUnsigned: false });
      toast.success(intl.formatMessage({ id: "admin.federation.action.refetch" }));
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Re-fetch failed");
    }
  };

  const onToggle = async (pid: string, enable: boolean) => {
    try {
      await setFederationPackEnabled(pid, enable);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Toggle failed");
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1
          className="text-3xl tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {intl.formatMessage({ id: "admin.federation.heading" })}
        </h1>
        <p className="max-w-3xl text-sm text-foreground-muted">
          {intl.formatMessage({ id: "admin.federation.lede" })}
        </p>
      </header>

      <section
        aria-labelledby="federation-registry-heading"
        className="space-y-3 rounded-md border border-border bg-surface-raised p-5"
      >
        <h2
          id="federation-registry-heading"
          className="text-lg text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {intl.formatMessage({ id: "admin.federation.section.registry" })}
        </h2>
        {loading ? (
          <p className="text-sm text-foreground-muted">…</p>
        ) : registry.length === 0 ? (
          <div className="rounded border border-dashed border-border bg-surface p-4 text-sm">
            <p className="text-foreground-muted">
              {intl.formatMessage({ id: "admin.federation.empty_registry" })}
            </p>
            <a
              href="https://docs.lovable.dev/features/cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-authority hover:underline"
            >
              {intl.formatMessage({ id: "admin.federation.empty_registry_cta" })}
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </div>
        ) : (
          <RegistryTable registry={registry} lastFetchedById={lastFetchedById} />
        )}
      </section>

      <section
        aria-labelledby="federation-packs-heading"
        className="space-y-3 rounded-md border border-border bg-surface-raised p-5"
      >
        <h2
          id="federation-packs-heading"
          className="text-lg text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {intl.formatMessage({ id: "admin.federation.section.packs" })}
        </h2>
        {loading ? (
          <p className="text-sm text-foreground-muted">…</p>
        ) : packs.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            {intl.formatMessage({ id: "admin.federation.empty_packs" })}
          </p>
        ) : (
          <PacksTable packs={packs} onRefetch={onRefetch} onToggle={onToggle} />
        )}
      </section>

      <section
        aria-labelledby="federation-fetch-heading"
        className="space-y-3 rounded-md border border-border bg-surface-raised p-5"
      >
        <h2
          id="federation-fetch-heading"
          className="text-lg text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {intl.formatMessage({ id: "admin.federation.section.fetch" })}
        </h2>
        <FetchPackForm
          registry={registry}
          publisherId={publisherId}
          onPublisherChange={setPublisherId}
          dryRun={dryRun}
          onDryRunChange={setDryRun}
          allowUnsigned={allowUnsigned}
          onAllowUnsignedChange={setAllowUnsigned}
          submitting={submitting}
          onSubmit={onFetch}
        />
      </section>
    </div>
  );
}
