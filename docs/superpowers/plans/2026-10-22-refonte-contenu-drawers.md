# Refonte de contenu — Réseau, Sortie, Compte — plan d’implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre le contenu des trois drawers Réseau, Sortie et Compte, en réutilisant le shell et les interactions du drawer Profil.

**Architecture:** Le shell React du Profil (capsule `.segc` en haut, capsule flottante conditionnelle en bas à droite, glissement à deux couches) est réutilisé. Chaque drawer reçoit une API dédiée, des données Supabase réelles, des états explicites et des tests d’intégration. Les migrations sont additives.

**Tech Stack:** Next.js 15.5, React 19, TypeScript strict, Supabase Postgres + RLS, Zod, Vitest, Playwright, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-22-refonte-contenu-drawers-design.md`

## Global Constraints

- Aucun mock sur un compte authentifié ; toute donnée vient de Supabase.
- Aucun orange `#E4501C`.
- 44 px, contraste AA, `prefers-reduced-motion`.
- Capsule haut : `.segc.lg-tabs.lens-on`, 48 px, icônes 18 px, `.sel-lens --i`.
- Capsule bas droite : `.ig-tabs-float`, 30 px, offset 10 px, icônes 15 px.
- Contenu : 14 px de marge latérale, 62 px de marge basse.
- Glissement : 420 ms `cubic-bezier(.32,.72,0,1)`.
- Aucun classement public, aucune comparaison entre membres.
- Toute route API : auth, Zod, erreurs 401/403/404/409/500, rate limit.
- Toute table : RLS activée + tests d’accès.
- Chaque tâche : `tsc`, tests ciblés, commit.

---

## Phase 0 — Fondations

### Task 1: API socle et schéma additif

**Files:**
- Create: `src/lib/api/drawerAuth.ts`
- Create: `src/lib/api/respond.ts`
- Create: `supabase/migrations/20261023090000_three_drawers.sql`
- Create: `supabase/migrations/20261023091000_three_drawers_rls.sql`
- Test: `tests/design/three-drawers-schema.spec.ts`

**Contenu :** colonnes `profiles.cover_url`, `profiles.bio`, `profiles.links`,
`follows.close_friend`, `orders.tracking_url`, `notifications.group`,
`outings.duration_s`, `outings.visibility`, tables `follow_requests`,
`outing_photos`, `outing_gear`, `outing_participants`, `outing_kudos`,
`outing_comments`, `profile_share_links`, `profile_views`,
`notification_preferences`, `user_sessions`.

**Interfaces :**
```ts
export type ApiErrorCode = 'unauthorized'|'forbidden'|'not_found'|'conflict'|'server';
export function ok<T>(data: T, status?: number): Response;
export function fail(code: ApiErrorCode, message: string): Response;
export async function requireUser(): Promise<{ user: User } | Response>;
```

- [ ] **Step 1: Test schéma** — lit les migrations, assert tables/colonnes/index/RLS.
- [ ] **Step 2: Run** — `npx vitest run tests/design/three-drawers-schema.spec.ts` → FAIL.
- [ ] **Step 3: Écrire migrations** — `create table if not exists`, `add column if not exists`, policies owner/visibilité.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(db): socle des trois drawers`.

**Acceptance :** migrations idempotentes, RLS testée (propriétaire, participant, abonné, visiteur).

---

### Task 2: Shell et composants partagés

**Files:**
- Create: `src/components/compte/drawer/DrawerShell.tsx`
- Create: `src/components/compte/drawer/DrawerTopNav.tsx`
- Create: `src/components/compte/drawer/DrawerLensPill.tsx`
- Create: `src/components/compte/drawer/DrawerSection.tsx`
- Test: `src/components/compte/drawer/__tests__/DrawerShell.test.tsx`

**Interfaces :**
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

- [ ] **Step 1: Test** — 3 sections, `role=tablist`, capsule 48 px, `aria-selected`, clic, pill absente par défaut.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter** — capsule, lentille `--i`, pill 30 px à 10 px, slide `data-dir`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(compte): shell partagé des drawers`.

---

## Phase 1 — Drawer Réseau

### Task 3: API sociale

**Files:**
- Create: `src/app/api/compte/social/[kind]/route.ts`
- Create: `src/app/api/compte/social/follow/route.ts`
- Create: `src/app/api/compte/social/requests/route.ts`
- Create: `src/app/api/compte/social/cordee/route.ts`
- Test: `src/app/api/compte/social/__tests__/route.test.ts`

