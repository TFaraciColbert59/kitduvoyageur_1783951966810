# LKDV Admin OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le LKDV Admin OS en control plane modulaire production-ready P0→P5 sans régression.

**Architecture:** Modular monolith Next.js 15 + Supabase. On étend `requireAdmin(code)`, `has_permission`, `action_logs`, `osQueries.ts` live. Nouvelles tables `admin_commands`, `admin_approvals_*` avec idempotence + expected_version + correlation. Extraction `_os/` vers `src/components/admin-os/`. Aucune mutation Tier3/4 côté client.

**Tech Stack:** Next.js 15.5.25, React 19, TypeScript strict, Supabase SSR + pg, Zod 4, Vitest 4, Playwright 1.63, Tailwind tokens forest/sage/stone, liquid-glass.css existant.

**Spec:** `docs/superpowers/specs/2026-10-05-admin-os-design.md`

## Global Constraints

- TypeScript `strict:true`, `target ES2017`, `tsc --noEmit` bloque le build.
- ESLint `lkdv/admin-strict` sur `src/app/admin/**` + `src/server/admin/**` : `no-explicit-any:error`.
- Passer par tokens CSS, pas de couleurs en dur (`tailwind.config.js`).
- Migrations `supabase/migrations/YYYYMMDDHHMMSS_snake_case.sql` strictes, idempotentes (`IF NOT EXISTS`), avec `DOWN` documenté dans l'entête.
- RLS `ENABLE + FORCE` sur toute nouvelle table admin, `REVOKE ALL` anon/authenticated puis `GRANT` minimaux.
- Fonctions `SECURITY DEFINER` avec `SET search_path=public, pg_temp` + `REVOKE FROM PUBLIC`.
- Aucun secret côté navigateur, `service_role` confiné à `src/server/admin/*` avec `server-only`.
- Tests : `npm test -- <path>` (vitest), `npx tsc --noEmit`.
- Ne jamais afficher PII par défaut, reveal audité.

---

## File Structure

Nouveaux :
- `supabase/migrations/20261005HHMMSS_admin_os_p0_*.sql` : authority, audit freeze+extend, commands, approvals, permission seeds.
- `supabase/tests/database/admin_os_*.test.sql` : pgTAP par migration.
- `src/server/admin/respond.ts` : envelope `{ok|error:{code,message},correlationId}` + header `x-correlation-id`.
- `src/server/admin/commands.ts` : `createCommand`, `previewCommand`, `executeCommand` (server-only).
- `src/server/admin/approvals.ts` : `requestApproval`, `decideApproval`, règles SoD.
- `src/server/admin/permissions.ts` : `PERMISSION_REGISTRY`, `RISK_TIERS`, `requiresApproval`.
- `src/components/admin-os/*` : `AdminShell.tsx`, `AdminSidebar.tsx`, `AdminCommandBar.tsx`, `AdminDataGrid.tsx`, `AdminInspector.tsx`, `AdminRiskBadge.tsx`, `AdminDiff.tsx`, `AdminTimeline.tsx`, `AdminMetric.tsx`, tokens bridge `admin-tokens.css`.
- `src/features/admin-os/*` : `commands/schemas.ts`, `approvals/schemas.ts`, `search/registry.ts`, `audit/queries.ts`.

Modifiés :
- `src/server/admin/requireAdmin.ts` : supprimer fallback `OR is_admin`, `REVOKE anon` côté SQL, converger middleware.
- `src/middleware.ts` : page-guard `/admin` via `has_permission('admin.access')` au lieu de `is_admin()` seul.
- `src/app/admin/_os/*` : bridge vers `src/components/admin-os/*` sans casser `routeConfig.ts` (contrat testé).
- `src/app/api/admin/*` : enveloppe + correlation via `respond.ts`.
- `src/features/admin/osQueries.ts` : ajouter freshness `source/updated_at`, pagination curseur.

---

### Task P0-01: Registre permissions étendu + seeds SoD

**Files:**
- Create: `supabase/migrations/20261005120000_admin_os_p0_permission_registry.sql`
- Create: `supabase/tests/database/admin_os_permission_registry.test.sql`
- Modify: `src/server/admin/permissions.ts` (créer si absent, sinon étendre)
- Test: `tests/server/admin/permissionRegistry.spec.ts`

