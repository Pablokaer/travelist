// Reading the trip planner's request bodies (D-085), ported from the TravelisHachtoberfest fork's
// `plan_requests.py`. `BadRequest` names the offending value and the expected shape.

export const LANGUAGES = ['en', 'pt'] as const;
export type Language = (typeof LANGUAGES)[number];

export const MAX_ANSWERS = 30;
export const MAX_CANDIDATES = 30;
export const MAX_TEXT_CHARS = 500;
export const DEFAULT_LIMIT = 6;
export const MAX_LIMIT = 10;

/** One answered question of the interview. */
export type Answer = { id: string; question: string; answer: string };

/** A shortlisted city as the model reads it: measured facts only. */
export type Candidate = {
  slug: string;
  name: string;
  country: string;
  distance_km: number | null;
  facts: Record<string, number>;
};

export type QuestionRequest = { language: Language; answers: Answer[] };
export type RankRequest = QuestionRequest & { limit: number; candidates: Candidate[] };

export class BadRequest extends Error {}

type Body = Record<string, unknown>;

function objectOf(payload: unknown): Body {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new BadRequest(`body ${JSON.stringify(payload)} is not an object; expected JSON object`);
  }
  return payload as Body;
}

export function parseLanguage(body: Body): Language {
  const language = LANGUAGES.find((l) => l === body.language);
  if (!language) {
    throw new BadRequest(`language ${JSON.stringify(body.language)} is not 'en' or 'pt'`);
  }
  return language;
}

function text(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.length > MAX_TEXT_CHARS) {
    throw new BadRequest(`${where} is not text of up to ${MAX_TEXT_CHARS} characters`);
  }
  return value;
}

function answerAt(item: unknown, index: number): Answer {
  const entry = (typeof item === 'object' && item !== null ? item : {}) as Body;
  const [id, question, answer] = (['id', 'question', 'answer'] as const).map((key) => {
    if (!(key in entry)) throw new BadRequest(`answers[${index}] lacks '${key}'`);
    return text(entry[key], `answers[${index}].${key}`);
  });
  return { id: id!, question: question!, answer: answer! };
}

export function parseAnswers(body: Body): Answer[] {
  const raw = body.answers;
  if (!Array.isArray(raw) || raw.length > MAX_ANSWERS) {
    throw new BadRequest(`answers is not a list of at most ${MAX_ANSWERS} entries`);
  }
  return raw.map(answerAt);
}

export function parseLimit(body: Body): number {
  const limit = body.limit ?? DEFAULT_LIMIT;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new BadRequest(`limit ${JSON.stringify(limit)} is not an integer from 1 to ${MAX_LIMIT}`);
  }
  return limit;
}

function requiredText(entry: Body, key: string, index: number): string {
  const value = entry[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequest(
      `candidates[${index}] lacks a text '${key}'; got ${JSON.stringify(value)}`,
    );
  }
  return value.trim();
}

function numericFacts(facts: unknown, index: number): Record<string, number> {
  if (facts === undefined || facts === null) return {};
  if (typeof facts !== 'object' || Array.isArray(facts)) {
    throw new BadRequest(`candidates[${index}].facts is not an object`);
  }
  return Object.fromEntries(
    Object.entries(facts as Body).filter((e): e is [string, number] => typeof e[1] === 'number'),
  );
}

function candidateAt(item: unknown, index: number): Candidate {
  const entry = (typeof item === 'object' && item !== null ? item : {}) as Body;
  const distance = entry.distance_km ?? null;
  if (distance !== null && typeof distance !== 'number') {
    throw new BadRequest(
      `candidates[${index}].distance_km ${JSON.stringify(distance)} is not a number`,
    );
  }
  return {
    slug: requiredText(entry, 'slug', index),
    name: requiredText(entry, 'name', index),
    country: typeof entry.country === 'string' ? entry.country : '',
    distance_km: distance,
    facts: numericFacts(entry.facts, index),
  };
}

export function parseCandidates(body: Body): Candidate[] {
  const raw = Array.isArray(body.candidates) ? body.candidates : [];
  if (raw.length < 1 || raw.length > MAX_CANDIDATES) {
    throw new BadRequest(`candidates has ${raw.length} entries; expected 1 to ${MAX_CANDIDATES}`);
  }
  const candidates = raw.map(candidateAt);
  const seen = new Set<string>();
  for (const { slug } of candidates) {
    if (seen.has(slug)) throw new BadRequest(`duplicate candidate slug '${slug}'`);
    seen.add(slug);
  }
  return candidates;
}

/** @example questionRequest({ language: 'en', answers: [] }) // { language: 'en', answers: [] } */
export function questionRequest(payload: unknown): QuestionRequest {
  const body = objectOf(payload);
  return { language: parseLanguage(body), answers: parseAnswers(body) };
}

/** @example rankRequest({ language: 'pt', answers: [], candidates: [{ slug: 'porto', name: 'Porto' }] }) */
export function rankRequest(payload: unknown): RankRequest {
  const body = objectOf(payload);
  return {
    ...questionRequest(body),
    limit: parseLimit(body),
    candidates: parseCandidates(body),
  };
}
