import { useIntl, FormattedDate } from "react-intl";
import type { FederationRegistryEntry } from "@/lib/federation-types";
import { TrustChip } from "./TrustChip";

export function RegistryTable({
  registry,
  lastFetchedById,
}: {
  registry: FederationRegistryEntry[];
  lastFetchedById: Map<string, string | null>;
}) {
  const intl = useIntl();

  // Mobile: stacked cards. Desktop (md+): table. Same data, two layouts.
  return (
    <>
      {/* Mobile cards */}
      <ul className="space-y-3 md:hidden">
        {registry.map((r) => {
          const lf = lastFetchedById.get(r.publisher_id) ?? null;
          return (
            <li
              key={r.publisher_id}
              className="rounded-md border border-border bg-surface p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{r.name}</p>
                  <p
                    className="truncate text-xs text-foreground-muted"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {r.publisher_id}
                  </p>
                </div>
                <TrustChip status={r.trust_status} />
              </div>
              <a
                href={r.manifest_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block truncate text-xs text-authority hover:underline"
                title={r.manifest_url}
              >
                {r.manifest_url}
              </a>
              <p className="mt-2 text-xs text-foreground-muted">
                {intl.formatMessage({ id: "admin.federation.col.last_fetched" })}:{" "}
                {lf ? <FormattedDate value={lf} year="numeric" month="short" day="numeric" /> : "—"}
              </p>
            </li>
          );
        })}
      </ul>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-foreground-muted">
              <th className="py-2">
                {intl.formatMessage({ id: "admin.federation.col.publisher_id" })}
              </th>
              <th>{intl.formatMessage({ id: "admin.federation.col.name" })}</th>
              <th>{intl.formatMessage({ id: "admin.federation.col.manifest_url" })}</th>
              <th>{intl.formatMessage({ id: "admin.federation.col.trust" })}</th>
              <th>{intl.formatMessage({ id: "admin.federation.col.last_fetched" })}</th>
            </tr>
          </thead>
          <tbody>
            {registry.map((r) => {
              const lf = lastFetchedById.get(r.publisher_id) ?? null;
              return (
                <tr key={r.publisher_id} className="border-t border-border">
                  <td className="py-2" style={{ fontFamily: "var(--font-mono)" }}>
                    {r.publisher_id}
                  </td>
                  <td>{r.name}</td>
                  <td className="max-w-[18rem] truncate" title={r.manifest_url}>
                    <a
                      href={r.manifest_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-authority hover:underline"
                    >
                      {r.manifest_url}
                    </a>
                  </td>
                  <td>
                    <TrustChip status={r.trust_status} />
                  </td>
                  <td className="text-foreground-muted">
                    {lf ? (
                      <FormattedDate value={lf} year="numeric" month="short" day="numeric" />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
