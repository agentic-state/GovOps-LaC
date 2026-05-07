import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { DraftConfigForm } from "@/components/govops/DraftConfigForm";
import { RecentDrafts } from "@/components/govops/RecentDrafts";
import { createConfigValue, getConfigValue } from "@/lib/api";
import { MOCK_CONFIG_VALUES } from "@/lib/mock-config-values";
import type { ConfigValue, CreateConfigValueRequest } from "@/lib/types";
import { RouteError } from "@/components/govops/RouteError";

type DraftSearch = {
  key?: string;
  jurisdiction_id?: string;
  value_type?: string;
  supersedes_id?: string;
  domain?: string;
  value?: string;
  effective_from?: string;
  citation?: string;
  rationale?: string;
  language?: string;
};

export const Route = createFileRoute("/config/draft")({
  head: () => ({
    meta: [{ title: "Draft new ConfigValue — GovOps" }],
  }),
  validateSearch: (s: Record<string, unknown>): DraftSearch => {
    const pick = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : undefined);
    return {
      key: pick("key"),
      jurisdiction_id: pick("jurisdiction_id"),
      value_type: pick("value_type"),
      supersedes_id: pick("supersedes_id"),
      domain: pick("domain"),
      value: pick("value"),
      effective_from: pick("effective_from"),
      citation: pick("citation"),
      rationale: pick("rationale"),
      language: pick("language"),
    };
  },
  loaderDeps: ({ search }) => ({ supersedes_id: search.supersedes_id }),
  loader: async ({ deps }): Promise<ConfigValue | null> => {
    if (!deps.supersedes_id) return null;
    const id = deps.supersedes_id;
    try {
      return await getConfigValue(id);
    } catch {
      return MOCK_CONFIG_VALUES.find((v) => v.id === id) ?? null;
    }
  },
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  component: DraftPage,
});

function DraftPage() {
  const search = Route.useSearch();
  const nav = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const prior: ConfigValue | null = Route.useLoaderData();

  async function onSubmit(body: CreateConfigValueRequest) {
    setSubmitting(true);
    try {
      const created = await createConfigValue(body);
      nav({
        to: "/config/$key/$jurisdictionId",
        params: {
          key: created.key,
          jurisdictionId: created.jurisdiction_id ?? "global",
        },
      });
    } finally {
      setSubmitting(false);
    }
  }

  function onSaveDraft(params: Record<string, string>) {
    nav({
      to: "/config/draft",
      search: params as DraftSearch,
      replace: true,
    });
  }

  // Re-key the form on the serialized search so navigating to a different
  // Recent draft (or a save-as-draft URL change) fully resets dirty/touched
  // state and re-hydrates field values from the new search params.
  const formKey = new URLSearchParams(search as Record<string, string>).toString() || "blank";

  return (
    <div className="space-y-6">
      <RecentDrafts activeSearch={formKey === "blank" ? "" : formKey} />
      <DraftConfigForm
        key={formKey}
        initial={search}
        prior={prior}
        onSubmit={onSubmit}
        onSaveDraft={onSaveDraft}
        submitting={submitting}
      />
    </div>
  );
}
