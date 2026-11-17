// The planner's two prompts and their JSON schemas (D-085), ported from the TravelisHachtoberfest
// fork's `plan.py`. The schemas follow OpenAI's strict Structured Outputs: every property is
// required and no other is allowed, so `allow_other` is always present.
import {
  KINDS,
  LABEL_MAX_CHARS,
  OPTIONS_MAX,
  OPTIONS_MIN,
  pickRange,
  QUESTION_MAX_CHARS,
  REASON_MAX_CHARS,
} from './checks.ts';
import type { Answer, Candidate, Language } from './requests.ts';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type JsonSchema = Record<string, unknown>;

const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  pt: 'European Portuguese (Portugal), in a formal register, never Brazilian Portuguese',
};

const FACTS_LEGEND =
  'Facts: temp_mean_c and temp_max_c are the mean and maximum daily temperature ' +
  'in °C in the travel month; precip_mm and snowfall_cm the rain and snow of that month; ' +
  'sunshine_hours the sunshine per day; inception_year the founding year (negative: before the ' +
  'common era); beaches, unesco, castles, museums and churches are counts of such places.';

export function questionSchema(): JsonSchema {
  return {
    type: 'object',
    properties: {
      text: { type: 'string' },
      kind: { type: 'string', enum: [...KINDS] },
      options: { type: 'array', items: { type: 'string' } },
      allow_other: { type: 'boolean' },
    },
    required: ['text', 'kind', 'options', 'allow_other'],
    additionalProperties: false,
  };
}

export function rankSchema(slugs: string[]): JsonSchema {
  const pick = {
    type: 'object',
    properties: { slug: { type: 'string', enum: slugs }, reason: { type: 'string' } },
    required: ['slug', 'reason'],
    additionalProperties: false,
  };
  return {
    type: 'object',
    properties: { picks: { type: 'array', items: pick } },
    required: ['picks'],
    additionalProperties: false,
  };
}

function history(answers: Answer[]): string {
  return answers.map((a) => `- Q: ${a.question}\n  A: ${a.answer}`).join('\n') || '(none yet)';
}

/** Said again at the end of the user message, where the model looks last. */
function replyIn(language: Language): string {
  const name = LANGUAGE_NAMES[language];
  return language === 'en' ? `Reply in ${name}.` : `Write in ${name}.`;
}

/** @example questionMessages('en', [])[0].role // 'system' */
export function questionMessages(language: Language, answers: Answer[]): ChatMessage[] {
  const system = 'You help a traveller choose their next trip by asking ONE short follow-up ' +
    'question at a time. Read their answers and dig into what they reveal (for example castles ' +
    'plus warm weather: ask what kind of castle or old-town atmosphere they like). Go deeper than ' +
    'what they already said: ask about something they have not told you that would change which ' +
    'city fits, and never offer options that just restate an earlier answer. Never repeat a ' +
    `question already asked. The question is at most ${QUESTION_MAX_CHARS} characters. ` +
    "kind is 'single' (pick one), 'multi' (pick several) or 'text' (free answer, empty options). " +
    `For single or multi give ${OPTIONS_MIN} to ${OPTIONS_MAX} options, each a label of at most ` +
    `${LABEL_MAX_CHARS} characters. Write in ${LANGUAGE_NAMES[language]}.`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: `Answers so far:\n${history(answers)}\n\n${replyIn(language)}` },
  ];
}

function candidateLine(c: Candidate): string {
  const { slug, name, country, distance_km, facts } = c;
  return JSON.stringify({ slug, name, country, distance_km, facts });
}

function rankSystem(language: Language, low: number, high: number): string {
  return `You pick destinations for a traveller. From the list choose ${high} cities that best ` +
    'fit ALL their answers, including the free-text ones, best first; choose fewer (never ' +
    `fewer than ${low}) only when the others clearly do not fit. For each give a reason of one ` +
    `or two sentences, at most ${REASON_MAX_CHARS} characters, that cites a concrete fact of ` +
    'that city from its data (temperature, sunshine, beaches, castles) and uses ONLY facts shown ' +
    'for that city: never invent numbers or facts. Do not drop a city because of distance or ' +
    "climate: the traveller's limits were already applied. Keep the shortlist varied: not all " +
    `cities of one country unless the answers demand it. ${FACTS_LEGEND} Write the reason in ` +
    'natural language (say "highs of 29 °C", never a field name like temp_max_c) and add nothing ' +
    'that is not in the data (do not call a castle hilltop or a beach quiet). ' +
    `Write in ${LANGUAGE_NAMES[language]}.`;
}

/** @example rankMessages('pt', 6, answers, candidates)[1].content.includes('Cities') // true */
export function rankMessages(
  language: Language,
  limit: number,
  answers: Answer[],
  candidates: Candidate[],
): ChatMessage[] {
  const [low, high] = pickRange(limit, candidates.length);
  const cities = candidates.map(candidateLine).join('\n');
  const user = `Answers:\n${history(answers)}\n\nCities (one JSON object per line):\n${cities}` +
    `\n\n${replyIn(language)}`;
  return [
    { role: 'system', content: rankSystem(language, low, high) },
    { role: 'user', content: user },
  ];
}

export function retryNote(problem: string): ChatMessage {
  return { role: 'user', content: `Your previous answer was invalid: ${problem}. Try again.` };
}
