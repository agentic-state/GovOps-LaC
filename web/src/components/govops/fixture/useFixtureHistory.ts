import { useEffect, useState } from "react";
import type { FixtureRunResult } from "@/lib/api";
import { StorageKeys } from "@/lib/storageKeys";

const HISTORY_LIMIT = 10;
const historyKey = StorageKeys.fixtureRuns;

export interface StoredRun extends FixtureRunResult {
  ran_at: string; // ISO
}

function load(promptKey: string): StoredRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(historyKey(promptKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredRun[];
    return Array.isArray(parsed) ? parsed.slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

function save(promptKey: string, runs: StoredRun[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      historyKey(promptKey),
      JSON.stringify(runs.slice(0, HISTORY_LIMIT)),
    );
  } catch {
    /* quota exceeded */
  }
}

export function runLabel(r: StoredRun, i: number): string {
  return `#${i + 1} · ${r.proposals_count} proposals · ${new Date(r.ran_at).toLocaleString()}`;
}

/**
 * Manages the persisted run-history per prompt key, plus the cursors for
 * "currently displayed" and "compare-against" runs.
 */
export function useFixtureHistory(promptKey: string) {
  const [history, setHistory] = useState<StoredRun[]>([]);
  const [viewIndex, setViewIndex] = useState(0);
  const [compareIndex, setCompareIndex] = useState<number | null>(null);

  useEffect(() => {
    setHistory(load(promptKey));
    setViewIndex(0);
    setCompareIndex(null);
  }, [promptKey]);

  const append = (run: FixtureRunResult) => {
    const stored: StoredRun = { ...run, ran_at: new Date().toISOString() };
    const next = [stored, ...history].slice(0, HISTORY_LIMIT);
    setHistory(next);
    setViewIndex(0);
    save(promptKey, next);
  };

  return {
    history,
    viewIndex,
    setViewIndex,
    compareIndex,
    setCompareIndex,
    append,
  };
}

export const FIXTURE_HISTORY_LIMIT = HISTORY_LIMIT;
