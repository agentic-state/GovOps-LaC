import type {
  FederationFetchResult,
  FederationPack,
  FederationRegistryEntry,
} from "./federation-types";

const registry: FederationRegistryEntry[] = [
  {
    publisher_id: "ca-statutes-pub",
    name: "Canadian Statutes Publisher",
    manifest_url: "https://example.ca/lawcode/manifest.json",
    trust_status: "trusted",
    last_fetched_at: "2026-04-12T10:30:00Z",
  },
  {
    publisher_id: "eu-pension-research",
    name: "EU Pension Research Lab",
    manifest_url: "https://research.example.eu/lawcode/manifest.json",
    trust_status: "unsigned_only",
    last_fetched_at: null,
  },
];

const packs: FederationPack[] = [
  {
    publisher_id: "ca-statutes-pub",
    pack_name: "ca-oas-2026.04",
    version: "2026.04.0",
    fetched_at: "2026-04-12T10:30:00Z",
    signed: true,
    file_count: 18,
    enabled: true,
  },
];

export async function mockListRegistry(): Promise<{
  entries: FederationRegistryEntry[];
}> {
  await new Promise((r) => setTimeout(r, 120));
  return { entries: registry };
}

export async function mockListPacks(): Promise<{ packs: FederationPack[] }> {
  await new Promise((r) => setTimeout(r, 120));
  return { packs };
}

export async function mockFetchPack(
  publisherId: string,
  opts: { dryRun: boolean; allowUnsigned: boolean },
): Promise<FederationFetchResult> {
  await new Promise((r) => setTimeout(r, 600));
  const entry = registry.find((r) => r.publisher_id === publisherId);
  if (!entry) throw new Error(`Unknown publisher: ${publisherId}`);
  const signed = entry.trust_status === "trusted";
  if (!signed && !opts.allowUnsigned) {
    throw new Error(`Publisher ${publisherId} is unsigned; rerun with --allow-unsigned`);
  }
  const previous = packs.find((p) => p.publisher_id === publisherId) ?? null;
  const result: FederationFetchResult = {
    publisher_id: publisherId,
    pack_name: `${publisherId}-${new Date().toISOString().slice(0, 7)}`,
    version: `mock.${Date.now().toString(36)}`,
    file_count: 12,
    signed,
    dry_run: opts.dryRun,
    diff: previous
      ? {
          previous_version: previous.version,
          file_count_delta: 12 - previous.file_count,
          signing_key_changed: previous.signed !== signed,
        }
      : undefined,
  };
  if (!opts.dryRun) {
    const existing = packs.findIndex((p) => p.publisher_id === publisherId);
    const pack: FederationPack = {
      publisher_id: publisherId,
      pack_name: result.pack_name,
      version: result.version,
      fetched_at: new Date().toISOString(),
      signed,
      file_count: result.file_count,
      enabled: true,
    };
    if (existing === -1) packs.push(pack);
    else packs[existing] = pack;
    entry.last_fetched_at = pack.fetched_at;
  }
  return result;
}

export async function mockTogglePack(
  publisherId: string,
  enable: boolean,
): Promise<FederationPack> {
  await new Promise((r) => setTimeout(r, 200));
  const idx = packs.findIndex((p) => p.publisher_id === publisherId);
  if (idx === -1) throw new Error(`No pack for ${publisherId}`);
  packs[idx] = { ...packs[idx], enabled: enable };
  return packs[idx];
}
