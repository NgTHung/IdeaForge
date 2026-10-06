---
id: "WORK-022"
title: "Set up the MongoDB Express API and auth base"
status: "In Progress"
priority: "High"
type: "Feature"
impact: "Adds a backend service, persistent identities, and board access foundations."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-06"
---

## Summary

Create the TypeScript Express service, connect it to MongoDB, and configure Better Auth for Google and verified email/password accounts. This foundation precedes board ownership, share links, and Liveblocks authorization enforcement.

## Acceptance Criteria

- [ ] Express starts as a separate API service and exposes a health endpoint.
- [ ] MongoDB connection settings and authentication secrets are validated server-side and documented with empty example values.
- [ ] Better Auth stores users and sessions in MongoDB and supports Google and verified email/password sign-in.
- [ ] A simple login page supports email/password sign-in, account creation, and Google sign-in through Better Auth.
- [ ] The board header shows the signed-in user's name after login and offers logout.
- [ ] Credentialed cross-origin requests are restricted to the configured frontend origin.
- [ ] Local setup documents MongoDB, Google OAuth, auth secret, and SMTP values without exposing credentials.
