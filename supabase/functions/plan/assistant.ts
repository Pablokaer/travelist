// Asks the model for the planner's next question or its shortlist (D-085). Each answer is checked
// by code; an invalid one is asked for again (the problem fed back) twice, then the planner is
// "unavailable" and the app falls back to its fixed questions and to ranking by score.
import {
  checkPicks,
  checkQuestion,
  InvalidAnswer,
  type Pick,
  type PlanQuestion,
} from './checks.ts';
import { type ChatModel, ModelError } from './openai.ts';
import {
  type ChatMessage,
  type JsonSchema,
  questionMessages,
  questionSchema,
  rankMessages,
  rankSchema,
  retryNote,
} from './prompts.ts';
import type { QuestionRequest, RankRequest } from './requests.ts';

export const RETRIES = 2;
const QUESTION_TEMPERATURE = 0.7;
const RANK_TEMPERATURE = 0.2;

/** No valid answer could be had: no model configured, or every try failed. */
export class PlanUnavailable extends Error {}

type Ask<T> = {
  messages: ChatMessage[];
  schema: JsonSchema;
  temperature: number;
  check: (answer: unknown) => T;
};

/**
 * @example const planner = new PlanAssistant(new OpenAiChatModel({ apiKey }));
 * const { question } = await planner.question({ language: 'en', answers: [] });
 */
export class PlanAssistant {
  constructor(private readonly model: ChatModel | null) {}

  async question({ language, answers }: QuestionRequest): Promise<{ question: PlanQuestion }> {
    const question = await this.ask({
      messages: questionMessages(language, answers),
      schema: questionSchema(),
      temperature: QUESTION_TEMPERATURE,
      check: (answer) => checkQuestion(answer, answers),
    });
    return { question };
  }

  async rank({ language, limit, answers, candidates }: RankRequest): Promise<{ picks: Pick[] }> {
    const picks = await this.ask({
      messages: rankMessages(language, limit, answers, candidates),
      schema: rankSchema(candidates.map((c) => c.slug)),
      temperature: RANK_TEMPERATURE,
      check: (answer) => checkPicks(answer, candidates, limit),
    });
    return { picks };
  }

  private async ask<T>({ messages, schema, temperature, check }: Ask<T>): Promise<T> {
    if (!this.model) throw new PlanUnavailable('no model configured (OPENAI_API_KEY is not set)');
    let problem = '';
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      const sent = problem ? [...messages, retryNote(problem)] : messages;
      try {
        return check(await this.model.complete(sent, schema, temperature));
      } catch (err) {
        if (!(err instanceof InvalidAnswer || err instanceof ModelError)) throw err;
        problem = err.message;
      }
    }
    throw new PlanUnavailable(`no valid answer in ${RETRIES + 1} tries; last problem: ${problem}`);
  }
}
