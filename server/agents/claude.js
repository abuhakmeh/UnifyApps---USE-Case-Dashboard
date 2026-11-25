// Shared Claude client. AI is on when credentials are present; every agent has a heuristic
// fallback so the platform keeps working (with simpler profiles) without a key.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client;
export const claude = () => (client ||= new Anthropic({ maxRetries: 3 }));

// Server-side refusal fallback: on a policy decline the API re-runs the request on a fallback model.
export const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };

export async function structured({ system, content, schema, effort = "medium" }) {
  const res = await claude().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    system,
    output_config: { effort, format: betaZodOutputFormat(schema) },
    messages: [{ role: "user", content }],
  });
  if (res.stop_reason === "refusal") throw new Error("The model declined to analyse this content");
  if (!res.parsed_output) throw new Error(`No structured output (stop_reason: ${res.stop_reason})`);
  return res.parsed_output;
}
