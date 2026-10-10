---
id: "WORK-047"
title: "Show the product on the landing page"
status: Done
priority: "Medium"
type: "Design"
risk: "Low"
tags: ["enhancement", "ready-for-agent"]
whitepaper: "docs/design-cleanup.md"
last_updated: 2026-10-10
---

## Summary

Turn the landing page from two entry forms into a page that shows what IdeaForge does. Guests see an illustrated merge, a single Create board action, a compact join field, and the collect, organize, merge, conclude flow. Access policy and the sign-in requirement for creating boards stay unchanged.

## Acceptance Criteria

- [x] The hero shows an illustrated merge of idea cards into a merged idea with ancestry links, labeled as an illustration, and respects reduced motion.
- [x] Create board is the single primary action; joining by link or ID is a compact secondary field with the existing validation.
- [x] A subheadline and a four-step section describe collecting, organizing, merging with originals kept, and concluding, using the app's vocabulary.
- [x] The page uses a loaded typeface and the board dot grid, and fits a 390px viewport without horizontal overflow.
- [x] Lint, typecheck, and production build pass; browser evidence and unverified paths are recorded.

## Verification

On 2026-10-10, lint, typecheck, and the production build passed. The T3 browser at 1280×800 showed the hero, the illustration paused at its selection and merged states, and the How it works section; pausing the animations confirmed the ancestry lines stay hidden until the merge and finish drawn.

Headless Chromium against the production build confirmed the invalid-input join error, navigation to `/board/<uuid>` from a pasted board URL, and the guest **Create board** redirect to `/login?returnTo=%2Fboards%2Fnew`. At 390px and 768px the document was no wider than the viewport. With reduced motion, the page ran zero animations and showed the merged idea and drawn links.

Signed-in board creation, Safari and Firefox rendering, and the deployed app were not checked. The illustration is static markup and calls no AI provider.
