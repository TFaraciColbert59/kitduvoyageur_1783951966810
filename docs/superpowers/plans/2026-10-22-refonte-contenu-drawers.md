# Refonte de contenu des drawers — plan d’implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre le contenu des drawers Compte, Abonnés/Abonnements, Sorties & Voyages, Publications & Carnets, Lignées & Inventaire et Réglages & Sécurité, en réutilisant le shell et les interactions du drawer Profil.

**Architecture:** Un shell React partagé (capsule `.segc` en haut, capsule flottante conditionnelle en bas à droite, glissement à deux couches) remplace progressivement le HTML runtime. Chaque drawer reçoit une API dédiée, des données Supabase réelles, des états explicites et des tests d’intégration. Les migrations sont additives et rétrocompatibles.

**Tech Stack:** Next.js 15.5, React 19, TypeScript strict, Supabase Postgres + RLS, Zod, Vitest, Playwright, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-22-refonte-contenu-drawers-design.md`

## Global Constraints

- Aucun mock sur un compte authentifié ; toute donnée affichée vient de Supabase.
- Aucun orange `#E4501C`.
- Cibles tactiles 44 px, contraste AA, `prefers-reduced-motion` respecté.
- Capsule haut : `.segc.lg-tabs.lens-on`, 48 px, icônes 18 px, lentille `--i`.
- Capsule bas droite : `.ig-tabs-float`, 30 px, offset 10 px, icônes 15 px.
- Contenu : 14 px de marge latérale, 62 px de marge basse.
- Glissement : 420 ms `cubic-bezier(.32,.72,0,1)`.
- Aucun classement public, aucune comparaison entre membres.
- Toute route API : auth, Zod, erreurs 401/403/404/409/500, rate limit.
- Toute table : RLS activée + tests d’accès.
- Chaque tâche se termine par `tsc`, tests ciblés et commit.

---

## Phase 0 — Fondations

### Task 1: Shell de drawer partagé

**Files:**
- Create: `src/components/compte/drawer/DrawerShell.tsx`
- Create: `src/components/compte/drawer/DrawerTopNav.tsx`
- Create: `src/components/compte/drawer/DrawerLensPill.tsx`
- Create: `src/components/compte/drawer/DrawerSection.tsx`
- Test: `src/components/compte/drawer/__tests__/DrawerShell.test.tsx`

**Interfaces:**
```ts
export interface DrawerSectionDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  render: () => React.ReactNode;
}
export interface DrawerShellProps {
  sections: DrawerSectionDef[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  secondary?: { items: { id: string; label: string; icon: React.ReactNode }[]; active: number; onChange: (i: number) => void };
  state?: 'ready' | 'loading' | 'empty' | 'error';
  onRetry?: () => void;
  children: React.ReactNode;
}
```

- [ ] **Step 1: Write the failing test** — render 3 sections, assert `role="tablist"`, `.segc.lg-tabs.lens-on`, active `aria-selected`, click calls `onIndexChange`, secondary pill absent by default.
- [ ] **Step 2: Run test** — `npx vitest run src/components/compte/drawer/__tests__/DrawerShell.test.tsx` → FAIL.
- [ ] **Step 3: Implement** — top nav 48 px, `.sel-lens --i`, optional `.ig-tabs-float` pill at 10 px, slide wrapper with `data-dir`.
- [ ] **Step 4: Run test** → PASS.
- [ ] **Step 5: Commit** — `feat(compte): shell de drawer partagé`.

**Acceptance:** le shell reproduit visuellement le Profil (capsule 48 px, lentille, pill 30 px, offset 10 px) et ne contient aucun en-tête.

---

### Task 2: Schéma Supabase additif

**Files:**
- Create: `supabase/migrations/20261023090000_drawers_content.sql`
- Create: `supabase/migrations/20261023091000_drawers_rls.sql`
- Test: `tests/design/drawers-schema.spec.ts`

**Contenu :** tables `carnets`, `carnet_days`, `carnet_media`, `carnet_collaborators`, `gear_maintenance`, `gear_warranties`, `profile_share_links`, `profile_views`, `referrals`, `loyalty_events`, `notification_preferences`, `user_sessions`, `weather_cache` ; colonnes listées dans la spec §12.2 ; index sur les clés étrangères et les dates.

- [ ] **Step 1: Write failing schema test** — lit les migrations, assert tables/colonnes/index.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Write migrations** — `create table if not exists`, `add column if not exists`, RLS activée, policies owner/visibilité.
- [ ] **Step 4: Apply local + run** → PASS.
- [ ] **Step 5: Commit** — `feat(db): schéma des contenus drawers`.

