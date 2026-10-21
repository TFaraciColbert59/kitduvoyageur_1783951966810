# Drawer Profil 5 slots — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer les 5 slots du drawer Profil — Vitrine, Kit, Prêts, Souvenirs, Communauté — avec sélecteur `.ig-tabs` en bas à gauche, swipe des lentilles, carte du bas en mode contexte, kit avec images produit et fonctions existantes, Souvenirs limité aux stories À la une, clubs scrollables avec drawer club, compte public/privé sur invitation.

**Architecture:** Le runtime garde la feuille, le sélecteur et les gestes ; chaque slot est un composant React monté via `#lkdv-slot-root`. Les lentilles sont une piste horizontale swipable synchronisée avec le segmented `.flow`. La carte du bas reçoit un mode contexte piloté par le slot actif. Les données viennent du bootstrap et des routes existantes de kit.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Supabase (Postgres + RLS), Vitest, Playwright, Tailwind + tokens Liquid Glass.

**Spec:** `docs/superpowers/specs/2026-10-21-drawer-profil-5-slots-design.md`

## Global Constraints

- 5 slots, sélecteur `.ig-tabs` (petite capsule à lentille) en bas à gauche, aucun nouveau style de sélecteur.
- Swipe horizontal des lentilles uniquement, seuil 24 px, verrouillage d'axe, snap 250 ms.
- Aucune carte ajoutée dans le drawer ; la carte du bas passe en mode contexte.
- Kit : image produit à chaque fois ; réutiliser `/api/materiel/fork`, `/api/materiel/share`, `/api/kits/:id/sheet`, `/api/kits/:id/refer`, `/api/kits/my-royalties`, `/api/materiel/kits/:id/history`, `/api/kits/discovery`.
- Souvenirs : uniquement `story_highlights` + `story_highlight_items`.
- Prêts : « prêts rendus » retiré de Confiance.
- Compte `public` = tout le monde ; `prive` = invitation uniquement. Pas de visibilité par bloc.
- Réutiliser `--glass-*`, `--lkv-*`, `.lg`, `.li`, `.mbtn`, `.ig-tabs`, `.flow` ; zéro orange `#E4501C`.
- 44 px, `role="tablist"/"tab"/"tabpanel"`, `prefers-reduced-motion`.
- Tests : `npx vitest run tests/design`, `src/components/compte/drawer/__tests__/`, `tests/e2e/compte-drawer-v2.spec.ts`.
- Commits : `feat(compte): …`, `fix(compte): …`, `test(compte): …`.

---

### Task 1: Migration confidentialité, invitations, republication, index

**Files:**
- Create: `supabase/migrations/20261022100000_profile_visibility_invitations.sql`
- Modify: `src/features/compte/data/accountBootstrap.ts` (clubs)
- Test: `tests/design/compte-drawer-v2-schema.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
const sql = readFileSync('supabase/migrations/20261022100000_profile_visibility_invitations.sql', 'utf8');
it('deux niveaux, invitations, republication', () => {
  expect(sql).toContain("profile_visibility in ('public','prive')");
  expect(sql).toContain('profile_invitations');
  expect(sql).toContain('reposted_from_id');
  expect(sql).toContain('story_highlights_owner_position_idx');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/design/compte-drawer-v2-schema.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```sql
update public.user_profiles set profile_visibility = 'public' where profile_visibility = 'communaute';
alter table public.user_profiles
  add constraint user_profiles_profile_visibility_check check (profile_visibility in ('public','prive'));

alter table public.community_posts
  add column if not exists reposted_from_id uuid references public.community_posts(id) on delete set null;

create table if not exists public.profile_invitations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid references auth.users(id) on delete set null,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.profile_invitations enable row level security;
create policy profile_invitations_owner on public.profile_invitations
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy profile_invitations_invitee on public.profile_invitations
  for select to authenticated using (invitee_id = auth.uid());

