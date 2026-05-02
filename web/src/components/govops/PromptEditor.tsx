import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { useIntl } from "react-intl";

/**
 * CodeMirror 6 wrapper themed to GovOps tokens.
 *
 * The editor is intentionally a pure controlled component: the parent owns
 * the value and persistence (autosave is handled in the route). Tab is NOT
 * trapped inside the editor — once focused, Esc releases focus so keyboard
 * users can tab onward to "Reset" / "Show diff" buttons.
 */
const govopsTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--surface-raised)",
    color: "var(--foreground)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.875rem",
    height: "100%",
  },
  ".cm-scroller": { fontFamily: "var(--font-mono)" },
  ".cm-cursor": { borderColor: "var(--lavender-600)" },
  ".cm-gutters": {
    backgroundColor: "var(--surface-sunken)",
    color: "var(--foreground-subtle)",
    border: "none",
  },
  ".cm-activeLineGutter, .cm-activeLine": {
    backgroundColor: "color-mix(in oklch, var(--lavender-200) 40%, transparent)",
  },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in oklch, var(--lavender-400) 40%, transparent) !important",
  },
  ".cm-line": { paddingInline: "0.5rem" },
});

export function PromptEditor({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  const intl = useIntl();
  return (
    <div
      role="region"
      aria-label={ariaLabel ?? intl.formatMessage({ id: "prompt.editor.aria" })}
      className="h-full overflow-hidden rounded-md border border-border"
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={[markdown(), govopsTheme, EditorView.lineWrapping]}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          foldGutter: false,
          autocompletion: false,
        }}
        height="100%"
        style={{ height: "100%" }}
      />
    </div>
  );
}
