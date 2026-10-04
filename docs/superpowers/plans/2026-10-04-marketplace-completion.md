# Marketplace completion Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development and verification-before-completion. Explicit user authorization covers publishing.

Goal: replace simulated marketplace flows with persistent, private-by-default listings, manual transactions, reviews, reports and support; publish tested changes.
Architecture: private product_ownership remains canonical; public listing snapshot and participant-only transactions controlled by database RPCs. No PSP/KYC/GS1/insurance claims without providers.

- [x] Backend agent: migration, shared types, RPC APIs, meaningful SQL/API tests; no UI edits.
- [x] UI agent: shared real marketplace browser, inline inventory publishing/transactions/reviews/reporting, replace legacy occasion/location pages; no backend or contact edits.
- [x] Root: durable support/contact, catalog EAN lookup, documentation, production URL discovery and integration.
- [x] Backend reviewer: immutable backend security/lifecycle review and corrections.
- [x] Final reviewer: whole change spec/quality review.
- [x] Root: real auth persistence tests, SQL concurrency/RLS, build/lint/type checks, migration deployment, PR merge and production verification.
