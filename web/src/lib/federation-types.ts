export type FederationTrustStatus = "trusted" | "unsigned_only" | "untrusted";

export interface FederationRegistryEntry {
  publisher_id: string;
  name: string;
  manifest_url: string;
  trust_status: FederationTrustStatus;
  last_fetched_at: string | null;
}

export interface FederationPack {
  publisher_id: string;
  pack_name: string;
  version: string;
  fetched_at: string;
  signed: boolean;
  file_count: number;
  enabled: boolean;
}

export interface FederationFetchResult {
  publisher_id: string;
  pack_name: string;
  version: string;
  file_count: number;
  signed: boolean;
  dry_run: boolean;
  /**
   * Optional diff vs the previously imported pack from the same publisher.
   * Surfaced in the admin UI so reviewers can spot scope changes without
   * re-reading the full pack. Backend may omit this field on first fetch.
   */
  diff?: {
    previous_version: string | null;
    file_count_delta: number;
    signing_key_changed: boolean;
  };
}
