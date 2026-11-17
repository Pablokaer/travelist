// Client of the planner's model (D-085): the `plan` Edge Function, which asks OpenAI to write the
// follow-up questions and to rank the shortlist with a reason for each place. Ported from the
// TravelisHachtoberfest fork, whose agent called a local Ollama service instead. Both answers are
// optional: when the function or the model is not there (no OPENAI_API_KEY, an outage, a signed-out
// visitor) the app falls back to its fixed questions and to ranking by score.
import type { PlanQuestion, RankedPick } from './plan-flow';

export type AnswerSummary = { id: string; question: string; answer: string };

/** A shortlisted city as the model reads it: facts only, never invented numbers. */
export type RankCandidate = {
  slug: string;
  name: string;
  country: string;
  distanceKm: number;
  facts: Record<string, number | null>;
};

export interface PlanAgent {
  /** The next question written by the model; null when it cannot be had. */
  nextQuestion(answers: AnswerSummary[], language: string): Promise<PlanQuestion | null>;
  /** The model's picks with reasons; null when it cannot be had. */
  rank(
    answers: AnswerSummary[],
    candidates: RankCandidate[],
    language: string,
    limit: number,
  ): Promise<RankedPick[] | null>;
}

/**
 * Calls an Edge Function by name with a JSON body (supabase.functions.invoke, or a fake in tests).
 * The same shape as the Supabase client's answer: `error` set when the call failed.
 */
export type InvokeFn = (name: string, body: unknown) => Promise<{ data: unknown; error: unknown }>;

type QuestionWire = {
  id?: unknown;
  text?: unknown;
  kind?: unknown;
  options?: { value?: unknown; label?: unknown }[];
  allow_other?: unknown;
};

const KINDS = ['single', 'multi', 'text'] as const;

function questionFromWire(wire: QuestionWire | undefined): PlanQuestion | null {
  if (!wire || typeof wire.id !== 'string' || typeof wire.text !== 'string') return null;
  const kind = KINDS.find((k) => k === wire.kind);
  if (!kind) return null;
  const options = (wire.options ?? []).flatMap((o) =>
    typeof o.value === 'string' && typeof o.label === 'string'
      ? [{ value: o.value, label: o.label }]
      : [],
  );
  return {
    id: wire.id,
    kind,
    text: wire.text,
    options,
    allowOther: wire.allow_other !== false,
    source: 'ai',
  };
}

/**
 * @example const agent = new EdgePlanAgent((name, body) => supabase.functions.invoke(name, { body }));
 * const next = await agent.nextQuestion(summary, 'en'); // null when the model cannot be had
 */
export class EdgePlanAgent implements PlanAgent {
  constructor(private readonly invoke: InvokeFn) {}

  /** The function's JSON answer, or null for any refusal, outage or bad answer. */
  private async post<T>(path: string, body: unknown): Promise<T | null> {
    try {
      // `path` is the function and its route, e.g. "/plan/question" → invoke("plan/question").
      const { data, error } = await this.invoke(path.replace(/^\/+/, ''), body);
      return error ? null : (data as T);
    } catch {
      return null;
    }
  }

  async nextQuestion(answers: AnswerSummary[], language: string): Promise<PlanQuestion | null> {
    const wire = await this.post<{ question?: QuestionWire }>('/plan/question', {
      language,
      answers,
    });
    return questionFromWire(wire?.question);
  }

  async rank(
    answers: AnswerSummary[],
    candidates: RankCandidate[],
    language: string,
    limit: number,
  ): Promise<RankedPick[] | null> {
    const wire = await this.post<{ picks?: { slug?: unknown; reason?: unknown }[] }>('/plan/rank', {
      language,
      limit,
      answers,
      candidates: candidates.map(({ distanceKm, ...rest }) => ({
        ...rest,
        distance_km: distanceKm,
      })),
    });
    const picks = (wire?.picks ?? []).flatMap((p) =>
      typeof p.slug === 'string' && typeof p.reason === 'string'
        ? [{ slug: p.slug, reason: p.reason }]
        : [],
    );
    return picks.length > 0 ? picks : null;
  }
}