**Acceptance:** migrations idempotentes, RLS testée (propriétaire, collaborateur, visiteur, privé).

---

### Task 3: Socle API

**Files:**
- Create: `src/lib/api/drawerAuth.ts`
- Create: `src/lib/api/respond.ts`
- Create: `src/lib/api/schemas.ts`
- Test: `src/lib/api/__tests__/respond.test.ts`

**Interfaces:**
```ts
export type ApiError = { error: string; code: 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'server' };
export function ok<T>(data: T, init?: number): Response;
export function fail(code: ApiError['code'], message: string): Response;
export async function requireUser(): Promise<{ user: User } | Response>;
```

- [ ] **Step 1: Test** — `fail('not_found')` → 404 JSON, `requireUser` sans session → 401.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — Zod parse helper, rate limit simple, logs sans PII.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(api): socle des routes drawers`.

---

### Task 4: Analytics, flags, cache offline

**Files:**
- Create: `src/lib/analytics/drawerEvents.ts`
- Create: `src/lib/flags.ts`
- Create: `src/lib/offline/drawerCache.ts`
- Test: `src/lib/analytics/__tests__/drawerEvents.test.ts`

- [ ] **Step 1: Test** — événements `drawer_open`, `section_view`, `action_click`, `empty_cta`, `error_view`, sans PII.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — file d’attente, envoi batch, flags `drawer_content_v2`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(analytics): événements drawers`.

---

## Phase 1 — Drawer Compte

### Task 5: Commandes

**Files:**
- Create: `src/app/api/compte/orders/route.ts`
- Create: `src/components/compte/drawer/sections/OrdersSection.tsx`
- Create: `src/components/compte/drawer/cards/OrderCard.tsx`
- Test: `src/app/api/compte/orders/__tests__/route.test.ts`
- Test: `src/components/compte/drawer/sections/__tests__/OrdersSection.test.tsx`

**Interfaces:**
```ts
export interface OrderSummary {
  id: string; reference: string; createdAt: string; status: 'pending'|'confirmed'|'shipped'|'delivered'|'cancelled';
  totalCents: number; currency: string; items: { id: string; title: string; imageUrl: string | null; qty: number }[];
  trackingUrl: string | null; estimatedDelivery: string | null;
}
```

- [ ] **Step 1: API test** — 401 sans session, 200 avec commandes, 500 propre.
- [ ] **Step 2: UI test** — rend 3 statuts, filtre En cours, empty state CTA.
- [ ] **Step 3: Implement** — requête `orders` + items, filtre client, carte avec stepper.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(compte): commandes réelles`.

---

### Task 6: Notifications

**Files:**
- Create: `src/app/api/compte/notifications/route.ts`
- Create: `src/components/compte/drawer/sections/NotificationsSection.tsx`
- Test: `src/app/api/compte/notifications/__tests__/route.test.ts`
- Test: `src/components/compte/drawer/sections/__tests__/NotificationsSection.test.tsx`

- [ ] **Step 1: Test** — GET groupé, PATCH lecture, 403 sur notification d’autrui.
- [ ] **Step 2: Test UI** — groupes Aujourd’hui/Hier, filtre Social, action inline.
- [ ] **Step 3: Implement** — API + optimistic read + « tout lire ».
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(compte): boîte de notifications`.

---

### Task 7: Hub Paramètres

**Files:**
- Create: `src/components/compte/drawer/sections/SettingsHub.tsx`
- Modify: `src/components/compte/drawer/ProfileDrawerHost.tsx` (si réutilisé)
- Test: `src/components/compte/drawer/sections/__tests__/SettingsHub.test.tsx`

- [ ] **Step 1: Test** — 4 cartes, états, clic ouvre la section Réglages.
- [ ] **Step 2: Implement** — cartes verre, deux toggles rapides.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(compte): hub paramètres`.

---

### Task 8: Modifier le profil + partage

**Files:**
- Create: `src/components/compte/drawer/sections/EditProfileSection.tsx`
- Create: `src/components/compte/drawer/sections/ShareSection.tsx`
- Create: `src/app/api/compte/share/route.ts`
- Test: `src/components/compte/drawer/sections/__tests__/EditProfileSection.test.tsx`

- [ ] **Step 1: Test** — validation handle/bio, anneau de complétude, save.
- [ ] **Step 2: Test** — partage : lien, QR, révocation.
- [ ] **Step 3: Implement** — formulaire, aperçu, barre collante.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(compte): édition profil et partage`.

---

### Task 9: Intégration du drawer Compte

**Files:**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js`
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx`
- Test: `tests/e2e/compte-drawer-compte.spec.ts`

