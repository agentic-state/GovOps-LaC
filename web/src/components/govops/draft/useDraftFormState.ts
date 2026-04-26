import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { useUnsavedChangesPrompt } from "@/lib/dirtyState";
import { emitDraftsChanged, saveRecentDraft } from "@/lib/draftStorage";
import { StorageKeys } from "@/lib/storageKeys";
import { coerceValue, validateIsoUtc, validateKey, validateRationale } from "@/lib/validators";
import type { ConfigValue, CreateConfigValueRequest, ValueType } from "@/lib/types";
import { hydrateValue, todayMidnightUtc } from "./draftHelpers";

export type DraftInitial = {
  key?: string;
  jurisdiction_id?: string;
  value_type?: string;
  supersedes_id?: string;
  domain?: string;
  value?: string;
  effective_from?: string;
  citation?: string;
  rationale?: string;
  language?: string;
};

export type DraftErrors = Partial<
  Record<
    | "key"
    | "jurisdiction"
    | "domain"
    | "value_type"
    | "value"
    | "effective_from"
    | "citation"
    | "rationale"
    | "language",
    string
  >
>;

export type DraftFieldName = keyof DraftErrors;

export type DraftIds = {
  key: string;
  jurisdiction: string;
  domain: string;
  valueType: string;
  value: string;
  effectiveFrom: string;
  citation: string;
  rationale: string;
  language: string;
};

/**
 * Owns the entire DraftConfigForm state machine: field values, touched/error
 * tracking, live re-validation, dirty-detection, submit, save-as-draft, and
 * cancel-with-confirm. The component tree consumes the returned bundle and
 * only renders inputs.
 */
