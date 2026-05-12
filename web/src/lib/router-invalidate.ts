import { useRouter } from "@tanstack/react-router";

/**
 * Hook that returns a function which invalidates every TanStack-router
 * loader. Call it after a successful mutation so navigating back to a
 * list page (or refreshing a detail page) refetches instead of showing
 * a stale `useLoaderData` snapshot.
 *
 * Why blanket-invalidate: GovOps mutation effects often span multiple
 * routes (an approve mutates the approvals list, the timeline page, and
 * the authority chain). Per-routeId filtering would couple every call
 * site to a hand-maintained list of impacted routes; blanket invalidate
 * is correct, cheap (loaders only re-run when their route is rendered
 * again), and matches the "evidence-first, never stale" rule.
 */
export function useInvalidateAfterMutation() {
  const router = useRouter();
  return () => router.invalidate();
}
