/**
 * Local persistence of save-as-draft URL snapshots so maintainers can switch
 * between in-progress drafts. Stored as a JSON array under a single key.
 * Best-effort: any read/write failure simply yields an empty list.
 */
import { StorageEvents, StorageKeys } from "./storageKeys";
const STORAGE_KEY = StorageKeys.recentDrafts;
const MAX_DRAFTS = 8;

export interface RecentDraft {
  /** Stable identity = the search-string (so re-saving the same form de-dupes). */
  id: string;
  /** URL search-params (sans leading `?`). */
  search: string;
  /** Best-effort label: `key` field from the snapshot, else "(untitled)". */
  label: string;
  /** ms since epoch */
  savedAt: number;
}

function safeParse(): RecentDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecentDraft) : [];
  } catch {
    return [];
  }
}

function isRecentDraft(x: unknown): x is RecentDraft {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.search === "string" &&
    typeof r.label === "string" &&
    typeof r.savedAt === "number"
  );
}

export function listRecentDrafts(): RecentDraft[] {
  return safeParse().sort((a, b) => b.savedAt - a.savedAt);
}

export function saveRecentDraft(params: Record<string, string>): RecentDraft {
  const search = new URLSearchParams(params).toString();
  const draft: RecentDraft = {
    id: search,
    search,
    label: params.key?.trim() || "(untitled)",
    savedAt: Date.now(),
  };
  if (typeof window === "undefined") return draft;
  const existing = safeParse().filter((d) => d.id !== draft.id);
  const next = [draft, ...existing].slice(0, MAX_DRAFTS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota or disabled — swallow */
  }
  return draft;
}

export function removeRecentDraft(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const next = safeParse().filter((d) => d.id !== id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* swallow */
  }
}

export function clearAllRecentDrafts(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* swallow */
  }
}

/** Subscribe to cross-tab + same-tab updates. Returns an unsubscribe fn. */
export const DRAFTS_EVENT = StorageEvents.recentDraftsChanged;
export function emitDraftsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DRAFTS_EVENT));
}