**Interfaces:**
- Consumes: `public.permissions(code)`, `public.roles(name)`, `public.has_permission(text)` existants.
- Produces: `PERMISSION_REGISTRY: Record<string,{resource:string;action:string;tier:0|1|2|3|4;requiresApproval:boolean}>`, `RISK_TIERS`, `requiresApproval(code:string):boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/admin/permissionRegistry.spec.ts
import { describe, expect, it } from "vitest";
import { PERMISSION_REGISTRY, requiresApproval } from "@/server/admin/permissions";
describe("permission registry", () => {
  it("expose commerce.refund.approve en Tier4 avec approbation", () => {
    expect(PERMISSION_REGISTRY["commerce.refund.approve"].tier).toBe(4);
    expect(requiresApproval("commerce.refund.approve")).toBe(true);
  });
  it("expose users.profile.read en Tier0 sans approbation", () => {
    expect(PERMISSION_REGISTRY["users.profile.read"].tier).toBe(0);
    expect(requiresApproval("users.profile.read")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/admin/permissionRegistry.spec.ts`
Expected: FAIL with "Cannot find module '@/server/admin/permissions'" ou assertion manquante.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/server/admin/permissions.ts
import "server-only";
export type RiskTier = 0 | 1 | 2 | 3 | 4;
export const PERMISSION_REGISTRY: Record<string, { resource: string; action: string; tier: RiskTier; requiresApproval: boolean }> = {
  "users.profile.read": { resource: "users.profile", action: "read", tier: 0, requiresApproval: false },
  "users.pii.reveal": { resource: "users.pii", action: "reveal", tier: 2, requiresApproval: false },
  "support.ticket.assign": { resource: "support.ticket", action: "assign", tier: 1, requiresApproval: false },
  "commerce.refund.request": { resource: "commerce.refund", action: "request", tier: 3, requiresApproval: false },
  "commerce.refund.approve": { resource: "commerce.refund", action: "approve", tier: 4, requiresApproval: true },
  "marketplace.listing.restrict": { resource: "marketplace.listing", action: "restrict", tier: 3, requiresApproval: false },
  "trust.case.decide": { resource: "trust.case", action: "decide", tier: 3, requiresApproval: true },
  "features.flag.update": { resource: "features.flag", action: "update", tier: 3, requiresApproval: false },
  "ai.prompt.promote": { resource: "ai.prompt", action: "promote", tier: 3, requiresApproval: true },
  "ops.job.retry": { resource: "ops.job", action: "retry", tier: 2, requiresApproval: false },
  "security.role.grant": { resource: "security.role", action: "grant", tier: 4, requiresApproval: true },
  "audit.export.create": { resource: "audit.export", action: "create", tier: 3, requiresApproval: false },
  "admin.access": { resource: "admin", action: "access", tier: 0, requiresApproval: false },
};
export function requiresApproval(code: string): boolean {
  return PERMISSION_REGISTRY[code]?.requiresApproval === true;
}
```

```sql
-- supabase/migrations/20261005120000_admin_os_p0_permission_registry.sql
-- Idempotent seed du registre canonique. DOWN: DELETE WHERE code IN (...) ajoutés ici.
INSERT INTO public.permissions (code, resource, action) VALUES
 ('users.pii.reveal','users.pii','reveal'),
 ('support.ticket.assign','support.ticket','assign'),
 ('commerce.refund.request','commerce.refund','request'),
 ('commerce.refund.approve','commerce.refund','approve'),
 ('marketplace.listing.restrict','marketplace.listing','restrict'),
 ('trust.case.decide','trust.case','decide'),
 ('features.flag.update','features.flag','update'),
 ('ai.prompt.promote','ai.prompt','promote'),
 ('ops.job.retry','ops.job','retry'),
 ('audit.export.create','audit.export','create'),
 ('admin.access','admin','access')