- [ ] **Step 1: E2E** — ouvrir, parcourir les 5 sections, vérifier capsule 48 px et slide.
- [ ] **Step 2: Implement** — brancher le shell React, supprimer l’ancien HTML.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(compte): drawer Compte v2`.

---

## Phase 2 — Abonnés / Abonnements

### Task 10: API sociale

**Files:**
- Create: `src/app/api/compte/social/[kind]/route.ts`
- Create: `src/app/api/compte/social/follow/route.ts`
- Create: `src/app/api/compte/social/requests/route.ts`
- Test: `src/app/api/compte/social/__tests__/route.test.ts`

- [ ] **Step 1: Test** — followers/following, follow/unfollow idempotent, demandes privées.
- [ ] **Step 2: Implement** — requêtes `follows`, `follow_requests`, profils, RLS.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(social): API abonnés`.

---

### Task 11: UI Abonnés/Abonnements

**Files:**
- Create: `src/components/compte/drawer/sections/FollowersSection.tsx`
- Create: `src/components/compte/drawer/cards/UserRow.tsx`
- Create: `src/components/compte/drawer/sections/CordeeSection.tsx`
- Test: `src/components/compte/drawer/sections/__tests__/FollowersSection.test.tsx`

- [ ] **Step 1: Test** — recherche, filtres, cordée, demandes, follow optimiste.
- [ ] **Step 2: Implement** — liste virtualisée, sections, menu « … ».
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(social): drawer abonnés v2`.

---

## Phase 3 — Sorties & Voyages

### Task 12: API sorties et statistiques

**Files:**
- Create: `src/app/api/compte/outings/route.ts`
- Create: `src/features/compte/server/outingStats.ts`
- Test: `src/app/api/compte/outings/__tests__/route.test.ts`

- [ ] **Step 1: Test** — liste paginée, filtres année/type/massif, stats, records.
- [ ] **Step 2: Implement** — requêtes `outings`, agrégats SQL, cache 60 s.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(sorties): API et statistiques`.

---

### Task 13: Parcours + Records

**Files:**
- Create: `src/components/compte/drawer/sections/OutingsSection.tsx`
- Create: `src/components/compte/drawer/sections/RecordsSection.tsx`
- Create: `src/components/compte/drawer/cards/ActivityCard.tsx`
- Test: `src/components/compte/drawer/sections/__tests__/OutingsSection.test.tsx`

- [ ] **Step 1: Test** — groupes par mois, filtres, récap, records.
- [ ] **Step 2: Implement** — cartes, mini-trace, actions.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(sorties): parcours et records`.

---

### Task 14: Météo + Planifier

**Files:**
- Create: `src/app/api/weather/route.ts`
- Create: `src/components/compte/drawer/sections/WeatherSection.tsx`
- Create: `src/components/compte/drawer/sections/PlanSection.tsx`
- Test: `src/app/api/weather/__tests__/route.test.ts`

- [ ] **Step 1: Test** — cache 30 min, massif inconnu 404, 7 jours.
- [ ] **Step 2: Implement** — fournisseur, cache, UI.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(sorties): météo et planification`.

---

## Phase 4 — Publications & Carnets

### Task 15: API carnets

**Files:**
- Create: `src/app/api/compte/carnets/route.ts`
- Create: `src/app/api/compte/carnets/[id]/route.ts`
- Create: `src/app/api/compte/carnets/[id]/days/route.ts`
- Test: `src/app/api/compte/carnets/__tests__/route.test.ts`

- [ ] **Step 1: Test** — CRUD, collaborateurs, publication, 403.
- [ ] **Step 2: Implement** — tables + RLS + validation.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(carnets): API`.

---

### Task 16: Publications + Brouillons + À la une

**Files:**
- Create: `src/components/compte/drawer/sections/PostsSection.tsx`
- Create: `src/components/compte/drawer/sections/DraftsSection.tsx`
- Create: `src/components/compte/drawer/sections/HighlightsSection.tsx`
- Test: `src/components/compte/drawer/sections/__tests__/PostsSection.test.tsx`

- [ ] **Step 1: Test** — grille, filtres, stats, brouillons, à la une.
- [ ] **Step 2: Implement** — cartes et actions.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(carnets): publications et à la une`.

---

### Task 17: Éditeur de carnet

**Files:**
- Create: `src/components/compte/drawer/carnets/CarnetEditor.tsx`
- Create: `src/components/compte/drawer/carnets/CarnetDayEditor.tsx`
- Test: `src/components/compte/drawer/carnets/__tests__/CarnetEditor.test.tsx`

