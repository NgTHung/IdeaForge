---
id: "WORK-035"
title: "Move the account and board backend into Next.js"
status: Done
priority: "High"
type: "Refactor"
tags: ["enhancement", "ready-for-agent"]
last_updated: 2026-10-09
---

## Summary

Replace the separate Express service with Next.js route handlers for Better Auth, sessions, board metadata, and health. Use same-origin browser requests and retain MongoDB records and the current board-link access policy.

## Acceptance Criteria

- [x] Next.js serves auth, session, board creation, dashboard, join, context, title, and MongoDB health routes without an Express process.
- [x] Browser account and board requests use the app origin; configuration and setup describe one server and the updated Google callback.
- [x] Server configuration and MongoDB clients initialize on demand so builds and unrelated pages do not require account credentials.
- [x] Tests cover board access, validation, metadata persistence, origin checks, and safe errors through Web Request and Response handlers; lint, typecheck, and build pass.
- [x] The decision log and roadmap record the migration and distinguish verified behavior from unavailable live integrations.

## Verification

All 138 tests, lint, typecheck, and production build passed. A build without MongoDB credentials or an auth secret passed, then served successful account session and MongoDB health reads with runtime credentials. HTTP checks confirmed the expected 401, 403, 400, and 405 responses. Live Gemini embeddings and Liveblocks authorization returned 200. Board persistence paths are covered with mocked MongoDB tests. Interactive account flows and two-browser synchronization remain unverified because collaborative browser navigation failed. Setup changes and these limits are recorded in README.md and docs/roadmap.md.
