---
id: "WORK-035"
title: "Move the account and board backend into Next.js"
status: In Progress
priority: "High"
type: "Refactor"
tags: ["enhancement", "ready-for-agent"]
last_updated: 2026-10-09
---

## Summary

Replace the separate Express service with Next.js route handlers for Better Auth, sessions, board metadata, and health. Use same-origin browser requests and retain MongoDB records and the current board-link access policy.

## Acceptance Criteria

- [ ] Next.js serves auth, session, board creation, dashboard, join, context, title, and MongoDB health routes without an Express process.
- [ ] Browser account and board requests use the app origin; configuration and setup describe one server and the updated Google callback.
- [ ] Server configuration and MongoDB clients initialize on demand so builds and unrelated pages do not require account credentials.
- [ ] Tests cover board access, validation, metadata persistence, origin checks, and safe errors through Web Request and Response handlers; lint, typecheck, and build pass.
- [ ] The decision log and roadmap record the migration and distinguish verified behavior from unavailable live integrations.
