import { createFileRoute, Outlet } from "@tanstack/react-router";

// /admin layout. The Operator-overview content lives at admin.index.tsx
// (the index path "/admin"); child routes such as admin.federation.tsx
// render through the Outlet below.
//
// Pre-LO-008 this file owned the overview component AND did not render
// Outlet, so /admin/federation silently rendered the overview body.
// Split into layout + index to make child mounts work and to keep
// /admin's own page rendered at the index path. (LO-008 in the
// journey-coverage backlog.)
export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return <Outlet />;
}
