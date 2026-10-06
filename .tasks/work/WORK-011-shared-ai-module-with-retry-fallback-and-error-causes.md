---
id: "WORK-011"
title: "Shared AI module with retry, fallback, and error causes"
status: Done
priority: "High"
type: "Feature"
milestone: "day-1"
risk: "Medium"
impact: "Changes how every AI route calls Gemini and reports errors."
tags: ["enhancement", "ready-for-agent"]
last_updated: 2026-10-06
---

## Summary

Owner: AI2. Gemini can fail under load. On 2026-10-05 one of six merge calls returned 503 high demand, and the merge route reports every error with the same message. All AI routes share one module so retries, fallback, and errors behave the same way. See AI reliability in docs/decisions.md.

## Acceptance Criteria

- [x] One server module makes every Gemini generation and embedding call, and the merge route uses it.
- [x] A provider overload or timeout is retried once, then sent to a fallback model when one is configured.
- [x] Errors returned to the browser name their cause (missing key, provider overload, timeout, or invalid output), and the UI shows that message.
- [x] Provider errors are logged on the server with the model name.
- [x] The Gemini key never leaves the server.

## Verification

On 2026-10-06, `npm test` passed all 34 tests with mocked provider responses. They cover generation and embedding calls, exact retry and fallback counts, SDK timeout aborts, schema and JSON validation, safe messages and logs, and merge-route behavior. `npm run lint`, `npm run typecheck`, and `npm run build` passed.

Live Gemini calls returned a valid merge through the production route in 8.4 seconds and two 768-dimensional embeddings through the shared module in 0.7 seconds. Browser checks used the machine's Tailscale IP. With the key disabled for a separate production server, the UI showed the missing-key message and still allowed editing and adding notes. A live browser merge could be kept, leaving both originals and two ancestry edges. All 14 client JavaScript chunks were checked: none contained the Gemini key or SDK. The server-only import guard rejected an import outside the server condition.

Live overload and fallback behavior remain unverified; those paths use mocked responses in the tests. Liveblocks was not retested because this task does not change collaboration.