- [ ] **Step 1: Test** — créer, ajouter un jour, réordonner, publier, aperçu.
- [ ] **Step 2: Implement** — formulaire, upload, carte, collaborateurs.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(carnets): éditeur`.

---

## Phase 5 — Lignées & Inventaire

### Task 18: API matériel et kits

**Files:**
- Create: `src/app/api/compte/gear/route.ts`
- Create: `src/app/api/compte/kits/route.ts`
- Test: `src/app/api/compte/gear/__tests__/route.test.ts`

- [ ] **Step 1: Test** — CRUD, maintenance, prêt, QR, agrégats.
- [ ] **Step 2: Implement** — requêtes + RLS.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(gear): API inventaire`.

---

### Task 19: UI Kits + Inventaire

**Files:**
- Create: `src/components/compte/drawer/sections/KitsSection.tsx`
- Create: `src/components/compte/drawer/sections/InventorySection.tsx`
- Create: `src/components/compte/drawer/cards/GearRow.tsx`
- Test: `src/components/compte/drawer/sections/__tests__/InventorySection.test.tsx`

- [ ] **Step 1: Test** — stats, filtres, états, fiche objet, QR.
- [ ] **Step 2: Implement** — cartes, arbre de lignée, actions.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(gear): kits et inventaire`.

---

### Task 20: Fidélité + Parrainage

**Files:**
- Create: `src/components/compte/drawer/sections/LoyaltySection.tsx`
- Create: `src/components/compte/drawer/sections/ReferralSection.tsx`
- Test: `src/components/compte/drawer/sections/__tests__/LoyaltySection.test.tsx`

- [ ] **Step 1: Test** — palier, badges, défis, série, parrainage.
- [ ] **Step 2: Implement** — données réelles, aucun classement.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(loyalty): fidélité et parrainage`.

---

## Phase 6 — Réglages & Sécurité

### Task 21: API réglages et sécurité

**Files:**
- Create: `src/app/api/compte/settings/route.ts`
- Create: `src/app/api/compte/security/sessions/route.ts`
- Test: `src/app/api/compte/settings/__tests__/route.test.ts`

- [ ] **Step 1: Test** — préférences, sessions, révocation, suppression.
- [ ] **Step 2: Implement** — validation, RLS, audit.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(settings): API`.

---

### Task 22: UI Réglages

**Files:**
- Create: `src/components/compte/drawer/sections/SecuritySection.tsx`
- Create: `src/components/compte/drawer/sections/PrivacySection.tsx`
- Create: `src/components/compte/drawer/sections/NotificationPrefsSection.tsx`
- Create: `src/components/compte/drawer/sections/PreferencesSection.tsx`
- Create: `src/components/compte/drawer/sections/DataSection.tsx`
- Test: `src/components/compte/drawer/sections/__tests__/PrivacySection.test.tsx`

- [ ] **Step 1: Test** — toggles, confirmations, export, suppression.
- [ ] **Step 2: Implement** — sections et sous-feuilles.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(settings): drawer réglages v2`.

---

## Phase 7 — Sous-drawers et finitions

### Task 23: Sortie, club, commentaires, invitations

**Files:**
- Create: `src/components/compte/drawer/sections/OutingDetail.tsx`
- Create: `src/components/compte/drawer/sections/ClubDetail.tsx`
- Create: `src/components/compte/drawer/sections/CommentsSheet.tsx`
- Test: `tests/e2e/compte-subdrawers.spec.ts`

- [ ] **Step 1: E2E** — ouvrir chaque sous-drawer, actions principales.
- [ ] **Step 2: Implement** — contenu réel + shell.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(compte): sous-drawers v2`.

---

### Task 24: Audit accessibilité, performance, offline

**Files:**
- Test: `tests/design/drawers-a11y.spec.ts`
- Test: `tests/e2e/drawers-offline.spec.ts`

- [ ] **Step 1: Tests** — focus, contrastes, 44 px, reduced motion, cache offline.
- [ ] **Step 2: Fix** — corriger les écarts.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `chore(compte): audit drawers`.

---

### Task 25: Déploiement production

**Files:**
- Modify: `docs/superpowers/sdd/.../progress.md`

- [ ] **Step 1:** `tsc`, build, tests complets.
- [ ] **Step 2:** déploiement Vercel production.
- [ ] **Step 3:** smoke test des 6 drawers + console + CSP.
- [ ] **Step 4:** rapport et suivi.

---

## Ordre recommandé

1. Phase 0 (fondations) — indispensable.
2. Compte — le plus utilisé.
3. Abonnés — quick win social.
4. Sorties — cœur de valeur.
5. Carnets — le plus gros chantier.
6. Lignées — différenciateur.
7. Réglages — confiance.
8. Sous-drawers et polish.

Chaque phase est livrable seule ; on peut s’arrêter après n’importe quelle phase
sans casser le reste.
