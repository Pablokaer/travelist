// Named fakes for the planner's tests: a model that answers from a script, and a fetch that
// records the request it was given.
import type { ChatModel } from './openai.ts';
import type { ChatMessage, JsonSchema } from './prompts.ts';
import type { Candidate } from './requests.ts';

/** Answers each call with the next scripted answer (an Error is thrown instead). */
export class FakeChatModel implements ChatModel {
  readonly calls: { messages: ChatMessage[]; schema: JsonSchema; temperature: number }[] = [];

  constructor(private readonly script: unknown[]) {}

  complete(messages: ChatMessage[], schema: JsonSchema, temperature: number): Promise<unknown> {
    this.calls.push({ messages, schema, temperature });
    const next = this.script[Math.min(this.calls.length - 1, this.script.length - 1)];
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  }
}

/** Answers every request with `response` and keeps what was asked. */
export class FakeFetch {
  readonly requests: { url: string; init: RequestInit }[] = [];

  constructor(private readonly response: () => Response) {}

  readonly fn = (url: string, init: RequestInit): Promise<Response> => {
    this.requests.push({ url, init });
    return Promise.resolve(this.response());
  };
}

export const lisbon: Candidate = {
  slug: 'lisbon',
  name: 'Lisbon',
  country: 'Portugal',
  distance_km: 1450,
  facts: { temp_max_c: 23.4, population: 545923, beaches: 12 },
};
export const porto: Candidate = { ...lisbon, slug: 'porto', name: 'Porto', distance_km: 1500 };
export const seville: Candidate = {
  ...lisbon,
  slug: 'seville',
  name: 'Seville',
  distance_km: 1800,
};

export const goodQuestion = {
  text: 'What kind of old town do you enjoy?',
  kind: 'single',
  options: ['Medieval lanes', 'Grand boulevards', 'Seaside quarters'],
  allow_other: true,
};
