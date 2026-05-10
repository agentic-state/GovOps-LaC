import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { useRouter } from "@tanstack/react-router";

const STORAGE_KEY = "govops-jurisdiction";
const DEFAULT_JUR = "ca";
const ACTIVE_JURISDICTIONS = ["ca", "br", "es", "fr", "de", "ua", "jp"] as const;

type JurCode = (typeof ACTIVE_JURISDICTIONS)[number];

function readPersisted(): JurCode {
  if (typeof window === "undefined") return DEFAULT_JUR;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v && (ACTIVE_JURISDICTIONS as readonly string[]).includes(v)) {
      return v as JurCode;
    }
  } catch {
    /* localStorage may be unavailable in private mode -- fall back */
  }
  return DEFAULT_JUR;
}

/**
 * Global jurisdiction selector for the application header (LO-010).
 *
 * Persists the operator's preferred jurisdiction in localStorage so it
 * survives reloads and links. Pages that are jurisdiction-parameterised
 * (e.g. ``/screen/:jurisdictionId``) reroute themselves when this changes;
 * pages that aren't keep rendering as-is.
 *
 * Stable selectors for tests:
 *   - ``data-testid="global-jurisdiction-switcher"`` on the wrapping label
 *   - ``aria-label="Jurisdiction"`` on the select
 */
export function GlobalJurisdictionSwitcher() {
  const intl = useIntl();
  const router = useRouter();
  const [current, setCurrent] = useState<JurCode>(DEFAULT_JUR);

  // Hydrate after mount so SSR + client agree on first paint, then update
  // from localStorage. Keeps the dropdown deterministic across reloads.
  useEffect(() => {
    setCurrent(readPersisted());
  }, []);

  const onChange = (next: JurCode) => {
    setCurrent(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* localStorage unavailable -- preference does not persist */
    }
    // If the operator is on a jurisdiction-parameterised route, swap the
    // jurisdiction segment in place. Recognized prefixes today: /screen.
    // Other surfaces (compare, check, cases) take jurisdiction via query
    // or are jurisdiction-agnostic so a soft route refresh is enough.
    try {
      const path = window.location.pathname;
      const screenMatch = /^\/screen\/([a-z]{2})(\/|$)/i.exec(path);
      if (screenMatch) {
        router.navigate({ to: `/screen/${next}` });
      }
    } catch {
      /* navigation best-effort -- fall through */
    }
  };

  const labelText = intl.formatMessage({ id: "header.jurisdiction.label" });

  return (
    <label
      data-testid="global-jurisdiction-switcher"
      className="flex items-center gap-2 text-sm"
    >
      <span className="sr-only">{labelText}</span>
      <select
        aria-label={labelText}
        value={current}
        onChange={(e) => onChange(e.target.value as JurCode)}
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ fontFamily: "var(--font-mono)" }}
        title={intl.formatMessage({ id: "header.jurisdiction.help" })}
      >
        {ACTIVE_JURISDICTIONS.map((c) => (
          <option key={c} value={c}>
            {c.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
