// HTTP side of the trip planner (D-085):
//   POST /functions/v1/plan/question  { language, answers }              → { question }
//   POST /functions/v1/plan/rank      { language, limit?, answers, candidates } → { picks }
// 400 for a malformed body, 503 `plan_unavailable` when no valid model answer can be had (the app
// then asks its fixed questions and ranks by score).
import type { AuthUser } from '../_shared/auth.ts';
import { badRequest, errorResponse, json, methodNotAllowed, notFound } from '../_shared/cors.ts';
import { logEvent } from '../_shared/log.ts';
import { type PlanAssistant, PlanUnavailable } from './assistant.ts';
import { BadRequest, questionRequest, rankRequest } from './requests.ts';

type Route = 'question' | 'rank';

/** The last path segment: `/plan/question` (or `/functions/v1/plan/question`) → 'question'. */
export function routeOf(url: string): Route | null {
  const last = new URL(url).pathname.replace(/\/+$/, '').split('/').pop();
  return last === 'question' || last === 'rank' ? last : null;
}

async function answer(planner: PlanAssistant, route: Route, payload: unknown): Promise<unknown> {
  return route === 'question'
    ? await planner.question(questionRequest(payload))
    : await planner.rank(rankRequest(payload));
}

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new BadRequest('body is not valid JSON');
  }
}

/** @example requireUser(verify, createHandler(new PlanAssistant(model))) */
export function createHandler(planner: PlanAssistant) {
  return async (req: Request, user: AuthUser): Promise<Response> => {
    if (req.method !== 'POST') return methodNotAllowed();
    const route = routeOf(req.url);
    if (!route) return notFound('not_found', 'expected /plan/question or /plan/rank');
    try {
      return json(await answer(planner, route, await readJson(req)));
    } catch (err) {
      if (err instanceof BadRequest) return badRequest(err.message);
      if (!(err instanceof PlanUnavailable)) throw err;
      logEvent({
        level: 'warn',
        event: 'plan_unavailable',
        route,
        user: user.id,
        reason: err.message,
      });
      return errorResponse(503, 'plan_unavailable', err.message);
    }
  };
}
