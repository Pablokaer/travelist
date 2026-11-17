import { assertEquals, assertRejects, assertThrows } from 'jsr:@std/assert@1';

import { ModelError, OPENAI_URL, OpenAiChatModel, parseContent } from './openai.ts';
import { questionSchema } from './prompts.ts';
import { FakeFetch, goodQuestion } from './test-fakes.ts';

const completion = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

Deno.test('the request carries the key, the model and a strict JSON schema', async () => {
  const fake = new FakeFetch(() => completion(JSON.stringify(goodQuestion)));
  const model = new OpenAiChatModel({ apiKey: 'sk-test', model: 'gpt-test', fetch: fake.fn });
  const answer = await model.complete([{ role: 'user', content: 'hi' }], questionSchema(), 0.7);
  assertEquals(answer, goodQuestion);
  const { url, init } = fake.requests[0]!;
  assertEquals(url, OPENAI_URL);
  assertEquals((init.headers as Record<string, string>).Authorization, 'Bearer sk-test');
  const body = JSON.parse(String(init.body));
  assertEquals([body.model, body.temperature], ['gpt-test', 0.7]);
  assertEquals(body.response_format.json_schema.strict, true);
});

Deno.test('an HTTP error becomes a ModelError with the status', async () => {
  const fake = new FakeFetch(() => new Response('{"error":"bad key"}', { status: 401 }));
  const model = new OpenAiChatModel({ apiKey: 'sk-bad', fetch: fake.fn });
  await assertRejects(() => model.complete([], questionSchema(), 0), ModelError, 'HTTP 401');
});

Deno.test('a refusal or an answer that is not JSON is a ModelError', () => {
  assertThrows(
    () => parseContent({ choices: [{ message: { refusal: 'no' } }] }),
    ModelError,
    'refused',
  );
  assertThrows(() => parseContent({ choices: [{ message: { content: 'hello' } }] }), ModelError);
});