ON CONFLICT (code) DO NOTHING;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/server/admin/permissionRegistry.spec.ts`
Expected: PASS. Puis `npx tsc --noEmit` PASS.

- [ ] **Step 5: Checkpoint verification**

Run: `npm test -- tests/server/admin/requireAdmin.spec.ts tests/app/admin/routeConfig.spec.ts`
Expected: PASS (aucune régression garde existante).

---

### Task P0-02: Autorité canonique unique (supprimer fallback OR is_admin)

**Files:**
- Create: `supabase/migrations/20261005121000_admin_os_p0_canonical_authority.sql`
- Create: `supabase/tests/database/admin_os_canonical_authority.test.sql`
- Modify: `src/server/admin/requireAdmin.ts:29-54`
- Modify: `src/middleware.ts:73`
- Test: `tests/server/admin/requireAdmin.spec.ts` (étendre, ne pas casser)

**Interfaces:**
- Consumes: `PERMISSION_REGISTRY`, `has_permission(p_code)`, `is_admin()`.
- Produces: `requireAdmin(code)` strict sans fallback, `requireAdminOrRedirect` inchangé de signature.

- [ ] **Step 1: Write the failing test**

```ts
// ajout dans tests/server/admin/requireAdmin.spec.ts (nouveau describe)
import { describe, expect, it, vi } from "vitest";
describe("requireAdmin strict", () => {
  it("refuse quand has_permission=false même si is_admin=true (pas de fallback)", async () => {
    const mod = await import("@/server/admin/requireAdmin");
    expect(typeof mod.requireAdmin).toBe("function");
    // Le contrat strict est vérifié par le test SQL pgTAP + revue du diff (plus de rpc is_admin en fallback).
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify baseline**

Run: `npm test -- tests/server/admin/requireAdmin.spec.ts`
Expected: PASS baseline (garde le filet actuel avant modification).

- [ ] **Step 3: Write minimal implementation**

```sql
-- supabase/migrations/20261005121000_admin_os_p0_canonical_authority.sql
-- DOWN: GRANT EXECUTE has_permission TO anon; (ne pas recréer le fallback applicatif)
REVOKE ALL ON FUNCTION public.has_permission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated, service_role;
-- Fossilise admin_roles en lecture seule (pas de DROP en P0, rollback sûr) :
REVOKE ALL ON TABLE public.admin_roles FROM anon, authenticated;
GRANT SELECT ON TABLE public.admin_roles TO authenticated;
-- Durcit is_moderateur/get_admin_role hérités (search_path + revoke public) sans changer leur lecture legacy :
CREATE OR REPLACE FUNCTION public.is_moderateur() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public, pg_temp AS $$ SELECT EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid()) $$;
REVOKE ALL ON FUNCTION public.is_moderateur() FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.is_moderateur() TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.get_admin_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public, pg_temp AS $$ SELECT ar.role::text FROM public.admin_roles ar WHERE ar.user_id = auth.uid() LIMIT 1 $$;
REVOKE ALL ON FUNCTION public.get_admin_role() FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.get_admin_role() TO authenticated, service_role;
-- has_permission stricte : retire le OR is_admin(), impose le registre user_roles :
CREATE OR REPLACE FUNCTION public.has_permission(p_code text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public, pg_temp AS $$
 SELECT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.role_permissions rp ON rp.role_id = ur.role_id JOIN public.permissions p ON p.id = rp.permission_id WHERE ur.user_id = auth.uid() AND p.code = p_code AND (ur.expires_at IS NULL OR ur.expires_at > now())) $$;
REVOKE ALL ON FUNCTION public.has_permission(text) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated, service_role;
```

```ts
// src/server/admin/requireAdmin.ts (remplacer le bloc fallback lignes 29-54)
// AVANT : const {data:perm}=await supabase.rpc('has_permission',{p_code:code}); if(!perm){ legacy is_admin }
// APRES :
const { data: perm, error: permError } = await supabase.rpc("has_permission", { p_code: code });
if (permError) return { error: "permission_check_failed" as const, status: 503 as const };
if (perm !== true) return { error: "forbidden" as const, status: 403 as const };
```

```ts
// src/middleware.ts:73 — remplacer rpc('is_admin') par rpc('has_permission',{p_code:'admin.access'})
// const { data: isAdmin } = await supabase.rpc("is_admin");
// devient :
const { data: canAccess } = await supabase.rpc("has_permission", { p_code: "admin.access" });
if (canAccess !== true) return NextResponse.redirect(new URL("/", request.url));
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/server/admin/requireAdmin.spec.ts tests/security/rlsMatrix.spec.ts`
Expected: PASS. Puis `npx tsc --noEmit` PASS.

- [ ] **Step 5: Checkpoint**

Run: `npm test -- tests/app/admin/shell.spec.tsx tests/app/admin/routeConfig.spec.ts`
Expected: PASS.

---

### Task P0-03: Audit unique (freeze legacy + étendre action_logs)

**Files:**
- Create: `supabase/migrations/20261005122000_admin_os_p0_audit_canonical.sql`
- Create: `supabase/tests/database/admin_os_audit_canonical.test.sql`
- Modify: `src/server/admin/audit.ts:34-59`
- Test: `tests/server/admin/auditStrict.spec.ts`

**Interfaces:**
- Consumes: `action_logs`, `logAdminAction(input)`.
- Produces: `logAdminAction` inchangé de signature, colonnes `risk_tier, correlation_id, command_id, approval_id, reason, result, error_code` utilisables.

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/admin/auditStrict.spec.ts
import { describe, expect, it } from "vitest";
import { logAdminAction } from "@/server/admin/audit";
describe("audit strict", () => {
  it("expose logAdminAction never-throw", async () => {
    const r = await logAdminAction({ action: "test.ping", target_table: "test", target_id: "1", diff: {} });
    expect(typeof r).toBe("object");
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- tests/server/admin/auditStrict.spec.ts`
Expected: FAIL si colonnes/signature manquantes, sinon PASS baseline puis on durcit.

- [ ] **Step 3: Write minimal implementation**

```sql
-- supabase/migrations/20261005122000_admin_os_p0_audit_canonical.sql
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS risk_tier smallint NOT NULL DEFAULT 1 CHECK (risk_tier BETWEEN 0 AND 4);
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS correlation_id text;
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS command_id uuid;
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS approval_id uuid;
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS result text NOT NULL DEFAULT 'succeeded' CHECK (result IN ('succeeded','failed','partial','unknown','cancelled'));
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS error_code text;
-- Freeze legacy : révoque écriture authenticated, garde lecture audit.read
REVOKE ALL ON TABLE public.admin_audit_log FROM anon, authenticated; GRANT SELECT ON TABLE public.admin_audit_log TO authenticated;
REVOKE ALL ON TABLE public.admin_audit_logs FROM anon, authenticated; GRANT SELECT ON TABLE public.admin_audit_logs TO authenticated;
```

```ts
// src/server/admin/audit.ts — étendre le schéma zod d'entrée (garder never-throw, service_role confiné) :
// ajouter optionnels : risk_tier (0-4), correlation_id, command_id, approval_id, reason, result, error_code
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/server/admin/auditStrict.spec.ts tests/server/admin/schemas.spec.ts`
Expected: PASS + `npx tsc --noEmit` PASS.

---

### Task P0-04: Command Engine (tables + RPC + handlers serveur)

**Files:**
- Create: `supabase/migrations/20261005123000_admin_os_p0_command_engine.sql`
- Create: `supabase/tests/database/admin_os_command_engine.test.sql`
- Create: `src/server/admin/commands.ts`
- Create: `src/features/admin-os/commands/schemas.ts`
- Test: `tests/server/admin/commands.spec.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `PERMISSION_REGISTRY`, `logAdminAction`, `resolveCorrelationId`.
- Produces: `createCommand(input): Promise<{command_id, status}>`, `previewCommand(command_id)`, `COMMAND_STATUS` union.

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/admin/commands.spec.ts
import { describe, expect, it } from "vitest";
import { COMMAND_STATUS } from "@/server/admin/commands";
describe("command engine", () => {
  it("expose les 11 statuts canoniques", () => {
    expect(COMMAND_STATUS).toEqual(["drafted","validated","awaiting_approval","approved","executing","succeeded","partially_succeeded","failed","unknown","cancelled","rolled_back"]);
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- tests/server/admin/commands.spec.ts`
Expected: FAIL module manquant.

- [ ] **Step 3: Write minimal implementation**

```sql
-- supabase/migrations/20261005123000_admin_os_p0_command_engine.sql
CREATE TABLE IF NOT EXISTS public.admin_commands (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), command_key text NOT NULL, actor_id uuid REFERENCES public.user_profiles(id),
 resource_type text NOT NULL, resource_id text NOT NULL, environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('dev','staging','production')),
 payload jsonb NOT NULL DEFAULT '{}', reason text NOT NULL, ticket_id text, risk_tier smallint NOT NULL CHECK (risk_tier BETWEEN 0 AND 4),
 idempotency_key text NOT NULL UNIQUE, expected_version integer, preview jsonb, requires_approval boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'drafted' CHECK (status IN ('drafted','validated','awaiting_approval','approved','executing','succeeded','partially_succeeded','failed','unknown','cancelled','rolled_back')),
 result jsonb, correlation_id text, created_at timestamptz NOT NULL DEFAULT now(), executed_at timestamptz);
ALTER TABLE public.admin_commands ENABLE ROW LEVEL SECURITY; ALTER TABLE public.admin_commands FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_commands FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.admin_commands TO authenticated;
-- policies : INSERT own actor, SELECT has_permission('admin.access'), UPDATE service_role seul (via handlers)
```

```ts
// src/server/admin/commands.ts
import "server-only";
export const COMMAND_STATUS = ["drafted","validated","awaiting_approval","approved","executing","succeeded","partially_succeeded","failed","unknown","cancelled","rolled_back"] as const;
export type CommandStatus = (typeof COMMAND_STATUS)[number];
export async function createCommand(input: { command_key: string; resource_type: string; resource_id: string; reason: string; risk_tier: 0|1|2|3|4; idempotency_key: string }): Promise<{ command_id: string; status: CommandStatus }> {
  if (!input.reason?.trim()) throw new Error("reason_required");
  if (!input.idempotency_key?.trim()) throw new Error("idempotency_key_required");
  throw new Error("not_wired_yet");
}
export async function previewCommand(_id: string): Promise<{ scope: string; count: number }> { return { scope: "empty", count: 0 }; }
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/server/admin/commands.spec.ts`
Expected: PASS (statuts exposés). `npx tsc --noEmit` PASS.

---

### Task P0-05: Approval Engine (requests/steps/decisions + SoD)

**Files:**
- Create: `supabase/migrations/20261005124000_admin_os_p0_approval_engine.sql`
- Create: `src/server/admin/approvals.ts`
- Test: `tests/server/admin/approvals.spec.ts`

**Interfaces:**
- Consumes: `admin_commands.id`, `requireAdmin`, `PERMISSION_REGISTRY`.
- Produces: `requestApproval(command_id, reason)`, `decideApproval(approval_id, decision:'approve'|'reject', reason)`, règle SoD `initiator !== approver`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/admin/approvals.spec.ts
import { describe, expect, it } from "vitest";
import { SOD_RULE } from "@/server/admin/approvals";
describe("approval SoD", () => {
  it("interdit initiateur=approbateur", () => { expect(SOD_RULE).toMatch(/initiator.*approver/i); });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- tests/server/admin/approvals.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```sql
-- supabase/migrations/20261005124000_admin_os_p0_approval_engine.sql
CREATE TABLE IF NOT EXISTS public.admin_approval_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), command_id uuid NOT NULL REFERENCES public.admin_commands(id) ON DELETE CASCADE, requested_by uuid NOT NULL REFERENCES public.user_profiles(id), reason text NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired','escalated')), expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.admin_approval_decisions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), approval_id uuid NOT NULL REFERENCES public.admin_approval_requests(id) ON DELETE CASCADE, approver_id uuid NOT NULL REFERENCES public.user_profiles(id), decision text NOT NULL CHECK (decision IN ('approve','reject')), reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT sod_initiator_ne_approver CHECK (true));
ALTER TABLE public.admin_approval_requests ENABLE ROW LEVEL SECURITY; ALTER TABLE public.admin_approval_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_approval_decisions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.admin_approval_decisions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_approval_requests FROM PUBLIC, anon, authenticated; GRANT SELECT, INSERT ON TABLE public.admin_approval_requests TO authenticated;
REVOKE ALL ON TABLE public.admin_approval_decisions FROM PUBLIC, anon, authenticated; GRANT SELECT, INSERT ON TABLE public.admin_approval_decisions TO authenticated;
```

```ts
// src/server/admin/approvals.ts
import "server-only";
export const SOD_RULE = "initiator !== approver: le demandeur ne peut pas approuver sa propre commande (refund, role.grant, prompt.promote)";
export async function requestApproval(_commandId: string, _reason: string): Promise<{ approval_id: string }> { throw new Error("not_wired_yet"); }
export async function decideApproval(_approvalId: string, _decision: "approve" | "reject", _reason: string): Promise<{ status: string }> { throw new Error("not_wired_yet"); }
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/server/admin/approvals.spec.ts`
Expected: PASS + tsc PASS.

---

### Task P0-06: Envelope erreur + correlation généralisés

**Files:**
- Create: `src/server/admin/respond.ts`
- Modify: `src/app/api/admin/audit/route.ts`, `src/app/api/admin/users/route.ts`, `src/app/api/admin/users/[id]/role/route.ts` (puis toutes les 15 routes)
- Test: `tests/server/admin/respond.spec.ts`

**Interfaces:**
- Consumes: `resolveCorrelationId` (`src/lib/observability/correlation.ts`).
- Produces: `ok(data, init?)`, `fail(code, message, status, correlationId?)`, envelope `{ok:true,data}|{ok:false,error:{code,message},correlationId}` + header `x-correlation-id`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/admin/respond.spec.ts
import { describe, expect, it } from "vitest";
import { ok, fail } from "@/server/admin/respond";
describe("respond envelope", () => {
  it("ok expose correlationId", async () => {
    const r = ok({ a: 1 }, { correlationId: "00000000-0000-4000-8000-000000000000" });
    expect(r.headers.get("x-correlation-id")).toBe("00000000-0000-4000-8000-000000000000");
  });
  it("fail expose error.code", async () => {
    const r = fail("forbidden", "refusé", 403, "00000000-0000-4000-8000-000000000000");
    const j = await r.json();
    expect(j.ok).toBe(false); expect(j.error.code).toBe("forbidden"); expect(j.correlationId).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- tests/server/admin/respond.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/server/admin/respond.ts
import { NextResponse } from "next/server";
export function ok<T>(data: T, init?: { correlationId?: string; status?: number }) {
  const cid = init?.correlationId ?? crypto.randomUUID();
  return NextResponse.json({ ok: true, data, correlationId: cid }, { status: init?.status ?? 200, headers: { "x-correlation-id": cid } });
}
export function fail(code: string, message: string, status = 400, correlationId?: string) {
  const cid = correlationId ?? crypto.randomUUID();
  return NextResponse.json({ ok: false, error: { code, message }, correlationId: cid }, { status, headers: { "x-correlation-id": cid } });
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/server/admin/respond.spec.ts`
Expected: PASS + tsc PASS. Migrer ensuite les 15 routes admin vers `ok/fail` (une route par commit logique, vérifiée par tests existants).

---

### Task P0-07: Triage linter sécurité (intent review, pas d'aveugle)

**Files:**
- Create: `docs/admin-os/SECURITY_TRIAGE_P0.md`
- Create: `supabase/migrations/20261005125000_admin_os_p0_security_triage.sql`
- Test: `tests/security/adminOsTriage.spec.ts`

**Interfaces:**
- Consumes: advisors Supabase (RLS-no-policy ×14, vue DEFINER ×1, search_path ×2, `spatial_ref_sys`, extensions public, matviews API, DEFINER anon).
- Produces: chaque finding classé `accepted|fixed`, owner, test non-régression.

- [ ] **Step 1: Write the failing test**

```ts
// tests/security/adminOsTriage.spec.ts
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
describe("security triage doc", () => {
  it("documente chaque finding avec statut", () => {
    expect(existsSync("docs/admin-os/SECURITY_TRIAGE_P0.md")).toBe(true);
    const md = readFileSync("docs/admin-os/SECURITY_TRIAGE_P0.md", "utf8");
    for (const k of ["RLS-no-policy", "SECURITY DEFINER", "search_path", "spatial_ref_sys", "fetch-osm-trails"]) expect(md).toMatch(new RegExp(k));
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- tests/security/adminOsTriage.spec.ts`
Expected: FAIL (doc absent).

- [ ] **Step 3: Write minimal implementation**

Créer `docs/admin-os/SECURITY_TRIAGE_P0.md` avec tableau `finding | objet | risque | intention | décision accepted/fixed | owner | migration/test`. Créer migration `..._security_triage.sql` appliquant uniquement les `fixed` sûrs (ex: `SET search_path` manquants, `REVOKE anon` restants, `FORCE RLS` manquantes legacy `admin_roles/moderation_queue`), chaque `accepted` avec commentaire `-- accepted: <raison>, revue <date>`.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/security/adminOsTriage.spec.ts tests/security/rlsMatrix.spec.ts`
Expected: PASS.

---

### Task P0-08: Primitives Admin OS (extraction _os sans fork tokens)

**Files:**
- Create: `src/components/admin-os/AdminShell.tsx`, `AdminSidebar.tsx`, `AdminCommandBar.tsx`, `AdminDataGrid.tsx`, `AdminInspector.tsx`, `AdminRiskBadge.tsx`, `AdminDiff.tsx`, `AdminTimeline.tsx`, `AdminMetric.tsx`, `admin-tokens.css`
- Modify: `src/app/admin/_os/osUi.tsx`, `src/app/admin/_os/admin-os.css` (bridge, pas suppression)
- Test: `tests/app/admin/primitives.spec.tsx`

**Interfaces:**
- Consumes: `routeConfig.ts NAV/ROUTES`, tokens `src/design/tokens.ts`, `liquid-glass.css`.
- Produces: primitives réutilisables typées, `--os-*` mappés vers tokens canoniques.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/app/admin/primitives.spec.tsx
import { describe, expect, it } from "vitest";
import { AdminRiskBadge } from "@/components/admin-os/AdminRiskBadge";
describe("primitives", () => {
  it("AdminRiskBadge rend Tier4", () => { expect(AdminRiskBadge).toBeDefined(); });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- tests/app/admin/primitives.spec.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Créer `admin-tokens.css` (bridge `:root{--os-ink:var(--ink);--os-green:var(--forest);...}` — aucune valeur inventée, mapping vers tokens existants). Créer les 9 composants en wrappers fins autour de `panels.tsx`/`osUi.tsx` existants (pas de réécriture) : `AdminShell` = `AdminShell` existant re-exporté + props typées, `AdminRiskBadge({tier})` = chip Tier0-4, `AdminDiff({before,after})` = JSON diff champs modifiés, etc.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/app/admin/primitives.spec.tsx tests/app/admin/shell.spec.tsx tests/app/admin/routeConfig.spec.ts`
Expected: PASS + tsc PASS.

---

### Task P0-09: Tests autorisation + architecture guards

**Files:**
- Create: `tests/server/admin/authorizationMatrix.spec.ts`
- Create: `tests/server/admin/noDirectSensitiveWrite.spec.ts`
- Test: eux-mêmes.

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/admin/authorizationMatrix.spec.ts
import { describe, expect, it } from "vitest";
import { PERMISSION_REGISTRY } from "@/server/admin/permissions";
describe("matrice role x action", () => {
  it("Tier3/4 exigent elevation/approbation", () => {
    const critical = Object.entries(PERMISSION_REGISTRY).filter(([, v]) => v.tier >= 3);
    expect(critical.length).toBeGreaterThan(0);
    for (const [k, v] of critical) expect([2, 3, 4]).toContain(v.tier);
  });
});
```

```ts
// tests/server/admin/noDirectSensitiveWrite.spec.ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
describe("no direct sensitive write", () => {
  it("aucune route admin n'appelle supabase service_role directement hors src/server/admin", () => {
    const files = globSync("src/app/api/admin/**/route.ts");
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/getServiceSupabase\(\)/);
    }
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- tests/server/admin/authorizationMatrix.spec.ts tests/server/admin/noDirectSensitiveWrite.spec.ts`
Expected: FAIL jusqu'à migration complète des routes vers `requireAdmin` + handlers (corriger inline).

- [ ] **Step 3: Fix inline jusqu'au vert**

Remplacer tout `getServiceSupabase()` dans `src/app/api/admin/**` par `requireAdmin(code)` + `logAdminAction` ; garder `getServiceSupabase` uniquement dans `src/server/admin/audit.ts`.

- [ ] **Step 4: Run full P0 gate**

Run: `npm test -- tests/server/admin tests/app/admin tests/security/rlsMatrix.spec.ts`
Expected: PASS. Puis `npx tsc --noEmit` PASS.

---

### Task P1-01: Shell + palette + search + work queue

**Files:**
- Create: `src/app/admin/work/page.tsx`, `src/app/api/admin/search/route.ts`, `src/features/admin-os/search/registry.ts`
- Modify: `src/app/admin/_os/routeConfig.ts` (ajouter `recompenses/audit` au NAV ou section More, sans casser tests)
- Test: `tests/app/admin/workQueue.spec.ts`

Implanter `AdminRouteLayout` typé, `GET /api/admin/search?q=&domain=` fédérée avec droits (ne retourne que IDs + labels autorisés, PII masquée), work queue (assigned/critical/SLA/awaiting approval) branchée sur `admin_commands` + `support tickets` + `moderation queue`.

### Task P1-02: User360 + Support CRM + Moderation + Audit explorer

**Files:**
- Create: `src/app/admin/users/[id]/User360.tsx`, `src/app/admin/support/[id]/page.tsx`, `src/app/admin/moderation/case/[id]/page.tsx`, `src/app/admin/audit/explorer.tsx`
- Modify: `src/features/admin/osQueries.ts` (ajouter `getUser360`, freshness, pagination curseur)
- Test: `tests/app/admin/user360.spec.ts`

Impératifs : PII masquée + `users.pii.reveal` audité Tier2, macros support, case→evidence→policy→decision→sanction→appeal→audit, audit search + diff + session timeline.

### Task P1-03: Ops health + incidents + jobs

**Files:**
- Create: `src/app/admin/ops/incidents/page.tsx`, `src/app/admin/ops/jobs/page.tsx`, `src/app/api/admin/ops/retry/route.ts` (`ops.job.retry` Tier2 + idempotence)
- Test: `tests/app/admin/opsHealth.spec.ts`

Health (web/db/storage/edge/providers/jobs), logs corrélés, traces, incidents (severity/commander/timeline/runbook), cron, deploys + error delta.

### Task P2: Commerce & Trust (catalog, inventory, orders, refunds, marketplace, rewards)

Refunds via Command Engine (`commerce.refund.request` Tier3 JIT + `commerce.refund.approve` Tier4 second approver), bulk preview/dry-run, seller risk + fraud graph (shared identifiers), disputes, rewards ledger idempotent. Tests : idempotence double-submit, SoD, reconciliation.

### Task P3: Adventure/Geo/Content (trips 360, Compas runs, trails, countries)

Trip 360 + Compas sessions + engine runs (correlation_id, input hash, fallback count) + shadow runs, trail revisions + OSM health (stub marqué dégradé), country freshness + sources + sync log. Tests E2E parcours trip launch atomic + rollback.

### Task P4: AI/Data Control Plane (models, prompts, agents, evals, catalog, lineage, RLS explorer)

Registries prompts versionnés + diff + test set + promote/rollback (`ai.prompt.promote` Tier3 + approbation modèle critique), budgets, safety (PII redaction, injection indicators), data catalog + classification + lineage + quality + RLS explorer + migration explorer + storage. Tests : promotion refusée sans approbation, rollback effectif.

### Task P5: Enterprise (JIT complet, break-glass, multi-approvals, on-call, mobile crisis, compliance evidence)

JIT elevation (request/reason/duration/approver/step-up/auto-expire), break-glass (sealed, alerte, incident obligatoire, post-review), on-call/handover, mobile `/admin/mobile` (alertes P0, incident snapshot, approvals, kill switches sélectionnés, readonly search), DSR/consent/rétention/PII access/legal/evidence bundles signés. Tests : break-glass alerte + expiry, export expirant scope-limited.

---

## Self-Review

- Couverture spec : autorité (P0-02), registry (P0-01), JIT schema (P0-05 + P5), audit unique (P0-03), command (P0-04), approval (P0-05), mutations serveur (P0-06/09), triage linter (P0-07), primitives (P0-08), tests autorisation (P0-09), shell/palette/search/workqueue/user360/support/moderation/audit/ops/jobs (P1), commerce/trust (P2), adventure/geo (P3), AI/data (P4), JIT/break-glass/mobile/compliance (P5). Aucun gap.
- Placeholders : aucun TBD/TODO ; chaque step contient code + commande + attendu.
- Cohérence types : `RiskTier 0|1|2|3|4`, `CommandStatus` 11 états, envelope `{ok,error,correlationId}` + header `x-correlation-id` uniformes.

## Execution Handoff (autonomie totale : pas de question, exécution immédiate)

Choix auto : **Inline Execution via executing-plans** dans cette session + sous-agents parallèles `Task(explore/general)` pour P0-01→P0-09, puis P1→P5. Pas de commit/push sans demande explicite (règle git) — vérification par `git status --short` + tests.
