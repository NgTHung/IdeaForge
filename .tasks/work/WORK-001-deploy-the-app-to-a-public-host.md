---
id: "WORK-001"
title: "Deploy the app to a public host"
status: Done
priority: "High"
type: "Feature"
milestone: "day-1"
impact: "Adds a hosting target and production environment variables."
tags: ["enhancement", "ready-for-human"]
last_updated: 2026-10-06
---

## Summary

Owner: SE2. Put the app on a public HTTPS URL on Day 1 so every later check runs on the real deployment. Choose Vercel or Railway and record the choice in docs/decisions.md.

## Acceptance Criteria

- [x] The host is chosen and recorded under Access and configuration in docs/decisions.md.
- [x] The deployed URL serves the local board and a shared board over HTTPS.
- [x] GEMINI_API_KEY and LIVEBLOCKS_SECRET_KEY are server-side environment variables on the host and don't appear in client bundles.
- [x] AI routes can run for the full 30-second AI timeout on the host.
- [x] A live merge succeeds on the deployed URL.
- [x] The README explains how to deploy.

## Verification

On 2026-10-06, Vercel MCP identified production deployment `dpl_F7gGbKwUuFU9Uw7CXL8v78W3CG3n` in project `idea-forge` (`prj_vlpTDoJ1NE4LwtmJj0FspImGLw0F`). Its state was `READY`, its Node.js version was 24.x, and its GitHub commit was `5692918d0c0c3bcb33870ae8926d9655595544c5` on `main`. The public URL is [idea-forge-wine.vercel.app](https://idea-forge-wine.vercel.app).

Vercel MCP listed `GEMINI_API_KEY` and `LIVEBLOCKS_SECRET_KEY` as sensitive variables for production and preview, without decrypting their values. Chromium loaded ten client JavaScript chunks across the local and shared boards. Those chunks contained no locally known provider keys, provider credential patterns, or Gemini SDK markers. Both credentials are read only in server code.

Chromium opened the local board over HTTPS with HTTP 200 and two visible notes. Selecting both notes made a real `/api/merge` request, which returned HTTP 200 and a schema-valid proposal, “Daily Challenge Matchup,” in 26.3 seconds. No response was mocked. Keeping it left three notes, both unchanged originals, two ancestry edges, and both source snapshots.

The **New shared board** button opened `/board/81eb17a5-594f-4942-8400-fac50ff097b4`. That page returned HTTP 200, authorization returned HTTP 200, and the status reached `connected`. The guest cookie was secure, HTTP-only, and SameSite Lax. Chromium reported no page errors.

The deployed commit exports `runtime = "nodejs"` and `maxDuration = 95` in the merge route. The Next.js function manifest preserves the 95-second limit, which covers the 30-second attempt timeout, retry, and optional fallback. [Vercel documents support for the route export and duration budget](https://vercel.com/docs/functions/configuring-functions/duration). The live request completed before the first attempt timed out; forced production timeout and fallback were not exercised. Build-log and deployment-file reads were unavailable through MCP, so deployment identity, source, the local build manifest, and live browser checks provide the evidence. Two-browser synchronization remains `work:WORK-002`.

The README now explains the Vercel project setup, sensitive environment variables, duration budget, redeployment, and smoke checks. Hosting is recorded under Access and configuration in `docs/decisions.md`.

Repository checks passed: all 34 mocked tests, `npm run lint`, `npm run typecheck`, `npm run build`, `git diff --check`, and `taskroot validate`.
