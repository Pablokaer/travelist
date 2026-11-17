// Entry point of the trip planner's model (D-085): OpenAI when OPENAI_API_KEY is set (model:
// OPENAI_MODEL, default gpt-4.1-mini); without a key every call answers 503 and the app uses its
// fixed questions. Signed-in users only, so the key cannot be spent by anonymous callers.
import { requireUser, supabaseUserVerifier } from '../_shared/auth.ts';
import { env } from '../_shared/env.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { PlanAssistant } from './assistant.ts';
import { createHandler } from './handler.ts';
import { OpenAiChatModel } from './openai.ts';

export function defaultHandler(): (req: Request) => Promise<Response> {
  const apiKey = env.openAiApiKey();
  const model = apiKey ? new OpenAiChatModel({ apiKey, model: env.openAiModel() }) : null;
  return requireUser(
    supabaseUserVerifier(serviceClient()),
    createHandler(new PlanAssistant(model)),
  );
}

if (import.meta.main) {
  Deno.serve(defaultHandler());
}
