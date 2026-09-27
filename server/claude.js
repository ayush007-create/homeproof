import Anthropic from "@anthropic-ai/sdk";

// Anthropic Claude: the last-resort backup when every Gemini model fails
// (quota used up, out of credit, overloaded). Optional: without
// ANTHROPIC_API_KEY the app simply has no Claude backup.

export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5"; // fast and good with photos

export const claudeEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client;
function claude() {
  // No SDK retries: the scan has a fixed time budget, and Claude is already the last try.
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });
  return client;
}

// One request with photos, answered as JSON that matches `schema`.
// parts: [{ text }] or [{ image: Buffer, mimeType }], in order.
export async function claudeJson({ parts, schema, timeoutMs, maxTokens = 16000 }) {
  const content = parts.map((p) =>
    p.image
      ? { type: "image", source: { type: "base64", media_type: p.mimeType, data: p.image.toString("base64") } }
      : { type: "text", text: p.text }
  );
  const response = await claude().messages.create(
    {
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content }],
      output_config: { format: { type: "json_schema", schema } },
    },
    { timeout: timeoutMs }
  );
  if (response.stop_reason === "refusal") throw new Error("Claude declined the request.");
  if (response.stop_reason === "max_tokens") throw new Error("Claude's answer was cut off.");
  const text = response.content.find((b) => b.type === "text")?.text;
  return JSON.parse(text);
}

// A short plain-text answer (used for the report summary).
export async function claudeText({ prompt, timeoutMs }) {
  const response = await claude().messages.create(
    { model: CLAUDE_MODEL, max_tokens: 1024, messages: [{ role: "user", content: prompt }] },
    { timeout: timeoutMs }
  );
  if (response.stop_reason === "refusal") throw new Error("Claude declined the request.");
  return response.content.find((b) => b.type === "text")?.text ?? "";
}

// Turns an SDK error into a short reason for the logs (never includes the key).
export function claudeErrorReason(err) {
  if (err instanceof Anthropic.AuthenticationError) return "invalid ANTHROPIC_API_KEY (401)";
  if (err instanceof Anthropic.PermissionDeniedError) return "key not allowed (403)";
  if (err instanceof Anthropic.RateLimitError) return "rate limited (429)";
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "timed out";
  if (err instanceof Anthropic.APIError && err.status) return `API error ${err.status}: ${String(err.message).slice(0, 160)}`;
  return err?.message || String(err);
}
