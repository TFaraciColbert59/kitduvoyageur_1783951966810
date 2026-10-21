# Drawer Profil 5 slots — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les 5 onglets actuels du drawer Profil par 5 slots réels — Vitrine, Kit, Prêts, Souvenirs, Communauté — avec le même sélecteur que la bottom bar et une confidentialité au niveau du compte (public / privé sur invitation).

**Architecture:** Le runtime conserve la feuille et le sélecteur capsule ; chaque slot est un composant React monté dans la feuille via un portail (`#lkdv-slot-root`). Les données viennent de `/api/compte/bootstrap` (lecture) et de routes dédiées (écriture). La confidentialité est portée par `user_profiles.profile_visibility` (`public` | `prive`) et `profile_invitations`.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Supabase (Postgres + RLS), Vitest, Playwright, Tailwind + tokens Liquid Glass existants.

**Spec:** `docs/superpowers/specs/2026-10-21-drawer-profil-6-slots-design.md`

## Global Constraints

- 5 slots exactement, sélecteur **identique à la bottom bar** (`.tb`), aucune nouvelle forme de sélecteur.
- Aucune donnée de démonstration sur un compte connecté : état vide explicite sinon.
- Compte `public` = tout le monde ; compte `prive` = invitation uniquement. Pas de visibilité par bloc.
- Aucune couronne de régularité, aucun classement nominatif.
- Réutiliser `--glass-*`, `--lkv-*`, `.lg`, `.li`, `.mbtn`, `.sel-lens`, `.flow` ; zéro orange `#E4501C`.
- Cible tactile 44 px, `role="tablist"/"tab"/"tabpanel"`, `prefers-reduced-motion`.
- Animations `transform`/`opacity` uniquement, 200–300 ms.
- Tests : `npx vitest run tests/design`, `src/components/compte/drawer/__tests__/`, `tests/e2e/compte-drawer-v2.spec.ts`.
- Commits fréquents : `feat(compte): …`, `fix(compte): …`, `test(compte): …`.

---

### Task 1: Migration confidentialité compte, republication, invitations, index

**Files:**
- Create: `supabase/migrations/20261022100000_profile_visibility_invitations.sql`
- Modify: `src/features/compte/data/accountBootstrap.ts` (mapping clubs)
- Test: `tests/design/compte-drawer-v2-schema.spec.ts`

**Interfaces:**
- Produces: `profile_visibility in ('public','prive')`, table `profile_invitations`, colonne `community_posts.reposted_from_id`, vue `public_profiles` étendue, index chauds.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/migrations/20261022100000_profile_visibility_invitations.sql', 'utf8');

