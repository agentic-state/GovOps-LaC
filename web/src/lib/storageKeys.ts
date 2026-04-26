/**
 * Centralized localStorage / sessionStorage key registry.
 *
 * Conventions:
 * - Namespaced under `govops:` (colon, not dash).
 * - Existing legacy keys (`govops-theme`, `govops-locale`, `govops-user`,
 *   `govops-prompt-draft-*`) are preserved here so users don't lose state
 *   on upgrade. Prefer `govops:` for new keys.
 *
 * Scope (local | session) is documented per key.
 */
export const StorageKeys = {
  // ── singletons (local) ────────────────────────────────────────────────
  theme: "govops-theme",
  locale: "govops-locale",
  currentUser: "govops-user",
  draftPreviewOpen: "govops:draft-preview-open",
  recentDrafts: "govops:recent-drafts",
  approvalPanelExpanded: "govops:approval-panel-expanded",

  // ── singletons (session) ──────────────────────────────────────────────
  approvalShortcutsOpen: "govops:approval-shortcuts-open",

  // ── parameterized factories ───────────────────────────────────────────
  approvalComment: (cvId: string) => `govops:approval-comment:${cvId}`,
  promptDraft: (key: string, jurisdictionId: string) =>
    `govops-prompt-draft-${key}-${jurisdictionId}`,
  fixtureRuns: (promptKey: string) => `govops:fixture-runs:${promptKey}`,
} as const;

/** Cross-tab change event dispatched by draftStorage helpers. */
export const StorageEvents = {
  recentDraftsChanged: "govops:recent-drafts:changed",
} as const;
