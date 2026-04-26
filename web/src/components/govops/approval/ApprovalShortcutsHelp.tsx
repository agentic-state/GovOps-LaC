import { useIntl } from "react-intl";

/** Keyboard-shortcut legend rendered under the action buttons. */
export function ApprovalShortcutsHelp({ mod }: { mod: string }) {
  const intl = useIntl();
  const items = [
    { id: "approvals.action.approve", combo: `${mod} + Enter` },
    { id: "approvals.action.request_changes", combo: `${mod} + Shift + C` },
    { id: "approvals.action.reject", combo: `${mod} + Shift + R` },
    { id: "approvals.shortcuts.toggle_help", combo: "?" },
  ] as const;
  return (
    <dl
      className="mt-2 space-y-1 text-[11px] text-foreground-muted"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {items.map(({ id, combo }) => (
        <div key={id} className="flex items-center justify-between gap-3">
          <dt>{intl.formatMessage({ id })}</dt>
          <dd className="rounded border border-border px-1.5 py-0.5">{combo}</dd>
        </div>
      ))}
    </dl>
  );
}
