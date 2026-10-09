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

- [ ] Missing or invalid account settings return a no-store 503 naming only the affected environment variable keys.
- [ ] Partial Google or SMTP configuration identifies the missing keys; errors and logs never include secret values, database URIs, or raw exception messages.
- [ ] Tests cover configuration failures and safe diagnostics, and lint, typecheck, and production build pass.
- [ ] Preview setup documents required environment scope, callback registration, and redeployment; verification distinguishes reproduced behavior from inaccessible Vercel logs.
