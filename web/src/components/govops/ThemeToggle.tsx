import { useIntl } from "react-intl";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const intl = useIntl();
  const label = intl.formatMessage({ id: "theme.toggle.label" });
  const stateLabel = intl.formatMessage({
    id: theme === "dark" ? "theme.dark" : "theme.light",
  });
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={theme === "dark"}
      title={label}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-foreground transition-colors hover:bg-surface-sunken"
    >
      {theme === "dark" ? (
        <Sun className="size-4" aria-hidden />
      ) : (
        <Moon className="size-4" aria-hidden />
      )}
      <span style={{ fontFamily: "var(--font-mono)" }}>{stateLabel}</span>
    </button>
  );
}
