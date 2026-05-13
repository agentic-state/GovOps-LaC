import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import { getAuthoringDraft, updateAuthoringDraft } from "@/lib/api";
import type { AuthoringDraft } from "@/lib/types";
import {
  cleanCase,
  emptyCase,
  emptyEvidence,
  emptyResidency,
  EVIDENCE_TYPES,
  LEGAL_STATUSES,
  validateCases,
  type DemoCase,
  type EvidenceItem,
  type ResidencyPeriod,
} from "@/lib/demo-case-entry";
import { Button } from "@/components/ui/button";
import { RouteError } from "@/components/govops/RouteError";

export const Route = createFileRoute("/admin/drafts/$id/demo-cases")({
  head: ({ params }) => ({
    meta: [
      { title: `Edit demo cases - ${params.id} - GovOps` },
      {
        name: "description",
        content:
          "v3.1.x L11 demo cases editor: edit a pending program draft's demo_cases[] (applicants + residency periods + evidence items) without re-creating the draft.",
      },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <RouteError error={error as Error} reset={reset} />
  ),
  component: DemoCasesEditor,
});

/**
 * v3.1.x L11 demo cases editor.
 *
 * Same posture as L9 + L10: load a pending program draft, surface a
 * slice of the manifest as a form, validate, PATCH the substrate.
 * Slice this time is demo_cases[] with three nested arrays per case:
 * applicant (single object), residency_periods[], evidence_items[].
 *
 * Validation crosses inner arrays: residency.evidence_ids must
 * reference an existing evidence item id within the same case. This is
 * the closest thing the v3.1.x editor set has to relational integrity
 * checking and pays for itself when authoring real demo cases.
 */
function DemoCasesEditor() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id } = Route.useParams();

  const [draft, setDraft] = useState<AuthoringDraft | null>(null);
  const [cases, setCases] = useState<DemoCase[]>([]);
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
        (d.content as { demo_cases?: unknown }).demo_cases,
      )
        ? ((d.content as { demo_cases: DemoCase[] }).demo_cases ?? [])
        : [];
      setCases(
        list.map((c) => ({
          id: c.id ?? "",
          applicant: {
            id: c.applicant?.id ?? "",
            legal_name: c.applicant?.legal_name ?? "",
            date_of_birth: c.applicant?.date_of_birth ?? "",
            legal_status: c.applicant?.legal_status ?? "citizen",
            country_of_birth: c.applicant?.country_of_birth ?? "",
          },
          residency_periods: Array.isArray(c.residency_periods)
            ? c.residency_periods.map((r) => ({
                country: r.country ?? "",
                start_date: r.start_date ?? "",
                end_date: r.end_date ?? "",
                verified: Boolean(r.verified),
                evidence_ids: Array.isArray(r.evidence_ids)
                  ? [...r.evidence_ids]
                  : [],
              }))
            : [],
          evidence_items: Array.isArray(c.evidence_items)
            ? c.evidence_items.map((e) => ({
                id: e.id ?? "",
                type: e.type ?? "other",
                description: e.description ?? "",
                provided: Boolean(e.provided),
                verified: Boolean(e.verified),
              }))
            : [],
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
  const issues = useMemo(() => validateCases(cases), [cases]);

  function addCase() {
    setCases((rows) => [...rows, emptyCase()]);
  }
  function removeCase(idx: number) {
    setCases((rows) => rows.filter((_, i) => i !== idx));
  }
  function moveCase(idx: number, dir: -1 | 1) {
    setCases((rows) => {
      const next = [...rows];
      const t = idx + dir;
      if (t < 0 || t >= next.length) return next;
      [next[idx], next[t]] = [next[t], next[idx]];
      return next;
    });
  }
  function patchCase(idx: number, patch: Partial<DemoCase>) {
    setCases((rows) => rows.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function patchApplicant(idx: number, patch: Partial<DemoCase["applicant"]>) {
    setCases((rows) =>
      rows.map((c, i) =>
        i === idx ? { ...c, applicant: { ...c.applicant, ...patch } } : c,
      ),
    );
  }
  function addResidency(idx: number) {
    setCases((rows) =>
      rows.map((c, i) =>
        i === idx ? { ...c, residency_periods: [...c.residency_periods, emptyResidency()] } : c,
      ),
    );
  }
  function removeResidency(idx: number, rIdx: number) {
    setCases((rows) =>
      rows.map((c, i) =>
        i === idx
          ? { ...c, residency_periods: c.residency_periods.filter((_, j) => j !== rIdx) }
          : c,
      ),
    );
  }
  function patchResidency(idx: number, rIdx: number, patch: Partial<ResidencyPeriod>) {
    setCases((rows) =>
      rows.map((c, i) =>
        i === idx
          ? {
              ...c,
              residency_periods: c.residency_periods.map((r, j) =>
                j === rIdx ? { ...r, ...patch } : r,
              ),
            }
          : c,
      ),
    );
  }
  function addEvidence(idx: number) {
    setCases((rows) =>
      rows.map((c, i) =>
        i === idx ? { ...c, evidence_items: [...c.evidence_items, emptyEvidence()] } : c,
      ),
    );
  }
  function removeEvidence(idx: number, eIdx: number) {
    setCases((rows) =>
      rows.map((c, i) =>
        i === idx
          ? { ...c, evidence_items: c.evidence_items.filter((_, j) => j !== eIdx) }
          : c,
      ),
    );
  }
  function patchEvidence(idx: number, eIdx: number, patch: Partial<EvidenceItem>) {
    setCases((rows) =>
      rows.map((c, i) =>
        i === idx
          ? {
              ...c,
              evidence_items: c.evidence_items.map((e, j) =>
                j === eIdx ? { ...e, ...patch } : e,
              ),
            }
          : c,
      ),
    );
  }

  async function handleSave() {
    if (!draft) return;
    if (!editor.trim()) {
      setError(intl.formatMessage({ id: "democases.editor.required" }));
      return;
    }
    if (issues.length > 0) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const nextContent = {
        ...draft.content,
        demo_cases: cases.map(cleanCase),
      } as Record<string, unknown>;
      const updated = await updateAuthoringDraft(draft.id, {
        content: nextContent,
        editor: editor.trim(),
        rationale: rationale.trim() || undefined,
      });
      setDraft(updated);
      setInfo(intl.formatMessage({ id: "democases.saved" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-foreground-muted">
        {intl.formatMessage({ id: "democases.loading" })}
      </p>
    );
  }

  if (!draft) {
    return (
      <p role="alert" className="text-sm" style={{ color: "var(--verdict-rejected)" }}>
        {error ?? intl.formatMessage({ id: "democases.notfound" })}
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
          {intl.formatMessage({ id: "democases.editor.title" })}
        </h1>
        <p className="max-w-3xl text-sm text-foreground-muted">
          {intl.formatMessage({ id: "democases.editor.lede" })}
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
          {intl.formatMessage({ id: "democases.editor.wrong_type" })}
        </p>
      )}

      {isProgram && !isPending && (
        <p
          role="alert"
          className="rounded-md border border-border bg-surface p-3 text-sm text-foreground-muted"
        >
          {intl.formatMessage(
            { id: "democases.editor.not_pending" },
            { status: draft.status },
          )}
        </p>
      )}

      {isProgram && isPending && (
        <>
          <section
            className="space-y-3"
            aria-label={intl.formatMessage({ id: "democases.editor.title" })}
          >
            {cases.length === 0 && (
              <p className="rounded-md border border-border bg-surface p-3 text-sm text-foreground-muted">
                {intl.formatMessage({ id: "democases.empty" })}
              </p>
            )}
            {cases.map((c, idx) => (
              <article
                key={idx}
                className="space-y-3 rounded-md border border-border bg-surface p-3"
                data-testid={`democase-row-${idx}`}
              >
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider text-foreground-muted">
                    {intl.formatMessage({ id: "democases.row.position" }, { n: idx + 1 })}
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => moveCase(idx, -1)}
                      disabled={idx === 0}
                      data-testid={`democase-row-${idx}-up`}
                    >
                      {intl.formatMessage({ id: "democases.row.move_up" })}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => moveCase(idx, 1)}
                      disabled={idx === cases.length - 1}
                      data-testid={`democase-row-${idx}-down`}
                    >
                      {intl.formatMessage({ id: "democases.row.move_down" })}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeCase(idx)}
                      data-testid={`democase-row-${idx}-remove`}
                    >
                      {intl.formatMessage({ id: "democases.row.remove" })}
                    </Button>
                  </div>
                </header>

                <label className="space-y-1 text-xs">
                  <span className="text-foreground-muted">
                    {intl.formatMessage({ id: "democases.field.id" })}
                  </span>
                  <input
                    type="text"
                    value={c.id}
                    onChange={(e) => patchCase(idx, { id: e.target.value })}
                    data-testid={`democase-row-${idx}-id`}
                    className="w-full rounded-md border border-border bg-surface px-2 py-1 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>

                <section className="space-y-2 rounded-md border border-border bg-surface-sunken p-3">
                  <h3
                    className="text-sm text-foreground"
                    style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
                  >
                    {intl.formatMessage({ id: "democases.applicant.heading" })}
                  </h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="space-y-1 text-xs">
                      <span className="text-foreground-muted">
                        {intl.formatMessage({ id: "democases.applicant.id" })}
                      </span>
                      <input
                        type="text"
                        value={c.applicant.id}
                        onChange={(e) => patchApplicant(idx, { id: e.target.value })}
                        data-testid={`democase-row-${idx}-applicant-id`}
                        className="w-full rounded-md border border-border bg-surface px-2 py-1 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-foreground-muted">
                        {intl.formatMessage({ id: "democases.applicant.legal_name" })}
                      </span>
                      <input
                        type="text"
                        value={c.applicant.legal_name}
                        onChange={(e) => patchApplicant(idx, { legal_name: e.target.value })}
                        data-testid={`democase-row-${idx}-applicant-name`}
                        className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-foreground-muted">
                        {intl.formatMessage({ id: "democases.applicant.dob" })}
                      </span>
                      <input
                        type="date"
                        value={c.applicant.date_of_birth}
                        onChange={(e) => patchApplicant(idx, { date_of_birth: e.target.value })}
                        data-testid={`democase-row-${idx}-applicant-dob`}
                        className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-foreground-muted">
                        {intl.formatMessage({ id: "democases.applicant.legal_status" })}
                      </span>
                      <select
                        value={c.applicant.legal_status}
                        onChange={(e) => patchApplicant(idx, { legal_status: e.target.value })}
                        data-testid={`democase-row-${idx}-applicant-status`}
                        className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {LEGAL_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs sm:col-span-2">
                      <span className="text-foreground-muted">
                        {intl.formatMessage({ id: "democases.applicant.country_of_birth" })}
                      </span>
                      <input
                        type="text"
                        value={c.applicant.country_of_birth}
                        onChange={(e) => patchApplicant(idx, { country_of_birth: e.target.value })}
                        data-testid={`democase-row-${idx}-applicant-country`}
                        className="w-full rounded-md border border-border bg-surface px-2 py-1 font-mono text-sm uppercase text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                  </div>
                </section>

                <section className="space-y-2 rounded-md border border-border bg-surface-sunken p-3">
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <h3
                      className="text-sm text-foreground"
                      style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
                    >
                      {intl.formatMessage({ id: "democases.residency.heading" })}
                    </h3>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => addResidency(idx)}
                      data-testid={`democase-row-${idx}-add-residency`}
                    >
                      {intl.formatMessage({ id: "democases.residency.add" })}
                    </Button>
                  </header>
                  {c.residency_periods.length === 0 && (
                    <p className="text-xs text-foreground-muted">
                      {intl.formatMessage({ id: "democases.residency.empty" })}
                    </p>
                  )}
                  {c.residency_periods.map((r, rIdx) => (
                    <div
                      key={rIdx}
                      className="space-y-2 rounded-md border border-border bg-surface p-2"
                      data-testid={`democase-row-${idx}-residency-${rIdx}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-foreground-muted">
                          {intl.formatMessage(
                            { id: "democases.residency.position" },
                            { n: rIdx + 1 },
                          )}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeResidency(idx, rIdx)}
                          data-testid={`democase-row-${idx}-residency-${rIdx}-remove`}
                        >
                          {intl.formatMessage({ id: "democases.residency.remove" })}
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <label className="space-y-1 text-xs">
                          <span className="text-foreground-muted">
                            {intl.formatMessage({ id: "democases.residency.country" })}
                          </span>
                          <input
                            type="text"
                            value={r.country}
                            onChange={(e) =>
                              patchResidency(idx, rIdx, { country: e.target.value })
                            }
                            data-testid={`democase-row-${idx}-residency-${rIdx}-country`}
                            className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </label>
                        <label className="space-y-1 text-xs">
                          <span className="text-foreground-muted">
                            {intl.formatMessage({ id: "democases.residency.start" })}
                          </span>
                          <input
                            type="date"
                            value={r.start_date}
                            onChange={(e) =>
                              patchResidency(idx, rIdx, { start_date: e.target.value })
                            }
                            data-testid={`democase-row-${idx}-residency-${rIdx}-start`}
                            className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </label>
                        <label className="space-y-1 text-xs">
                          <span className="text-foreground-muted">
                            {intl.formatMessage({ id: "democases.residency.end" })}
                          </span>
                          <input
                            type="date"
                            value={r.end_date ?? ""}
                            onChange={(e) =>
                              patchResidency(idx, rIdx, { end_date: e.target.value })
                            }
                            data-testid={`democase-row-${idx}-residency-${rIdx}-end`}
                            className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </label>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-foreground">
                        <input
                          type="checkbox"
                          checked={r.verified}
                          onChange={(e) =>
                            patchResidency(idx, rIdx, { verified: e.target.checked })
                          }
                          data-testid={`democase-row-${idx}-residency-${rIdx}-verified`}
                        />
                        <span>{intl.formatMessage({ id: "democases.residency.verified" })}</span>
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="text-foreground-muted">
                          {intl.formatMessage({ id: "democases.residency.evidence_ids" })}
                        </span>
                        <input
                          type="text"
                          value={r.evidence_ids.join(", ")}
                          onChange={(e) =>
                            patchResidency(idx, rIdx, {
                              evidence_ids: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                            })
                          }
                          data-testid={`democase-row-${idx}-residency-${rIdx}-evids`}
                          placeholder="ev-001-tax, ev-002-passport"
                          className="w-full rounded-md border border-border bg-surface px-2 py-1 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </label>
                    </div>
                  ))}
                </section>

                <section className="space-y-2 rounded-md border border-border bg-surface-sunken p-3">
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <h3
                      className="text-sm text-foreground"
                      style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
                    >
                      {intl.formatMessage({ id: "democases.evidence.heading" })}
                    </h3>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => addEvidence(idx)}
                      data-testid={`democase-row-${idx}-add-evidence`}
                    >
                      {intl.formatMessage({ id: "democases.evidence.add" })}
                    </Button>
                  </header>
                  {c.evidence_items.length === 0 && (
                    <p className="text-xs text-foreground-muted">
                      {intl.formatMessage({ id: "democases.evidence.empty" })}
                    </p>
                  )}
                  {c.evidence_items.map((ev, eIdx) => (
                    <div
                      key={eIdx}
                      className="space-y-2 rounded-md border border-border bg-surface p-2"
                      data-testid={`democase-row-${idx}-evidence-${eIdx}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-foreground-muted">
                          {intl.formatMessage(
                            { id: "democases.evidence.position" },
                            { n: eIdx + 1 },
                          )}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeEvidence(idx, eIdx)}
                          data-testid={`democase-row-${idx}-evidence-${eIdx}-remove`}
                        >
                          {intl.formatMessage({ id: "democases.evidence.remove" })}
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <label className="space-y-1 text-xs">
                          <span className="text-foreground-muted">
                            {intl.formatMessage({ id: "democases.field.id" })}
                          </span>
                          <input
                            type="text"
                            value={ev.id}
                            onChange={(e) =>
                              patchEvidence(idx, eIdx, { id: e.target.value })
                            }
                            data-testid={`democase-row-${idx}-evidence-${eIdx}-id`}
                            className="w-full rounded-md border border-border bg-surface px-2 py-1 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </label>
                        <label className="space-y-1 text-xs">
                          <span className="text-foreground-muted">
                            {intl.formatMessage({ id: "democases.evidence.type" })}
                          </span>
                          <select
                            value={ev.type}
                            onChange={(e) =>
                              patchEvidence(idx, eIdx, { type: e.target.value })
                            }
                            data-testid={`democase-row-${idx}-evidence-${eIdx}-type`}
                            className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {EVIDENCE_TYPES.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="block space-y-1 text-xs">
                        <span className="text-foreground-muted">
                          {intl.formatMessage({ id: "democases.evidence.description" })}
                        </span>
                        <input
                          type="text"
                          value={ev.description}
                          onChange={(e) =>
                            patchEvidence(idx, eIdx, { description: e.target.value })
                          }
                          data-testid={`democase-row-${idx}-evidence-${eIdx}-description`}
                          className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </label>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-foreground">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={ev.provided}
                            onChange={(e) =>
                              patchEvidence(idx, eIdx, { provided: e.target.checked })
                            }
                            data-testid={`democase-row-${idx}-evidence-${eIdx}-provided`}
                          />
                          <span>
                            {intl.formatMessage({ id: "democases.evidence.provided" })}
                          </span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={ev.verified}
                            onChange={(e) =>
                              patchEvidence(idx, eIdx, { verified: e.target.checked })
                            }
                            data-testid={`democase-row-${idx}-evidence-${eIdx}-verified`}
                          />
                          <span>
                            {intl.formatMessage({ id: "democases.evidence.verified" })}
                          </span>
                        </label>
                      </div>
                    </div>
                  ))}
                </section>
              </article>
            ))}
            <Button
              type="button"
              variant="ghost"
              onClick={addCase}
              data-testid="democase-add"
            >
              {intl.formatMessage({ id: "democases.row.add" })}
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
                {intl.formatMessage({ id: "democases.save.heading" })}
              </h2>
              <p className="text-sm text-foreground-muted">
                {intl.formatMessage({ id: "democases.save.lede" })}
              </p>
            </header>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs">
                <span className="text-foreground-muted">
                  {intl.formatMessage({ id: "democases.field.editor" })}
                </span>
                <input
                  type="text"
                  value={editor}
                  onChange={(e) => setEditor(e.target.value)}
                  data-testid="democase-editor"
                  className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-foreground-muted">
                  {intl.formatMessage({ id: "democases.field.rationale" })}
                </span>
                <input
                  type="text"
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  data-testid="democase-rationale"
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
                data-testid="democase-save"
              >
                {intl.formatMessage({
                  id: saving ? "democases.save.loading" : "democases.save.button",
                })}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate({ to: "/admin/drafts" })}
              >
                {intl.formatMessage({ id: "democases.back" })}
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
