---
name: security-audit
description: Security review for Next.js, Supabase and LKDV APIs.
---

# Security Audit

Always consider security when modifying:

- authentication
- authorization
- Supabase
- API routes
- forms
- uploads
- user-generated content
- payments
- admin functionality

Check:

## Supabase
- RLS
- ownership
- authenticated access
- service-role boundaries
- exposed tables
- exposed functions

## Next.js
- server/client boundaries
- secrets
- API validation
- unsafe redirects
- XSS
- dangerouslySetInnerHTML
- unsafe SVG
- sensitive error messages

## Authentication
Never trust client-provided user IDs or roles.

Always verify identity server-side when authorization matters.

## Payments
Never handle raw card information in application code.

Never expose secret API keys.

## General
Do not introduce:
- hardcoded secrets
- SQL injection
- command injection
- path traversal
- insecure file access
- privilege escalation

When discovering a security issue, explain:
1. severity
2. attack surface
3. impact
4. minimal remediation
