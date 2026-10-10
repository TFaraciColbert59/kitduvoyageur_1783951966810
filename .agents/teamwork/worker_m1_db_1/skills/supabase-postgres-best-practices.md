# Supabase Postgres Best Practices (Local Skill Cache)
Source: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\skills\supabase-postgres-best-practices\SKILL.md

Key Principles:
1. Query Performance & Indexes: Foreign keys must have indexes. Partial indexes for common filtered subsets.
2. Security & RLS:
   - Always wrap auth.uid() in subqueries: `user_id = (SELECT auth.uid())`
   - Explicit auth.uid() verification inside SECURITY DEFINER functions.
   - Always SET search_path = public, pg_temp; on SECURITY DEFINER functions.
   - Principle of least privilege: revoke execute on sensitive RPCs from public, anon, authenticated if service_role only.
3. Schema constraints:
   - Explicit UNIQUE constraints and FOREIGN KEY constraints with ON DELETE CASCADE where needed.
   - CHECK constraints on status/type columns and self-referencing relationships (e.g. follower_id <> following_id).
