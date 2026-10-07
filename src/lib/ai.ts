import "server-only";

import { ApiError, GoogleGenAI, type EmbedContentConfig, type GenerateContentConfig, type GenerateContentParameters } from "@google/genai";
import { z } from "zod";
import { AI_ATTEMPT_TIMEOUT_MS, AI_RETRY_DELAY_MS } from "./ai-policy.ts";

const failures = {
  missing_key: { status: 503, message: "AI is not configured: missing Gemini API key. Add GEMINI_API_KEY on the server and restart the app." },
  provider_overload: { status: 503, message: "Gemini is overloaded or its quota is exhausted. Try again shortly." },
  timeout: { status: 504, message: "Gemini timed out while generating a response. Try again." },
  invalid_output: { status: 502, message: "Gemini returned invalid output. Try again." },
  provider_error: { status: 502, message: "Gemini could not complete the request. Check the server's model and API access, then try again." },
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

function classifyError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof SyntaxError) return new AiError("invalid_output");
  if (error instanceof ApiError) {
    if (error.status === 429 || error.status === 503) return new AiError("provider_overload");
    if (error.status === 408 || error.status === 504) return new AiError("timeout");
  }
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return new AiError("timeout");
  }
  return new AiError("provider_error");
}

export function aiErrorResponse(error: unknown): Response {
  const failure = classifyError(error);
  return Response.json({ error: failure.message, code: failure.code }, { status: failure.status });
}

const httpOptions = { timeout: AI_ATTEMPT_TIMEOUT_MS, retryOptions: { attempts: 1 } };
const embeddingResponseSchema = z.object({
  embeddings: z.array(z.object({ values: z.array(z.number()).min(1) })).min(1),
});

async function callGemini<T>(
  model: string,
  fallback: string | undefined,
  operation: (ai: GoogleGenAI, model: string) => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new AiError("missing_key");
  const ai = new GoogleGenAI({ apiKey });
  const models = [model, model];
  if (fallback && fallback !== model) models.push(fallback);
  const attempts = models.slice(0, maxAttempts);
  for (const [attempt, currentModel] of attempts.entries()) {
    try {
      return await operation(ai, currentModel);
    } catch (error) {
      const failure = classifyError(error);
      // Raw provider errors can contain request data or credentials.
      console.error("Gemini request failed", {
        model: currentModel, attempt: attempt + 1, code: failure.code,
        providerStatus: error instanceof ApiError ? error.status : undefined,
      });
      const retryable = failure.code === "provider_overload" || failure.code === "timeout";
      if (!retryable || attempt === attempts.length - 1) throw failure;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, AI_RETRY_DELAY_MS));
    }
  }
  throw new AiError("provider_error");
}

type GenerationRequest = {
  contents: GenerateContentParameters["contents"];
  config?: Omit<GenerateContentConfig, "httpOptions" | "abortSignal" | "responseMimeType" | "responseJsonSchema" | "responseSchema">;
};

export async function generateJson<T extends z.ZodType>(request: GenerationRequest, schema: T, options?: { maxAttempts: 1 }): Promise<z.output<T>> {
  return (await generateJsonWithModel(request, schema, options)).result;
}

export async function generateJsonWithModel<T extends z.ZodType>(request: GenerationRequest, schema: T, options?: { maxAttempts: 1 }): Promise<{ result: z.output<T>; model: string }> {
  return callGemini(
    process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
    process.env.GEMINI_FALLBACK_MODEL?.trim(),
    async (ai, model) => {
      const response = await ai.models.generateContent({
        ...request, model,
        config: {
          ...request.config, responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(schema), httpOptions,
        },
      });
      try {
        return { result: schema.parse(JSON.parse(response.text || "")), model };
      } catch {
        throw new AiError("invalid_output");
      }
    }, options?.maxAttempts,
  );
}

export async function embedTexts(
  texts: string[],
  config?: Omit<EmbedContentConfig, "httpOptions" | "abortSignal">,
): Promise<{ model: string; vectors: number[][] }> {
  if (!texts.length || texts.some((text) => !text.trim())) throw new TypeError("Provide nonempty texts to embed.");
  return callGemini(
    process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-001",
    process.env.GEMINI_EMBEDDING_FALLBACK_MODEL?.trim(),
    async (ai, model) => {
      // Explicit contents keep embedding-2 from combining all strings into one note.
      const contents = texts.map((text) => ({ parts: [{ text }] }));
      const response = await ai.models.embedContent({ model, contents, config: { ...config, httpOptions } });
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
