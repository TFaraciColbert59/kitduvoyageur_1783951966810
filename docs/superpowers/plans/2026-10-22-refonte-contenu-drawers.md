# Refonte de contenu — Réseau, Sortie, Compte — plan complet

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aligner les drawers Réseau, Sortie et Compte sur le design du drawer Profil et remplacer tout contenu simulé par des données Supabase réelles, avec API, RLS, états et tests.

**Architecture:** Le shell React du Profil (capsule `.segc` en haut, capsule `.ig-tabs-float` conditionnelle en bas à droite, glissement à deux couches) est extrait en composants partagés. Les trois drawers sont migrés du HTML runtime vers des sections React. Chaque drawer a ses routes API, ses types, ses mappers et ses tests. Les migrations sont additives et rétrocompatibles.

**Tech Stack:** Next.js 15.5, React 19, TypeScript strict, Supabase Postgres + RLS, Zod, Vitest, Playwright, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-22-refonte-contenu-drawers-design.md`

## Global Constraints

- Design identique au Profil : aucune en-tête, capsule haut 48 px, lentille `.sel-lens`, capsule bas droite 30 px à 10 px des bords, contenu 14 px / 62 px, glissement 420 ms `cubic-bezier(.32,.72,0,1)`.
- Aucun mock sur un compte authentifié ; toute donnée vient de Supabase.
- Tables réelles : `user_profiles`, `user_follows`, `public_profiles`, `hike_sessions`, `hiking_routes`, `materiel_kits`, `materiel_kit_items`, `kit_items`, `orders`, `notifications`, `clubs`, `club_members`.
- Aucun orange `#E4501C`.
- 44 px, contraste AA, `prefers-reduced-motion`.
- Toute route API : auth, Zod, erreurs 401/403/404/409/500, rate limit.
- Toute table : RLS activée + tests d’accès.
- Chaque tâche : `tsc`, tests ciblés, commit.

---

## Structure des fichiers

```
src/components/compte/drawer/
  shell/DrawerShell.tsx
  shell/DrawerTopNav.tsx
  shell/DrawerLensPill.tsx
  shell/DrawerSection.tsx
  reseau/ReseauDrawer.tsx
  reseau/FollowersPane.tsx
  reseau/FollowingPane.tsx
  reseau/FollowRequests.tsx
  reseau/CordeeStrip.tsx
  reseau/UserRow.tsx
  sortie/SortieDrawer.tsx
  sortie/OutingSummary.tsx
  sortie/OutingTrace.tsx
  sortie/OutingPhotos.tsx
  sortie/OutingGear.tsx
  sortie/OutingParticipants.tsx
  sortie/OutingWeather.tsx
  sortie/OutingComments.tsx
  compte/CompteDrawer.tsx
  compte/OrdersPane.tsx
  compte/NotificationsPane.tsx
  compte/SettingsHub.tsx
  compte/EditProfilePane.tsx
  compte/SharePane.tsx
src/app/api/compte/reseau/
  followers/route.ts
  following/route.ts
  follow/route.ts
  requests/route.ts
  cordee/route.ts
src/app/api/compte/sorties/[id]/
  route.ts
  photos/route.ts
  gear/route.ts
  participants/route.ts
  kudos/route.ts
  comments/route.ts
src/app/api/compte/compte/
  orders/route.ts
  notifications/route.ts
  share/route.ts
src/features/compte/server/
  reseau.ts
  sorties.ts
  compte.ts
supabase/migrations/
  20261023090000_three_drawers.sql
  20261023091000_three_drawers_rls.sql
tests/
  design/three-drawers-schema.spec.ts
  design/three-drawers-a11y.spec.ts
  e2e/compte-reseau.spec.ts
  e2e/compte-sortie.spec.ts
  e2e/compte-compte.spec.ts
```

---

## Phase 0 — Fondations

### Task 1: Shell partagé