export function useDraftFormState({
  initial,
  prior,
  onSubmit,
  onSaveDraft,
  currentAuthor,
}: {
  initial: DraftInitial;
  prior: ConfigValue | null;
  onSubmit: (body: CreateConfigValueRequest) => Promise<void> | void;
  onSaveDraft?: (params: Record<string, string>) => void;
  currentAuthor: string;
}) {
  const intl = useIntl();
  const nav = useNavigate();

  // -- field state --
  const [key, setKey] = useState(initial.key ?? prior?.key ?? "");
  const [jurisdiction, setJurisdiction] = useState<string>(
    initial.jurisdiction_id ?? prior?.jurisdiction_id ?? "global",
  );
  const [domain, setDomain] = useState<string>(initial.domain ?? prior?.domain ?? "rule");
  const [valueType, setValueType] = useState<ValueType>(
    (initial.value_type as ValueType) ?? prior?.value_type ?? "number",
  );
  const [value, setValue] = useState<unknown>(
    initial.value !== undefined
      ? hydrateValue(
          initial.value,
          (initial.value_type as ValueType) ?? prior?.value_type ?? "number",
        )
      : (prior?.value ?? ""),
  );
  const [effectiveFrom, setEffectiveFrom] = useState<string>(
    initial.effective_from ?? todayMidnightUtc(),
  );
  const [citation, setCitation] = useState<string>(initial.citation ?? "");
  const [rationale, setRationale] = useState<string>(initial.rationale ?? "");
  const [language, setLanguage] = useState<string>(initial.language ?? prior?.language ?? "en");

  const [errors, setErrors] = useState<DraftErrors>({});
  const [touched, setTouched] = useState<Partial<Record<DraftFieldName, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [showPreview, setShowPreview] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(StorageKeys.draftPreviewOpen);
    return stored === null ? true : stored === "true";
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedDraftOnce, setSavedDraftOnce] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(StorageKeys.draftPreviewOpen, String(showPreview));
  }, [showPreview]);

  // -- locked fields when superseding --
  const lockedKey = !!initial.supersedes_id || !!prior;
  const lockedJurisdiction = !!initial.supersedes_id || !!prior;
  const lockedDomain = !!initial.supersedes_id || !!prior;
  const lockedValueType = !!initial.supersedes_id || !!prior;

  // -- dirty detection --
  const dirty = useMemo(() => {
    return (
      (typeof value === "string"
        ? value.length > 0
        : Array.isArray(value)
          ? value.length > 0
          : value !== "" && value !== undefined) ||
      citation.trim() !== "" ||
      rationale.trim() !== "" ||
      key !== (initial.key ?? prior?.key ?? "")
    );
  }, [value, citation, rationale, key, initial.key, prior]);

  useUnsavedChangesPrompt(dirty, intl.formatMessage({ id: "draft.unsaved.body" }));

  // Reset value when value_type changes (avoid type-mismatched residue), but
  // skip the very first render so URL-hydrated values survive.
  const [vtMounted, setVtMounted] = useState(false);
  useEffect(() => {
    if (!vtMounted) {
      setVtMounted(true);
      return;
    }
    if (prior && valueType === prior.value_type) return;
    if (valueType === "bool") setValue(false);
    else if (valueType === "list" || valueType === "enum") setValue([]);
    else setValue("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueType]);

  // -- per-field validators (single source of truth) --
  const computeFieldError = useCallback(
    (
      field: DraftFieldName,
      draftSnapshot?: Partial<Record<DraftFieldName, unknown>>,
    ): string | undefined => {
      const v = (k: DraftFieldName, fallback: unknown) =>
        draftSnapshot && k in draftSnapshot ? draftSnapshot[k] : fallback;
      switch (field) {
        case "key":
          return validateKey(String(v("key", key))) ?? undefined;
        case "effective_from":
          return validateIsoUtc(String(v("effective_from", effectiveFrom) ?? "")) ?? undefined;
        case "citation":
          return v("domain", domain) === "rule" && !String(v("citation", citation)).trim()
            ? "validators.citation.required"
            : undefined;
        case "rationale":
          return validateRationale(String(v("rationale", rationale))) ?? undefined;
        case "language":
          return v("domain", domain) === "ui" && !v("language", language)
            ? "validators.language.required"
            : undefined;
        case "value": {
          const t = (v("value_type", valueType) as ValueType) ?? valueType;
          const raw = v("value", value);
          try {
            const coerced = coerceValue(raw, t);
            if (t === "number" && (raw === "" || raw === undefined || raw === null))
              return "validators.value.required";
            if ((t === "string" || t === "prompt") && !String(raw ?? "").trim())
              return "validators.value.required";
            if ((t === "list" || t === "enum") && (!Array.isArray(coerced) || coerced.length === 0))
              return "validators.value.required";
            return undefined;
          } catch (e) {
            return (e as Error).message;
          }
        }
        default:
          return undefined;
      }
    },
    [key, effectiveFrom, citation, domain, rationale, language, valueType, value],
  );

  // Re-validate touched fields whenever their inputs change (live feedback).
  useEffect(() => {
    if (!submitAttempted && Object.keys(touched).length === 0) return;
    setErrors((prev) => {
      const next: DraftErrors = { ...prev };
      const fields: DraftFieldName[] = [
        "key",
        "value",
        "effective_from",
        "citation",
        "rationale",
        "language",
      ];
      for (const f of fields) {
        if (!submitAttempted && !touched[f]) continue;
        const err = computeFieldError(f);
        if (err) next[f] = err;
        else delete next[f];
      }
      return next;
    });
  }, [computeFieldError, submitAttempted, touched]);

  const markTouched = useCallback((field: DraftFieldName) => {
    setTouched((t) => (t[field] ? t : { ...t, [field]: true }));
  }, []);

  const validateAll = useCallback((): {
    ok: boolean;
    coercedValue?: unknown;
  } => {
    const next: DraftErrors = {};
    const fields: DraftFieldName[] = [
      "key",
      "value",
      "effective_from",
      "citation",
      "rationale",
      "language",
    ];
    for (const f of fields) {
      const err = computeFieldError(f);
      if (err) next[f] = err;
    }
    let coerced: unknown;
    try {
      coerced = coerceValue(value, valueType);
    } catch {
      // already captured above
    }
    setErrors(next);
    return { ok: Object.keys(next).length === 0, coercedValue: coerced };
  }, [computeFieldError, value, valueType]);

  // Stable id namespace for label/aria wiring.
  const ids: DraftIds = {
    key: useId(),
    jurisdiction: useId(),
    domain: useId(),
    valueType: useId(),
    value: useId(),
    effectiveFrom: useId(),
    citation: useId(),
    rationale: useId(),
    language: useId(),
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitAttempted(true);
    setSubmitError(null);
    const { ok, coercedValue } = validateAll();
    if (!ok) {
      const firstError = document.querySelector<HTMLElement>("[aria-invalid='true']");
      firstError?.focus();
      return;
    }
    const body: CreateConfigValueRequest = {
      domain,
      key,
      jurisdiction_id: jurisdiction === "global" ? null : jurisdiction,
      value: coercedValue,
      value_type: valueType,
      effective_from: effectiveFrom,
      effective_to: null,
      citation: citation.trim() || null,
      author: currentAuthor,
      rationale: rationale.trim(),
      supersedes: prior?.id ?? initial.supersedes_id ?? null,
      language: domain === "ui" ? language : null,
    };
    try {
      await onSubmit(body);
      toast.success(intl.formatMessage({ id: "draft.success" }));
    } catch (err) {
      setSubmitError((err as Error).message);
    }
  }

  function handleSaveDraft() {
    if (!onSaveDraft) return;
    const efErr = computeFieldError("effective_from");
    if (efErr) {
      markTouched("effective_from");
      setErrors((prev) => ({ ...prev, effective_from: efErr }));
      const el = document.getElementById(ids.effectiveFrom);
      el?.focus();
      toast.error(intl.formatMessage({ id: "draft.saved.blocked" }));
      return;
    }
    const params: Record<string, string> = {};
    if (key) params.key = key;
    if (jurisdiction) params.jurisdiction_id = jurisdiction;
    if (domain) params.domain = domain;
    if (valueType) params.value_type = valueType;
    if (citation) params.citation = citation;
    if (rationale) params.rationale = rationale;
    if (effectiveFrom) params.effective_from = effectiveFrom;
    if (domain === "ui" && language) params.language = language;
    if (initial.supersedes_id) params.supersedes_id = initial.supersedes_id;
    if (value !== "" && value !== undefined && value !== null) {
      try {
        params.value = typeof value === "string" ? value : JSON.stringify(value);
      } catch {
        /* skip un-serializable values */
      }
    }
    onSaveDraft(params);
    saveRecentDraft(params);
    emitDraftsChanged();
    setSavedDraftOnce(true);
    toast.success(intl.formatMessage({ id: "draft.saved" }));
  }

  const cancelNeedsConfirm = dirty || Object.keys(touched).length > 0 || savedDraftOnce;

  function performCancel() {
    setConfirmCancelOpen(false);
    if (window.history.length > 1) window.history.back();
    else nav({ to: "/config" });
  }

  function handleCancel() {
    if (cancelNeedsConfirm) {
      setConfirmCancelOpen(true);
      return;
    }
    performCancel();
  }

  return {
    // ids
    ids,
    // values + setters
    key,
    setKey,
    jurisdiction,
    setJurisdiction,
    domain,
    setDomain,
    valueType,
    setValueType,
    value,
    setValue,
    effectiveFrom,
    setEffectiveFrom,
    citation,
    setCitation,
    rationale,
    setRationale,
    language,
    setLanguage,
    // locks
    lockedKey,
    lockedJurisdiction,
    lockedDomain,
    lockedValueType,
    // errors / interactions
    errors,
    markTouched,
    // preview / submit / cancel
    showPreview,
    setShowPreview,
    submitError,
    confirmCancelOpen,
    setConfirmCancelOpen,
    handleSubmit,
    handleSaveDraft,
    handleCancel,
    performCancel,
  };
}

export type DraftFormState = ReturnType<typeof useDraftFormState>;