create index if not exists materiel_loans_lender_status_idx on public.materiel_loans (lender_id, status);
create index if not exists club_events_club_date_idx on public.club_events (club_id, event_date);
create index if not exists community_posts_author_created_idx on public.community_posts (author_id, created_at desc);
create index if not exists story_highlights_owner_position_idx on public.story_highlights (owner_id, position);
```

Étendre la vue `public_profiles` aux invitations, corriger `mapClubs` pour lire
le prochain événement depuis `club_events`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/design/compte-drawer-v2-schema.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261022100000_profile_visibility_invitations.sql src/features/compte/data/accountBootstrap.ts tests/design/compte-drawer-v2-schema.spec.ts
git commit -m "feat(compte): confidentialité, invitations, republication et index"
```

---

### Task 2: Bootstrap complet des 5 slots

**Files:**
- Modify: `src/features/compte/data/accountBootstrap.ts`
- Test: `tests/design/compte-bootstrap-api.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('mappe kits avec image, highlights À la une et compagnons', () => {
  const kits = mapKits([{ id: 'k1', name: 'Kit', cover_image_url: null, total_weight_g: 4200 }], new Map([['k1', 10]]), new Map([['k1', 'https://img/x.jpg']]));
  expect(kits[0].image).toBe('https://img/x.jpg');

  const highlights = mapHighlights([{ id: 'h1', title: 'Néouvielle', cover_story_id: 's1', position: 1 }], new Map([['h1', 4]]));
  expect(highlights[0].items).toBe(4);

  const companions = mapCompanions([{ session_id: 's1', user_id: 'u2' }, { session_id: 's2', user_id: 'u2' }], new Map([['u2', { handle: 'lea' }]]));
  expect(companions[0].outings).toBe(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/design/compte-bootstrap-api.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Ajouter `mapKits` (avec image de repli issue de `product_ownership.photo_url` ou
`kit_items.image`), `mapHighlights` (`story_highlights` + comptage
`story_highlight_items`), `mapCompanions`, `mapReposts`, `mapChallenges`,
`mapStamps`, `mapLoans`. Étendre `loadAccountBootstrap` avec les requêtes
correspondantes : `materiel_kits`, `materiel_kit_items`, `product_ownership`,
`kit_items`, `story_highlights`, `story_highlight_items`, `community_posts`,
`badges`, `user_badges`, `challenges`, `user_challenges`, `progression_challenges`,
`materiel_loans`, `hike_sessions`, `hiking_routes`, `geo_massifs`, `clubs`,
`club_members`, `club_events`, `club_topics`, `user_follows`, `public_profiles`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/design/compte-bootstrap-api.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/compte/data/accountBootstrap.ts tests/design/compte-bootstrap-api.spec.ts
git commit -m "feat(compte): bootstrap kits images, À la une, clubs et cordée"
```

---

### Task 3: Sélecteur `.ig-tabs`, swipe des lentilles, carte contexte

**Files:**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js`
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx`
- Create: `src/components/compte/drawer/ProfileDrawerHost.tsx`
- Create: `src/components/compte/drawer/SlotSelector.tsx`
- Create: `src/components/compte/drawer/LensPager.tsx`
- Create: `src/components/compte/drawer/SlotShell.tsx`
- Test: `tests/design/compte-drawer-v2-shell.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('réutilise ig-tabs, gère le swipe et la carte contexte', () => {
  const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
  const selector = read('src/components/compte/drawer/SlotSelector.tsx');
  const pager = read('src/components/compte/drawer/LensPager.tsx');
  expect(runtime).toContain('__lkdvOpenSlot');
  expect(runtime).toContain('lkdv-map-context');
  expect(selector).toContain('ig-tabs');
  expect(pager).toContain('pointerdown');
  expect(pager).toContain('translateX');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/design/compte-drawer-v2-shell.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`SlotSelector` réutilise `.ig-tabs` / `.ig-th` : 5 icônes, l'actif s'élargit avec
libellé, position bas-gauche. `LensPager` : piste horizontale, seuil 24 px,
verrouillage d'axe, snap 250 ms, synchronisation avec `.flow`, clavier ←/→.
Le runtime ajoute `data-map-context` sur la carte du bas selon le slot actif et
retire l'attribut à la fermeture.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/design/compte-drawer-v2-shell.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/compte-liquid-glass-v8-runtime.js src/components/compte/CompteLiquidGlassV8.tsx src/components/compte/drawer/ProfileDrawerHost.tsx src/components/compte/drawer/SlotSelector.tsx src/components/compte/drawer/LensPager.tsx src/components/compte/drawer/SlotShell.tsx tests/design/compte-drawer-v2-shell.spec.ts
git commit -m "feat(compte): sélecteur ig-tabs, swipe des lentilles et carte contexte"
```

