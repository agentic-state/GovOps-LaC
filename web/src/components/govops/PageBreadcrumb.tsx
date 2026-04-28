import { useRouterState } from "@tanstack/react-router";
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";

/**
 * Layout-level breadcrumb. Renders on every non-home route, auto-derived
 * from the current TanStack Router match chain. No per-route boilerplate —
 * adding a new route automatically gets a breadcrumb as long as its
 * routeId is present in ROUTE_CRUMBS below.
 */

type CrumbSpec =
  | { kind: "i18n"; id: string }
  | { kind: "param"; paramName: string; truncate?: boolean };

const ROUTE_CRUMBS: Record<string, CrumbSpec> = {
  "/walkthrough": { kind: "i18n", id: "nav.walkthrough" },
  "/authority": { kind: "i18n", id: "nav.authority" },
  "/about": { kind: "i18n", id: "nav.about" },
  "/policies": { kind: "i18n", id: "nav.policies" },
  "/cases": { kind: "i18n", id: "nav.cases" },
  "/cases/$caseId": { kind: "param", paramName: "caseId", truncate: true },
  "/encode": { kind: "i18n", id: "nav.encode" },
  "/encode/new": { kind: "i18n", id: "encode.new.crumb" },
  "/encode/$batchId": { kind: "param", paramName: "batchId", truncate: true },
  "/config": { kind: "i18n", id: "nav.config" },
  "/config/draft": { kind: "i18n", id: "config.draft.crumb" },
  "/config/diff": { kind: "i18n", id: "config.diff.crumb" },
  "/config/approvals": { kind: "i18n", id: "nav.approvals" },
  "/config/approvals/$id": { kind: "param", paramName: "id", truncate: true },
  "/config/prompts": { kind: "i18n", id: "nav.prompts" },
  "/config/prompts/$key/$jurisdictionId/edit": {
    kind: "i18n",
    id: "config.prompts.edit.crumb",
  },
  "/config/$key/$jurisdictionId": { kind: "param", paramName: "key", truncate: true },
  "/admin": { kind: "i18n", id: "nav.admin" },
};

export function PageBreadcrumb() {
  const matches = useRouterState({ select: (s) => s.matches });
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Home gets no breadcrumb — the masthead alone is the orientation.
  if (pathname === "/" || pathname === "") return null;

  // Drop the root match and the index match; keep only routes we have specs for.
  const visibleMatches = matches.filter((m) => m.routeId !== "__root__" && ROUTE_CRUMBS[m.routeId]);
  if (visibleMatches.length === 0) return null;

  const items: BreadcrumbItem[] = visibleMatches.map((m, idx, arr) => {
    const spec = ROUTE_CRUMBS[m.routeId];
    const isLast = idx === arr.length - 1;
    const params = m.params as Record<string, string> | undefined;

    if (spec.kind === "i18n") {
      return {
        label: spec.id,
        i18n: true,
        to: isLast ? undefined : m.pathname,
      };
    }
    // param
    const raw = params?.[spec.paramName] ?? "";
    return {
      label: decodeURIComponent(raw),
      to: isLast ? undefined : m.pathname,
      truncate: spec.truncate,
    };
  });

  return <Breadcrumb items={items} />;
}
