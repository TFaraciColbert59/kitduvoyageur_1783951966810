# Admin OS Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/admin` frontend in the MagicPath « Admin OS Liquid Glass V2 » language, wired to real data.

**Architecture:** Server-guarded layout fetches nav badges + account, renders client shell (sidebar/topbar/island/palette). Each `/admin/*` page is an async Server Component rendering hero + KPI + workspace from `osQueries.ts` (RLS user client), with existing client islands (RoleManager, ProductEditor…) reused inside panels.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, `@/design` primitives, scoped `admin-os.css`, Supabase RLS reads.

**Spec:** `docs/superpowers/specs/2026-10-04-admin-os-design.md` + MagicPath TSX (`C:/Users/Tony/AppData/Local/Temp/opencode/admin-os.tsx`) + preview (`admin-os-preview.png` même dossier).

## Global Constraints

- RLS obligatoire, lectures via client appelant après `requireAdminOrRedirect`.
- Zéro donnée mock/fictive dans le livré ; delta masqué si incalculable.
- Zéro hex en dur ; couleurs via `var(--lkv-*)` ou variables `.admin-os`.
- Aucun `<button>`/`<input>` brut (Button, AdminInput/AdminField, ou classes shell).
- `no-explicit-any: error` sur `src/app/admin/**`.
- `export const dynamic = 'force-dynamic'` sur les routes API ; pages serveur dynamiques par défaut via-guards.
- Fond `/assets/images/app-background.jpg` (valider visuellement, sinon gradient).

---

### Task 1: Shell + tokens + Symbol

**Files:**
- Create: `src/app/admin/_os/admin-os.css`
- Create: `src/app/admin/_os/Symbol.tsx`
- Create: `src/app/admin/_os/routeConfig.ts`
- Create: `src/app/admin/_os/AdminShell.tsx`
- Create: `src/app/admin/_os/Topbar.tsx`
- Create: `src/app/admin/_os/CommandPalette.tsx`
- Create: `src/app/admin/_os/DynamicIsland.tsx`
- Create: `src/app/admin/_os/Inspector.tsx`
- Create: `tests/app/admin/routeConfig.spec.ts`
- Modify: `src/app/admin/layout.tsx` (guard + badges + shell + bg)

**Interfaces:**
- Consumes: `requireAdminOrRedirect` (queries.ts), `getSsoProviders` non (rien).
- Produces: `NAV: {id,label,icon,badge?,href}[]`, `Symbol({name,size})`, `AdminShell({badges,account,children})`, `OsMetric{label,value,delta?,icon,tone?}`, `OsRow{title,detail,value,tone}`, `InspectorContent{title,subtitle,headline,text,rows}`.

- [ ] **Step 1: Symbol.tsx** — recopier les 24 paths exacts du TSX source (stroke 1.8/round, viewBox 24). Props `{name: IconName; size?: number}` (défaut 17).
- [ ] **Step 2: admin-os.css** — variables `.admin-os` (4 verres, scrim, chip, tons good/info/warn/danger), layout sidebar 280px / main fluide / inspector 340px, responsive `<lg` (sidebar overlay + bouton hamburger dans Topbar), focus visibles.
- [ ] **Step 3: routeConfig.ts** — `NAV` 11 items (10 design + securite), types `OsMetric/OsRow/InspectorContent`, copy statique eyebrow/title/subtitle/cta{label,href} par route reprise du TSX (overview CTA « Exporter le rapport »).
- [ ] **Step 4: AdminShell + Topbar + CommandPalette + DynamicIsland + Inspector** — shell client : sidebar (brand, env pill → ouvre palette, nav avec badges, account réel), topbar (breadcrumb, search → palette, outdoor toggle, notif dot si inbox>0, inspector toggle), palette (⌘K/Ctrl+K, esc, filtre nav+actions), island (props `primaryCount/label`), inspector (props content + onClose).
- [ ] **Step 5: spec routeConfig** — NAV ids == dossiers `/admin/*` existants ; chaque route a eyebrow/title/subtitle/cta ; Symbol names utilisés ∈ set.
- [ ] **Step 6: layout.tsx** — guard, `getNavBadges()` (modération pending, inbox, degraded), account (profil + rôle + MFA bool via listFactors), fond bg + shell. Run: `vitest run tests/app/admin` → PASS. Commit.

### Task 2: Data layer OS + Overview

**Files:**
- Create: `src/features/admin/osQueries.ts`
- Create: `src/app/admin/_os/MetricGrid.tsx`, `SectionPanels.tsx` (présentationnels serveur)
- Modify: `src/app/admin/page.tsx` (rewrite Mission Control)
- Test: `tests/features/admin/osQueries.spec.ts` (mappeurs purs uniquement)

**Interfaces:**
- Consumes: queries existantes + supabase user client.
- Produces: `getPriorityQueue(): OsRow[]` (modération P0 récents, retraits pending, stocks bas), `getCopilotSignal(): InspectorContent` (top signal réel), `getNavBadges(): {community,support,system}`, `getAccountBadge(): {initials,name,role,mfa}`.

