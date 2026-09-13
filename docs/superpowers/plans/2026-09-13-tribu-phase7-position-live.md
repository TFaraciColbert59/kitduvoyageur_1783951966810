# TRIBU Phase 7 — Position live — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Partage de position opt-in par session de groupe, visible uniquement des membres, indicateur permanent, arrêt 1 tap, expiration automatique, zéro historique.

**Architecture:** Deux tables (`group_live_sessions`, `group_live_positions`) + RLS stricte, actions serveur avec erreurs visibles, hook de partage throttlé 45 s, panneau de consentement dans `/hub/groupe`, couche avatars dans `UnifiedExplorerMap`, cron de purge.

**Tech Stack:** Postgres 17/Supabase (RLS, pgTAP local), Next.js 15 App Router, Zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-13-tribu-phase7-position-live-design.md`

## Global Constraints

- WIP propriétaire jamais stagé (`src/app/hub/[section]/page.tsx`, `HubRealtimeRefresh.tsx`, captures) ; staging explicite.
- Gardes design : tokens `--lkv-*` + `.glass*`, interdits `red-*`(hors token danger existant)/`rose-*`/`sand-*`/`forest-*`/hex bruts nouveaux (H-D85 R1/R2).
- TRIBU-R4/R6 : jamais de partage par défaut, jamais silencieux, suppressions automatiques par cron uniquement.
- Gates par task : `npx tsc --noEmit` 0 ; `npx vitest run` ; `npm run lint` 0 erreur ; harness `install`/`upgrade` pour les migrations.
- Un commit par task.

---

## Section 1 — Données

### Task 1: M12 sessions live + M13 positions + pgTAP

**Files:**
- Create: `supabase/migrations/20260913200000_tribu_live_sessions.sql`
- Create: `supabase/migrations/20260913210000_tribu_live_positions.sql`
- Test: `supabase/tests/database/tribu_live.test.sql`

- [ ] **Step 1: Test rouge** — fixtures A (organizer), B (member), X (non-membre) ; session ouverte S (A). Assertions : B lit la session, X non ; B insère sa position ; B ne peut pas écrire pour A (42501) ; non-membre ne lit pas les positions ; position expirée invisible ; session expirée rend les positions invisibles ; DELETE self OK ; contraintes lat 999 → 23514 ; durée 100 h → 23514 ; deuxième session ouverte → 23505 (index partiel). Run harness → FAIL.
- [ ] **Step 2: Implémenter** M12 puis M13 (SQL du spec §2).
- [ ] **Step 3: Run PASS** — harness `-Mode upgrade` (TAP complet vert).
- [ ] **Step 4: Commit** — `feat(tribu-live): sessions et positions live (RLS stricte, zero historique)`

### Task 2: Actions consentement

**Files:**
- Create: `src/features/tribu/actions/livePosition.ts`
- Test: `tests/tribu/live-position-action.spec.ts`

**Interfaces:**
- `startLiveSession({ groupId, durationHours })`, `stopLiveSession({ sessionId })`, `sharePosition(input)`, `stopSharingPosition({ sessionId })`, `getLiveState(groupId)`.

- [ ] **Step 1: Tests rouges** — session : bornes 1-72 h, refus si session ouverte, fermeture des expirées avant insert ; share : refus session fermée/expirée, `expires_at ≈ now+15 min`, upsert payload ; stopSharing delete self ; getLiveState mappe noms `public_profiles` ; auth requise partout.
- [ ] **Step 2: Implémenter** (Zod, erreurs visibles, jamais de succès partiel silencieux).
- [ ] **Step 3: Run PASS** + `tsc`.
- [ ] **Step 4: Commit** — `feat(tribu-live): actions de session et de partage (erreurs visibles)`

---

## Section 2 — UI consentement

### Task 3: Panneau hub + hook de partage

**Files:**
- Create: `src/features/tribu/components/LiveSharePanel.tsx`
- Create: `src/features/tribu/hooks/useLivePositionSharing.ts`
- Modify: `src/features/hub/components/collectif/HubGroupeCockpit.tsx` (desktop, après le badge éphémère)
- Modify: `src/features/hub/components/mobile/groupe/GroupeMobileExperience.tsx` (mobile)
- Test: `tests/tribu/live-share-panel.spec.tsx`

- [ ] **Step 1: Tests rouges** — sans session : bouton démarrer + copie consentement + durées ; avec session : indicateur permanent + compte à rebours + toggle partage + arrêt ; organisateur voit « Clôturer ».
- [ ] **Step 2: Implémenter** le panneau (tokens design) + hook (watchPosition throttlé 45 s, arrêt sur off/erreurs ×3/démontage, haptique).
- [ ] **Step 3: Run PASS** + `tsc` + lint.
- [ ] **Step 4: Commit** — `feat(tribu-live): panneau de consentement et partage opt-in dans le hub`

---

## Section 3 — Carte & realtime

### Task 4: Couche avatars + Realtime Explorer

**Files:**
- Modify: `src/components/map/UnifiedExplorerMap.tsx` (prop `memberPositions` + source/couche avatars)
- Modify: `src/components/explorer/ExplorerClient.tsx` (fetch `getLiveState` si aventure collectif, canal Realtime `group-live-{id}`, badge + arrêt 1 tap)
- Test: `tests/tribu/live-map-layer.spec.tsx` (markup/props) 

- [ ] **Step 1: Test rouge** — la carte rend un marqueur par membre (markup dataset), absent sans prop.
- [ ] **Step 2: Implémenter** source GeoJSON + couche symbol (initiale), realtime + refresh 60 s, badge « Positions du groupe ».
- [ ] **Step 3: Run PASS** + e2e explorateur non régressé (specs atlas).
- [ ] **Step 4: Commit** — `feat(tribu-live): couche membres sur la carte et diffusion temps reel`

### Task 5: Cron d'expiration

**Files:**
- Create: `src/app/api/cron/expire-live-positions/route.ts`
- Test: `tests/tribu/expire-live-positions.spec.ts`

- [ ] **Step 1: Test rouge** — 401/503 ; purge positions expirées uniquement ; fermeture sessions expirées uniquement.
- [ ] **Step 2: Implémenter** (pattern `cleanup-ephemeral-groups`, filtres re-vérifiés).
- [ ] **Step 3: Run PASS**.
- [ ] **Step 4: Commit** — `feat(tribu-live): cron d'expiration des positions et sessions`

---

## Section 4 — Clôture

### Task 6: Revue sécurité + gates + prod + merge

**Files:**
- Modify: `MISSION_LOG.md` · Create: `docs/tribu/rapport-phase7.md`

- [ ] **Step 1** — `silent-failure-hunter` sur les actions + hook + carte (aucune fuite, aucun faux « actif ») ; corriger.
- [ ] **Step 2** — Gates : `tsc`, `lint`, `vitest` complet, `build`, harness install+upgrade, e2e preparer/depart/atlas + garde design.
- [ ] **Step 3** — `npx supabase db push --linked` + vérif service-role (tables, RLS on, cron).
- [ ] **Step 4** — Rapport + MISSION_LOG ; merge `--no-ff` sur `main` ; push.
