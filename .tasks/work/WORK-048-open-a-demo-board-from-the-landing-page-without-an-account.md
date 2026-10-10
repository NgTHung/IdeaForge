---
id: "WORK-048"
title: "Open a demo board from the landing page without an account"
status: In Progress
priority: "Medium"
type: "Feature"
risk: "Low"
tags: ["enhancement", "ready-for-agent"]
whitepaper: "docs/decisions.md"
last_updated: 2026-10-10
---

## Summary

Add a demo board section under How it works on the landing page. Its button opens a new public UUID board seeded with the sample ideas, so a guest can try the canvas without signing in. Demo rooms use the existing guest lobby and public UUID policy and get no directory record.

## Acceptance Criteria

- [ ] A demo board section appears under How it works with one button that opens a new /board/<uuid> room without sign-in.
- [ ] The board ID comes from the shared HTTP-safe UUID helper, and repeated clicks start only one navigation.
- [ ] docs/decisions.md records that guests can start demo rooms and that rooms without directory records keep the sample seed.
- [ ] Lint, typecheck, and production build pass; browser evidence and unverified paths are recorded.
