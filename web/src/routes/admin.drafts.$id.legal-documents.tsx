import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import { getAuthoringDraft, updateAuthoringDraft } from "@/lib/api";
import type { AuthoringDraft } from "@/lib/types";
import {
  cleanDocument,
  DOC_TYPES,
  validateDocuments,
  type LegalDocument,
  type LegalSection,
} from "@/lib/legal-document-entry";
import { Button } from "@/components/ui/button";
import { RouteError } from "@/components/govops/RouteError";

export const Route = createFileRoute("/admin/drafts/$id/legal-documents")({
  head: ({ params }) => ({
    meta: [
      { title: `Edit legal documents - ${params.id} - GovOps` },
      {
        name: "description",
        content:
          "v3.1.x L10 legal documents editor: edit a pending program draft's legal_documents[] (with nested sections[]) without re-creating the draft.",
      },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <RouteError error={error as Error} reset={reset} />
  ),
  component: LegalDocumentsEditor,
});

/**
 * v3.1.x L10 legal documents editor.
 *
 * Same posture as L9 authority chain editor: load a pending program
 * draft, surface `legal_documents[]` as a reorderable form (nested
 * `sections[]` per document), validate ids, PATCH the substrate. The
 * substrate refuses PATCH on non-PENDING; this view mirrors that with
 * an inline notice instead of rendering a form the substrate would 409.
 */
function LegalDocumentsEditor() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id } = Route.useParams();

  const [draft, setDraft] = useState<AuthoringDraft | null>(null);
  const [docs, setDocs] = useState<LegalDocument[]>([]);
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
      const list = Array.isArray(
        (d.content as { legal_documents?: unknown }).legal_documents,
      )
        ? ((d.content as { legal_documents: LegalDocument[] }).legal_documents ??
          [])
        : [];
      setDocs(
        list.map((doc) => ({
          ...doc,
          sections: Array.isArray(doc.sections) ? doc.sections.map((s) => ({ ...s })) : [],
        })),
      );
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

  const issues = useMemo(() => validateDocuments(docs), [docs]);

  function addDoc() {
    setDocs((rows) => [
      ...rows,
      {
        id: "",
        type: "statute",
        title: "",
        citation: "",
        effective_date: "",
        url: "",
        sections: [],
      },
    ]);
  }

  function removeDoc(idx: number) {
    setDocs((rows) => rows.filter((_, i) => i !== idx));
  }

  function moveDoc(idx: number, dir: -1 | 1) {
    setDocs((rows) => {
      const next = [...rows];
      const t = idx + dir;
      if (t < 0 || t >= next.length) return next;
      [next[idx], next[t]] = [next[t], next[idx]];
      return next;
    });
  }

  function patchDoc(idx: number, patch: Partial<LegalDocument>) {
    setDocs((rows) => rows.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }

  function addSection(docIdx: number) {
    setDocs((rows) =>
      rows.map((d, i) =>
        i === docIdx
          ? { ...d, sections: [...d.sections, { id: "", ref: "", heading: "", text: "" }] }
          : d,
      ),
    );
  }

  function removeSection(docIdx: number, secIdx: number) {
    setDocs((rows) =>
      rows.map((d, i) =>
        i === docIdx
          ? { ...d, sections: d.sections.filter((_, j) => j !== secIdx) }
          : d,
      ),
    );
  }

  function patchSection(docIdx: number, secIdx: number, patch: Partial<LegalSection>) {
    setDocs((rows) =>
      rows.map((d, i) =>
        i === docIdx
          ? {
              ...d,
              sections: d.sections.map((s, j) => (j === secIdx ? { ...s, ...patch } : s)),
            }
          : d,
      ),
    );
  }

  async function handleSave() {
    if (!draft) return;
    if (!editor.trim()) {
      setError(intl.formatMessage({ id: "legaldocs.editor.required" }));
      return;
    }
    if (issues.length > 0) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const nextContent = {
        ...draft.content,
        legal_documents: docs.map(cleanDocument),
      } as Record<string, unknown>;
      const updated = await updateAuthoringDraft(draft.id, {
        content: nextContent,
        editor: editor.trim(),
        rationale: rationale.trim() || undefined,
      });
      setDraft(updated);
      setInfo(intl.formatMessage({ id: "legaldocs.saved" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-foreground-muted">
        {intl.formatMessage({ id: "legaldocs.loading" })}
      </p>
    );
  }

  if (!draft) {
    return (
      <p role="alert" className="text-sm" style={{ color: "var(--verdict-rejected)" }}>
        {error ?? intl.formatMessage({ id: "legaldocs.notfound" })}
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
          {intl.formatMessage({ id: "legaldocs.editor.title" })}
        </h1>
        <p className="max-w-3xl text-sm text-foreground-muted">
          {intl.formatMessage({ id: "legaldocs.editor.lede" })}
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
          {intl.formatMessage({ id: "legaldocs.editor.wrong_type" })}
        </p>
      )}

      {isProgram && !isPending && (
        <p
          role="alert"
          className="rounded-md border border-border bg-surface p-3 text-sm text-foreground-muted"
        >
          {intl.formatMessage(
            { id: "legaldocs.editor.not_pending" },
            { status: draft.status },
          )}
        </p>
      )}

      {isProgram && isPending && (
        <>
          <section
            className="space-y-3"
            aria-label={intl.formatMessage({ id: "legaldocs.editor.title" })}
          >
            {docs.length === 0 && (
              <p className="rounded-md border border-border bg-surface p-3 text-sm text-foreground-muted">
                {intl.formatMessage({ id: "legaldocs.empty" })}
              </p>
            )}
            {docs.map((d, idx) => (
              <article
                key={idx}
                className="space-y-3 rounded-md border border-border bg-surface p-3"
                data-testid={`legaldoc-row-${idx}`}
              >
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider text-foreground-muted">
                    {intl.formatMessage({ id: "legaldocs.row.position" }, { n: idx + 1 })}
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => moveDoc(idx, -1)}
                      disabled={idx === 0}
                      data-testid={`legaldoc-row-${idx}-up`}
                    >
                      {intl.formatMessage({ id: "legaldocs.row.move_up" })}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => moveDoc(idx, 1)}
                      disabled={idx === docs.length - 1}
                      data-testid={`legaldoc-row-${idx}-down`}
                    >
                      {intl.formatMessage({ id: "legaldocs.row.move_down" })}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeDoc(idx)}
                      data-testid={`legaldoc-row-${idx}-remove`}
                    >
                      {intl.formatMessage({ id: "legaldocs.row.remove" })}
                    </Button>
                  </div>
                </header>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs">
                    <span className="text-foreground-muted">
                      {intl.formatMessage({ id: "legaldocs.field.id" })}
                    </span>
                    <input
                      type="text"
                      value={d.id}
                      onChange={(e) => patchDoc(idx, { id: e.target.value })}
                      data-testid={`legaldoc-row-${idx}-id`}
                      className="w-full rounded-md border border-border bg-surface px-2 py-1 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="text-foreground-muted">
                      {intl.formatMessage({ id: "legaldocs.field.type" })}
                    </span>
                    <select
                      value={d.type}
                      onChange={(e) => patchDoc(idx, { type: e.target.value })}
                      data-testid={`legaldoc-row-${idx}-type`}
                      className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {DOC_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs sm:col-span-2">
                    <span className="text-foreground-muted">
                      {intl.formatMessage({ id: "legaldocs.field.title" })}
                    </span>
                    <input
                      type="text"
                      value={d.title}
                      onChange={(e) => patchDoc(idx, { title: e.target.value })}
                      data-testid={`legaldoc-row-${idx}-title`}
                      className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="text-foreground-muted">
                      {intl.formatMessage({ id: "legaldocs.field.citation" })}
                    </span>
                    <input
                      type="text"
                      value={d.citation}
                      onChange={(e) => patchDoc(idx, { citation: e.target.value })}
                      data-testid={`legaldoc-row-${idx}-citation`}
                      className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="text-foreground-muted">
                      {intl.formatMessage({ id: "legaldocs.field.effective_date" })}
                    </span>
                    <input
                      type="date"
                      value={d.effective_date ?? ""}
                      onChange={(e) => patchDoc(idx, { effective_date: e.target.value })}
                      data-testid={`legaldoc-row-${idx}-effective`}
                      className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                  <label className="space-y-1 text-xs sm:col-span-2">
                    <span className="text-foreground-muted">
                      {intl.formatMessage({ id: "legaldocs.field.url" })}
                    </span>
                    <input
                      type="url"
                      value={d.url ?? ""}
                      onChange={(e) => patchDoc(idx, { url: e.target.value })}
                      data-testid={`legaldoc-row-${idx}-url`}
                      className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                </div>

                <section className="space-y-2 rounded-md border border-border bg-surface-sunken p-3">
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <h3
                      className="text-sm text-foreground"
                      style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
                    >
                      {intl.formatMessage({ id: "legaldocs.sections.heading" })}
                    </h3>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => addSection(idx)}
                      data-testid={`legaldoc-row-${idx}-add-section`}
                    >
                      {intl.formatMessage({ id: "legaldocs.sections.add" })}
                    </Button>
                  </header>
                  {d.sections.length === 0 && (
                    <p className="text-xs text-foreground-muted">
                      {intl.formatMessage({ id: "legaldocs.sections.empty" })}
                    </p>
                  )}
                  {d.sections.map((s, sIdx) => (
                    <div
                      key={sIdx}
                      className="space-y-2 rounded-md border border-border bg-surface p-2"
                      data-testid={`legaldoc-row-${idx}-section-${sIdx}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-foreground-muted">
                          {intl.formatMessage(
                            { id: "legaldocs.sections.position" },
                            { n: sIdx + 1 },
                          )}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeSection(idx, sIdx)}
                          data-testid={`legaldoc-row-${idx}-section-${sIdx}-remove`}
                        >
                          {intl.formatMessage({ id: "legaldocs.sections.remove" })}
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <label className="space-y-1 text-xs">
                          <span className="text-foreground-muted">
                            {intl.formatMessage({ id: "legaldocs.field.id" })}
                          </span>
                          <input
                            type="text"
                            value={s.id}
                            onChange={(e) =>
                              patchSection(idx, sIdx, { id: e.target.value })
                            }
                            data-testid={`legaldoc-row-${idx}-section-${sIdx}-id`}
                            className="w-full rounded-md border border-border bg-surface px-2 py-1 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </label>
                        <label className="space-y-1 text-xs">
                          <span className="text-foreground-muted">
                            {intl.formatMessage({ id: "legaldocs.sections.ref" })}
                          </span>
                          <input
                            type="text"
                            value={s.ref}
                            onChange={(e) =>
                              patchSection(idx, sIdx, { ref: e.target.value })
                            }
                            data-testid={`legaldoc-row-${idx}-section-${sIdx}-ref`}
                            className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </label>
                        <label className="space-y-1 text-xs">
                          <span className="text-foreground-muted">
                            {intl.formatMessage({ id: "legaldocs.sections.heading_field" })}
                          </span>
                          <input
                            type="text"
                            value={s.heading}
                            onChange={(e) =>
                              patchSection(idx, sIdx, { heading: e.target.value })
                            }
                            data-testid={`legaldoc-row-${idx}-section-${sIdx}-heading`}
                            className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </label>
                      </div>
                      <label className="block space-y-1 text-xs">
                        <span className="text-foreground-muted">
                          {intl.formatMessage({ id: "legaldocs.sections.text" })}
                        </span>
                        <textarea
                          value={s.text}
                          onChange={(e) =>
                            patchSection(idx, sIdx, { text: e.target.value })
                          }
                          rows={4}
                          data-testid={`legaldoc-row-${idx}-section-${sIdx}-text`}
                          className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </label>
                    </div>
                  ))}
                </section>
              </article>
            ))}
            <Button
              type="button"
              variant="ghost"
              onClick={addDoc}
              data-testid="legaldoc-add"
            >
              {intl.formatMessage({ id: "legaldocs.row.add" })}
            </Button>
          </section>

          {issues.length > 0 && (
            <ul
              role="alert"
              className="space-y-1 text-sm"
              style={{ color: "var(--verdict-rejected)" }}
            >
              {issues.map((i, k) => (
                <li key={k}>{i.message}</li>
              ))}
            </ul>
          )}

          <section className="space-y-3 rounded-md border border-border bg-surface p-4">
            <header className="space-y-1">
              <h2
                className="text-lg text-foreground"
                style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
              >
                {intl.formatMessage({ id: "legaldocs.save.heading" })}
              </h2>
              <p className="text-sm text-foreground-muted">
                {intl.formatMessage({ id: "legaldocs.save.lede" })}
              </p>
            </header>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs">
                <span className="text-foreground-muted">
                  {intl.formatMessage({ id: "legaldocs.field.editor" })}
                </span>
                <input
                  type="text"
                  value={editor}
                  onChange={(e) => setEditor(e.target.value)}
                  data-testid="legaldoc-editor"
                  className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-foreground-muted">
                  {intl.formatMessage({ id: "legaldocs.field.rationale" })}
                </span>
                <input
                  type="text"
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  data-testid="legaldoc-rationale"
                  className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="authority"
                onClick={handleSave}
                disabled={saving || issues.length > 0 || !editor.trim()}
                data-testid="legaldoc-save"
              >
                {intl.formatMessage({
                  id: saving ? "legaldocs.save.loading" : "legaldocs.save.button",
                })}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate({ to: "/admin/drafts" })}
              >
                {intl.formatMessage({ id: "legaldocs.back" })}
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
