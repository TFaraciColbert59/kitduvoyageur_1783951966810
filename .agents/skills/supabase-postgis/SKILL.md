---
name: supabase-postgis
description: Safe Supabase, PostgreSQL and PostGIS development for LKDV.
---

# Supabase and PostGIS

Before changing database-related code:
1. Inspect existing Supabase clients and types.
2. Search the repository for the table/function/column being used.
3. Never invent schema elements.
4. Check authentication and RLS implications.
5. Prefer existing RPC/functions when available.
6. Never expose service-role credentials to the browser.

## Supabase

Respect:
- src/lib/supabase/client.ts
- src/lib/supabase/server.ts
- src/lib/supabase/queries.ts
- src/lib/supabase/types.ts

Use the correct client for the execution context.

## PostgreSQL

For queries:
- select only required columns
- avoid unbounded queries
- use pagination where appropriate
- handle errors explicitly
- avoid N+1 queries
- use indexes for frequently queried columns

## PostGIS

For spatial data:
- preserve existing geometry types and SRIDs
- inspect existing spatial indexes before changing queries
- use appropriate spatial operators
- avoid loading huge geometry datasets unnecessarily
- simplify geometries when appropriate for map rendering
- never duplicate millions of spatial records unnecessarily

For hiking trails and map data:
- distinguish routes from POIs
- avoid returning unnecessary geometry detail
- use bounding boxes / viewport queries when possible
- paginate large result sets

## Security

Always consider:
- Row Level Security
- authenticated vs anonymous access
- ownership checks
- service-role usage
- SQL injection
- exposed sensitive data

Never disable RLS merely to make a feature work.
