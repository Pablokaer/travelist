import { assertEquals } from 'jsr:@std/assert@1';

import { PlanAssistant } from './assistant.ts';
import { createHandler, routeOf } from './handler.ts';
import { FakeChatModel, goodQuestion } from './test-fakes.ts';

const user = { id: 'user-1' };
const post = (path: string, body: unknown) =>
  new Request(`http://localhost/functions/v1/plan/${path}`, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

Deno.test('the route is the last segment of the path', () => {
  assertEquals(routeOf('http://x/functions/v1/plan/question'), 'question');
  assertEquals(routeOf('http://x/plan/rank/'), 'rank');
  assertEquals(routeOf('http://x/plan'), null);
});

Deno.test('a question is answered as { question }', async () => {
  const handler = createHandler(new PlanAssistant(new FakeChatModel([goodQuestion])));
  const response = await handler(post('question', { language: 'en', answers: [] }), user);
  assertEquals(response.status, 200);
  assertEquals((await response.json()).question.kind, 'single');
});

Deno.test('a malformed body is a 400 that names the problem', async () => {
  const handler = createHandler(new PlanAssistant(new FakeChatModel([goodQuestion])));
  const response = await handler(post('question', { language: 'fr', answers: [] }), user);
  assertEquals(response.status, 400);
  assertEquals((await response.json()).message.includes('"fr"'), true);
  assertEquals((await handler(post('question', 'not json'), user)).status, 400);
});

Deno.test('without a model the planner answers 503 plan_unavailable', async () => {
  const response = await createHandler(new PlanAssistant(null))(
    post('question', { language: 'en', answers: [] }),
    user,
  );
  assertEquals([response.status, (await response.json()).error], [503, 'plan_unavailable']);
});

Deno.test('an unknown route is 404 and a GET is 405', async () => {
  const handler = createHandler(new PlanAssistant(null));
  assertEquals((await handler(post('other', {}), user)).status, 404);
  const get = new Request('http://localhost/plan/question');
  assertEquals((await handler(get, user)).status, 405);
});
