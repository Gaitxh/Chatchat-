import { detectProviderUrl, normalizeHttpUrl } from "./catalog.js";
import type { AdapterRecipe, CompleteAdapterRecipe } from "./recipe.js";

export interface RecipeCandidateV1 {
  schemaVersion: 1;
  providerId: string;
  origin: string;
  composerSelector: string;
  sendSelector: string;
  responseSelector: string;
  capturedAt: string;
  notes?: string;
}

export type SelectorPortabilityLevel = "stable" | "caution" | "brittle";

export interface SelectorPortabilityAnalysis {
  selector: string;
  score: number;
  level: SelectorPortabilityLevel;
  warnings: string[];
  strengths: string[];
}

export interface RecipeCandidateAnalysis {
  score: number;
  level: SelectorPortabilityLevel;
  selectorAnalyses: {
    composer: SelectorPortabilityAnalysis;
    send: SelectorPortabilityAnalysis;
    response: SelectorPortabilityAnalysis;
  };
  warnings: string[];
}

export interface ExportRecipeCandidateInput {
  providerId: string;
  origin: string;
  recipe: CompleteAdapterRecipe;
  capturedAt?: string;
  notes?: string;
}

export interface RecipeCandidateTarget {
  providerId: string;
  origin: string;
  profileId: string;
}

const MAX_PROVIDER_ID = 96;
const MAX_SELECTOR = 512;
const MAX_NOTES = 500;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_LIKE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const TOKEN_LIKE = /(?:\bBearer\s+[A-Za-z0-9._~+\/-]{12,}|\bsk-[A-Za-z0-9_-]{12,}|\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,})/i;
const VALUE_SELECTOR = /\[\s*value\s*(?:[*^$|~]?=)/i;
const PASSWORD_SELECTOR = /(?:type\s*[*^$|~]?=\s*["']?password|autocomplete\s*[*^$|~]?=\s*["']?(?:current-password|new-password))/i;

export function exportRecipeCandidate(input: ExportRecipeCandidateInput): RecipeCandidateV1 {
  const raw: RecipeCandidateV1 = {
    schemaVersion: 1,
    providerId: input.providerId,
    origin: input.origin,
    composerSelector: input.recipe.composerSelector,
    sendSelector: input.recipe.sendSelector,
    responseSelector: input.recipe.responseSelector,
    capturedAt: input.capturedAt ?? new Date().toISOString().slice(0, 10),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
  };
  return parseRecipeCandidate(raw);
}

export function parseRecipeCandidate(input: unknown): RecipeCandidateV1 {
  const raw = typeof input === "string" ? parseJson(input) : input;
  if (!isRecord(raw)) throw new Error("Recipe Candidate must be a JSON object.");

  const allowed = new Set([
    "schemaVersion",
    "providerId",
    "origin",
    "composerSelector",
    "sendSelector",
    "responseSelector",
    "capturedAt",
    "notes",
  ]);
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) throw new Error(`Recipe Candidate contains unsupported field: ${key}.`);
  }

  if (raw.schemaVersion !== 1) throw new Error("Unsupported Recipe Candidate schemaVersion.");
  const providerId = cleanRequiredString(raw.providerId, "providerId", MAX_PROVIDER_ID);
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(providerId)) {
    throw new Error("Recipe Candidate providerId contains unsupported characters.");
  }

  const origin = normalizeOrigin(cleanRequiredString(raw.origin, "origin", 512));
  const composerSelector = validateShareableSelector(raw.composerSelector, "composerSelector");
  const sendSelector = validateShareableSelector(raw.sendSelector, "sendSelector");
  const responseSelector = validateShareableSelector(raw.responseSelector, "responseSelector");
  const capturedAt = cleanRequiredString(raw.capturedAt, "capturedAt", 10);
  if (!validIsoDate(capturedAt)) {
    throw new Error("Recipe Candidate capturedAt must be a real YYYY-MM-DD date.");
  }

  const notes = raw.notes === undefined ? undefined : sanitizePublicNotes(raw.notes);
  assertKnownProviderIdentity(providerId, origin);

  return {
    schemaVersion: 1,
    providerId,
    origin,
    composerSelector,
    sendSelector,
    responseSelector,
    capturedAt,
    ...(notes === undefined ? {} : { notes }),
  };
}

export function recipeCandidateToAdapterRecipe(
  candidateInput: RecipeCandidateV1 | unknown,
  target: RecipeCandidateTarget,
  now = new Date().toISOString(),
): AdapterRecipe {
  const candidate = parseRecipeCandidate(candidateInput);
  const targetOrigin = normalizeOrigin(target.origin);
  if (candidate.origin !== targetOrigin) {
    throw new Error(`Recipe Candidate origin ${candidate.origin} does not match target ${targetOrigin}.`);
  }
  if (candidate.providerId !== target.providerId) {
    throw new Error(`Recipe Candidate provider ${candidate.providerId} does not match target ${target.providerId}.`);
  }
  if (!target.profileId.trim()) throw new Error("Recipe Candidate target requires a local profileId.");

  // Deliberately returns recipe data only. Runtime Test Speech / Council Gate
  // proof lives elsewhere and therefore cannot be inherited from shared JSON.
  return {
    profileId: target.profileId,
    composerSelector: candidate.composerSelector,
    sendSelector: candidate.sendSelector,
    responseSelector: candidate.responseSelector,
    createdAt: now,
    updatedAt: now,
  };
}

