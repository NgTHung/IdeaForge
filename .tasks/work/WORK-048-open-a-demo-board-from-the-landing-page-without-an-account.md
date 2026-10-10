---
id: "WORK-048"
title: "Open a demo board from the landing page without an account"
status: Done
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

- [x] A demo board section appears under How it works with one button that opens a new /board/<uuid> room without sign-in.
- [x] The board ID comes from the shared HTTP-safe UUID helper, and repeated clicks start only one navigation.
- [x] docs/decisions.md records that guests can start demo rooms and that rooms without directory records keep the sample seed.
- [x] Lint, typecheck, and production build pass; browser evidence and unverified paths are recorded.

## Verification

On 2026-10-10, lint, typecheck, and the production build passed. Headless Chromium against the production build double-clicked **Open demo board** and recorded one navigation to a new `/board/<uuid>`. This held on `localhost` and on the plain-HTTP `bbq` host, where the page is not a secure context and the ID comes from the `getRandomValues` fallback in `id.ts`.

On `localhost`, the guest lobby accepted a display name and the board connected to live Liveblocks with the five sample ideas and their two links. The section stacks at 390px without horizontal overflow.

Two-browser editing in a demo room, AI features on a demo board, and the deployed app were not checked.

## Removal

Commit `e946c6b` removed the shared demo board link from the landing page in favor of the `work:WORK-049` sandbox, and the unused handler and styles were deleted after it. `/board/<uuid>` rooms still work for anyone with a link.
