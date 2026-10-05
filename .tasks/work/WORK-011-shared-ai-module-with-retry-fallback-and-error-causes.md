---
id: "WORK-011"
title: "Shared AI module with retry, fallback, and error causes"
status: "To Do"
priority: "High"
type: "Feature"
milestone: "day-1"
risk: "Medium"
impact: "Changes how every AI route calls Gemini and reports errors."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-05"
---

## Summary

Owner: AI2. Gemini can fail under load. On 2026-10-05 one of six merge calls returned 503 high demand, and the merge route reports every error with the same message. All AI routes share one module so retries, fallback, and errors behave the same way. See AI reliability in docs/decisions.md.

## Acceptance Criteria

- [ ] One server module makes every Gemini generation and embedding call, and the merge route uses it.
- [ ] A provider overload or timeout is retried once, then sent to a fallback model when one is configured.
- [ ] Errors returned to the browser name their cause (missing key, provider overload, timeout, or invalid output), and the UI shows that message.
- [ ] Provider errors are logged on the server with the model name.
- [ ] The Gemini key never leaves the server.
