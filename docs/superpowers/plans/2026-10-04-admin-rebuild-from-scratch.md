# Admin Rebuild From Scratch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy admin (archived to `archive/admin-legacy-20261004/`) with a zero-mock, RLS-first back-office: RBAC global + append-only audit + server-only writes + Liquid Glass UI + tests/gates.

**Architecture:** Server-first Next.js 15: middleware `is_admin` page guard (kept) + `requireAdmin()` server guard on every admin API/Server Action + `service_role` writes confined to `src/server/admin/` (`server-only`) + new `roles/permissions/user_roles/role_permissions/action_logs` tables with `FORCE RLS` deny-by-default. UI = Server Components + client islands, primitives from `@/design` only, light Liquid Glass theme.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Supabase Postgres + RLS, zod, vitest, pgTAP, Playwright.

**Spec:** Deep-research report `deep-research-report (8).md` §§1-9 + ultimage audit synthesis (5 probes, 2026-10-04) + `DESIGN_SYSTEM.md` + `src/design/README.md`.

## Global Constraints

- RLS obligatoire sur toute nouvelle table, isolation par `auth.uid()` / `(select auth.uid())`.
- `SECURITY DEFINER` + `SET search_path = public, pg_temp` + `REVOKE ALL ... FROM PUBLIC` on every new function.
- Zéro secret en dur, clés serveur uniquement, `export const dynamic = 'force-dynamic'` on API routes.
- Zéro hex en dur, zéro `<button>/<input>` brut dans `src/app/admin/**` (primitives `@/design`).
- `no-explicit-any: error` sur tout nouveau fichier admin (override eslint).
- Aucune donnée mock/PII factice dans le code livré.
- Pas de `rm -rf`, pas de `git push --force`, pas de `DROP TABLE`, pas de commit de `.env*`.

---

### Task 1: P0 — Isolation & baseline (DONE 2026-10-04)

**Files:**
- Modify (via git mv): `src/app/admin/**` → `archive/admin-legacy-20261004/admin/**`

**Interfaces:** Produces: branch `chantier/admin-rebuild`, legacy history preserved via rename detection.

- [x] **Step 1:** `git checkout -b chantier/admin-rebuild`
- [x] **Step 2:** `git mv src/app/admin archive/admin-legacy-20261004/admin`
- [x] **Step 3:** Baseline `npx tsc --noEmit` → exit 0
- [ ] **Step 4 (P7):** Re-verify `tsc`, `lint` scoped, `vitest run`, `next build`

---

### Task 2: P1 — Socle RBAC (migration + backfill + pgTAP)

**Files:**
- Create: `supabase/migrations/20261005000000_admin_rbac_core.sql`
- Create: `supabase/tests/database/admin_rbac_core.test.sql`
- Modify: `supabase/migrations/20260710110000_admin_tables.sql` — none (legacy untouched, deprecated later)

**Interfaces:**
- Consumes: `public.is_admin()` (20260911551000, DEFINER locked), `user_profiles.role`.
- Produces: `public.has_permission(p_code text) → boolean`, tables `roles`, `permissions`, `user_roles`, `role_permissions`.

**SQL (migration, exact):**

