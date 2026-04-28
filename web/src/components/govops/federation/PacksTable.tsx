import { useIntl, FormattedDate } from "react-intl";
import { AlertTriangle, Check, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FederationPack } from "@/lib/federation-types";

export interface PacksTableProps {
  packs: FederationPack[];
  onRefetch: (publisherId: string) => void;
  onToggle: (publisherId: string, enable: boolean) => void;
}

function StatusChip({ enabled }: { enabled: boolean }) {
  const intl = useIntl();
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
      style={{
        backgroundColor: enabled
          ? "color-mix(in oklab, var(--verdict-enacted) 14%, transparent)"
          : "color-mix(in oklab, var(--foreground-muted) 14%, transparent)",
        color: enabled ? "var(--verdict-enacted)" : "var(--foreground-muted)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {intl.formatMessage({
        id: enabled ? "admin.federation.status.active" : "admin.federation.status.disabled",
      })}
    </span>
  );
}

function SignedIndicator({ signed }: { signed: boolean }) {
  const intl = useIntl();
  const label = intl.formatMessage({
    id: signed ? "admin.federation.signed.true" : "admin.federation.signed.false",
  });
  return (
    <span className="inline-flex items-center gap-1 text-xs" title={label}>
      {signed ? (
        <Check className="size-4" style={{ color: "var(--verdict-enacted)" }} aria-hidden />
      ) : (
        <AlertTriangle className="size-4" style={{ color: "var(--verdict-pending)" }} aria-hidden />
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}

function ActionsMenu({
  pack,
  onRefetch,
  onToggle,
}: {
  pack: FederationPack;
  onRefetch: (id: string) => void;
  onToggle: (id: string, enable: boolean) => void;
}) {
  const intl = useIntl();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={intl.formatMessage({ id: "admin.federation.col.actions" })}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onRefetch(pack.publisher_id)}>
          {intl.formatMessage({ id: "admin.federation.action.refetch" })}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onToggle(pack.publisher_id, !pack.enabled)}>
          {intl.formatMessage({
            id: pack.enabled ? "admin.federation.action.disable" : "admin.federation.action.enable",
          })}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PacksTable({ packs, onRefetch, onToggle }: PacksTableProps) {
  const intl = useIntl();

  return (
    <>
      {/* Mobile: stacked cards */}
      <ul className="space-y-3 md:hidden">
        {packs.map((p) => (
          <li
            key={p.publisher_id}
            className="rounded-md border border-border bg-surface p-3 text-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{p.pack_name}</p>
                <p
                  className="truncate text-xs text-foreground-muted"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {p.publisher_id} · v{p.version}
                </p>
              </div>
              <ActionsMenu pack={p} onRefetch={onRefetch} onToggle={onToggle} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-foreground-muted">
              <span>
                <FormattedDate value={p.fetched_at} year="numeric" month="short" day="numeric" />
              </span>
              <span style={{ fontFamily: "var(--font-mono)" }}>
                {p.file_count} {intl.formatMessage({ id: "admin.federation.col.files" })}
              </span>
              <SignedIndicator signed={p.signed} />
              <StatusChip enabled={p.enabled} />
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-foreground-muted">
              <th className="py-2">
                {intl.formatMessage({ id: "admin.federation.col.publisher" })}
              </th>
              <th>{intl.formatMessage({ id: "admin.federation.col.pack_name" })}</th>
              <th>{intl.formatMessage({ id: "admin.federation.col.version" })}</th>
              <th>{intl.formatMessage({ id: "admin.federation.col.fetched_at" })}</th>
              <th>{intl.formatMessage({ id: "admin.federation.col.signed" })}</th>
              <th>{intl.formatMessage({ id: "admin.federation.col.files" })}</th>
              <th>{intl.formatMessage({ id: "admin.federation.col.status" })}</th>
              <th className="text-right">
                {intl.formatMessage({ id: "admin.federation.col.actions" })}
              </th>
            </tr>
          </thead>
          <tbody>
            {packs.map((p) => (
              <tr key={p.publisher_id} className="border-t border-border">
                <td className="py-2" style={{ fontFamily: "var(--font-mono)" }}>
                  {p.publisher_id}
                </td>
                <td>{p.pack_name}</td>
                <td style={{ fontFamily: "var(--font-mono)" }}>{p.version}</td>
                <td className="text-foreground-muted">
                  <FormattedDate value={p.fetched_at} year="numeric" month="short" day="numeric" />
                </td>
                <td>
                  <SignedIndicator signed={p.signed} />
                </td>
                <td style={{ fontFamily: "var(--font-mono)" }}>{p.file_count}</td>
                <td>
                  <StatusChip enabled={p.enabled} />
                </td>
                <td className="text-right">
                  <ActionsMenu pack={p} onRefetch={onRefetch} onToggle={onToggle} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