**Files:**
- Create: `src/components/compte/drawer/shell/DrawerShell.tsx`
- Create: `src/components/compte/drawer/shell/DrawerTopNav.tsx`
- Create: `src/components/compte/drawer/shell/DrawerLensPill.tsx`
- Create: `src/components/compte/drawer/shell/DrawerSection.tsx`
- Create: `src/components/compte/drawer/shell/States.tsx`
- Test: `src/components/compte/drawer/shell/__tests__/DrawerShell.test.tsx`

**Interfaces:**
```ts
export interface DrawerTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  render: () => React.ReactNode;
}

export interface DrawerShellProps {
  tabs: DrawerTab[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  secondary?: {
    items: { id: string; label: string; icon: React.ReactNode }[];
    active: number;
    onChange: (index: number) => void;
  };
  state?: 'ready' | 'loading' | 'empty' | 'error';
  onRetry?: () => void;
  children: React.ReactNode;
}
```

- [ ] **Step 1: Écrire le test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { DrawerShell } from '../DrawerShell';

const tabs = [
  { id: 'a', label: 'A', icon: <span>A</span>, render: () => <p>Contenu A</p> },
  { id: 'b', label: 'B', icon: <span>B</span>, render: () => <p>Contenu B</p> },
];

it('rend la capsule du profil et change d’onglet', () => {
  const onChange = vi.fn();
  render(<DrawerShell tabs={tabs} activeIndex={0} onIndexChange={onChange}>x</DrawerShell>);
  expect(screen.getByRole('tablist', { name: 'Sections' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'A' }).getAttribute('aria-selected')).toBe('true');
  fireEvent.click(screen.getByRole('tab', { name: 'B' }));
  expect(onChange).toHaveBeenCalledWith(1);
});