```sql
-- roles / permissions / user_roles / role_permissions — RBAC global admin
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  resource text NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.user_profiles(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  PRIMARY KEY (user_id, role_id)
);
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- seed roles
INSERT INTO public.roles (name, description) VALUES
  ('super_admin', 'Accès total, gestion des rôles'),
  ('admin', 'Administration contenus + modération + récompenses'),
  ('moderateur', 'Modération contenus + lecture')
ON CONFLICT (name) DO NOTHING;

-- seed permissions
INSERT INTO public.permissions (code, resource, action) VALUES
  ('users.read','users','read'), ('users.write','users','write'),
  ('roles.grant','roles','grant'),
  ('products.read','products','read'), ('products.write','products','write'),
  ('orders.read','orders','read'), ('orders.write','orders','write'),
  ('moderation.read','moderation','read'), ('moderation.write','moderation','write'),
  ('rewards.read','rewards','read'), ('rewards.write','rewards','write'),
  ('audit.read','audit','read'), ('config.write','config','write')
ON CONFLICT (code) DO NOTHING;

-- role -> permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE (r.name = 'super_admin')
   OR (r.name = 'admin' AND p.code <> 'roles.grant')
   OR (r.name = 'moderateur' AND p.code IN ('moderation.read','moderation.write','users.read','products.read','orders.read'))
ON CONFLICT DO NOTHING;

-- backfill idempotent: user_profiles.role='admin' -> user_roles(admin); admin_roles table -> user_roles
INSERT INTO public.user_roles (user_id, role_id)
SELECT up.id, r.id FROM public.user_profiles up
JOIN public.roles r ON r.name = 'admin'
WHERE up.role = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role_id, granted_at)
SELECT ar.user_id, r.id, ar.created_at FROM public.admin_roles ar
JOIN public.roles r ON r.name = CASE WHEN ar.role = 'super_admin' THEN 'super_admin' WHEN ar.role = 'moderateur' THEN 'moderateur' ELSE 'admin' END
ON CONFLICT DO NOTHING;

-- has_permission()
CREATE OR REPLACE FUNCTION public.has_permission(p_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND p.code = p_code
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
  ) OR public.is_admin();
$$;
REVOKE ALL ON FUNCTION public.has_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO anon, authenticated, service_role;

-- RLS deny-by-default
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.permissions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.roles FROM anon, authenticated;
REVOKE ALL ON public.role_permissions FROM anon, authenticated;
REVOKE ALL ON public.user_roles FROM anon, authenticated;
REVOKE ALL ON public.permissions FROM anon, authenticated;
GRANT SELECT ON public.roles, public.permissions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.role_permissions TO authenticated;

CREATE POLICY roles_read ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY permissions_read ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY user_roles_read_own ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR public.has_permission('users.read'));
CREATE POLICY user_roles_grant ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('roles.grant'));
CREATE POLICY user_roles_revoke ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_permission('roles.grant'));
CREATE POLICY role_permissions_read ON public.role_permissions FOR SELECT TO authenticated
  USING (true);
CREATE POLICY role_permissions_write ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('roles.grant'));
CREATE POLICY role_permissions_delete ON public.role_permissions FOR DELETE TO authenticated
  USING (public.has_permission('roles.grant'));
```

**pgTAP test (exact file):** `supabase/tests/database/admin_rbac_core.test.sql` — begin; check tables exist, `has_permission` is DEFINER with locked search_path, grants revoked from public, backfill row count >= 0 idempotent (run migration twice via `ON CONFLICT`), anon cannot select user_roles. Follow existing test style in `supabase/tests/database/rls_role_helper_execute.test.sql`.

- [ ] **Step 1:** Write migration file above verbatim.
- [ ] **Step 2:** Write pgTAP test mirroring repo style.
- [ ] **Step 3:** Validate SQL parses: `npx supabase db lint` if CLI available, else `node -e` balanced-parens + `rg` self-check for `search_path`/`REVOKE` presence.
- [ ] **Step 4:** Stage + commit `feat(admin): socle RBAC global + backfill idempotent`.

---

### Task 3: P2 — Audit log append-only serveur

**Files:**
- Create: `supabase/migrations/20261005010000_admin_action_logs.sql`
- Create: `src/server/admin/audit.ts`
- Create: `supabase/tests/database/admin_action_logs.test.sql`

**Interfaces:**
- Consumes: `has_permission('audit.read')`.
- Produces: `logAdminAction(input: { action: string; target_table?: string; target_id?: string; diff?: unknown; ip?: string; user_agent?: string }) → Promise<void>` (service_role insert, `server-only`).

Migration highlights (exact intent): `action_logs(actor_id uuid NULL, action text NOT NULL, target_table text, target_id text, diff jsonb, ip text, user_agent text, source text DEFAULT 'app', created_at)`; `REVOKE ALL` + `FORCE RLS`; policies: INSERT authenticated `WITH CHECK (actor_id = (select auth.uid()))`, SELECT `has_permission('audit.read')`, NO update/delete policies (deny); trigger on `user_roles` after insert/delete auto-logging grant/revoke via `SECURITY DEFINER SET search_path` function; backfill both legacy tables with `source='legacy:admin_audit_log'` / `'legacy:admin_audit_logs'`, `actor_id NULL`.

- [ ] **Step 1:** Write migration.
- [ ] **Step 2:** Write `src/server/admin/audit.ts` (service client from `@/lib/ai/serviceClient` pattern, zod-validated input, never throws to caller — logs to console on failure).
- [ ] **Step 3:** pgTAP: UPDATE/DELETE denied for authenticated, INSERT чужой actor denied, SELECT denied without `audit.read`.
- [ ] **Step 4:** Commit `feat(admin): audit log append-only serveur`.

---

### Task 4: P3 — Guards serveur + APIs admin

