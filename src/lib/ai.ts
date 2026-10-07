import "server-only";

import { ApiError, GoogleGenAI, type EmbedContentConfig } from "@google/genai";
import { z } from "zod";
import { AI_ATTEMPT_TIMEOUT_MS, AI_RETRY_DELAY_MS } from "./ai-policy.ts";

const failures = {
  missing_key: { status: 503, message: "AI is not configured: missing provider API key. Add FEATHERLESS_API_KEY for generation and GEMINI_API_KEY for embeddings on the server, then restart the app." },
  provider_overload: { status: 503, message: "The AI provider is overloaded or its quota is exhausted. Try again shortly." },
  timeout: { status: 504, message: "The AI provider timed out while generating a response. Try again." },
  invalid_output: { status: 502, message: "The AI provider returned invalid output. Try again." },
  provider_error: { status: 502, message: "The AI provider could not complete the request. Check the server's model and API access, then try again." },
} as const;

export class AiError extends Error {
  readonly code: keyof typeof failures;
  readonly status: number;

  constructor(code: keyof typeof failures) {
    super(failures[code].message);
    this.name = "AiError";
    this.code = code;
    this.status = failures[code].status;
  }
}

class ProviderHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Provider returned HTTP ${status}`);
    this.name = "ProviderHttpError";
    this.status = status;
  }
}

function providerStatus(error: unknown): number | undefined {
  return error instanceof ApiError || error instanceof ProviderHttpError ? error.status : undefined;
}

function classifyError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof SyntaxError) return new AiError("invalid_output");
  const status = providerStatus(error);
  if (status === 429 || status === 503) return new AiError("provider_overload");
  if (status === 408 || status === 504) return new AiError("timeout");
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return new AiError("timeout");
  }
  return new AiError("provider_error");
}

export function aiErrorResponse(error: unknown): Response {
  const failure = classifyError(error);
  return Response.json({ error: failure.message, code: failure.code }, { status: failure.status });
}

async function withRetries<T>(
  provider: string,
  model: string,
  fallback: string | undefined,
  operation: (model: string) => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  const models = [model, model];
  if (fallback && fallback !== model) models.push(fallback);
  const attempts = models.slice(0, maxAttempts);
  for (const [attempt, currentModel] of attempts.entries()) {
    try {
      return await operation(currentModel);
    } catch (error) {
      const failure = classifyError(error);
      // Raw provider errors can contain request data or credentials.
      console.error("AI request failed", {
        provider, model: currentModel, attempt: attempt + 1, code: failure.code, providerStatus: providerStatus(error),
      });
      const retryable = failure.code === "provider_overload" || failure.code === "timeout";
      if (!retryable || attempt === attempts.length - 1) throw failure;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, AI_RETRY_DELAY_MS));
    }
  }
  throw new AiError("provider_error");
}

const FEATHERLESS_CHAT_URL = "https://api.featherless.ai/v1/chat/completions";
const chatResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

export const generationModel = () => process.env.FEATHERLESS_MODEL?.trim() || "zai-org/GLM-5.3-Flash";
export const generationConfigured = () => Boolean(process.env.FEATHERLESS_API_KEY?.trim());

export type GenerationRequest = {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
};

async function postFeatherless(apiKey: string, body: unknown): Promise<unknown> {
  // A timer instead of AbortSignal.timeout gives each attempt a fresh signal that tests can shorten.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Provider request timed out", "TimeoutError")), AI_ATTEMPT_TIMEOUT_MS);
  try {
    const response = await fetch(FEATHERLESS_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new ProviderHttpError(response.status);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// GLM can wrap JSON in a reasoning block or a Markdown fence even in JSON mode.
function jsonText(content: string): string {
  const text = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  return text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)?.[1] ?? text;
}

export async function generateJson<T extends z.ZodType>(request: GenerationRequest, schema: T, options?: { maxAttempts: 1 }): Promise<z.output<T>> {
  return (await generateJsonWithModel(request, schema, options)).result;
}

export async function generateJsonWithModel<T extends z.ZodType>(request: GenerationRequest, schema: T, options?: { maxAttempts: 1 }): Promise<{ result: z.output<T>; model: string }> {
  const apiKey = process.env.FEATHERLESS_API_KEY?.trim();
  if (!apiKey) throw new AiError("missing_key");
  // Featherless documents JSON mode but not schema-constrained output, so the prompt carries the schema and Zod enforces it.
  const system = `${request.system}\n\nReply with one JSON object and nothing else. It must match this JSON Schema:\n${JSON.stringify(z.toJSONSchema(schema))}`;
  return withRetries(
    "featherless",
    generationModel(),
    process.env.FEATHERLESS_FALLBACK_MODEL?.trim(),
    async (model) => {
      const response = chatResponseSchema.safeParse(await postFeatherless(apiKey, {
        model,
        messages: [{ role: "system", content: system }, { role: "user", content: request.prompt }],
        response_format: { type: "json_object" },
        reasoning_effort: process.env.FEATHERLESS_REASONING_EFFORT?.trim() || "low",
        ...(request.maxOutputTokens ? { max_tokens: request.maxOutputTokens } : {}),
      }));
      if (!response.success) throw new AiError("invalid_output");
      try {
        return { result: schema.parse(JSON.parse(jsonText(response.data.choices[0].message.content))), model };
      } catch {
        throw new AiError("invalid_output");
      }
    }, options?.maxAttempts,
  );
}

const embeddingHttpOptions = { timeout: AI_ATTEMPT_TIMEOUT_MS, retryOptions: { attempts: 1 } };
const embeddingResponseSchema = z.object({
  embeddings: z.array(z.object({ values: z.array(z.number()).min(1) })).min(1),
});

export async function embedTexts(
  texts: string[],
  config?: Omit<EmbedContentConfig, "httpOptions" | "abortSignal">,
): Promise<{ model: string; vectors: number[][] }> {
  if (!texts.length || texts.some((text) => !text.trim())) throw new TypeError("Provide nonempty texts to embed.");
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new AiError("missing_key");
  const ai = new GoogleGenAI({ apiKey });
  return withRetries(
    "gemini",
    process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-001",
    process.env.GEMINI_EMBEDDING_FALLBACK_MODEL?.trim(),
    async (model) => {
      // Explicit contents keep embedding-2 from combining all strings into one note.
      const contents = texts.map((text) => ({ parts: [{ text }] }));
      const response = await ai.models.embedContent({ model, contents, config: { ...config, httpOptions: embeddingHttpOptions } });
      const parsed = embeddingResponseSchema.safeParse(response);
      if (!parsed.success) throw new AiError("invalid_output");
      const vectors = parsed.data.embeddings.map((embedding) => embedding.values);
      const dimensions = config?.outputDimensionality ?? vectors[0].length;
      if (vectors.length !== texts.length || vectors.some((vector) => vector.length !== dimensions)) {
        throw new AiError("invalid_output");
      }
      return { model, vectors };
    },
  );
}
