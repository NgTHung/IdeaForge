import "server-only";

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class ServerConfigurationError extends HttpError {
  readonly fields: string[];

  constructor(fields: string[]) {
    super(503, `Server configuration is missing or invalid. Check: ${fields.join(", ")}.`);
    this.fields = fields;
  }
}

const safeErrorNames = new Set([
  "TypeError", "RangeError", "MongoParseError", "MongoServerSelectionError",
  "MongoNetworkError", "MongoNetworkTimeoutError", "MongoServerError",
]);

export async function apiResponse(run: () => Promise<Response>): Promise<Response> {
  try {
    const response = await run();
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } catch (error) {
    if (error instanceof ServerConfigurationError) {
      console.error("API request failed", { cause: "server_configuration", fields: error.fields });
    } else if (!(error instanceof HttpError)) {
      const cause = error instanceof Error && safeErrorNames.has(error.name) ? error.name : "unexpected_error";
      console.error("API request failed", { cause });
    }
    return Response.json({ error: error instanceof HttpError ? error.message : "The request could not be completed." }, {
      status: error instanceof HttpError ? error.status : 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

export function requireOrigin(request: Request, appOrigin: string) {
  if (request.headers.get("origin") !== appOrigin) throw new HttpError(403, "This request is not allowed.");
}

export async function readJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Send valid JSON.");
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1024 * 1024) {
        await reader.cancel();
        throw new HttpError(413, "The request body is too large.");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  try { return JSON.parse(text); }
  catch { throw new HttpError(400, "Send valid JSON."); }
}