**Files:**
- Create: `src/server/admin/requireAdmin.ts`, `src/server/admin/rateLimit.ts` (reuse existing limiter if present in `src/lib`), `src/server/admin/csrf.ts`, `src/server/admin/schemas.ts`
- Create: `src/app/api/admin/users/route.ts`, `src/app/api/admin/users/[id]/role/route.ts`, `src/app/api/admin/audit/route.ts`, `src/app/api/admin/overview/route.ts`
- Modify: `src/app/api/admin/rewards/route.ts` (zod + rate-limit + audit + generic errors)
- Create: `tests/server/admin/requireAdmin.spec.ts`, `tests/server/admin/schemas.spec.ts`

**Interfaces:**
- `requireAdmin(code?: string) → Promise<{ supabase, user }>` — 401 if no user, 403 if `!has_permission(code ?? 'users.read')` (via rpc). Typed, no `any`.
- Every route: `export const dynamic = 'force-dynamic'`, zod `safeParse` → 400, rate-limit fail-closed → 429, `logAdminAction` on writes, catch-all → 500 generic.

- [ ] **Step 1:** Failing vitest for `requireAdmin` (401/403/ok with mocked supabase client).
- [ ] **Step 2:** Implement `requireAdmin` + `schemas` + `audit` wiring.
- [ ] **Step 3:** Implement 4 routes + harden rewards route.
- [ ] **Step 4:** Run `vitest run tests/server/admin` → green.
- [ ] **Step 5:** Commit `feat(admin): guards serveur + APIs users/audit/overview`.

---

### Task 5: P4 — Admin UI from scratch

**Files:**
- Create: `src/app/admin/layout.tsx` (server guard via `requireAdmin`, metadata robots noindex, `DashboardPageLayout` shell)
- Create: `src/app/admin/page.tsx` (server: overview KPIs via `GET`-equivalent server function, links to sections)
- Create: `src/app/admin/utilisateurs/page.tsx`, `src/app/admin/produits/page.tsx`, `src/app/admin/commandes/page.tsx`, `src/app/admin/moderation/page.tsx`, `src/app/admin/recompenses/page.tsx`, `src/app/admin/audit/page.tsx`
- Create: `src/features/admin/` server functions (`getOverview`, `listUsers`, `listOrders`, `listAuditLogs`, `listModerationQueue`) using service_role reads behind `requireAdmin`
- Create: `src/app/api/admin/products/route.ts` (+ `[id]`), `src/app/api/admin/products/upload/route.ts` (storage `product-images` via service_role), reuse `slugify` + CSV export logic copied from legacy (no import from archive)
- Modify: `src/middleware.ts` — none (guard kept as-is)

**Interfaces:** Pages are async Server Components; mutations via `<form action={serverAction}>` or fetch to `/api/admin/*` with CSRF token; every table has `EmptyState` path; every number formatted via existing utils.

- [ ] **Step 1:** layout + overview page (KPIs live: counts products/shop_products canonique `shop_products`, orders, users, pending withdrawals).
- [ ] **Step 2:** users + roles UI (grant/revoke via `users/[id]/role`, expires_at support).
- [ ] **Step 3:** products CRUD + stock movements read + image upload + CSV export.
- [ ] **Step 4:** orders read + moderation queue actions + rewards (finalize/withdrawal via hardened route) + audit log viewer.
- [ ] **Step 5:** `tsc` scoped + manual smoke via `next dev` route check (200 + redirect matrix covered in P6 E2E).
- [ ] **Step 6:** Commit `feat(admin): UI back-office from scratch (zero mock)`.

---

### Task 6: P5 — Durcissements sécurité

**Files:**
- Modify: `src/app/guides/[slug]/GuideDetailClient.tsx` (sanitize `guide.content` with `isomorphic-dompurify` — add dep), `src/app/api/checkout/route.ts` (allowlist same-origin `successUrl/cancelUrl`), `src/app/api/og-preview/route.ts` (auth + rate-limit + `redirect:'manual'` + dns resolve + private-range block incl. IPv6), `src/app/api/indexnow/route.ts` (requireAdmin), `src/app/api/explorer/osm/materialize/route.ts` (requireAdmin OR `CRON_SECRET`; check callers first), `src/app/api/stripe/webhook/route.ts` (remove dummy key, fail-closed 503), `src/lib/supabase/server.ts` (drop forced `SameSite=None`, passthrough options), `next.config.mjs` (CSP enforce, remove Report-Only + `unsafe-inline/unsafe-eval` where feasible)
- Modify: `src/app/api/admin/rewards/route.ts` — done in P3 (rate-limit + audit).

- [ ] **Step 1:** Apply each fix, one file at a time, `tsc` after each.
- [ ] **Step 2:** E2E/security specs for redirect-matrix + og-preview deny (P6).
- [ ] **Step 3:** Commit `fix(security): XSS/CSP/redirects/SSRF/Stripe/cookies hardening`.

