# Compte — bootstrap réel des drawers

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Le Compte authentifié lit le profil, les carnets, les sorties, les commandes, les notifications, les follows et les clubs depuis Supabase, sans casser la coque v21.

**Architecture:** Une route serveur `/api/compte/bootstrap` renvoie un JSON déjà mappé sur les formes du runtime. Le composant le récupère après l'init et déclenche l'action `hydrate`; le runtime remplace les tableaux mock et re-rend. Les invités gardent l'état actuel.

**Tech Stack:** Next.js 15 route handler, Supabase server/client, runtime DOM, Vitest.

**Spec:** `docs/superpowers/plans/2026-10-21-compte-worldwide-audit.md` §6 Vague 3.

## Global Constraints

- Aucune modification dans `src/app/compas/**` ni `src/features/compas/**`.
- Le visuel v21 ne change pas.
- Auth absente → aucune requête, aucun remplacement.
- Données réelles vides → états vides, jamais de fallback mock.
- `npx vitest run tests/design/` reste vert ; `tsc` 0 ; build 0.
- Les identifiants publics utilisent `user_profiles.handle` (ajouté en base).

### Task 1: Route bootstrap

**Files:** `src/app/api/compte/bootstrap/route.ts`, `src/lib/queries/publicProfilesCore.ts`.

- [ ] Route GET auth-aware, `runtime='nodejs'`, `dynamic='force-dynamic'`.
- [ ] Lit `user_profiles` (self), `carnets` (author_id self), `hike_sessions` (user_id self), `orders`+`order_items`, `notifications` (20), `user_follows` + `public_profiles`, `club_members` + `clubs`.
- [ ] Renvoie `{ authenticated, profile, carnets, outings, orders, bookings, notifications, tribu, clubs }` avec les formes exactes du runtime (voir rapport d'audit).
- [ ] `publicProfilesCore` ajoute `handle` au type et au SELECT.
- [ ] Tests unitaires de mapping avec des fixtures.

### Task 2: Hydratation runtime

**Files:** runtime + `CompteLiquidGlassV8.tsx`.

- [ ] `case "hydrate"` : remplace `OUTINGS`, `CARNETS`, `ORDERS`, `ORDERS_BOOKINGS`, `TRIBU`, `CLUBS`, `S.profile`, puis `renderTop(); renderSheet();`.
- [ ] Le composant fetch la route après init, si `user`, et appelle `triggerAct('hydrate', data)`.
- [ ] Éviter la boucle de fetch ; abort au démontage.
- [ ] Test statique : action, fetch, pas de `_MOCK` dans le chemin hydraté.

### Task 3: Recette

- [ ] Compte authentifié : données de la base, pas de mock.
- [ ] Compte sans données : états vides.
- [ ] 393/375, tests, build, production.
