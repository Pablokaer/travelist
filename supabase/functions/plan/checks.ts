// Checks on what the model wrote (D-085), ported from the TravelisHachtoberfest fork's `plan.py`:
// the schema constrains the shape, these rules catch the rest (lengths, repeated questions, unknown
// slugs, numbers that are not in the city's facts). The message of `InvalidAnswer` is fed back to
// the model on the retry, so it says what was wrong and what was expected.
import type { Answer, Candidate } from './requests.ts';

export const QUESTION_MAX_CHARS = 110;
export const LABEL_MAX_CHARS = 40;
export const OPTIONS_MIN = 3;
export const OPTIONS_MAX = 6;
export const REASON_MAX_CHARS = 220;
export const MIN_PICKS = 3;
const SAME_QUESTION_RATIO = 0.85;
// A number this big in a reason must come from the candidate's data (population, a distance, a
// founding year, rainfall…); smaller ones (a temperature, a count of sites) are not checked.
const CHECKED_NUMBER_FROM = 100;

export const KINDS = ['single', 'multi', 'text'] as const;
export type QuestionKind = (typeof KINDS)[number];

export type PlanQuestion = {
  id: string;
  text: string;
  kind: QuestionKind;
  options: { value: string; label: string }[];
  allow_other: boolean;
};
export type Pick = { slug: string; reason: string };

export class InvalidAnswer extends Error {}

