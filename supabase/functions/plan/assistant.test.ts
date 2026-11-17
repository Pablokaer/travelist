import { assertEquals, assertRejects } from 'jsr:@std/assert@1';

import { PlanAssistant, PlanUnavailable, RETRIES } from './assistant.ts';
import { ModelError } from './openai.ts';
import { FakeChatModel, goodQuestion, lisbon, porto, seville } from './test-fakes.ts';

const request = { language: 'en' as const, answers: [] };

Deno.test('an invalid answer is asked for again with the problem, then accepted', async () => {
  const model = new FakeChatModel([{ ...goodQuestion, options: ['Only one'] }, goodQuestion]);
  const { question } = await new PlanAssistant(model).question(request);
  assertEquals(question.text, goodQuestion.text);
  assertEquals(model.calls.length, 2);
  assertEquals(model.calls[1]!.messages.at(-1)!.content.includes('1 options'), true);
});

Deno.test('after the retries the planner is unavailable', async () => {
  const model = new FakeChatModel([new ModelError('OpenAI answered HTTP 500')]);
  await assertRejects(
    () => new PlanAssistant(model).question(request),
    PlanUnavailable,
    'HTTP 500',
  );
  assertEquals(model.calls.length, RETRIES + 1);
});

Deno.test('without a model the planner is unavailable at once', async () => {
  await assertRejects(
    () => new PlanAssistant(null).question(request),
    PlanUnavailable,
    'OPENAI_API_KEY',
  );
});

Deno.test('ranking sends the candidates and their slugs as the only choices', async () => {
  const picks = ['lisbon', 'porto', 'seville'].map((slug) => ({ slug, reason: 'Warm and sunny.' }));
  const model = new FakeChatModel([{ picks }]);
  const result = await new PlanAssistant(model).rank({
    ...request,
    limit: 6,
    candidates: [lisbon, porto, seville],
  });
  assertEquals(result.picks.length, 3);
  const schema = JSON.stringify(model.calls[0]!.schema);
  assertEquals(schema.includes('"enum":["lisbon","porto","seville"]'), true);
  assertEquals(model.calls[0]!.temperature, 0.2);
});
