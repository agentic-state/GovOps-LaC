import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import { getAuthoringDraft, updateAuthoringDraft } from "@/lib/api";
import type { AuthoringDraft } from "@/lib/types";
import { cleanEntry, type AuthorityEntry } from "@/lib/authority-entry";
import { Button } from "@/components/ui/button";
import { RouteError } from "@/components/govops/RouteError";

export const Route = createFileRoute("/admin/drafts/$id/authority")({
  head: ({ params }) => ({
    meta: [
      { title: `Edit authority chain - ${params.id} - GovOps` },
      {
        name: "description",
        content:
          "v3.1.x L9 authority chain editor: edit a pending program draft's authority_chain entries without re-creating the draft.",
      },
    ],
  }),
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  component: AuthorityChainEditor,
});

const LAYERS = ["constitution", "act", "regulation", "program", "service"] as const;

/**
 * v3.1.x L9 authority chain editor.
 *
 * Loads a PENDING program draft, surfaces its `authority_chain[]` as a
 * reorderable form, and patches the substrate via
 * `PATCH /api/authoring/drafts/{id}` on save. Refuses to render the form
 * when the draft is anything other than PENDING (the substrate refuses
 * the PATCH itself; we mirror that posture in the UI for a clearer
 * read).
 *
 * Smallest of the three L9-L11 editors and the template for the others:
 * legal documents (L10) and demo cases (L11) repeat the same shape over
 * their respective slices of the program manifest.
 */