it('n’affiche aucune capsule secondaire par défaut', () => {
  render(<DrawerShell tabs={tabs} activeIndex={0} onIndexChange={() => {}}>x</DrawerShell>);
  expect(document.querySelector('.ig-tabs-float')).toBeNull();
});
```

- [ ] **Step 2: Lancer le test**

Run: `npx vitest run src/components/compte/drawer/shell/__tests__/DrawerShell.test.tsx`
Expected: FAIL `Cannot find module '../DrawerShell'`.

- [ ] **Step 3: Implémenter**

```tsx
export function DrawerShell({ tabs, activeIndex, onIndexChange, secondary, state = 'ready', onRetry, children }: DrawerShellProps) {
  return (
    <div className="lkdv-drawer-shell" data-state={state}>
      <div className="lkdv-drawer-topnav">
        <div className="segc lg-tabs lens-on" role="tablist" aria-label="Sections" style={{ '--n': tabs.length } as React.CSSProperties}>
          <span className="sel-lens" aria-hidden="true" style={{ '--i': activeIndex } as React.CSSProperties} />
          {tabs.map((tab, index) => (
            <button key={tab.id} type="button" role="tab" className={index === activeIndex ? 'active' : ''} aria-selected={index === activeIndex} tabIndex={index === activeIndex ? 0 : -1} onClick={() => onIndexChange(index)}>
              <span className="ic s">{tab.icon}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="lkdv-drawer-stage">
        {state === 'loading' ? <Skeleton /> : null}
        {state === 'error' ? <ErrorState onRetry={onRetry} /> : null}
        {state === 'ready' ? children : null}
      </div>
      {secondary ? (
        <div className="ig-tabs-float lkdv-drawer-secondary">
          <div className="ig-tabs" role="tablist" aria-label="Filtres" style={{ '--n': secondary.items.length } as React.CSSProperties}>
            <span className="ig-th lens" aria-hidden="true" style={{ width: `calc((100% - 5px) / ${secondary.items.length})`, transform: `translateX(${secondary.active * 100}%)` }} />
            {secondary.items.map((item, index) => (
              <button key={item.id} type="button" role="tab" aria-selected={index === secondary.active} onClick={() => secondary.onChange(index)}>
                {item.icon}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Lancer le test** → PASS.
- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/shell
git commit -m "feat(compte): shell partagé des drawers"
```

**Acceptance :** la capsule mesure 48 px, la lentille suit `--i`, la capsule secondaire est à 10 px des bords et mesure 30 px, aucun en-tête.

---

### Task 2: Migrations et RLS (auditées)

**Files:**
- Create: `supabase/migrations/20261023090000_three_drawers.sql`
- Create: `supabase/migrations/20261023091000_three_drawers_rls.sql`
- Test: `tests/design/three-drawers-schema.spec.ts`

**Audit du 2026-10-22 (schéma réel) :**
- `public_profiles` est une **vue** : la recréer avec `cover_url` et `links`.
- `hike_session_photos` **existe déjà** (`storage_path`, `position`, `user_id`) :
  ne pas créer de table `url`/`sort_order`.
- `story_close_friends` **existe déjà** pour la Cordée : ne pas ajouter
  `close_friend` à `user_follows`.
- `notifications` possède déjà `actor_id`, `related_type`, `related_id`,
  `read_at` : ajouter seulement `group`.
- `hike_sessions` possède déjà `visibility`, `duration_seconds`,
  `positions_geojson`, `positions_timed`, `carnet_id`, `kit_id` : ajouter
  `title`, `max_altitude_m`, `weather`, `notes`.
- `orders` : ajouter `tracking_url`, `carrier`, `estimated_delivery`.
- Nouvelles tables : `follow_requests`, `hike_session_participants`,
  `hike_session_kudos`, `hike_session_comments`, `hike_session_gear`,
  `profile_share_links`, `profile_views`, `user_sessions`.

**SQL clé :**

```sql
create table if not exists public.follow_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.user_profiles(id) on delete cascade,
  target_id uuid not null references public.user_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_id, target_id)
);
```

Le fichier complet contient les colonnes additives, les 8 tables, les index
et la recréation de la vue. Le fichier RLS contient
`can_view_hike_session(uuid)` + toutes les policies.

- [ ] **Step 1: Test schéma** — assert les tables, colonnes, index et la vue.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Appliquer les migrations** — via Supabase SQL Editor ou MCP
  avec le scope `database:write`.
- [ ] **Step 4: Vérifier** — `select` sur chaque table, `pg_get_viewdef`.
- [ ] **Step 5: Commit** — `feat(db): schéma des trois drawers`.

**Acceptance :** migrations idempotentes, RLS testée (propriétaire, participant,
abonné, visiteur).

### Task 3: Types et mappers serveur

**Files:**
- Create: `src/features/compte/server/reseau.ts`
- Create: `src/features/compte/server/sorties.ts`
- Create: `src/features/compte/server/compte.ts`
- Test: `src/features/compte/server/__tests__/mappers.test.ts`

**Interfaces :**

```ts
export interface ReseauUser {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  massif: string | null;
  verified: boolean;
  relation: 'follows_you' | 'mutual' | 'you_follow';
  lastActivityAt: string | null;
  closeFriend: boolean;
}

export interface OutingDetail {
  id: string;
  title: string;
  date: string;
  massif: string | null;
  km: number;
  dplus: number;
  maxAlt: number | null;
  durationS: number | null;
  status: 'planned' | 'ongoing' | 'done';
  verified: boolean;
  visibility: 'public' | 'followers' | 'private';
  coverUrl: string | null;
  gpxUrl: string | null;
  weather: Record<string, unknown> | null;
  photos: { id: string; url: string; caption: string | null }[];
  gear: { kitId: string | null; name: string; weightG: number | null }[];
  participants: { id: string; name: string; handle: string; role: string }[];
  kudos: { count: number; userIds: string[] };
  comments: { id: string; body: string; author: string; createdAt: string }[];
}

export interface OrderSummary {
  id: string;
  reference: string;
  createdAt: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  totalCents: number;
  items: { title: string; imageUrl: string | null; qty: number }[];
  trackingUrl: string | null;
  estimatedDelivery: string | null;
}

export interface NotificationItem {
  id: string;
  type: string;
  group: 'social' | 'loans' | 'orders' | 'system';
  text: string;
  actor: { name: string; avatarUrl: string | null } | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}
```

- [ ] **Step 1: Test** — mapper `mapReseauUser` sur une ligne `public_profiles` + relation ; `mapOutingDetail` sur `hike_sessions` + route + photos ; `mapOrder` sur `orders`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter** les fonctions pures, sans I/O.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(compte): types et mappers`.

---

### Task 4: API socle

**Files:**
- Create: `src/lib/api/drawerAuth.ts`
- Create: `src/lib/api/respond.ts`
- Test: `src/lib/api/__tests__/respond.test.ts`

```ts
export function ok<T>(data: T, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
export function fail(code: 'unauthorized'|'forbidden'|'not_found'|'conflict'|'server', message: string) {
  const status = { unauthorized: 401, forbidden: 403, not_found: 404, conflict: 409, server: 500 }[code];
  return Response.json({ error: message, code }, { status, headers: { 'Cache-Control': 'no-store' } });
}
```

- [ ] **Step 1: Test** — 401 sans session, 404, 500.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter** + `requireUser`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(api): socle des routes drawers`.

---

## Phase 1 — Drawer Réseau

### Task 5: API Réseau

**Files:**
- Create: `src/app/api/compte/reseau/followers/route.ts`
- Create: `src/app/api/compte/reseau/following/route.ts`
- Create: `src/app/api/compte/reseau/follow/route.ts`
- Create: `src/app/api/compte/reseau/requests/route.ts`
- Create: `src/app/api/compte/reseau/cordee/route.ts`
- Test: `src/app/api/compte/reseau/__tests__/route.test.ts`

**Requêtes réelles :**

```ts
const { data: followRows } = await supabase
  .from('user_follows')
  .select('follower_id, close_friend, created_at')
  .eq('following_id', user.id);

const ids = followRows.map((row) => row.follower_id);
const { data: profiles } = await supabase
  .from('public_profiles')
  .select('id, handle, full_name, avatar_url, trust_score, location')
  .in('id', ids);
```

- [ ] **Step 1: Test** — 401, 200, follow idempotent, unfollow, demande privée, cordée max 30.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter** les 5 routes + Zod.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(reseau): API`.

**Acceptance :** aucune fuite de demande ou de cordée ; les compteurs viennent des lignes réelles.

---

### Task 6: UI Abonnés

**Files:**
- Create: `src/components/compte/drawer/reseau/ReseauDrawer.tsx`
- Create: `src/components/compte/drawer/reseau/FollowersPane.tsx`
- Create: `src/components/compte/drawer/reseau/FollowRequests.tsx`
- Create: `src/components/compte/drawer/reseau/CordeeStrip.tsx`
- Create: `src/components/compte/drawer/reseau/UserRow.tsx`
- Test: `src/components/compte/drawer/reseau/__tests__/FollowersPane.test.tsx`

**Structure :**

```tsx
<DrawerShell
  tabs={[
    { id: 'following', label: 'Abonnements', icon: <User size={18} />, render: () => <FollowingPane /> },
    { id: 'followers', label: 'Abonnés', icon: <Users size={18} />, render: () => <FollowersPane /> },
  ]}
  activeIndex={tab}
  onIndexChange={setTab}
  secondary={{ items: filters, active: filter, onChange: setFilter }}
>
  {tab === 0 ? <FollowingPane /> : <FollowersPane />}
</DrawerShell>
```

- [ ] **Step 1: Test** — recherche, filtres, cordée, demandes, follow optimiste + rollback.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter** les composants.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(reseau): abonnés`.

---

### Task 7: UI Abonnements, demandes, cordée

**Files:**
- Create: `src/components/compte/drawer/reseau/FollowingPane.tsx`
- Create: `src/components/compte/drawer/reseau/Suggestions.tsx`
- Test: `src/components/compte/drawer/reseau/__tests__/FollowingPane.test.tsx`

- [ ] **Step 1: Test** — liste, badge « te suit aussi », retrait avec confirmation, suggestions.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter**.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(reseau): abonnements et suggestions`.

---

### Task 8: Intégration et E2E Réseau

**Files:**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js`
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx`
- Test: `tests/e2e/compte-reseau.spec.ts`

- [ ] **Step 1: E2E** — ouvrir, basculer, rechercher, accepter une demande, ajouter à la cordée.
- [ ] **Step 2: Implémenter** — monter `ReseauDrawer` dans le runtime.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(reseau): intégration drawer`.

---

## Phase 2 — Drawer Sortie

### Task 9: API Sortie

**Files:**
- Create: `src/app/api/compte/sorties/[id]/route.ts`
- Create: `src/app/api/compte/sorties/[id]/photos/route.ts`
- Create: `src/app/api/compte/sorties/[id]/gear/route.ts`
- Create: `src/app/api/compte/sorties/[id]/participants/route.ts`
- Create: `src/app/api/compte/sorties/[id]/kudos/route.ts`
- Create: `src/app/api/compte/sorties/[id]/comments/route.ts`
- Test: `src/app/api/compte/sorties/__tests__/[id].test.ts`

**Requête principale :**

```ts
const { data: session } = await supabase
  .from('hike_sessions')
  .select('id,user_id,route_id,started_at,ended_at,distance_km,elevation_gain_m,positions_timed,kit_id,title,max_altitude_m,status,visibility,cover_url,weather,gpx_url,notes')
  .eq('id', params.id)
  .maybeSingle();
```

- [ ] **Step 1: Test** — 200 propriétaire, 403 privé, 404 inconnu, photos/gear/participants CRUD.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter** les routes + RLS.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(sortie): API détail`.

---

### Task 10: UI Résumé + Trace

**Files:**
- Create: `src/components/compte/drawer/sortie/SortieDrawer.tsx`
- Create: `src/components/compte/drawer/sortie/OutingSummary.tsx`
- Create: `src/components/compte/drawer/sortie/OutingTrace.tsx`
- Create: `src/components/compte/drawer/sortie/ElevationProfile.tsx`
- Test: `src/components/compte/drawer/sortie/__tests__/OutingSummary.test.tsx`

- [ ] **Step 1: Test** — hero, tuiles, statut, actions, profil altimétrique.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter**.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(sortie): résumé et trace`.

---

### Task 11: UI Photos + Matériel

**Files:**
- Create: `src/components/compte/drawer/sortie/OutingPhotos.tsx`
- Create: `src/components/compte/drawer/sortie/OutingGear.tsx`
- Test: `src/components/compte/drawer/sortie/__tests__/OutingGear.test.tsx`

- [ ] **Step 1: Test** — grille, ajout/suppression, kit, objets, manquants.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter**.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(sortie): photos et matériel`.

---

### Task 12: UI Compagnons + Météo + Échanges

**Files:**
- Create: `src/components/compte/drawer/sortie/OutingParticipants.tsx`
- Create: `src/components/compte/drawer/sortie/OutingWeather.tsx`
- Create: `src/components/compte/drawer/sortie/OutingComments.tsx`
- Test: `src/components/compte/drawer/sortie/__tests__/OutingComments.test.tsx`

- [ ] **Step 1: Test** — participants, kudos, météo, commentaires.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter**.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(sortie): compagnons, météo, échanges`.

---

### Task 13: Intégration et E2E Sortie

**Files:**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js`
- Test: `tests/e2e/compte-sortie.spec.ts`

- [ ] **Step 1: E2E** — ouvrir une sortie, parcourir les sous-drawers, partager, exporter GPX.
- [ ] **Step 2: Implémenter** — monter `SortieDrawer`.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(sortie): intégration drawer`.

---

## Phase 3 — Drawer Compte

### Task 14: API Commandes et Notifications

**Files:**
- Create: `src/app/api/compte/compte/orders/route.ts`
- Create: `src/app/api/compte/compte/notifications/route.ts`
- Test: `src/app/api/compte/compte/__tests__/route.test.ts`

**Requêtes réelles :**

```ts
const { data: orders } = await supabase
  .from('orders')
  .select('id,order_number,status,total_eur,items,created_at,tracking_url,carrier,estimated_delivery')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
  .limit(50);

const { data: notifications } = await supabase
  .from('notifications')
  .select('id,type,title,message,read,created_at,link,"group",actor_id,entity_type,entity_id')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
  .limit(50);
```

- [ ] **Step 1: Test** — 401, 200, PATCH lecture, 403 sur notification d’autrui.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter**.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(compte): API commandes et notifications`.

---

### Task 15: UI Commandes

**Files:**
- Create: `src/components/compte/drawer/compte/CompteDrawer.tsx`
- Create: `src/components/compte/drawer/compte/OrdersPane.tsx`
- Create: `src/components/compte/drawer/compte/OrderCard.tsx`
- Test: `src/components/compte/drawer/compte/__tests__/OrdersPane.test.tsx`

- [ ] **Step 1: Test** — stepper, filtres, empty, actions.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter**.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(compte): commandes`.

---

### Task 16: UI Notifications

**Files:**
- Create: `src/components/compte/drawer/compte/NotificationsPane.tsx`
- Create: `src/components/compte/drawer/compte/NotificationRow.tsx`
- Test: `src/components/compte/drawer/compte/__tests__/NotificationsPane.test.tsx`

- [ ] **Step 1: Test** — groupes, filtres, lecture, « tout lire ».
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter**.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(compte): notifications`.

---

### Task 17: UI Paramètres + Profil + Partage

**Files:**
- Create: `src/components/compte/drawer/compte/SettingsHub.tsx`
- Create: `src/components/compte/drawer/compte/EditProfilePane.tsx`
- Create: `src/components/compte/drawer/compte/SharePane.tsx`
- Create: `src/app/api/compte/compte/share/route.ts`
- Test: `src/components/compte/drawer/compte/__tests__/EditProfilePane.test.tsx`

- [ ] **Step 1: Test** — hub, complétude, validation, partage/QR/révocation.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter**.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(compte): paramètres, profil et partage`.

---

### Task 18: Intégration et E2E Compte

**Files:**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js`
- Test: `tests/e2e/compte-compte.spec.ts`

- [ ] **Step 1: E2E** — 5 sections, commande, notification, profil, partage.
- [ ] **Step 2: Implémenter** — monter `CompteDrawer`.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(compte): intégration drawer Compte`.

---

## Phase 4 — Finitions

### Task 19: Audit accessibilité, performance, offline

**Files:**
- Test: `tests/design/three-drawers-a11y.spec.ts`
- Test: `tests/e2e/three-drawers-offline.spec.ts`

- [ ] **Step 1: Tests** — focus, contraste, 44 px, reduced motion, cache.
- [ ] **Step 2: Corriger**.
- [ ] **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `chore(compte): audit trois drawers`.

---

### Task 20: Production

- [ ] **Step 1:** `tsc`, build, tests complets.
- [ ] **Step 2:** déploiement Vercel production.
- [ ] **Step 3:** smoke test des 3 drawers + console + CSP.
- [ ] **Step 4:** rapport.

---

## Ordre recommandé

1. Phase 0 (fondations).
2. Réseau (rapide, fort impact).
3. Sortie (cœur de la valeur).
4. Compte (quotidien).
5. Audit + production.

Chaque phase est livrable seule.