**Interfaces :**
```ts
export type SocialKind = 'followers' | 'following';
export interface SocialUser {
  id: string; name: string; handle: string; avatarUrl: string | null;
  massif: string | null; verified: boolean; relation: 'follows_you'|'mutual'|'you_follow';
  lastActivityAt: string | null; closeFriend: boolean;
}
```

- [ ] **Step 1: Test** — followers/following 200, 401 sans session, follow idempotent, unfollow, demande privée, cordée max 30.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter** — requêtes `follows`, `follow_requests`, profils, RLS, Zod.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(social): API réseau`.

**Acceptance :** un utilisateur ne voit jamais une demande ou une cordée qui ne le concerne pas.

---

### Task 4: UI Abonnés / Abonnements

**Files:**
- Create: `src/components/compte/drawer/sections/FollowersSection.tsx`
- Create: `src/components/compte/drawer/sections/FollowingSection.tsx`
- Create: `src/components/compte/drawer/sections/RequestsSection.tsx`
- Create: `src/components/compte/drawer/sections/CordeeSection.tsx`
- Create: `src/components/compte/drawer/cards/UserRow.tsx`
- Test: `src/components/compte/drawer/sections/__tests__/FollowersSection.test.tsx`

- [ ] **Step 1: Test** — recherche, filtres Tous/Mutuels/Récents/Cordée, demandes, cordée, follow optimiste + rollback.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter** — sections, lignes, menu « … », états vide/erreur.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(social): drawer réseau v2`.

---

### Task 5: Intégration et E2E Réseau

**Files:**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js`
- Test: `tests/e2e/compte-reseau.spec.ts`

- [ ] **Step 1: E2E** — ouvrir, basculer Abonnements/Abonnés, rechercher, accepter une demande, ajouter à la cordée.
- [ ] **Step 2: Implémenter** — brancher le shell React, supprimer l’ancien HTML.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(social): intégration drawer réseau`.

---

## Phase 2 — Drawer Sortie

### Task 6: API sortie et sous-ressources

**Files:**
- Create: `src/app/api/compte/outings/[id]/route.ts`
- Create: `src/app/api/compte/outings/[id]/photos/route.ts`
- Create: `src/app/api/compte/outings/[id]/gear/route.ts`
- Create: `src/app/api/compte/outings/[id]/participants/route.ts`
- Create: `src/app/api/compte/outings/[id]/kudos/route.ts`
- Create: `src/app/api/compte/outings/[id]/comments/route.ts`
- Test: `src/app/api/compte/outings/__tests__/[id].test.ts`

**Interfaces :**
```ts
export interface OutingDetail {
  id: string; title: string; date: string; massif: string | null;
  km: number; dplus: number; maxAlt: number | null; durationS: number | null;
  status: 'done'|'upcoming'|'draft'; verified: boolean; visibility: 'public'|'abonnes'|'prive';
  coverUrl: string | null; gpxUrl: string | null; weather: WeatherSnapshot | null;
  photos: OutingPhoto[]; gear: OutingGear[]; participants: OutingParticipant[];
  kudos: { count: number; userIds: string[] };
  comments: OutingComment[];
}
```

- [ ] **Step 1: Test** — 200 propriétaire, 403 visiteur privé, 404 inconnu, photos/gear/participants CRUD.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter** — requêtes + RLS + validation.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(sortie): API détail`.

---

### Task 7: Sous-drawers Résumé + Trace

**Files:**
- Create: `src/components/compte/drawer/outings/OutingSummary.tsx`
- Create: `src/components/compte/drawer/outings/OutingTrace.tsx`
- Create: `src/components/compte/drawer/outings/ElevationProfile.tsx`
- Test: `src/components/compte/drawer/outings/__tests__/OutingSummary.test.tsx`

- [ ] **Step 1: Test** — hero, tuiles, statut, actions, profil altimétrique, GPX.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter** — cartes, graphique SVG, mini-carte.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(sortie): résumé et trace`.

---

### Task 8: Sous-drawers Photos + Matériel + Compagnons

**Files:**
- Create: `src/components/compte/drawer/outings/OutingPhotos.tsx`
- Create: `src/components/compte/drawer/outings/OutingGear.tsx`
- Create: `src/components/compte/drawer/outings/OutingParticipants.tsx`
- Test: `src/components/compte/drawer/outings/__tests__/OutingGear.test.tsx`

