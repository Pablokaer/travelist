// The language model behind the trip planner (D-085): OpenAI's Chat Completions API with strict
// Structured Outputs, instead of the local Ollama model of the TravelisHachtoberfest fork. The key
// stays on the server (OPENAI_API_KEY, an Edge Function secret): the app never sees it.
import type { ChatMessage, JsonSchema } from './prompts.ts';

export const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
export const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
const TIMEOUT_MS = 30_000;

/** What the planner needs from a model: one JSON answer shaped by `schema`. */
export interface ChatModel {
  complete(messages: ChatMessage[], schema: JsonSchema, temperature: number): Promise<unknown>;
}

/** The model failed to answer at all (network, HTTP error, refusal, not JSON). */
export class ModelError extends Error {}

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

type Completion = {
  choices?: { message?: { content?: string | null; refusal?: string | null } }[];
};

export type OpenAiConfig = { apiKey: string; model?: string; fetch?: FetchFn };

/**
 * @example const model = new OpenAiChatModel({ apiKey: Deno.env.get('OPENAI_API_KEY')! });
 * const answer = await model.complete(messages, questionSchema(), 0.7);
 */
export class OpenAiChatModel implements ChatModel {
  private readonly model: string;
  private readonly fetch: FetchFn;

  constructor(private readonly config: OpenAiConfig) {
    this.model = config.model ?? DEFAULT_OPENAI_MODEL;
    this.fetch = config.fetch ?? ((url, init) => fetch(url, init));
  }

  async complete(messages: ChatMessage[], schema: JsonSchema, temperature: number) {
    const response = await this.post(this.body(messages, schema, temperature));
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 200);
      throw new ModelError(`OpenAI answered HTTP ${response.status}: ${detail}`);
    }
    return parseContent((await response.json()) as Completion);
  }

  private body(messages: ChatMessage[], schema: JsonSchema, temperature: number) {
    return {
      model: this.model,
      temperature,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'planner_answer', strict: true, schema },
      },
    };
  }

  private async post(body: unknown): Promise<Response> {
    try {
      return await this.fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new ModelError(`OpenAI did not answer: ${err instanceof Error ? err.message : err}`);
    }
  }
}

/** The JSON the model wrote, or ModelError for a refusal or text that is not JSON. */
export function parseContent(completion: Completion): unknown {
  const message = completion.choices?.[0]?.message;
  if (message?.refusal) throw new ModelError(`the model refused: ${message.refusal}`);
  const content = message?.content ?? '';
  try {
    return JSON.parse(content);
  } catch {
    throw new ModelError(`the model's answer is not JSON: ${content.slice(0, 80)}`);
  }
}
