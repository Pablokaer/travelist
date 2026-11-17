import i18n from '@/lib/i18n';
import { CORE_QUESTION_IDS, FOLLOW_UP_COUNT, type PlanQuestion } from '@/features/plan/plan-flow';
import { EdgePlanAgent } from '@/features/plan/plan-agent';
import { coreQuestion, fallbackQuestion } from '@/features/plan/questions';

const t = i18n.getFixedT('en');
const COUNTRIES = [
  { code: 'IT', name: 'Italy' },
  { code: 'MT', name: 'Malta' },
];

/** Stands in for supabase.functions.invoke: one canned answer, an error, or a throw (offline). */
class FakeInvoke {
  calls: { name: string; body: unknown }[] = [];
  constructor(
    private readonly data: unknown,
    private readonly error: unknown = null,
    private readonly offline = false,
  ) {}
  invoke = async (name: string, body: unknown) => {
    if (this.offline) throw new TypeError('Failed to fetch');
    this.calls.push({ name, body });
    return { data: this.error ? null : this.data, error: this.error };
  };
}

describe('questions (D-085)', () => {
  test('the seven core questions are written in the language of the interface', () => {
    const asked = CORE_QUESTION_IDS.map((id) => coreQuestion(id, t, COUNTRIES));
    expect(asked.map((q) => q.kind)).toEqual([
      'origin',
      'date',
      'single',
      'single',
      'countries',
      'multi',
      'multi',
      'multi',
    ]);
    expect(asked[3]!.text).toBe('How far from home are you willing to go?');
    expect(asked[5]!.options.map((o) => o.label)).toContain('Snow');
    expect(asked[4]!.text).toBe('Are there countries you do not want as options?');
    expect(asked[4]!.options).toEqual(COUNTRIES.map((c) => ({ value: c.code, label: c.name })));
    expect(asked.every((q) => q.source === 'core' && q.allowOther)).toBe(true);
  });

  test('the fallback follow-ups are used when the model cannot write them', () => {
    const asked = Array.from({ length: FOLLOW_UP_COUNT }, (_, i) => fallbackQuestion(i, t));
    expect(asked.map((q) => [q.id, q.kind, q.source])).toEqual([
      ['pace', 'single', 'fallback'],
      ['extra', 'text', 'fallback'],
    ]);
  });

  test('a fallback index out of range is an error naming it', () => {
    expect(() => fallbackQuestion(FOLLOW_UP_COUNT, t)).toThrow(/2.*0 to 1/);
  });
});

describe('EdgePlanAgent (D-085)', () => {
  const summary = [{ id: 'weather', question: 'Weather?', answer: 'Sunny' }];

  test('nextQuestion posts the answers so far and maps the model’s question', async () => {
    const http = new FakeInvoke({
      question: {
        id: 'ai-4',
        text: 'Which kind of castle?',
        kind: 'single',
        options: [{ value: 'hilltop', label: 'Hilltop' }],
        allow_other: true,
      },
    });
    const agent = new EdgePlanAgent(http.invoke);
    const question = (await agent.nextQuestion(summary, 'en')) as PlanQuestion;
    expect(question).toEqual({
      id: 'ai-4',
      kind: 'single',
      text: 'Which kind of castle?',
      options: [{ value: 'hilltop', label: 'Hilltop' }],
      allowOther: true,
      source: 'ai',
    });
    expect(http.calls[0]).toEqual({
      name: 'plan/question',
      body: { language: 'en', answers: summary },
    });
  });

  test('nextQuestion is null when the function refuses, is offline or answers nonsense', async () => {
    const refused = new FakeInvoke(null, new Error('plan_unavailable (503)'));
    expect(await new EdgePlanAgent(refused.invoke).nextQuestion(summary, 'en')).toBeNull();
    const offline = new FakeInvoke(null, null, true);
    expect(await new EdgePlanAgent(offline.invoke).nextQuestion(summary, 'en')).toBeNull();
    const nonsense = new FakeInvoke({ question: { text: 7 } });
    expect(await new EdgePlanAgent(nonsense.invoke).nextQuestion(summary, 'en')).toBeNull();
  });

  test('rank sends the shortlist and returns the picks with their reasons', async () => {
    const http = new FakeInvoke({
      picks: [{ slug: 'lisbon', reason: 'Mild and sunny in December.' }],
    });
    const candidates = [
      {
        slug: 'lisbon',
        name: 'Lisbon',
        country: 'Portugal',
        distanceKm: 1900,
        facts: { beaches: 12 },
      },
    ];
    const picks = await new EdgePlanAgent(http.invoke).rank(summary, candidates, 'en', 6);
    expect(picks).toEqual([{ slug: 'lisbon', reason: 'Mild and sunny in December.' }]);
    expect(http.calls[0]!.name).toBe('plan/rank');
    expect(http.calls[0]!.body).toEqual({
      language: 'en',
      limit: 6,
      answers: summary,
      candidates: [
        {
          slug: 'lisbon',
          name: 'Lisbon',
          country: 'Portugal',
          distance_km: 1900,
          facts: { beaches: 12 },
        },
      ],
    });
  });

  test('rank is null when the function is not there, so the app ranks by score', async () => {
    const offline = new FakeInvoke(null, null, true);
    expect(await new EdgePlanAgent(offline.invoke).rank(summary, [], 'en', 6)).toBeNull();
  });
});
