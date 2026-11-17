// The planner's model client for this build (D-085): the `plan` Edge Function, which talks to
// OpenAI with the server's OPENAI_API_KEY. Without a key the function answers 503 and the planner
// asks its fixed questions and ranks by score.
import { supabase } from '@/lib/supabase';
import { EdgePlanAgent, type PlanAgent } from './plan-agent';

export const defaultPlanAgent: PlanAgent = new EdgePlanAgent((name, body) =>
  supabase.functions.invoke(name, { body: body as Record<string, unknown> }),
);