---

### Task 7: P6 — Tests + CI gates

**Files:**
- Create: `tests/e2e/admin-access.spec.ts` (anon → `/connexion`, non-admin → `/`, admin → 200; API 401/403 matrix), `tests/server/admin/*.spec.ts` (P3), `supabase/tests/database/admin_*.test.sql` (P1/P2)
- Modify: `.github/workflows/ci.yml` (add `secret-scan` job via `rg`, make `vitest` include new specs automatically), `eslint.config.mjs` (override `no-explicit-any: error` for `src/app/admin/**`, `src/server/admin/**`)

- [ ] **Step 1:** Write E2E + unit specs.
- [ ] **Step 2:** CI job `secret-scan` (rg `sk_live_|whsec_|SERVICE_ROLE` in `src/` → fail).
- [ ] **Step 3:** Run `vitest run tests/server/admin tests/e2e/admin-access` (E2E needs dev server; if unavailable, keep spec + document).
- [ ] **Step 4:** Commit `test(admin): guards/audit/RBAC specs + CI secret-scan`.

---

### Task 8: P7 — Observabilité + vérification finale

- [ ] **Step 1:** Admin audit viewer ships structured fields (actor, action, target, diff, ip) — done in P4; server console `info` on finance actions.
- [ ] **Step 2:** Run `npx tsc --noEmit`, scoped `next lint`, `vitest run`, `next build`.
- [ ] **Step 3:** Final commit + handoff summary with residual risks (MFA mandate, pgTAP opt-in, E2E staging creds).

## Self-Review

- Spec coverage: RBAC (§7) → Task 2; audit trail (§1/§7) → Task 3; API sécurisée (§1) → Task 4; UX/UI (§5) → Task 5 (light Liquid Glass, primitives, responsive, no dark-mode fork day-1 — documented deferral); CI/CD+observabilité (§4) → Tasks 7+8; comparatifs technos (§3) → stack inchangée (Next.js+Supabase, SSO externe différé — justification: `is_admin`+MFA suffisent day-1, Keycloak/Auth0 = lock-in + coût); migration/roadmap (§6) → phased; risques (§8) → Task 6 + guards.
- No placeholders: SQL exact in Task 2; Task 3/4/5 give exact file paths + function signatures + behaviors; tests named with assertions intent.
- Type consistency: `requireAdmin` → `{ supabase, user }`; `logAdminAction` input shape reused in Tasks 3–5; `has_permission(text)` signature stable.

## Résultat d'exécution (2026-10-04, autonome, branche `chantier/admin-rebuild`)

- [x] P0 archive legacy (`archive/admin-legacy-20261004/`, git mv), baseline tsc verte.
- [x] P1 `20261005000000_admin_rbac_core.sql` + pgTAP 16 asserts (validé statiquement ; `supabase db push` + run pgTAP à faire au déploiement).
- [x] P2 `20261005010000_admin_action_logs.sql` + `src/server/admin/audit.ts` + pgTAP 10 asserts.
- [x] P3 `requireAdmin` + zod + CSRF double-submit + 4 APIs + rewards durci ; vitest 17/17.
- [x] P4 UI from scratch (7 pages, 11 îlots, APIs produits/moderation/upload) ; vitest 22/22 ; tsc vert.
- [x] P5 XSS DOMPurify, redirects allowlist, og-preview DNS+redirects, indexnow admin-only, Stripe fail-closed, cookies Lax, CSP enforce, no-store /admin+/api/admin.
- [x] P6 E2E `admin-access.spec.ts` (401/307 live verts sur build frais), Gate 5 étendu, Gate 0.2 secret-scan vert, eslint strict admin (0 erreur).
- [x] P7 `next build` vert ; vitest complet 7373 passés, 5 échecs résiduels pré-existants hors périmètre (registry IA, palette trajectoire, capture n7) + 0 référence au code admin ; TEST-SRV-04 et U-D62 corrigés au passage.
- Preuves live : `GET /api/admin/*` sans session → 401 ; `/admin` sans session → 307 `/connexion` ; prod build frais port 4029.
- Correctifs collatéraux découverts : `withdrawals` → `reward_withdrawals` (legacy cassé), `transaction_type` enum sans accent, colonnes produits limitées au DDL vérifié.
- Risques résiduels assumés : migrations non poussées ( içi `db push` requis), MFA admin non imposée (AAL loggé, à mandater), pgTAP/E2E-staging derrière secrets CI, nonces CSP à venir, colonnes boutique étendues (supplier/ean/tags) exclues v1.
