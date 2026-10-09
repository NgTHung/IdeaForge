---
id: "WORK-022"
title: "Set up the MongoDB account API and auth base"
status: "In Progress"
priority: "High"
type: "Feature"
impact: "Adds persistent identities and board access foundations in Next.js."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-09"
---

## Summary

Connect the Next.js account API to MongoDB and configure Better Auth for Google and verified email/password accounts. This foundation precedes share links and Liveblocks authorization enforcement. The move from Express to Next.js is tracked in work:WORK-035.

## Acceptance Criteria

- [ ] Next.js serves the account API and exposes a MongoDB health endpoint.
- [ ] MongoDB connection settings and authentication secrets are validated server-side and documented with empty example values.
- [ ] Better Auth stores users and sessions in MongoDB and supports Google and verified email/password sign-in.
- [ ] A simple login page supports email/password sign-in, account creation, and Google sign-in through Better Auth.
- [ ] The board header shows the signed-in user's name after login and offers logout.
- [ ] Account requests use the app origin and mutations reject other origins.
- [ ] Local setup documents MongoDB, Google OAuth, auth secret, and SMTP values without exposing credentials.
