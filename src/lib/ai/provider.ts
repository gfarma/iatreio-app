/**
 * Vendor-neutral AI client. Talks to any OpenAI-compatible chat completions
 * endpoint (OpenAI, Azure OpenAI EU, Mistral, OpenRouter, local vLLM, ...).
 * Configure via env:
 *   ENABLE_AI_FEATURES=true|false  (default false — hard gate)
 *   AI_BASE_URL   e.g. https://api.mistral.ai/v1
 *   AI_API_KEY
 *   AI_MODEL      e.g. mistral-small-latest
 *
 * IMPORTANT (GDPR): the production AI provider must be locked in (EU-hosted /
 * DPA in place) before any real patient data flows through here. Until then,
 * AI features run only against demo data.
 */

export function aiEnabled(): boolean {
  return process.env.ENABLE_AI_FEATURES === "true" && !!process.env.AI_API_KEY;
}

export function aiModel(): string {
  return process.env.AI_MODEL ?? "unknown";
}

export async function chatComplete(opts: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  if (!aiEnabled()) {
    throw new Error("Οι λειτουργίες AI είναι απενεργοποιημένες (ENABLE_AI_FEATURES).");
  }
  const baseUrl = (process.env.AI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 1024,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI provider error ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Κενή απάντηση από τον πάροχο AI.");
  return content.trim();
}