function AuthorityChainEditor() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id } = Route.useParams();

  const [draft, setDraft] = useState<AuthoringDraft | null>(null);
  const [entries, setEntries] = useState<AuthorityEntry[]>([]);
  const [editor, setEditor] = useState("");
  const [rationale, setRationale] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getAuthoringDraft(id);
      setDraft(d);
      const chain = Array.isArray((d.content as { authority_chain?: unknown }).authority_chain)
        ? ((d.content as { authority_chain: AuthorityEntry[] }).authority_chain ?? [])
        : [];
      setEntries(chain.map((e) => ({ ...e })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load draft.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const isProgram = draft?.type === "program";
  const isPending = draft?.status === "pending";

  const validationErrors = useMemo(() => {
    const errs: string[] = [];
    const ids = new Set<string>();
    entries.forEach((e, i) => {
      if (!e.id.trim()) errs.push(`row ${i + 1}: id required`);
      else if (ids.has(e.id)) errs.push(`row ${i + 1}: duplicate id "${e.id}"`);
      else ids.add(e.id);
      if (!e.title.trim()) errs.push(`row ${i + 1}: title required`);
      if (!e.layer) errs.push(`row ${i + 1}: layer required`);
    });
    return errs;
  }, [entries]);

  function addEntry() {
    setEntries((rows) => [
      ...rows,
      {
        id: "",
        layer: "act",
        title: "",
        citation: "",
        effective_date: "",
        url: "",
        parent: "",
      },
    ]);
  }

  function removeEntry(idx: number) {
    setEntries((rows) => rows.filter((_, i) => i !== idx));
  }

  function moveEntry(idx: number, dir: -1 | 1) {
    setEntries((rows) => {
      const next = [...rows];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return next;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function patchEntry(idx: number, patch: Partial<AuthorityEntry>) {
    setEntries((rows) => rows.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  async function handleSave() {
    if (!draft) return;
    if (!editor.trim()) {
      setError(intl.formatMessage({ id: "authority.editor.required" }));
      return;
    }
    if (validationErrors.length > 0) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const nextContent = {
        ...draft.content,
        authority_chain: entries.map(cleanEntry),
      } as Record<string, unknown>;
      const updated = await updateAuthoringDraft(draft.id, {
        content: nextContent,
        editor: editor.trim(),
        rationale: rationale.trim() || undefined,
      });
      setDraft(updated);
      setInfo(intl.formatMessage({ id: "authority.saved" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-foreground-muted">
        {intl.formatMessage({ id: "authority.loading" })}
      </p>
    );
  }

  if (!draft) {
    return (
      <p role="alert" className="text-sm" style={{ color: "var(--verdict-rejected)" }}>
        {error ?? intl.formatMessage({ id: "authority.notfound" })}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1
          className="text-3xl tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {intl.formatMessage({ id: "authority.editor.title" })}
        </h1>
        <p className="max-w-3xl text-sm text-foreground-muted">
          {intl.formatMessage({ id: "authority.editor.lede" })}
        </p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 pt-2 text-xs text-foreground-muted sm:grid-cols-3">
          <div>
            <dt className="inline">{intl.formatMessage({ id: "drafts.row.id" })}: </dt>
            <dd className="inline font-mono">{draft.id}</dd>
          </div>
          <div>
            <dt className="inline">target: </dt>
            <dd className="inline font-mono">{draft.target_path}</dd>
          </div>
          <div>
            <dt className="inline">status: </dt>
            <dd className="inline">{draft.status}</dd>
          </div>
        </dl>
      </header>

      {!isProgram && (
        <p
          role="alert"
          className="rounded-md border border-border bg-surface p-3 text-sm text-foreground-muted"
        >
          {intl.formatMessage({ id: "authority.editor.wrong_type" })}
        </p>
      )}

      {isProgram && !isPending && (
        <p
          role="alert"
          className="rounded-md border border-border bg-surface p-3 text-sm text-foreground-muted"
        >
          {intl.formatMessage({ id: "authority.editor.not_pending" }, { status: draft.status })}
        </p>
      )}

      {isProgram && isPending && (
        <>
          <section
            className="space-y-3"
            aria-label={intl.formatMessage({ id: "authority.editor.title" })}
          >
            {entries.length === 0 && (
              <p className="rounded-md border border-border bg-surface p-3 text-sm text-foreground-muted">
                {intl.formatMessage({ id: "authority.empty" })}
              </p>
            )}
            {entries.map((e, idx) => (
              <article
                key={idx}
                className="space-y-2 rounded-md border border-border bg-surface p-3"
                data-testid={`authority-row-${idx}`}
              >
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider text-foreground-muted">
                    {intl.formatMessage({ id: "authority.row.position" }, { n: idx + 1 })}
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => moveEntry(idx, -1)}
                      disabled={idx === 0}
                      aria-label={intl.formatMessage({ id: "authority.row.move_up" })}
                      data-testid={`authority-row-${idx}-up`}
                    >
                      {intl.formatMessage({ id: "authority.row.move_up" })}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => moveEntry(idx, 1)}
                      disabled={idx === entries.length - 1}
                      aria-label={intl.formatMessage({ id: "authority.row.move_down" })}
                      data-testid={`authority-row-${idx}-down`}
                    >
                      {intl.formatMessage({ id: "authority.row.move_down" })}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeEntry(idx)}
                      aria-label={intl.formatMessage({ id: "authority.row.remove" })}
                      data-testid={`authority-row-${idx}-remove`}
                    >
                      {intl.formatMessage({ id: "authority.row.remove" })}
                    </Button>
                  </div>
                </header>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs">
                    <span className="text-foreground-muted">
                      {intl.formatMessage({ id: "authority.field.id" })}
                    </span>
                    <input
                      type="text"
                      value={e.id}
                      onChange={(ev) => patchEntry(idx, { id: ev.target.value })}
                      data-testid={`authority-row-${idx}-id`}
                      className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="text-foreground-muted">
                      {intl.formatMessage({ id: "authority.field.layer" })}
                    </span>
                    <select
                      value={e.layer}
                      onChange={(ev) => patchEntry(idx, { layer: ev.target.value })}
                      data-testid={`authority-row-${idx}-layer`}
                      className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {LAYERS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs sm:col-span-2">
                    <span className="text-foreground-muted">
                      {intl.formatMessage({ id: "authority.field.title" })}
                    </span>
                    <input
                      type="text"
                      value={e.title}
                      onChange={(ev) => patchEntry(idx, { title: ev.target.value })}
                      data-testid={`authority-row-${idx}-title`}
                      className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="text-foreground-muted">
                      {intl.formatMessage({ id: "authority.field.citation" })}
                    </span>
                    <input
                      type="text"
                      value={e.citation}
                      onChange={(ev) => patchEntry(idx, { citation: ev.target.value })}
                      data-testid={`authority-row-${idx}-citation`}
                      className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="text-foreground-muted">
                      {intl.formatMessage({ id: "authority.field.effective_date" })}
                    </span>
                    <input
                      type="date"
                      value={e.effective_date ?? ""}
                      onChange={(ev) => patchEntry(idx, { effective_date: ev.target.value })}
                      data-testid={`authority-row-${idx}-effective`}
                      className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="text-foreground-muted">
                      {intl.formatMessage({ id: "authority.field.url" })}
                    </span>
                    <input
                      type="url"
                      value={e.url ?? ""}
                      onChange={(ev) => patchEntry(idx, { url: ev.target.value })}
                      data-testid={`authority-row-${idx}-url`}
                      className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="text-foreground-muted">
                      {intl.formatMessage({ id: "authority.field.parent" })}
                    </span>
                    <input
                      type="text"
                      value={e.parent ?? ""}
                      onChange={(ev) => patchEntry(idx, { parent: ev.target.value })}
                      data-testid={`authority-row-${idx}-parent`}
                      className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                </div>
              </article>
            ))}
            <Button type="button" variant="ghost" onClick={addEntry} data-testid="authority-add">
              {intl.formatMessage({ id: "authority.row.add" })}
            </Button>
          </section>

          {validationErrors.length > 0 && (
            <ul
              role="alert"
              className="space-y-1 text-sm"
              style={{ color: "var(--verdict-rejected)" }}
            >
              {validationErrors.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}

          <section className="space-y-3 rounded-md border border-border bg-surface p-4">
            <header className="space-y-1">
              <h2
                className="text-lg text-foreground"
                style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
              >
                {intl.formatMessage({ id: "authority.save.heading" })}
              </h2>
              <p className="text-sm text-foreground-muted">
                {intl.formatMessage({ id: "authority.save.lede" })}
              </p>
            </header>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs">
                <span className="text-foreground-muted">
                  {intl.formatMessage({ id: "authority.field.editor" })}
                </span>
                <input
                  type="text"
                  value={editor}
                  onChange={(e) => setEditor(e.target.value)}
                  data-testid="authority-editor"
                  className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-foreground-muted">
                  {intl.formatMessage({ id: "authority.field.rationale" })}
                </span>
                <input
                  type="text"
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  data-testid="authority-rationale"
                  className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="authority"
                onClick={handleSave}
                disabled={saving || validationErrors.length > 0 || !editor.trim()}
                data-testid="authority-save"
              >
                {intl.formatMessage({
                  id: saving ? "authority.save.loading" : "authority.save.button",
                })}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate({ to: "/admin/drafts" })}
              >
                {intl.formatMessage({ id: "authority.back" })}
              </Button>
            </div>
          </section>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--verdict-rejected)" }}>
          {error}
        </p>
      )}
      {info && (
        <p role="status" className="text-sm text-foreground-muted">
          {info}
        </p>
      )}
    </div>
  );
}