export function analyzeRecipeCandidate(input: RecipeCandidateV1 | unknown): RecipeCandidateAnalysis {
  const candidate = parseRecipeCandidate(input);
  const composer = analyzeSelectorPortability(candidate.composerSelector);
  const send = analyzeSelectorPortability(candidate.sendSelector);
  const response = analyzeSelectorPortability(candidate.responseSelector);
  const analyses = [composer, send, response];
  const score = Math.round(analyses.reduce((sum, item) => sum + item.score, 0) / analyses.length);
  const warnings = [...new Set(analyses.flatMap((item) => item.warnings))];
  return {
    score,
    level: portabilityLevel(score),
    selectorAnalyses: { composer, send, response },
    warnings,
  };
}

export function analyzeSelectorPortability(selectorInput: string): SelectorPortabilityAnalysis {
  const selector = validateShareableSelector(selectorInput, "selector");
  let score = 0;
  const warnings: string[] = [];
  const strengths: string[] = [];

  if (selector.length > 160) {
    score += 15;
    warnings.push("long selector");
  }
  if (selector.length > 260) {
    score += 15;
    warnings.push("very long selector");
  }

  const nthCount = (selector.match(/:nth-(?:child|of-type)\s*\(/gi) ?? []).length;
  if (nthCount > 0) {
    score += Math.min(35, 20 + (nthCount - 1) * 5);
    warnings.push("depends on nth-child/nth-of-type position");
  }

  if (looksGenerated(selector)) {
    score += 30;
    warnings.push("contains UUID/hash-like generated identifier");
  }

  const combinators = (selector.match(/\s+|>/g) ?? []).length;
  if (combinators >= 5) {
    score += Math.min(20, 8 + (combinators - 5) * 2);
    warnings.push("deep DOM path");
  }

  const classCount = (selector.match(/\.[A-Za-z_-][\w-]*/g) ?? []).length;
  if (classCount >= 5) {
    score += 10;
    warnings.push("depends on many CSS classes");
  }

  if (/\[(?:data-testid|data-test|data-message-author-role)\s*=/i.test(selector)) {
    score -= 18;
    strengths.push("stable data attribute");
  }
  if (/\[(?:aria-label|role)\s*=/i.test(selector)) {
    score -= 12;
    strengths.push("semantic accessibility attribute");
  }
  if (/^#[A-Za-z][\w-]{0,31}(?:\s|$|>)/.test(selector) && !looksGenerated(selector)) {
    score -= 8;
    strengths.push("short readable id");
  }

  score = Math.max(0, Math.min(100, score));
  return {
    selector,
    score,
    level: portabilityLevel(score),
    warnings,
    strengths,
  };
}

export function recipeCandidateJson(candidateInput: RecipeCandidateV1 | unknown): string {
  return JSON.stringify(parseRecipeCandidate(candidateInput), null, 2);
}

function validateShareableSelector(value: unknown, label: string): string {
  const selector = cleanRequiredString(value, label, MAX_SELECTOR);
  if (/\0|[\u0001-\u0008\u000B\u000C\u000E-\u001F]/.test(selector)) {
    throw new Error(`${label} contains control characters.`);
  }
  if (PASSWORD_SELECTOR.test(selector)) throw new Error(`${label} targets password UI and cannot be shared.`);
  if (VALUE_SELECTOR.test(selector)) throw new Error(`${label} contains a value selector and may expose private page data.`);
  if (EMAIL_LIKE.test(selector)) throw new Error(`${label} appears to contain an email/account identifier.`);
  if (TOKEN_LIKE.test(selector)) throw new Error(`${label} appears to contain a token or credential.`);
  return selector;
}

function sanitizePublicNotes(value: unknown): string | undefined {
  if (typeof value !== "string") throw new Error("Recipe Candidate notes must be a string.");
  const notes = value.replace(/[\r\n\t]+/g, " ").trim();
  if (!notes) return undefined;
  if (notes.length > MAX_NOTES) throw new Error(`Recipe Candidate notes exceed ${MAX_NOTES} characters.`);
  if (EMAIL_LIKE.test(notes) || TOKEN_LIKE.test(notes)) {
    throw new Error("Recipe Candidate notes appear to contain an account identifier or credential.");
  }
  return notes;
}

function assertKnownProviderIdentity(providerId: string, origin: string): void {
  const detection = detectProviderUrl(origin);
  if (detection.kind === "known" && detection.providerId !== providerId) {
    throw new Error(`Known origin ${origin} belongs to ${detection.providerId}, not ${providerId}.`);
  }
}

function normalizeOrigin(input: string): string {
  const url = normalizeHttpUrl(input);
  if (url.username || url.password) throw new Error("Recipe Candidate origin must not contain credentials.");
  return url.origin;
}

function cleanRequiredString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`Recipe Candidate ${label} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength) {
    throw new Error(`Recipe Candidate ${label} must contain 1-${maxLength} characters.`);
  }
  return cleaned;
}

function looksGenerated(selector: string): boolean {
  return /(?:[a-f0-9]{8}-[a-f0-9]{4}-[1-5a-f0-9][a-f0-9]{3}-[89ab0-9][a-f0-9]{3}-[a-f0-9]{12}|[#.][A-Za-z_-]*[a-f0-9]{16,}(?:\b|[_-]))/i.test(selector);
}

function portabilityLevel(score: number): SelectorPortabilityLevel {
  if (score <= 20) return "stable";
  if (score <= 50) return "caution";
  return "brittle";
}

function validIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("Recipe Candidate is not valid JSON.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
