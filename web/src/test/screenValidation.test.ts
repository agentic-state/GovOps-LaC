import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { validateScreenForm, isValid } from "@/lib/screenValidation";
import type { ScreenResidencyPeriod } from "@/lib/types";

/** Freeze "today" so date-boundary assertions are deterministic. */
const FAKE_TODAY = new Date("2025-06-15T12:00:00Z");

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FAKE_TODAY);
});
afterAll(() => {
  vi.useRealTimers();
});

const period = (start: string, end: string | null, country = "ca"): ScreenResidencyPeriod => ({
  country,
  start_date: start,
  end_date: end,
});

const base = {
  date_of_birth: "1960-01-01",
  legal_status: "citizen" as const,
  residency_periods: [period("1990-01-01", "2000-01-01")],
};

describe("validateScreenForm — required fields", () => {
  it("flags missing DOB and legal status and empty country", () => {
    const e = validateScreenForm({
      date_of_birth: "",
      legal_status: "",
      residency_periods: [period("", null, "")],
    });
    expect(e.dob).toBe("screen.errors.dob.required");
    expect(e.legal_status).toBe("screen.errors.legal_status.required");
    expect(e["residency.0.country"]).toBe("screen.errors.residency.country_required");
    expect(e["residency.0.start_date"]).toBe("screen.errors.residency.start_required");
  });

  it("flags an empty residency list at fieldset level", () => {
    const e = validateScreenForm({
      date_of_birth: "1960-01-01",
      legal_status: "citizen",
      residency_periods: [],
    });
    expect(e.residency).toBe("screen.errors.residency.required");
  });
});

describe("validateScreenForm — DOB boundaries", () => {
  it("rejects a DOB equal to MIN_DOB minus one day (1899-12-31)", () => {
    const e = validateScreenForm({ ...base, date_of_birth: "1899-12-31" });
    expect(e.dob).toBe("screen.errors.dob.too_old");
  });

  it("accepts the exact MIN_DOB boundary (1900-01-01)", () => {
    const e = validateScreenForm({ ...base, date_of_birth: "1900-01-01" });
    expect(e.dob).toBeUndefined();
  });

  it("accepts today exactly", () => {
    const e = validateScreenForm({
      ...base,
      date_of_birth: "2025-06-15",
      residency_periods: [period("2025-06-15", null)],
    });
    expect(e.dob).toBeUndefined();
  });

  it("rejects DOB one day in the future", () => {
    const e = validateScreenForm({ ...base, date_of_birth: "2025-06-16" });
    expect(e.dob).toBe("screen.errors.dob.future");
  });
});

describe("validateScreenForm — residency date boundaries", () => {
  it("end_date == start_date is allowed (zero-day stay)", () => {
    const e = validateScreenForm({
      ...base,
      residency_periods: [period("1990-01-01", "1990-01-01")],
    });
    expect(e["residency.0.end_date"]).toBeUndefined();
  });

  it("end_date one day before start_date is rejected", () => {
    const e = validateScreenForm({
      ...base,
      residency_periods: [period("1990-01-02", "1990-01-01")],
    });
    expect(e["residency.0.end_date"]).toBe("screen.errors.residency.end_before_start");
  });

  it("rejects start_date before DOB by one day", () => {
    const e = validateScreenForm({
      ...base,
      date_of_birth: "1960-01-01",
      residency_periods: [period("1959-12-31", null)],
    });
    expect(e["residency.0.start_date"]).toBe("screen.errors.residency.start_before_dob");
  });

  it("accepts start_date exactly equal to DOB", () => {
    const e = validateScreenForm({
      ...base,
      date_of_birth: "1960-01-01",
      residency_periods: [period("1960-01-01", null)],
    });
    expect(e["residency.0.start_date"]).toBeUndefined();
  });

  it("rejects start_date one day in the future", () => {
    const e = validateScreenForm({
      ...base,
      residency_periods: [period("2025-06-16", null)],
    });
    expect(e["residency.0.start_date"]).toBe("screen.errors.residency.start_future");
  });

  it("rejects end_date one day in the future", () => {
    const e = validateScreenForm({
      ...base,
      residency_periods: [period("2024-01-01", "2025-06-16")],
    });
    expect(e["residency.0.end_date"]).toBe("screen.errors.residency.end_future");
  });
});

describe("validateScreenForm — ongoing end_date (null) handling", () => {
  it("treats ongoing as 'until today' for overlap purposes", () => {
    // Period A: 1990–2000 (closed). Period B: 1995–ongoing (overlaps A).
    const e = validateScreenForm({
      ...base,
      residency_periods: [period("1990-01-01", "2000-01-01"), period("1995-01-01", null, "fr")],
    });
    expect(e["residency.1.start_date"]).toBe("screen.errors.residency.overlap");
  });

  it("does NOT mark an ongoing period as missing end_date", () => {
    const e = validateScreenForm({
      ...base,
      residency_periods: [period("2020-01-01", null)],
    });
    expect(e["residency.0.end_date"]).toBeUndefined();
  });

  it("accepts two non-overlapping periods, one ongoing", () => {
    const e = validateScreenForm({
      ...base,
      residency_periods: [period("1990-01-01", "1999-12-31"), period("2000-01-01", null, "fr")],
    });
    expect(isValid(e)).toBe(true);
  });
});

describe("validateScreenForm — overlap detection edge cases", () => {
  it("touching periods (A.end == B.start) overlap (inclusive boundary)", () => {
    const e = validateScreenForm({
      ...base,
      residency_periods: [
        period("1990-01-01", "2000-01-01"),
        period("2000-01-01", "2010-01-01", "fr"),
      ],
    });
    expect(e["residency.1.start_date"]).toBe("screen.errors.residency.overlap");
  });

  it("adjacent (one day gap) periods do NOT overlap", () => {
    const e = validateScreenForm({
      ...base,
      residency_periods: [
        period("1990-01-01", "2000-01-01"),
        period("2000-01-02", "2010-01-01", "fr"),
      ],
    });
    expect(isValid(e)).toBe(true);
  });

  it("fully contained period overlaps the outer one", () => {
    const e = validateScreenForm({
      ...base,
      residency_periods: [
        period("1990-01-01", "2010-01-01"),
        period("1995-01-01", "2000-01-01", "fr"),
      ],
    });
    expect(e["residency.1.start_date"]).toBe("screen.errors.residency.overlap");
  });

  it("flags only the later-starting row when two periods overlap", () => {
    const e = validateScreenForm({
      ...base,
      residency_periods: [
        period("1990-01-01", "2005-01-01"),
        period("2000-01-01", "2010-01-01", "fr"),
      ],
    });
    expect(e["residency.1.start_date"]).toBe("screen.errors.residency.overlap");
    expect(e["residency.0.start_date"]).toBeUndefined();
  });

  it("does not crash when start_date is missing on one row of an overlap pair", () => {
    const e = validateScreenForm({
      ...base,
      residency_periods: [period("1990-01-01", "2000-01-01"), period("", null, "fr")],
    });
    // The empty row has its own required-field error; no overlap noise.
    expect(e["residency.1.start_date"]).toBe("screen.errors.residency.start_required");
  });
});

describe("validateScreenForm — happy path", () => {
  it("returns no errors for a fully valid form", () => {
    expect(isValid(validateScreenForm(base))).toBe(true);
  });
});
