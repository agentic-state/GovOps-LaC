import { useReducer, useState } from "react";
import { useIntl } from "react-intl";
import { toast } from "sonner";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { postCaseEvent } from "@/lib/api";
import type { CaseEventRequest, CaseEventType, PostEventResponse } from "@/lib/types";

export interface NewEventFormProps {
  caseId: string;
  onCreated: (response: PostEventResponse) => void;
}

const ISO_COUNTRIES = ["CA", "US", "BR", "FR", "DE", "ES", "UK", "UA", "MX", "AU"];
const LEGAL_STATUSES = ["citizen", "permanent_resident", "other"] as const;

// ── Validation schemas ──────────────────────────────────────────────────────
// Validate the per-event-type payload separately so we can map errors to fields.
const baseSchema = z.object({
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "events.error.bad_date" }),
  note: z.string().max(2000, { message: "events.error.note_long" }).optional(),
});
const moveSchema = z.object({
  to_country: z.enum(ISO_COUNTRIES as [string, ...string[]], {
    errorMap: () => ({ message: "events.error.to_country_required" }),
  }),
  from_country: z.enum(ISO_COUNTRIES as [string, ...string[]]).optional(),
  open_new: z.boolean(),
});
const statusSchema = z.object({
  to_status: z.enum(LEGAL_STATUSES, {
    errorMap: () => ({ message: "events.error.to_status_required" }),
  }),
});
const evidenceSchema = z.object({
  evidence_type: z
    .string()
    .trim()
    .min(1, { message: "events.error.evidence_type_required" })
    .max(80, { message: "events.error.evidence_type_long" }),
  description: z.string().max(500, { message: "events.error.description_long" }).optional(),
  verified: z.boolean(),
});

// ── Form state reducer (replaces 8 useState calls) ──────────────────────────
interface FormState {
  eventType: CaseEventType;
  effective_date: string;
  note: string;
  // payloads keyed by type, kept independently so switching back is non-destructive
  move: { to_country: string; from_country: string; open_new: boolean };
  status: { to_status: (typeof LEGAL_STATUSES)[number] };
  evidence: { evidence_type: string; description: string; verified: boolean };
}

type Action =
  | { kind: "set_type"; value: CaseEventType }
  | { kind: "set_field"; field: "effective_date" | "note"; value: string }
  | { kind: "set_move"; patch: Partial<FormState["move"]> }
  | { kind: "set_status"; patch: Partial<FormState["status"]> }
  | { kind: "set_evidence"; patch: Partial<FormState["evidence"]> }
  | { kind: "reset" };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function initialState(): FormState {
  return {
    eventType: "re_evaluate",
    effective_date: todayIso(),
    note: "",
    move: { to_country: "", from_country: "", open_new: true },
    status: { to_status: "citizen" },
    evidence: { evidence_type: "", description: "", verified: false },
  };
}

function reducer(state: FormState, action: Action): FormState {
  switch (action.kind) {
    case "set_type":
      return { ...state, eventType: action.value };
    case "set_field":
      return { ...state, [action.field]: action.value };
    case "set_move":
      return { ...state, move: { ...state.move, ...action.patch } };
    case "set_status":
      return { ...state, status: { ...state.status, ...action.patch } };
    case "set_evidence":
      return { ...state, evidence: { ...state.evidence, ...action.patch } };
    case "reset":
      return initialState();
  }
}

