import 'server-only';

export class ConnectionError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryAfter?: number;
  constructor(code: string, message: string, status = 503, retryAfter?: number) {
    super(message); this.code = code; this.status = status; this.retryAfter = retryAfter;
  }
}

export function connectionErrorResponse(error: unknown): Response {
  const failure = error instanceof ConnectionError ? error : new ConnectionError('connection_unavailable', 'Connection suggestions are unavailable. Try again later.');
  return Response.json({ error: failure.message, code: failure.code, ...(failure.retryAfter ? { retryAfter: failure.retryAfter } : {}) }, {
    status: failure.status, headers: failure.retryAfter ? { 'Retry-After': String(failure.retryAfter) } : undefined,
  });
}
