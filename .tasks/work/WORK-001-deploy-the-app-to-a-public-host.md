---
id: "WORK-001"
title: "Deploy the app to a public host"
status: "To Do"
priority: "High"
type: "Feature"
milestone: "day-1"
impact: "Adds a hosting target and production environment variables."
tags: ["enhancement", "ready-for-human"]
last_updated: "2026-10-05"
---

## Summary

Owner: SE2. Put the app on a public HTTPS URL on Day 1 so every later check runs on the real deployment. Choose Vercel or Railway and record the choice in docs/decisions.md.

## Acceptance Criteria

- [ ] The host is chosen and recorded under Access and configuration in docs/decisions.md.
- [ ] The deployed URL serves the local board and a shared board over HTTPS.
- [ ] GEMINI_API_KEY and LIVEBLOCKS_SECRET_KEY are server-side environment variables on the host and don't appear in client bundles.
- [ ] AI routes can run for the full 30-second AI timeout on the host.
- [ ] A live merge succeeds on the deployed URL.
- [ ] The README explains how to deploy.
