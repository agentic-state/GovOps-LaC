/**
 * Deterministic jurisdiction mocks used by the /screen loader in
 * preview/mock mode (`VITE_USE_MOCK_API=true`) and as the network-failure
 * fallback. Mirrors the shape returned by `GET /api/jurisdiction/{code}`.
 *
 * These program names are kept in their authoritative source language —
 * they are not user-translatable copy.
 */
import type { JurisdictionResponse } from "./types";

export const MOCK_JURISDICTIONS: Record<string, JurisdictionResponse> = {
  ca: {
    id: "ca",
    jurisdiction_label: "Government of Canada",
    program_name: "Old Age Security (OAS)",
    default_language: "en",
  },
  br: {
    id: "br",
    jurisdiction_label: "República Federativa do Brasil",
    program_name: "Benefício de Prestação Continuada (BPC)",
    default_language: "pt-BR",
  },
  es: {
    id: "es",
    jurisdiction_label: "Reino de España",
    program_name: "Pensión No Contributiva",
    default_language: "es-MX",
  },
  fr: {
    id: "fr",
    jurisdiction_label: "République française",
    program_name: "Allocation de Solidarité aux Personnes Âgées (ASPA)",
    default_language: "fr",
  },
  de: {
    id: "de",
    jurisdiction_label: "Bundesrepublik Deutschland",
    program_name: "Grundsicherung im Alter",
    default_language: "de",
  },
  ua: {
    id: "ua",
    jurisdiction_label: "Україна",
    program_name: "Державна соціальна допомога",
    default_language: "uk",
  },
};