- [ ] **Step 1: Test** — grille photos, ajout/suppression, kit + objets, participants + kudos.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter** — grilles, lignes, actions.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(sortie): photos, matériel, compagnons`.

---

### Task 9: Sous-drawers Météo + Échanges

**Files:**
- Create: `src/components/compte/drawer/outings/OutingWeather.tsx`
- Create: `src/components/compte/drawer/outings/OutingComments.tsx`
- Test: `src/components/compte/drawer/outings/__tests__/OutingComments.test.tsx`

- [ ] **Step 1: Test** — météo au départ, alertes, commentaires, réponses, signalement.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter** — cartes météo, fil, composer.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(sortie): météo et échanges`.

---

### Task 10: Intégration et E2E Sortie

**Files:**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js`
- Test: `tests/e2e/compte-sortie.spec.ts`

- [ ] **Step 1: E2E** — ouvrir une sortie, parcourir les 6 sous-drawers, partager, exporter GPX, commenter.
- [ ] **Step 2: Implémenter** — brancher le shell React, supprimer l’ancien HTML.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(sortie): intégration drawer`.

---

## Phase 3 — Drawer Compte

### Task 11: API commandes et notifications

**Files:**
- Create: `src/app/api/compte/orders/route.ts`
- Create: `src/app/api/compte/notifications/route.ts`
- Test: `src/app/api/compte/orders/__tests__/route.test.ts`
- Test: `src/app/api/compte/notifications/__tests__/route.test.ts`

**Interfaces :**
```ts
export interface OrderSummary {
  id: string; reference: string; createdAt: string;
  status: 'pending'|'confirmed'|'shipped'|'delivered'|'cancelled';
  totalCents: number; items: { title: string; imageUrl: string | null; qty: number }[];
  trackingUrl: string | null; estimatedDelivery: string | null;
}
export interface NotificationItem {
  id: string; type: string; group: 'social'|'loans'|'orders'|'system';
  text: string; actor: { name: string; avatarUrl: string | null } | null;
  entityId: string | null; readAt: string | null; createdAt: string;
}
```

- [ ] **Step 1: Test** — 401, 200, 403 notification d’autrui, PATCH lecture.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter** — requêtes + Zod.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(compte): API commandes et notifications`.

---

### Task 12: UI Commandes + Notifications

**Files:**
- Create: `src/components/compte/drawer/sections/OrdersSection.tsx`
- Create: `src/components/compte/drawer/sections/NotificationsSection.tsx`
- Create: `src/components/compte/drawer/cards/OrderCard.tsx`
- Create: `src/components/compte/drawer/cards/NotificationRow.tsx`
- Test: `src/components/compte/drawer/sections/__tests__/OrdersSection.test.tsx`

- [ ] **Step 1: Test** — stepper, filtres, empty, groupes de notifications, action inline.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter** — cartes, groupes, « tout lire ».
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(compte): commandes et notifications`.

---

### Task 13: UI Paramètres hub + Profil + Partage

**Files:**
- Create: `src/components/compte/drawer/sections/SettingsHub.tsx`
- Create: `src/components/compte/drawer/sections/EditProfileSection.tsx`
- Create: `src/components/compte/drawer/sections/ShareSection.tsx`
- Create: `src/app/api/compte/share/route.ts`
- Test: `src/components/compte/drawer/sections/__tests__/EditProfileSection.test.tsx`

- [ ] **Step 1: Test** — hub 4 cartes, complétude, validation handle/bio, partage/QR/révocation.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter** — formulaires, aperçu, barre collante.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(compte): paramètres, profil et partage`.

---

### Task 14: Intégration et E2E Compte

**Files:**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js`
- Test: `tests/e2e/compte-drawer-compte.spec.ts`

- [ ] **Step 1: E2E** — 5 sections, filtre, suivi commande, lecture notification, sauvegarde profil, partage.
- [ ] **Step 2: Implémenter** — brancher le shell React.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(compte): intégration drawer Compte`.

---

## Phase 4 — Finitions

### Task 15: Audit et production

**Files:**
- Test: `tests/design/three-drawers-a11y.spec.ts`
- Test: `tests/e2e/three-drawers-offline.spec.ts`

- [ ] **Step 1: Tests** — focus, contrastes, 44 px, reduced motion, cache offline.
- [ ] **Step 2: Corriger** les écarts.
- [ ] **Step 3: `tsc`, build, tests complets.**
- [ ] **Step 4: Déployer Vercel production + smoke test.**
- [ ] **Step 5: Commit + rapport.**

---

## Ordre recommandé

1. Phase 0 — fondations.
2. Réseau — le plus rapide, fort impact social.
3. Sortie — le cœur de la valeur.
4. Compte — le plus utilisé au quotidien.
5. Audit + production.

Chaque phase est livrable seule.