---

### Task 4: Vitrine — Stats

**Files:**
- Create: `src/components/compte/drawer/slots/VitrineSlot.tsx`
- Create: `src/components/compte/drawer/cards/StatTile.tsx`
- Test: `src/components/compte/drawer/__tests__/VitrineStats.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche les stats réelles sans carte interne', () => {
  render(<VitrineSlot lens="stats" stats={{ km: 351, dplus: 20200, outings: 10, nights: 4, massifs: 3, countries: 2, yearMonths: [], bestMonth: 'Août', longestOuting: 58 }} />);
  expect(screen.getByText('351 km')).toBeTruthy();
  expect(screen.queryByTestId('slot-map')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/VitrineStats.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Carte héro 3 colonnes, 3 tuiles, carte « Cette année » 12 barres. Aucune carte
dans le slot.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/VitrineStats.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/slots/VitrineSlot.tsx src/components/compte/drawer/cards/StatTile.tsx src/components/compte/drawer/__tests__/VitrineStats.test.tsx
git commit -m "feat(compte): vitrine — stats"
```

---

### Task 5: Vitrine — Republication et Trophées

**Files:**
- Create: `src/components/compte/drawer/cards/RepostCard.tsx`
- Create: `src/components/compte/drawer/cards/BadgeTile.tsx`
- Modify: `src/components/compte/drawer/slots/VitrineSlot.tsx`
- Create: `src/app/api/compte/repost/route.ts`
- Test: `src/components/compte/drawer/__tests__/VitrineRepost.test.tsx`, `tests/design/compte-repost-api.spec.ts`

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche les republications et les trophées', () => {
  render(<VitrineSlot lens="repost" reposts={[{ id: 'p2', sourceTitle: 'Lac Blanc', sourceAuthor: '@lea', createdAt: '2026-10-01', audience: 'public' }]} badges={[{ id: 'b1', name: 'Explorateur', rarity: 'Commun', earned: true }]} />);
  expect(screen.getByText('Lac Blanc')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/VitrineRepost.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`RepostCard` : vignette, auteur d'origine, dates, audience, « Voir l'original ».
`BadgeTile` : étagère 4, prochain badge, grille. Route `repost` : `reposted_from_id`,
attribution, idempotence, refus 401.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/VitrineRepost.test.tsx tests/design/compte-repost-api.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/cards/RepostCard.tsx src/components/compte/drawer/cards/BadgeTile.tsx src/components/compte/drawer/slots/VitrineSlot.tsx src/app/api/compte/repost/route.ts src/components/compte/drawer/__tests__/VitrineRepost.test.tsx tests/design/compte-repost-api.spec.ts
git commit -m "feat(compte): vitrine — republication et trophées"
```

---

### Task 6: Kit — Kits avec images et fonctions existantes

**Files:**
- Create: `src/components/compte/drawer/slots/KitSlot.tsx`
- Create: `src/components/compte/drawer/cards/KitCard.tsx`
- Test: `src/components/compte/drawer/__tests__/KitSlot.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche une image produit et les actions kit existantes', () => {
  render(<KitSlot lens="kits" kits={[{ id: 'k1', n: 'Kit 3 saisons', w: 4200, items: 10, image: 'https://img/x.jpg', proven: 3 }]} gearItems={[]} />);
  expect(screen.getByRole('img', { name: /Kit 3 saisons/ })).toBeTruthy();
  expect(screen.getByLabelText(/Partager/)).toBeTruthy();
  expect(screen.getByLabelText(/Récupérer/)).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/KitSlot.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`KitCard` : image produit (`cover_image_url` sinon première image d'objet, sinon
visuel généré), nom, poids, objets, génération, preuves. Actions branchées sur les
routes existantes : fork, share, sheet, refer, royalties, history, discovery.
Filiation G1 → G2 → G3.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/KitSlot.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/slots/KitSlot.tsx src/components/compte/drawer/cards/KitCard.tsx src/components/compte/drawer/__tests__/KitSlot.test.tsx
git commit -m "feat(compte): kit — images produit et fonctions existantes"
```

---

### Task 7: Kit — Inventaire avec images

**Files:**
- Create: `src/components/compte/drawer/cards/GearRow.tsx`
- Modify: `src/components/compte/drawer/slots/KitSlot.tsx`
- Test: `src/components/compte/drawer/__tests__/KitInventory.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche l’image produit de chaque objet', () => {
  render(<KitSlot lens="inventory" gearItems={[{ id: 'g1', n: 'Sac', b: 'LKDV', w: 900, c: 'Sac', photo_url: 'https://img/sac.jpg' }]} />);
  expect(screen.getByRole('img', { name: /Sac/ })).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/KitInventory.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`GearRow` : image 44 px, nom, marque, poids, état, badge prêt. Visiteur sans prix
ni prêt. État vide.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/KitInventory.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/cards/GearRow.tsx src/components/compte/drawer/slots/KitSlot.tsx src/components/compte/drawer/__tests__/KitInventory.test.tsx
git commit -m "feat(compte): inventaire — images produit"
```

---

### Task 8: Prêts — Je prête, J'emprunte, Confiance sans historique

**Files:**
- Create: `src/components/compte/drawer/slots/LoansSlot.tsx`
- Create: `src/components/compte/drawer/cards/LoanCard.tsx`
- Create: `src/app/api/compte/loans/route.ts`
- Test: `tests/design/compte-loans-api.spec.ts`, `src/components/compte/drawer/__tests__/LoansSlot.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche la confiance agrégée sans prêts rendus', () => {
  render(<LoansSlot lens="trust" trust={{ verified: true, active: 3, onTimeRate: 92, rating: 4.8 }} />);
  expect(screen.getByText('92 %')).toBeTruthy();
  expect(screen.queryByText(/prêts rendus/i)).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/LoansSlot.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Route `loans` : request/accept/decline/return/rate/dispute, refus 401. `LoanCard`
avec actions. Confiance : carte agrégée uniquement, **sans liste de prêts rendus**.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/design/compte-loans-api.spec.ts src/components/compte/drawer/__tests__/LoansSlot.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/compte/loans/route.ts src/components/compte/drawer/slots/LoansSlot.tsx src/components/compte/drawer/cards/LoanCard.tsx tests/design/compte-loans-api.spec.ts src/components/compte/drawer/__tests__/LoansSlot.test.tsx
git commit -m "feat(compte): prêts et confiance sans historique rendu"
```

---

### Task 9: Souvenirs — Timeline et Passeport

**Files:**
- Create: `src/components/compte/drawer/slots/MemoriesSlot.tsx`
- Create: `src/components/compte/drawer/cards/OutingCard.tsx`
- Create: `src/components/compte/drawer/cards/StampTile.tsx`
- Test: `src/components/compte/drawer/__tests__/MemoriesSlot.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche sorties et tampons réels', () => {
  render(<MemoriesSlot lens="timeline" outings={[{ id: 'o1', title: 'Lac Blanc', km: 12.5, dplus: 800, mass: 'Mont-Blanc', proven: true }]} stamps={[{ id: 's1', name: 'Néouvielle', kind: 'massif', outings: 2 }]} />);
  expect(screen.getByText('Lac Blanc')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/MemoriesSlot.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`OutingCard` 88 px, `StampTile` 96 px. Lentilles Timeline / Passeport / Souvenirs.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/MemoriesSlot.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/slots/MemoriesSlot.tsx src/components/compte/drawer/cards/OutingCard.tsx src/components/compte/drawer/cards/StampTile.tsx src/components/compte/drawer/__tests__/MemoriesSlot.test.tsx
git commit -m "feat(compte): souvenirs — timeline et passeport"
```

---

### Task 10: Souvenirs — stories À la une uniquement

**Files:**
- Create: `src/components/compte/drawer/cards/HighlightCard.tsx`
- Modify: `src/components/compte/drawer/slots/MemoriesSlot.tsx`
- Test: `src/components/compte/drawer/__tests__/MemoriesHighlights.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('ne liste que les À la une', () => {
  render(<MemoriesSlot lens="souvenirs" highlights={[{ id: 'h1', title: 'Néouvielle', items: 4, cover: 'https://img/h.jpg' }]} stories={[{ id: 's9', caption: 'Story normale' }]} />);
  expect(screen.getByText('Néouvielle')).toBeTruthy();
  expect(screen.queryByText('Story normale')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/MemoriesHighlights.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`HighlightCard` : couverture, titre, nombre d'éléments, clic → visionneuse À la
une. Aucune autre story listée. État vide « Aucune story à la une ».

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/MemoriesHighlights.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/cards/HighlightCard.tsx src/components/compte/drawer/slots/MemoriesSlot.tsx src/components/compte/drawer/__tests__/MemoriesHighlights.test.tsx
git commit -m "feat(compte): souvenirs — stories à la une uniquement"
```

---

### Task 11: Communauté — Défis

**Files:**
- Create: `src/components/compte/drawer/slots/CommunitySlot.tsx`
- Create: `src/components/compte/drawer/cards/ChallengeRow.tsx`
- Test: `src/components/compte/drawer/__tests__/CommunityChallenges.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche les défis réels', () => {
  render(<CommunitySlot lens="challenges" challenges={[{ id: 'c1', title: 'Kit parfait', category: 'Équipement', difficulty: 'Moyen', xp: 300, progress: 2, target: 5 }]} />);
  expect(screen.getByText('2 / 5')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/CommunityChallenges.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`ChallengeRow` : titre, catégorie, difficulté, XP, barre, échéance. Section
Terminés repliable. État vide.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/CommunityChallenges.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/slots/CommunitySlot.tsx src/components/compte/drawer/cards/ChallengeRow.tsx src/components/compte/drawer/__tests__/CommunityChallenges.test.tsx
git commit -m "feat(compte): communauté — défis"
```

---

### Task 12: Communauté — Clubs scrollables + drawer club

**Files:**
- Create: `src/components/compte/drawer/cards/ClubCard.tsx`
- Create: `src/components/compte/drawer/ClubDrawer.tsx`
- Modify: `src/components/compte/drawer/slots/CommunitySlot.tsx`
- Test: `src/components/compte/drawer/__tests__/CommunityClubs.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('rend les clubs scrollables et ouvre un drawer club', () => {
  render(<CommunitySlot lens="clubs" clubs={[{ id: 'c1', n: 'Club Alpin', role: 'Membre actif', members: 142, nextEvent: { title: 'Néouvielle', event_date: '2026-10-24' } }]} />);
  expect(screen.getByTestId('club-rail').className).toContain('overflow-x');
  fireEvent.click(screen.getByText('Club Alpin'));
  expect(screen.getByText(/Prochains événements/)).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/CommunityClubs.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Rail horizontal `overflow-x: auto`, snap, cartes 78 % de largeur. Clic → `ClubDrawer` :
en-tête, rôle, membres, prochains événements + RSVP, sujets, kits recommandés,
actions Rejoindre/Quitter/Partager/Inviter, sécurité.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/CommunityClubs.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/cards/ClubCard.tsx src/components/compte/drawer/ClubDrawer.tsx src/components/compte/drawer/slots/CommunitySlot.tsx src/components/compte/drawer/__tests__/CommunityClubs.test.tsx
git commit -m "feat(compte): clubs scrollables et drawer club"
```

---

### Task 13: Communauté — Cordée

**Files:**
- Create: `src/components/compte/drawer/cards/CompanionRow.tsx`
- Modify: `src/components/compte/drawer/slots/CommunitySlot.tsx`
- Test: `src/components/compte/drawer/__tests__/CommunityCordee.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche les compagnons réels', () => {
  render(<CommunitySlot lens="cordee" companions={[{ id: 'u2', n: 'Léa', ps: 'lea', outings: 2, mass: 'Néouvielle' }]} followers={[]} following={[]} />);
  expect(screen.getByText('2 sorties communes')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/CommunityCordee.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`CompanionRow` : avatar, nom, @handle, sorties communes, massif. Rangée abonnés /
abonnements, bandeau confiance. État vide.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/CommunityCordee.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/cards/CompanionRow.tsx src/components/compte/drawer/slots/CommunitySlot.tsx src/components/compte/drawer/__tests__/CommunityCordee.test.tsx
git commit -m "feat(compte): communauté — cordée"
```

---

### Task 14: Compte privé, invitations, E2E

**Files:**
- Create: `src/app/api/compte/invitations/route.ts`
- Create: `src/components/compte/drawer/PrivateAccountLock.tsx`
- Modify: `src/components/compte/drawer/ProfileDrawerHost.tsx`
- Create: `tests/e2e/compte-drawer-v2.spec.ts`
- Test: `tests/design/compte-invitations-api.spec.ts`, `src/components/compte/drawer/__tests__/PrivateAccount.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('verrouille un compte privé sans invitation', () => {
  render(<ProfileDrawerHost viewer="visitor" visibility="prive" invited={false} />);
  expect(screen.getByText(/Compte privé/)).toBeTruthy();
  expect(screen.queryByText('Vitrine')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/PrivateAccount.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Route `invitations` : create/revoke/accept, refus 401, RLS. `PrivateAccountLock` :
avatar flouté, nom, mention, aucun slot. Propriétaire : gestion des invitations
depuis Vitrine. E2E : propriétaire ouvre les 5 slots, visiteur d'un compte privé
voit le verrou, swipe des lentilles vérifié.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/design/compte-invitations-api.spec.ts src/components/compte/drawer/__tests__/PrivateAccount.test.tsx && npx playwright test tests/e2e/compte-drawer-v2.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/compte/invitations/route.ts src/components/compte/drawer/PrivateAccountLock.tsx src/components/compte/drawer/ProfileDrawerHost.tsx tests/e2e/compte-drawer-v2.spec.ts tests/design/compte-invitations-api.spec.ts src/components/compte/drawer/__tests__/PrivateAccount.test.tsx
git commit -m "feat(compte): compte privé, invitations et e2e des 5 slots"
```

---

## Self-review

- **Spec coverage** : 5 slots, sélecteur `.ig-tabs`, swipe, carte contexte, kit
  images + fonctions, À la une, clubs rail + drawer, prêts sans historique rendu,
  compte privé — couverts par les tâches 1 à 14.
- **Types cohérents** : `SlotId` (5), `viewer`, `visibility`, `mapHighlights`,
  `mapCompanions`, `ClubDrawer`, `PrivateAccountLock`.
- **Dépendances** : Task 1–2 avant Task 3 ; Task 3 avant les slots ; Task 14 en dernier.