export function NewEventForm({ caseId, onCreated }: NewEventFormProps) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  const fieldError = (key: string): string | undefined =>
    errors[key] ? intl.formatMessage({ id: errors[key], defaultMessage: errors[key] }) : undefined;

  const validate = (): { ok: boolean; payload: Record<string, unknown> } => {
    const next: Record<string, string> = {};
    const base = baseSchema.safeParse({
      effective_date: state.effective_date,
      note: state.note || undefined,
    });
    if (!base.success) {
      for (const issue of base.error.issues) next[issue.path.join(".")] = issue.message;
    }
    let payload: Record<string, unknown> = {};
    if (state.eventType === "move_country") {
      const r = moveSchema.safeParse(state.move);
      if (!r.success) for (const i of r.error.issues) next[i.path.join(".")] = i.message;
      else
        payload = {
          to_country: r.data.to_country,
          ...(r.data.from_country ? { from_country: r.data.from_country } : {}),
          open_new: r.data.open_new,
        };
    } else if (state.eventType === "change_legal_status") {
      const r = statusSchema.safeParse(state.status);
      if (!r.success) for (const i of r.error.issues) next[i.path.join(".")] = i.message;
      else payload = { to_status: r.data.to_status };
    } else if (state.eventType === "add_evidence") {
      const r = evidenceSchema.safeParse(state.evidence);
      if (!r.success) for (const i of r.error.issues) next[i.path.join(".")] = i.message;
      else
        payload = {
          evidence_type: r.data.evidence_type,
          ...(r.data.description ? { description: r.data.description } : {}),
          verified: r.data.verified,
        };
    }
    setErrors(next);
    return { ok: Object.keys(next).length === 0, payload };
  };

  // Submit is enabled only when the type-specific required fields are present.
  const canSubmit =
    !submitting &&
    !!state.effective_date &&
    (state.eventType === "re_evaluate" ||
      (state.eventType === "move_country" && !!state.move.to_country) ||
      (state.eventType === "change_legal_status" && !!state.status.to_status) ||
      (state.eventType === "add_evidence" && state.evidence.evidence_type.trim().length > 0));

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const v = validate();
    if (!v.ok) return;
    const body: CaseEventRequest = {
      event_type: state.eventType,
      effective_date: state.effective_date,
      payload: v.payload,
      note: state.note || undefined,
    };
    setSubmitting(true);
    try {
      const res = await postCaseEvent(caseId, body, true);
      onCreated(res);
      setOpen(false);
      dispatch({ kind: "reset" });
      setErrors({});
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : intl.formatMessage({ id: "events.error.submit_failed" }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant="outline" type="button">
          {intl.formatMessage({ id: "events.form.record_button" })}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{intl.formatMessage({ id: "events.form.heading" })}</DialogTitle>
          <DialogDescription className="sr-only">
            {intl.formatMessage({ id: "events.form.heading" })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="evt-type">
              {intl.formatMessage({ id: "events.form.field.event_type" })}
            </Label>
            <Select
              value={state.eventType}
              onValueChange={(v) => dispatch({ kind: "set_type", value: v as CaseEventType })}
            >
              <SelectTrigger id="evt-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="re_evaluate">
                  {intl.formatMessage({ id: "events.type.re_evaluate" })}
                </SelectItem>
                <SelectItem value="move_country">
                  {intl.formatMessage({ id: "events.type.move_country" })}
                </SelectItem>
                <SelectItem value="change_legal_status">
                  {intl.formatMessage({ id: "events.type.change_legal_status" })}
                </SelectItem>
                <SelectItem value="add_evidence">
                  {intl.formatMessage({ id: "events.type.add_evidence" })}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="evt-date">
              {intl.formatMessage({ id: "events.form.field.effective_date" })}
            </Label>
            <Input
              id="evt-date"
              type="date"
              required
              value={state.effective_date}
              onChange={(e) =>
                dispatch({ kind: "set_field", field: "effective_date", value: e.target.value })
              }
              aria-invalid={!!fieldError("effective_date") || undefined}
              aria-describedby={fieldError("effective_date") ? "evt-date-err" : undefined}
            />
            {fieldError("effective_date") && (
              <p id="evt-date-err" className="text-xs text-destructive">
                {fieldError("effective_date")}
              </p>
            )}
          </div>

          {state.eventType === "move_country" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="evt-from">
                    {intl.formatMessage({ id: "events.form.field.from_country" })}
                  </Label>
                  <Select
                    value={state.move.from_country}
                    onValueChange={(v) =>
                      dispatch({ kind: "set_move", patch: { from_country: v } })
                    }
                  >
                    <SelectTrigger id="evt-from">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {ISO_COUNTRIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {intl.formatMessage({
                            id: `country.iso.${c}`,
                            defaultMessage: c,
                          })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="evt-to">
                    {intl.formatMessage({ id: "events.form.field.to_country" })}
                    <span aria-hidden className="ms-1 text-destructive">
                      *
                    </span>
                  </Label>
                  <Select
                    value={state.move.to_country}
                    onValueChange={(v) => dispatch({ kind: "set_move", patch: { to_country: v } })}
                  >
                    <SelectTrigger
                      id="evt-to"
                      aria-invalid={!!fieldError("to_country") || undefined}
                      aria-describedby={fieldError("to_country") ? "evt-to-err" : undefined}
                    >
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {ISO_COUNTRIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {intl.formatMessage({
                            id: `country.iso.${c}`,
                            defaultMessage: c,
                          })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldError("to_country") && (
                    <p id="evt-to-err" className="text-xs text-destructive">
                      {fieldError("to_country")}
                    </p>
                  )}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={state.move.open_new}
                  onCheckedChange={(v) =>
                    dispatch({ kind: "set_move", patch: { open_new: v === true } })
                  }
                />
                {intl.formatMessage({ id: "events.form.field.open_new" })}
              </label>
            </>
          )}

          {state.eventType === "change_legal_status" && (
            <div className="space-y-2">
              <Label htmlFor="evt-status">
                {intl.formatMessage({ id: "events.form.field.to_status" })}
              </Label>
              <Select
                value={state.status.to_status}
                onValueChange={(v) =>
                  dispatch({
                    kind: "set_status",
                    patch: { to_status: v as (typeof LEGAL_STATUSES)[number] },
                  })
                }
              >
                <SelectTrigger id="evt-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEGAL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {intl.formatMessage({ id: `events.legal_status.${s}` })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {state.eventType === "add_evidence" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="evt-evtype">
                  {intl.formatMessage({ id: "events.form.field.evidence_type" })}
                  <span aria-hidden className="ms-1 text-destructive">
                    *
                  </span>
                </Label>
                <Input
                  id="evt-evtype"
                  value={state.evidence.evidence_type}
                  onChange={(e) =>
                    dispatch({ kind: "set_evidence", patch: { evidence_type: e.target.value } })
                  }
                  maxLength={80}
                  aria-invalid={!!fieldError("evidence_type") || undefined}
                  aria-describedby={fieldError("evidence_type") ? "evt-evtype-err" : undefined}
                />
                {fieldError("evidence_type") && (
                  <p id="evt-evtype-err" className="text-xs text-destructive">
                    {fieldError("evidence_type")}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="evt-evdesc">
                  {intl.formatMessage({ id: "events.form.field.description" })}
                </Label>
                <Input
                  id="evt-evdesc"
                  value={state.evidence.description}
                  onChange={(e) =>
                    dispatch({ kind: "set_evidence", patch: { description: e.target.value } })
                  }
                  maxLength={500}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={state.evidence.verified}
                  onCheckedChange={(v) =>
                    dispatch({ kind: "set_evidence", patch: { verified: v === true } })
                  }
                />
                {intl.formatMessage({ id: "events.form.field.verified" })}
              </label>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="evt-note">{intl.formatMessage({ id: "events.form.field.note" })}</Label>
            <Textarea
              id="evt-note"
              value={state.note}
              onChange={(e) =>
                dispatch({ kind: "set_field", field: "note", value: e.target.value })
              }
              rows={3}
              maxLength={2000}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              {intl.formatMessage({ id: "events.form.cancel" })}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {intl.formatMessage({ id: "events.form.submit" })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
