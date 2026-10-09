---
id: "BUG-003"
title: "Report account configuration failures without exposing secrets"
status: In Progress
priority: "High"
type: "Bug"
tags: ["bug", "ready-for-agent"]
last_updated: 2026-10-09
---

## Summary

A preview social sign-in returns only a generic 500, and the error wrapper suppresses configuration details in logs. Identify invalid server settings safely in API errors and logs, retain sanitized unexpected failures, and document Preview environment setup.

## Acceptance Criteria

- [x] Missing or invalid account settings return a no-store 503 naming only the affected environment variable keys.
- [x] Partial Google or SMTP configuration identifies the missing keys; errors and logs never include secret values, database URIs, or raw exception messages.
- [x] Tests cover configuration failures and safe diagnostics, and lint, typecheck, and production build pass.
- [x] Preview setup documents required environment scope, callback registration, and redeployment; verification distinguishes reproduced behavior from inaccessible Vercel logs.
- [ ] MongoDB parse failures log a fixed reason code without copying driver messages or credentials; tests verify real parser failures and URIs without a database path.

## Verification

All 139 tests, lint, typecheck, and a production build without account credentials passed. The actual social sign-in route returned a no-store 503 naming missing MongoDB and auth secret keys. With configured local settings it returned 200 and a Google authorization URL with the expected localhost callback. Tests ensure responses and logs exclude invalid secret values, database URIs, and raw exception messages. The Vercel project denied log and environment access with 403, so the preview failure itself is not confirmed; the new diagnostics and documented Preview setup provide the next check after redeployment.