/** Lower case, no accents, words separated by single spaces. */
export function normalized(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** 2·LCS / (|a| + |b|): like Python's SequenceMatcher ratio, 1 for equal texts. */
export function similarity(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  let previous = new Array<number>(b.length + 1).fill(0);
  for (const ca of a) {
    const row = [0];
    for (let j = 0; j < b.length; j++) {
      row.push(ca === b[j] ? previous[j]! + 1 : Math.max(previous[j + 1]!, row[j]!));
    }
    previous = row;
  }
  return (2 * previous[b.length]!) / (a.length + b.length);
}

function sameQuestion(a: string, b: string): boolean {
  const [x, y] = [normalized(a), normalized(b)];
  return x === y || similarity(x, y) >= SAME_QUESTION_RATIO;
}

/** "Old towns & castles" → "old-towns-castles"; InvalidAnswer when nothing is left. */
export function slugify(label: string): string {
  const slug = normalized(label).replace(/ /g, '-');
  if (!slug) throw new InvalidAnswer(`option '${label}' has no letters or digits for a value`);
  return slug;
}

function withValues(labels: string[]): PlanQuestion['options'] {
  const taken = new Set<string>();
  return labels.map((label) => {
    const base = slugify(label);
    let [value, n] = [base, 2];
    while (taken.has(value)) value = `${base}-${n++}`;
    taken.add(value);
    return { value, label };
  });
}

function checkedOptions(labels: unknown): PlanQuestion['options'] {
  if (!Array.isArray(labels) || !labels.every((x) => typeof x === 'string')) {
    throw new InvalidAnswer(`options ${JSON.stringify(labels)} is not a list of text`);
  }
  if (labels.length < OPTIONS_MIN || labels.length > OPTIONS_MAX) {
    throw new InvalidAnswer(`${labels.length} options; expected ${OPTIONS_MIN} to ${OPTIONS_MAX}`);
  }
  const clean = labels.map((x: string) => x.trim());
  const tooLong = clean.find((label) => label.length < 1 || label.length > LABEL_MAX_CHARS);
  if (tooLong !== undefined) {
    throw new InvalidAnswer(`option '${tooLong}' is not 1 to ${LABEL_MAX_CHARS} characters`);
  }
  if (new Set(clean.map((x) => x.toLowerCase())).size !== clean.length) {
    throw new InvalidAnswer(`options ${JSON.stringify(clean)} repeat a label; expected each once`);
  }
  return withValues(clean);
}

function checkedText(answer: Record<string, unknown>, answers: Answer[]): string {
  const text = String(answer.text ?? '').trim();
  if (text.length < 1 || text.length > QUESTION_MAX_CHARS) {
    throw new InvalidAnswer(
      `question of ${text.length} characters; expected 1 to ${QUESTION_MAX_CHARS}`,
    );
  }
  const repeated = answers.find((earlier) => sameQuestion(text, earlier.question));
  if (repeated) {
    throw new InvalidAnswer(`question '${text}' repeats the earlier '${repeated.question}'`);
  }
  return text;
}

/**
 * The question in the endpoint's shape, or InvalidAnswer.
 * @example checkQuestion({ text: 'Beach or mountains?', kind: 'single', options: [...] }, [])
 */
export function checkQuestion(answer: unknown, answers: Answer[]): PlanQuestion {
  if (typeof answer !== 'object' || answer === null) {
    throw new InvalidAnswer(`answer ${JSON.stringify(answer)?.slice(0, 60)} is not an object`);
  }
  const body = answer as Record<string, unknown>;
  const text = checkedText(body, answers);
  const kind = KINDS.find((k) => k === body.kind);
  if (!kind) throw new InvalidAnswer(`kind ${JSON.stringify(body.kind)} is not one of ${KINDS}`);
  const free = kind === 'text';
  return {
    id: `ai-${answers.length}`,
    text,
    kind,
    options: free ? [] : checkedOptions(body.options),
    allow_other: free ? false : body.allow_other !== false,
  };
}

function numbersIn(text: string): number[] {
  return (text.match(/\d[\d.,]*\d|\d/g) ?? [])
    .map((token) => Number(token.replace(/,/g, '').replace(/\.$/, '')))
    .filter((n) => Number.isFinite(n));
}

/** The number is a fact (or a fact rounded, or in thousands or millions): within 1 %. */
function inFacts(number: number, candidate: Candidate): boolean {
  const known = [candidate.distance_km, ...Object.values(candidate.facts)].filter(
    (v): v is number => typeof v === 'number',
  );
  return known.some((value) =>
    [1, 1_000, 1_000_000].some((scale) => {
      const target = value / scale;
      return target !== 0 && Math.abs(number - target) <= Math.max(0.51, Math.abs(target) * 0.01);
    })
  );
}

export function checkReason(reason: unknown, candidate: Candidate): string {
  const text = typeof reason === 'string' ? reason.trim() : '';
  if (text.length < 1 || text.length > REASON_MAX_CHARS) {
    throw new InvalidAnswer(
      `reason of ${text.length} characters; expected 1 to ${REASON_MAX_CHARS}`,
    );
  }
  const invented = numbersIn(text).find((n) => n >= CHECKED_NUMBER_FROM && !inFacts(n, candidate));
  if (invented !== undefined) {
    throw new InvalidAnswer(
      `reason for ${candidate.slug} says ${invented}, which is not in its facts`,
    );
  }
  return text;
}

/** The allowed number of picks: MIN_PICKS..limit, cut down to the candidates there are. */
export function pickRange(limit: number, available: number): [number, number] {
  const high = Math.min(limit, available);
  return [Math.min(MIN_PICKS, high), high];
}

function pickAt(pick: unknown, bySlug: Map<string, Candidate>, seen: Set<string>): Pick {
  const entry = (typeof pick === 'object' && pick !== null ? pick : {}) as Record<string, unknown>;
  const slug = typeof entry.slug === 'string' ? entry.slug : '';
  const candidate = bySlug.get(slug);
  if (!candidate) {
    throw new InvalidAnswer(
      `slug '${slug}' is not a candidate; expected one of ${[...bySlug.keys()]}`,
    );
  }
  if (seen.has(slug)) throw new InvalidAnswer(`slug '${slug}' is picked twice; expected each once`);
  seen.add(slug);
  return { slug, reason: checkReason(entry.reason, candidate) };
}

/**
 * The shortlist in the endpoint's shape, or InvalidAnswer.
 * @example checkPicks({ picks: [{ slug: 'porto', reason: 'Highs of 25 °C.' }] }, candidates, 6)
 */
export function checkPicks(answer: unknown, candidates: Candidate[], limit: number): Pick[] {
  const picks = (answer as { picks?: unknown } | null)?.picks;
  if (!Array.isArray(picks)) {
    throw new InvalidAnswer(`picks ${JSON.stringify(picks)} is not a list`);
  }
  const [low, high] = pickRange(limit, candidates.length);
  if (picks.length < low || picks.length > high) {
    throw new InvalidAnswer(`${picks.length} picks; expected ${low} to ${high}`);
  }
  const bySlug = new Map(candidates.map((c) => [c.slug, c]));
  const seen = new Set<string>();
  return picks.map((pick) => pickAt(pick, bySlug, seen));
}
