---
name: code-quality
description: Production code quality, security and regression prevention for LKDV.
---

# Code Quality

Before editing:
- inspect related files
- understand dependencies
- identify existing patterns
- identify potential regressions

## TypeScript

Prefer:
- strict typing
- existing project types
- explicit interfaces where useful
- no unnecessary any
- no @ts-ignore unless absolutely justified

Never hide errors by weakening compiler settings.

## Security

Check:
- authentication
- authorization
- RLS
- API validation
- input validation
- secrets
- XSS
- CSRF where relevant
- unsafe HTML/SVG
- server/client boundaries

Never put:
- Supabase service keys
- Stripe secret keys
- API secrets
- private credentials

in client-side code.

## API

API routes should:
- validate input
- authenticate when required
- authorize resources
- handle errors
- avoid leaking internal errors
- avoid unbounded queries
- return predictable responses

## UI

Maintain:
- accessibility
- keyboard navigation
- loading states
- error states
- empty states
- responsive behavior

## Testing

After significant changes:
- run relevant tests
- run TypeScript checks when available
- run lint when available
- verify affected routes/components

Never declare a task complete without verifying the result.
