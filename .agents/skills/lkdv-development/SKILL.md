---
name: lkdv-development
description: Development rules and architecture guidance for Le Kit du Voyageur.
---

# LKDV Development

You are working on Le Kit du Voyageur, a Next.js 15 + React 19 + TypeScript travel application.

## Rules

Before modifying anything:
1. Inspect the relevant existing code.
2. Understand the current architecture and dependencies.
3. Search for existing implementations before creating new ones.
4. Never invent database tables, columns, functions or APIs.
5. Preserve existing functionality unless the task explicitly requires changing it.
6. Prefer the smallest clean change that solves the problem.
7. Do not rewrite entire files unnecessarily.
8. Check TypeScript types after modifications.
9. Check for regressions in related components/routes.
10. Clearly report files changed and what was changed.

## Architecture

The project uses:
- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS
- Supabase
- PostgreSQL/PostGIS
- TanStack Query
- Leaflet / React-Leaflet
- Framer Motion
- Stripe

Important directories include:
- app/
- src/components/
- src/lib/
- src/lib/supabase/
- app/api/

## Quality

Do not:
- duplicate existing logic
- create unnecessary abstractions
- hardcode database data
- expose secrets
- bypass authentication
- disable TypeScript or lint checks to hide errors

Always favor maintainable production-ready code.
