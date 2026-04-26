import { useIntl } from "react-intl";

export function JurisdictionSwitcher({
  current,
  available,
  onSwitch,
  switching,
}: {
  current: string;
  available: string[];
  onSwitch: (code: string) => void;
  switching: boolean;
}) {
  const intl = useIntl();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-xs uppercase tracking-wider text-foreground-muted">
        {intl.formatMessage({ id: "admin.jurisdiction.switcher.label" })}
      </span>
      <select
        value={current}
        onChange={(e) => onSwitch(e.target.value)}
        disabled={switching}
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        style={{ fontFamily: "var(--font-mono)" }}
        title={intl.formatMessage({ id: "admin.jurisdiction.switcher.help" })}
      >
        {available.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </label>
  );
}
