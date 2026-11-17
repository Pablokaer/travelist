import { assertEquals, assertThrows } from 'jsr:@std/assert@1';

import {
  checkPicks,
  checkQuestion,
  InvalidAnswer,
  pickRange,
  similarity,
  slugify,
} from './checks.ts';
import { goodQuestion, lisbon, porto, seville } from './test-fakes.ts';

const candidates = [lisbon, porto, seville];

Deno.test('a valid question gets an id and a value for each option', () => {
  const question = checkQuestion(goodQuestion, []);
  assertEquals(question.id, 'ai-0');
  assertEquals(question.options.map((o) => o.value), [
    'medieval-lanes',
    'grand-boulevards',
    'seaside-quarters',
  ]);
  assertEquals(question.allow_other, true);
});

Deno.test('a free-text question keeps no options', () => {
  const question = checkQuestion({ ...goodQuestion, kind: 'text' }, []);
  assertEquals([question.options, question.allow_other], [[], false]);
});

Deno.test('a question already asked, even reworded slightly, is refused', () => {
  const asked = [{
    id: 'q1',
    question: 'What kind of old towns do you enjoy?',
    answer: 'Medieval',
  }];
  assertThrows(() => checkQuestion(goodQuestion, asked), InvalidAnswer, 'repeats the earlier');
});

Deno.test('too few or repeated options are refused', () => {
  assertThrows(
    () => checkQuestion({ ...goodQuestion, options: ['A', 'B'] }, []),
    InvalidAnswer,
    '2 options; expected 3 to 6',
  );
  assertThrows(
    () => checkQuestion({ ...goodQuestion, options: ['Sea', 'sea', 'Hills'] }, []),
    InvalidAnswer,
    'repeat a label',
  );
});

Deno.test('labels become accent-free slugs, and a label with no letters is refused', () => {
  assertEquals(slugify('Praias & Castelos à beira-mar'), 'praias-castelos-a-beira-mar');
  assertThrows(() => slugify('!!!'), InvalidAnswer, 'no letters or digits');
});

Deno.test('similarity is 1 for equal texts and low for different ones', () => {
  assertEquals(similarity('abc', 'abc'), 1);
  assertEquals(similarity('abc', 'xyz'), 0);
});

Deno.test('picks keep the order and reasons of the model', () => {
  const answer = {
    picks: [
      { slug: 'porto', reason: 'Highs of 23 °C and 12 beaches.' },
      { slug: 'lisbon', reason: 'About 546 thousand people and 1450 km away.' },
      { slug: 'seville', reason: 'Warm.' },
    ],
  };
  assertEquals(checkPicks(answer, candidates, 6).map((p) => p.slug), [
    'porto',
    'lisbon',
    'seville',
  ]);
});

Deno.test('an unknown, repeated or invented pick is refused', () => {
  const pick = (slug: string, reason = 'Warm.') => ({ slug, reason });
  assertThrows(
    () => checkPicks({ picks: [pick('lima'), pick('porto'), pick('lisbon')] }, candidates, 6),
    InvalidAnswer,
    "slug 'lima' is not a candidate",
  );
  assertThrows(
    () => checkPicks({ picks: [pick('porto'), pick('porto'), pick('lisbon')] }, candidates, 6),
    InvalidAnswer,
    'picked twice',
  );
  const invented = [pick('porto', 'Founded in 1123.'), pick('lisbon'), pick('seville')];
  assertThrows(
    () => checkPicks({ picks: invented }, candidates, 6),
    InvalidAnswer,
    'not in its facts',
  );
});

Deno.test('the number of picks is at least 3, at most the limit and the candidates', () => {
  assertEquals(pickRange(6, 30), [3, 6]);
  assertEquals(pickRange(6, 2), [2, 2]);
  assertThrows(
    () => checkPicks({ picks: [{ slug: 'porto', reason: 'Warm.' }] }, candidates, 6),
    InvalidAnswer,
    '1 picks; expected 3 to 3',
  );
});