describe('Drawer v2 — schéma', () => {
  it('deux niveaux de compte et invitations', () => {
    expect(sql).toContain("profile_visibility in ('public','prive')");
    expect(sql).toContain('profile_invitations');
  });
  it('republication et index', () => {
    expect(sql).toContain('reposted_from_id');
    expect(sql).toContain('materiel_loans_lender_status_idx');
    expect(sql).toContain('club_events_club_date_idx');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/design/compte-drawer-v2-schema.spec.ts`
Expected: FAIL — migration absente.

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
create index if not exists profile_invitations_owner_idx on public.profile_invitations (owner_id, status);
```

Mettre à jour la vue `public_profiles` : `profile_visibility = 'public'` → tout le
monde ; `profile_visibility = 'prive'` → `id = auth.uid()` ou invitation acceptée
non expirée. Corriger `mapClubs` pour lire le prochain événement depuis `club_events`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/design/compte-drawer-v2-schema.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261022100000_profile_visibility_invitations.sql src/features/compte/data/accountBootstrap.ts tests/design/compte-drawer-v2-schema.spec.ts
git commit -m "feat(compte): confidentialité public/privé, invitations et republication"
```

---

### Task 2: Bootstrap — stats, republications, badges, kits, prêts, souvenirs, défis, clubs, cordée

**Files:**
- Modify: `src/features/compte/data/accountBootstrap.ts`
- Test: `tests/design/compte-bootstrap-api.spec.ts`

**Interfaces:**
- Produces: `stats`, `reposts`, `badges`, `kits`, `gearItems`, `loans`, `memories`, `stamps`, `challenges`, `clubs`, `companions`, `visibility`.

- [ ] **Step 1: Write the failing test**

```ts
it('mappe les republications attribuées et les compagnons', () => {
  const reposts = mapReposts([
    { id: 'p2', reposted_from_id: 'p1', created_at: '2026-10-01T10:00:00Z', audience: 'public' },
  ], new Map([['p1', { id: 'p1', title: 'Lac Blanc', author_id: 'u2' }]]), new Map([['u2', { handle: 'lea', full_name: 'Léa' }]]));
  expect(reposts[0].sourceAuthor).toBe('@lea');
  expect(reposts[0].sourceTitle).toBe('Lac Blanc');

  const companions = mapCompanions([
    { session_id: 's1', user_id: 'u2' },
    { session_id: 's2', user_id: 'u2' },
  ], new Map([['u2', { handle: 'lea', full_name: 'Léa' }]]));
  expect(companions[0].outings).toBe(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/design/compte-bootstrap-api.spec.ts`
Expected: FAIL — `mapReposts` / `mapCompanions` absents.

- [ ] **Step 3: Write minimal implementation**

Ajouter `mapReposts`, `mapCompanions`, `mapChallenges`, `mapKits`, `mapLoans`,
`mapStamps`, puis étendre `loadAccountBootstrap` avec les requêtes `community_posts`
(reposts), `badges`, `user_badges`, `challenges`, `user_challenges`,
`progression_challenges`, `materiel_kits`, `materiel_kit_items`, `product_ownership`,
`materiel_loans`, `hike_sessions`, `hiking_routes`, `geo_massifs`, `clubs`,
`club_members`, `club_events`, `club_topics`, `user_follows`, `public_profiles`.
Chaque requête passe par `safeRows`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/design/compte-bootstrap-api.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/compte/data/accountBootstrap.ts tests/design/compte-bootstrap-api.spec.ts
git commit -m "feat(compte): bootstrap des 5 slots"
```

---

### Task 3: Sélecteur identique à la bottom bar + pont React

**Files:**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js`
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx`
- Create: `src/components/compte/drawer/ProfileDrawerHost.tsx`
- Create: `src/components/compte/drawer/SlotSelector.tsx`
- Create: `src/components/compte/drawer/SlotShell.tsx`
- Test: `tests/design/compte-drawer-v2-shell.spec.ts`

**Interfaces:**
- Produces: `SlotId = 'vitrine' | 'kit' | 'prets' | 'souvenirs' | 'communaute'` ; `window.__lkdvOpenSlot(slotId)` ; `#lkdv-slot-root`.
- Consumes: `viewer: 'owner' | 'visitor'`, `visibility: 'public' | 'prive'`.

- [ ] **Step 1: Write the failing test**

```ts
it('garde le sélecteur de la bottom bar et expose 5 slots', () => {
  const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
  const selector = read('src/components/compte/drawer/SlotSelector.tsx');
  expect(runtime).toContain('__lkdvOpenSlot');
  expect(runtime).toContain('lkdv-slot-root');
  expect(selector).toContain('tb');
  expect(selector).toContain("'vitrine'");
  expect(selector).toContain("'communaute'");
  expect(selector).not.toContain('SlotRail');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/design/compte-drawer-v2-shell.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Le runtime, pour `S.step === 0`, rend `<div id="lkdv-slot-root"></div>` et appelle
`window.__lkdvMountSlot?.(root, slotId, S)`. `SlotSelector` réutilise la capsule
`.tb` : 5 boutons icône + libellé, lentille `.sel-lens`, hauteur 50 px, aucun
nouveau style. `SlotShell` fournit titre, sous-lentilles `.flow`, états.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/design/compte-drawer-v2-shell.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/compte-liquid-glass-v8-runtime.js src/components/compte/CompteLiquidGlassV8.tsx src/components/compte/drawer/ProfileDrawerHost.tsx src/components/compte/drawer/SlotSelector.tsx src/components/compte/drawer/SlotShell.tsx tests/design/compte-drawer-v2-shell.spec.ts
git commit -m "feat(compte): sélecteur bottom bar et pont React des 5 slots"
```

---

### Task 4: Vitrine — lentille Stats

**Files:**
- Create: `src/components/compte/drawer/slots/VitrineSlot.tsx`
- Create: `src/components/compte/drawer/cards/StatTile.tsx`
- Test: `src/components/compte/drawer/__tests__/VitrineStats.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche les stats réelles', () => {
  render(<VitrineSlot lens="stats" stats={{ km: 351, dplus: 20200, outings: 10, nights: 4, massifs: 3, countries: 2, yearMonths: [], bestMonth: 'Août', longestOuting: 58 }} />);
  expect(screen.getByText('351 km')).toBeTruthy();
  expect(screen.getByText('Août')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/VitrineStats.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`StatTile` : label, valeur, icône. `VitrineSlot` stats : carte héro 3 colonnes,
rangée de 3 tuiles, carte « Cette année » 12 barres, meilleur mois, plus longue
sortie. État vide.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/VitrineStats.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/slots/VitrineSlot.tsx src/components/compte/drawer/cards/StatTile.tsx src/components/compte/drawer/__tests__/VitrineStats.test.tsx
git commit -m "feat(compte): vitrine — stats réelles"
```

---

### Task 5: Vitrine — lentille Republication

**Files:**
- Create: `src/components/compte/drawer/cards/RepostCard.tsx`
- Modify: `src/components/compte/drawer/slots/VitrineSlot.tsx`
- Create: `src/app/api/compte/repost/route.ts`
- Test: `src/components/compte/drawer/__tests__/VitrineRepost.test.tsx`, `tests/design/compte-repost-api.spec.ts`

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche la source et l’attribution', () => {
  render(<VitrineSlot lens="repost" reposts={[
    { id: 'p2', sourceTitle: 'Lac Blanc', sourceAuthor: '@lea', createdAt: '2026-10-01T10:00:00Z', audience: 'public' },
  ]} />);
  expect(screen.getByText('Lac Blanc')).toBeTruthy();
  expect(screen.getByText('@lea')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/VitrineRepost.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`RepostCard` : vignette source, auteur d’origine, date source, date relais,
pastille audience, chevron « Voir l’original ». Route `repost` : vérifie la source,
crée une ligne `community_posts` avec `reposted_from_id`, attribution et
idempotence. État vide si aucune republication.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/VitrineRepost.test.tsx tests/design/compte-repost-api.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/cards/RepostCard.tsx src/components/compte/drawer/slots/VitrineSlot.tsx src/app/api/compte/repost/route.ts src/components/compte/drawer/__tests__/VitrineRepost.test.tsx tests/design/compte-repost-api.spec.ts
git commit -m "feat(compte): vitrine — republications attribuées"
```

---

### Task 6: Vitrine — lentille Trophées

**Files:**
- Create: `src/components/compte/drawer/cards/BadgeTile.tsx`
- Modify: `src/components/compte/drawer/slots/VitrineSlot.tsx`
- Test: `src/components/compte/drawer/__tests__/VitrineBadges.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche 4 badges récents puis l’armoire', () => {
  render(<VitrineSlot lens="badges" badges={[
    { id: 'b1', name: 'Explorateur', rarity: 'Commun', earned: true, earnedAt: '2026-08-01' },
    { id: 'b2', name: 'Légende vivante', rarity: 'Légendaire', earned: false, requirementValue: 50 },
  ]} />);
  expect(screen.getByText('Explorateur')).toBeTruthy();
  expect(screen.getByText('Légende vivante')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/VitrineBadges.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`BadgeTile` : icône, nom, rareté, condition, état, date. Étagère de 4, carte
« Prochain badge », grille « Tout voir ».

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/VitrineBadges.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/cards/BadgeTile.tsx src/components/compte/drawer/slots/VitrineSlot.tsx src/components/compte/drawer/__tests__/VitrineBadges.test.tsx
git commit -m "feat(compte): vitrine — trophées"
```

---

### Task 7: Kit — Kits et Inventaire

**Files:**
- Create: `src/components/compte/drawer/slots/KitSlot.tsx`
- Create: `src/components/compte/drawer/cards/KitCard.tsx`
- Create: `src/components/compte/drawer/cards/WearGauge.tsx`
- Test: `src/components/compte/drawer/__tests__/KitSlot.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche le kit réel et l’inventaire', () => {
  render(<KitSlot lens="kits" kits={[{ id: 'k1', n: 'Kit 3 saisons', w: 4200, items: 10, gen: 'Lignée G2', proven: 3 }]} gearItems={[]} />);
  expect(screen.getByText('4,20 kg')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/KitSlot.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`KitCard` : couverture, nom, poids, objets, génération, preuves. `WearGauge` :
usure dérivée des sorties, seuil, CTA. `KitSlot` : lentilles Kits / Inventaire,
visiteur sans prix ni prêt.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/KitSlot.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/slots/KitSlot.tsx src/components/compte/drawer/cards/KitCard.tsx src/components/compte/drawer/cards/WearGauge.tsx src/components/compte/drawer/__tests__/KitSlot.test.tsx
git commit -m "feat(compte): kit et inventaire réels"
```

---

### Task 8: Prêts — Je prête, J'emprunte, Confiance

**Files:**
- Create: `src/components/compte/drawer/slots/LoansSlot.tsx`
- Create: `src/components/compte/drawer/cards/LoanCard.tsx`
- Create: `src/app/api/compte/loans/route.ts`
- Test: `tests/design/compte-loans-api.spec.ts`, `src/components/compte/drawer/__tests__/LoansSlot.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
it('refuse un visiteur non authentifié', async () => {
  const res = await POST(new Request('http://x/api/compte/loans', { method: 'POST', body: JSON.stringify({ action: 'accept', loanId: 'l1' }) }));
  expect(res.status).toBe(401);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/design/compte-loans-api.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Route `loans` : `request | accept | decline | return | rate | dispute`, refus 401.
`LoanCard` : objet, personne (visiteur : « Membre »), dates, statut, échéance,
actions. `LoansSlot` : trois lentilles, carte de confiance agrégée pour visiteur.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/design/compte-loans-api.spec.ts src/components/compte/drawer/__tests__/LoansSlot.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/compte/loans/route.ts src/components/compte/drawer/slots/LoansSlot.tsx src/components/compte/drawer/cards/LoanCard.tsx tests/design/compte-loans-api.spec.ts src/components/compte/drawer/__tests__/LoansSlot.test.tsx
git commit -m "feat(compte): prêts, emprunts et confiance"
```

---

### Task 9: Souvenirs — Timeline et Passeport

**Files:**
- Create: `src/components/compte/drawer/slots/MemoriesSlot.tsx`
- Create: `src/components/compte/drawer/cards/StampTile.tsx`
- Create: `src/components/compte/drawer/cards/OutingCard.tsx`
- Test: `src/components/compte/drawer/__tests__/MemoriesSlot.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche une sortie réelle et un tampon', () => {
  render(<MemoriesSlot lens="timeline" outings={[{ id: 'o1', title: 'Lac Blanc', km: 12.5, dplus: 800, mass: 'Mont-Blanc', date: '19 sept.', proven: true }]} stamps={[{ id: 's1', name: 'Néouvielle', kind: 'massif', outings: 2, verified: true }]} />);
  expect(screen.getByText('Lac Blanc')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/MemoriesSlot.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`OutingCard` : couverture, titre, km · D+, massif, date, pastille GPS, photos.
`StampTile` : lieu, type, sorties, sceau. `MemoriesSlot` : lentilles Timeline /
Passeport / Souvenirs (collections + 3D).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/MemoriesSlot.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/slots/MemoriesSlot.tsx src/components/compte/drawer/cards/StampTile.tsx src/components/compte/drawer/cards/OutingCard.tsx src/components/compte/drawer/__tests__/MemoriesSlot.test.tsx
git commit -m "feat(compte): souvenirs — timeline et passeport"
```

---

### Task 10: Communauté — Défis, Clubs, Cordée

**Files:**
- Create: `src/components/compte/drawer/slots/CommunitySlot.tsx`
- Create: `src/components/compte/drawer/cards/ChallengeRow.tsx`
- Create: `src/components/compte/drawer/cards/ClubCard.tsx`
- Create: `src/components/compte/drawer/cards/CompanionRow.tsx`
- Test: `src/components/compte/drawer/__tests__/CommunitySlot.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche défis, clubs et compagnons réels', () => {
  render(<CommunitySlot lens="clubs" challenges={[]} clubs={[{ id: 'c1', n: 'Club Alpin', role: 'Membre actif', members: 142, nextEvent: { title: 'Néouvielle', event_date: '2026-10-24' } }]} companions={[{ id: 'u2', n: 'Léa', ps: 'lea', outings: 2 }]} />);
  expect(screen.getByText('Club Alpin')).toBeTruthy();
  expect(screen.getByText('Néouvielle')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/CommunitySlot.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`ChallengeRow` : titre, catégorie, difficulté, XP, progression, échéance.
`ClubCard` : emoji, nom, rôle, membres, prochain événement, sujets, RSVP.
`CompanionRow` : avatar, nom, @handle, sorties communes, massif. `CommunitySlot`
trois lentilles.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/CommunitySlot.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/slots/CommunitySlot.tsx src/components/compte/drawer/cards/ChallengeRow.tsx src/components/compte/drawer/cards/ClubCard.tsx src/components/compte/drawer/cards/CompanionRow.tsx src/components/compte/drawer/__tests__/CommunitySlot.test.tsx
git commit -m "feat(compte): communauté — défis, clubs et cordée"
```

---

### Task 11: Compte privé, invitations et vue visiteur

**Files:**
- Create: `src/app/api/compte/invitations/route.ts`
- Create: `src/components/compte/drawer/PrivateAccountLock.tsx`
- Modify: `src/components/compte/drawer/ProfileDrawerHost.tsx`
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

Route `invitations` : `create | revoke | accept`, refus 401, RLS
`profile_invitations`. `PrivateAccountLock` : avatar flouté, nom, mention
« Compte privé · accès sur invitation », aucun slot. Propriétaire : gestion des
invitations depuis Vitrine (créer, copier le lien, révoquer).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/design/compte-invitations-api.spec.ts src/components/compte/drawer/__tests__/PrivateAccount.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/compte/invitations/route.ts src/components/compte/drawer/PrivateAccountLock.tsx src/components/compte/drawer/ProfileDrawerHost.tsx tests/design/compte-invitations-api.spec.ts src/components/compte/drawer/__tests__/PrivateAccount.test.tsx
git commit -m "feat(compte): compte privé et invitations"
```

---

### Task 12: E2E, accessibilité et performance

**Files:**
- Create: `tests/e2e/compte-drawer-v2.spec.ts`
- Modify: `src/components/compte/drawer/SlotSelector.tsx`
- Modify: `src/components/compte/drawer/SlotShell.tsx`

- [ ] **Step 1: Write the failing test**

```ts
test('propriétaire : les 5 slots s’ouvrent avec des données réelles', async ({ page }) => {
  await login(page, 'owner');
  await page.goto('/compte');
  await page.getByRole('button', { name: /Profil/ }).click();
  for (const slot of ['Vitrine', 'Kit', 'Prêts', 'Souvenirs', 'Communauté']) {
    await page.getByRole('tab', { name: slot }).click();
    await expect(page.getByTestId('slot-content')).toBeVisible();
  }
});

test('visiteur : un compte privé est verrouillé', async ({ page }) => {
  await page.goto('/u/compte_prive_test');
  await expect(page.getByText(/Compte privé/)).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/compte-drawer-v2.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Corriger rôles ARIA, libellés, états de chargement, réduction de mouvement,
lazy load par slot, et vérifier que le sélecteur reste la capsule `.tb`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/e2e/compte-drawer-v2.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/compte-drawer-v2.spec.ts src/components/compte/drawer/SlotSelector.tsx src/components/compte/drawer/SlotShell.tsx
git commit -m "test(compte): e2e des 5 slots et du compte privé"
```

---

## Self-review

- **Spec coverage** : 5 slots, 12 lentilles, sélecteur bottom bar, confidentialité
  public/privé, republication, liens BDD et migration couverts par les tâches 1 à 12.
- **Cohérence** : `SlotId` à 5 valeurs, `viewer`, `visibility`, `mapReposts`,
  `mapCompanions`, `PrivateAccountLock` définis une fois.
- **Dépendances** : Task 1–2 avant Task 3 ; Task 3 avant les slots ; Task 11 après
  les slots ; Task 12 en dernier.