- [ ] **Step 1: osQueries.ts** — priority queue (UNION logique en 3 requêtes limitées, tri criticité), copilot signal (1er item critique ou état nominal honnête « File nominale »), badges (counts), account (profil + rôle + `mfa.listFactors` bool).
- [ ] **Step 2: overview page** — hero (Bonsoir + prénom réel), pills période (filtrent audit/orders via searchParams `from/to`), MetricGrid 4 KPI réels, SectionPanels (Live Pulse table réelle + Priority Queue filtrable), Inspector (copilot signal), island (counts).
- [ ] **Step 3: spec mappeurs** — tone mapping, priorité tri, fallback nominal. Run vitest → PASS. Commit.

### Task 3: Migration des 7 sections existantes

**Files:** Modify: `utilisateurs/page.tsx`, `produits/page.tsx`, `produits/[id]/page.tsx`, `produits/nouveau/page.tsx`, `commandes/page.tsx`, `moderation/page.tsx`, `recompenses/page.tsx`, `audit/page.tsx`, `securite/page.tsx` + îlot `ReportButton.tsx` (export CSV générique via APIs existantes).

**Interfaces:** Consumes: Task 1 shell + Task 2 patterns. Produces: pages au format hero/metrics/workspace.

- [ ] **Step 1:** Convertir chaque page : hero (copy routeConfig), KPI (données existantes), workspace (contenu actuel encapsulé en `data-panel`), inspector contextuel (ex. utilisateurs → riskiest user trust min ; produits → lowest stock ; moderation → oldest P0).
- [ ] **Step 2: ReportButton** — props `{endpoint, filename, mapRow}` ; fetch paginé + CSV + download (généralise CsvExportButton, qui reste pour compatibilité ou est remplacé).
- [ ] **Step 3:** tsc + vitest scope. Commit.

### Task 4: Nouvelles sections (community, compas, analytics, system, support)

**Files:**
- Create: `src/app/admin/communaute/page.tsx`, `compas/page.tsx`, `analytics/page.tsx`, `systeme/page.tsx`, `support/page.tsx`
- Modify: `src/features/admin/osQueries.ts` (add getters), `src/app/api/admin/*` si besoin lecture (réutiliser patterns existants)
- Modify: `supabase/migrations/20261005030000_admin_os_support_view.sql` SI besoin (vue `support_inbox` matérialisée ? préférer requêtes directes — pas de migration sauf nécessité prouvée)

**Interfaces:** Produces: `getCommunityStats`, `getCompasStats` (vérifier DDL `trips` d'abord — si vide, section = états EmptyState honnêtes + lien doc), `getAnalytics` (funnel documenté), `getSystemStatus` (ping DB `select 1` timing, version `package.json`, présence clés redacted via `!!process.env.X`), `getSupportInbox`.

- [ ] **Step 1:** Vérifier DDL trips + vues matérialisées existantes ; écrire getters.
- [ ] **Step 2:** 5 pages au format shell, EmptyState partout où vide.
- [ ] **Step 3:** E2E `admin-access.spec.ts` : ajouter les 5 routes à la matrice 401/307. Run ciblé via serveur prod local (pattern `next start -p 4029` + `PW_BASE_URL`). Commit.

### Task 5: Finitions interactives

**Files:** Modify shell + pages : period `Personnaliser` (2 date inputs → from/to), inspector actions (Ajouter une note → logAdminAction via `/api/admin/audit`? — définir `POST /api/admin/notes` minimal RLS own + lecture audit ; Ouvrir → lien section), outdoor toggle (classe `.outdoor` scrim renforcé), notif dot → lien support.

- [ ] **Step 1:** Personnaliser + notes API + route.
- [ ] **Step 2:** eslint scope + tsc. Commit.

### Task 6: Vérification finale

- [ ] **Step 1:** `npx tsc --noEmit` → 0 erreur.
- [ ] **Step 2:** `npx vitest run tests/app/admin tests/features/admin tests/server/admin tests/lib` → vert.
- [ ] **Step 3:** `npm run build` → vert, static/SSG préservés hors admin.
- [ ] **Step 4:** E2E `@local-web` sur build frais (pattern 4029) → vert.
- [ ] **Step 5:** Screenshots Playwright desktop 1440 + mobile 390 de `/admin` (comparer au preview), corriger les écarts bloquants.
- [ ] **Step 6:** Commit final + rapport.

## Self-Review

- Spec coverage: shell Task 1 ; données réelles Task 2/4 ; migration Task 3 ; interactions Task 5 ; vérification Task 6. CTA IA → rapport couvert Task 3 Step 2. Badges Task 2. Compte sidebar Task 1 Step 6.
- No placeholders: fichiers/sections/composants exacts ; copy source = TSX+spec.
- Type consistency: `OsMetric/OsRow/InspectorContent` définis Task 1, consommés Task 2-4 ; `requireAdminOrRedirect` existant réutilisé.
