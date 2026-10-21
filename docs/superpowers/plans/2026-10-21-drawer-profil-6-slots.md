# Drawer Profil 6 slots — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les 5 onglets actuels du drawer Profil par 6 slots réels : Vitrine, Kit & Sac, Prêts & Locations, Sorties & Souvenirs, Communauté (privé), Atelier de publication (privé).

**Architecture:** Le runtime conserve la feuille, les gestes et les transitions ; un rail horizontal de slots remplace la barre d'onglets, et chaque slot est un composant React monté dans la feuille via un portail (`#lkdv-slot-root`). Les données viennent de `/api/compte/bootstrap` (lecture) et de routes dédiées (écriture), avec une visibilité par bloc dans `user_profiles.profile_section_visibility`.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Supabase (Postgres + RLS), Vitest, Playwright, Tailwind + tokens Liquid Glass existants.

**Spec:** `docs/superpowers/specs/2026-10-21-drawer-profil-6-slots-design.md`

## Global Constraints

- Aucune donnée de démonstration sur un compte connecté : état vide explicite sinon.
- Slots 5 et 6 **privés** : jamais rendus pour un visiteur.
- Aucune couronne de régularité, aucun classement nominatif, aucun rang.
- Réutiliser `--glass-*`, `--lkv-*`, `.lg`, `.li`, `.mbtn`, `.sel-lens` ; pas de nouvelle palette, zéro orange `#E4501C`.
- Cible tactile 44 px, `role="tablist"/"tab"/"tabpanel"`, `prefers-reduced-motion` respecté.
- Animations limitées à `transform` et `opacity`, 200–300 ms pour les lentilles.
- Tests : `npx vitest run tests/design`, tests unitaires `src/components/compte/drawer/__tests__/`, Playwright `tests/e2e/compte-drawer-v2.spec.ts`.
- Commits fréquents : `feat(compte): …`, `fix(compte): …`, `test(compte): …`.

---

### Task 1: Migration visibilité, republication, index, correction clubs

**Files:**
- Create: `supabase/migrations/20261022100000_profile_section_visibility.sql`
- Modify: `src/features/compte/data/accountBootstrap.ts` (mapping clubs)
- Test: `tests/design/compte-drawer-v2-schema.spec.ts`

**Interfaces:**
- Produces: `profile_section_visibility jsonb`, `community_posts.reposted_from_id`, `community_posts.scheduled_at`, `community_post_drafts.scheduled_at`, index prêts/événements/publications.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/migrations/20261022100000_profile_section_visibility.sql', 'utf8');

describe('Drawer v2 — schéma', () => {
  it('ajoute la visibilité et la republication', () => {
    expect(sql).toContain('profile_section_visibility');
    expect(sql).toContain('reposted_from_id');
    expect(sql).toContain('scheduled_at');
  });
  it('indexe les lectures chaudes', () => {
    expect(sql).toContain('materiel_loans_lender_status_idx');
    expect(sql).toContain('club_events_club_date_idx');
    expect(sql).toContain('community_posts_author_created_idx');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/design/compte-drawer-v2-schema.spec.ts`
Expected: FAIL — migration absente.

- [ ] **Step 3: Write minimal implementation**

```sql
alter table public.user_profiles
  add column if not exists profile_section_visibility jsonb not null default '{}'::jsonb;

alter table public.community_posts
  add column if not exists reposted_from_id uuid references public.community_posts(id) on delete set null,
  add column if not exists scheduled_at timestamptz;

alter table public.community_post_drafts
  add column if not exists scheduled_at timestamptz;

create index if not exists materiel_loans_lender_status_idx on public.materiel_loans (lender_id, status);
create index if not exists club_events_club_date_idx on public.club_events (club_id, event_date);
create index if not exists community_posts_author_created_idx on public.community_posts (author_id, created_at desc);
```

Dans `accountBootstrap.ts`, remplacer la lecture `clubs.next_event` (colonne inexistante)
par `club_events` : `select('id,club_id,title,event_date,location,participants_count,max_participants')`,
trier par `event_date` croissant, garder le premier par club.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/design/compte-drawer-v2-schema.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261022100000_profile_section_visibility.sql src/features/compte/data/accountBootstrap.ts tests/design/compte-drawer-v2-schema.spec.ts
git commit -m "feat(compte): visibilité par bloc, republication et prochains événements"
```

---

### Task 2: Bootstrap — stats, badges, défis, clubs, prêts, brouillons, partages, modération, sécurité

**Files:**
- Modify: `src/features/compte/data/accountBootstrap.ts`
- Test: `tests/design/compte-bootstrap-api.spec.ts`

**Interfaces:**
- Produces: `loadAccountBootstrap()` renvoie `stats`, `badges`, `challenges`, `clubs` enrichis, `loans`, `drafts`, `shares`, `shareTokens`, `moderation`, `documents`, `checkpoints`, `visibility`, `companions`.

- [ ] **Step 1: Write the failing test**

```ts
it('mappe les badges dédupliqués et les compagnons de sortie', () => {
  const badges = mapBadges([
    { id: 'b1', name: 'Explorateur', rarity: 'Commun', requirement_type: 'destination_visited', requirement_value: 5 },
    { id: 'b1', name: 'Explorateur', rarity: 'Commun' },
  ], [{ user_id: 'u1', badge_id: 'b1', earned_at: '2026-08-01T10:00:00Z' }], 'u1');
  expect(badges).toHaveLength(1);
  expect(badges[0].earned).toBe(true);

  const companions = mapCompanions([
    { session_id: 's1', user_id: 'u2' },
    { session_id: 's2', user_id: 'u2' },
    { session_id: 's1', user_id: 'u3' },
  ], new Map([['u2', { handle: 'lea', full_name: 'Léa' }], ['u3', { handle: 'marc', full_name: 'Marc' }]]));
  expect(companions[0].ps).toBe('lea');
  expect(companions[0].outings).toBe(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/design/compte-bootstrap-api.spec.ts`
Expected: FAIL — `mapBadges` / `mapCompanions` absents.

- [ ] **Step 3: Write minimal implementation**

Ajouter les types et mappers `mapBadges`, `mapChallenges`, `mapDrafts`, `mapShares`,
`mapShareTokens`, `mapModeration`, `mapCompanions`, puis étendre
`loadAccountBootstrap` avec les requêtes `badges`, `user_badges`, `challenges`,
`user_challenges`, `progression_challenges`, `club_events`, `club_topics`,
`materiel_loans`, `community_post_drafts`, `post_shares`, `share_tokens`,
`community_moderation_queue`, `trip_safety_checkpoints`, `user_documents`,
`trip_documents`, et `profile_section_visibility`. Chaque requête passe par `safeRows`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/design/compte-bootstrap-api.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/compte/data/accountBootstrap.ts tests/design/compte-bootstrap-api.spec.ts
git commit -m "feat(compte): bootstrap complet des 6 slots"
```

---

### Task 3: Rail de slots + pont React + shell

**Files:**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js`
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx`
- Create: `src/components/compte/drawer/ProfileDrawerHost.tsx`
- Create: `src/components/compte/drawer/SlotRail.tsx`
- Create: `src/components/compte/drawer/SlotShell.tsx`
- Test: `tests/design/compte-drawer-v2-shell.spec.ts`

**Interfaces:**
- Produces: `SlotId = 'vitrine' | 'kit' | 'loans' | 'memories' | 'community' | 'atelier'` ; `window.__lkdvOpenSlot(slotId)` ; `#lkdv-slot-root`.
- Consumes: `viewer: 'owner' | 'visitor'` (visiteur : 4 slots seulement).

- [ ] **Step 1: Write the failing test**

```ts
it('expose le rail, le pont et la règle visiteur', () => {
  const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
  const rail = read('src/components/compte/drawer/SlotRail.tsx');
  expect(runtime).toContain('__lkdvOpenSlot');
  expect(runtime).toContain('lkdv-slot-root');
  expect(rail).toContain("'community'");
  expect(rail).toContain("'atelier'");
  expect(rail).toContain('ownerSlots');
  expect(rail).toContain('visitorSlots');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/design/compte-drawer-v2-shell.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Le runtime, pour `S.step === 0`, rend `<div id="lkdv-slot-root"></div>` et appelle
`window.__lkdvMountSlot?.(root, slotId, S)`. `SlotRail` est un `role="tablist"`
horizontal scrollable : 6 pilules owner (`ownerSlots`), 4 visiteur (`visitorSlots`
= vitrine, kit, loans, memories). `SlotShell` fournit le titre large, la lentille
segmentée, les états squelette/vide/erreur.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/design/compte-drawer-v2-shell.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/compte-liquid-glass-v8-runtime.js src/components/compte/CompteLiquidGlassV8.tsx src/components/compte/drawer/ProfileDrawerHost.tsx src/components/compte/drawer/SlotRail.tsx src/components/compte/drawer/SlotShell.tsx tests/design/compte-drawer-v2-shell.spec.ts
git commit -m "feat(compte): rail de slots et pont React du drawer profil"
```

---

### Task 4: Vitrine — lentille Stats (sans couronne)

**Files:**
- Create: `src/components/compte/drawer/slots/VitrineSlot.tsx`
- Create: `src/components/compte/drawer/cards/StatTile.tsx`
- Test: `src/components/compte/drawer/__tests__/VitrineStats.test.tsx`

**Interfaces:**
- Consumes: `stats` (`km`, `dplus`, `outings`, `nights`, `massifs`, `countries`, `yearMonths`, `bestMonth`, `longestOuting`).

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche les stats réelles sans couronne', () => {
  render(<VitrineSlot lens="stats" stats={{ km: 351, dplus: 20200, outings: 10, nights: 4, massifs: 3, countries: 2, yearMonths: [], bestMonth: 'Août', longestOuting: 58 }} />);
  expect(screen.getByText('351 km')).toBeTruthy();
  expect(screen.getByText('Août')).toBeTruthy();
  expect(screen.queryByText(/couronne|regularité/i)).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/VitrineStats.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`StatTile` : label, valeur, cadenas public/privé. `VitrineSlot` stats : bandeau de
6 tuiles, bloc « Cette année » (12 barres), meilleur mois, plus longue sortie.
Aucun élément de type couronne ou classement.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/VitrineStats.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/slots/VitrineSlot.tsx src/components/compte/drawer/cards/StatTile.tsx src/components/compte/drawer/__tests__/VitrineStats.test.tsx
git commit -m "feat(compte): vitrine — stats réelles sans couronne"
```

---

### Task 5: Vitrine — lentille Trophées

**Files:**
- Create: `src/components/compte/drawer/cards/BadgeTile.tsx`
- Modify: `src/components/compte/drawer/slots/VitrineSlot.tsx`
- Test: `src/components/compte/drawer/__tests__/VitrineBadges.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche 4 badges récents puis l’armoire', () => {
  render(<VitrineSlot lens="badges" badges={[
    { id: 'b1', name: 'Explorateur', rarity: 'Commun', earned: true, earnedAt: '2026-08-01', points: 100 },
    { id: 'b2', name: 'Légende vivante', rarity: 'Légendaire', earned: false, requirementValue: 50, points: 2000 },
  ]} />);
  expect(screen.getByText('Explorateur')).toBeTruthy();
  expect(screen.getByText('Obtenu')).toBeTruthy();
  expect(screen.getByText('Légende vivante')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/VitrineBadges.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`BadgeTile` : icône, nom, rareté, condition, état, date. Trier les badges obtenus
par date décroissante, afficher les 4 premiers, « Tout voir » déplie la grille.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/VitrineBadges.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/cards/BadgeTile.tsx src/components/compte/drawer/slots/VitrineSlot.tsx src/components/compte/drawer/__tests__/VitrineBadges.test.tsx
git commit -m "feat(compte): vitrine — armoire de trophées"
```

---

### Task 6: Kit & Sac

**Files:**
- Create: `src/components/compte/drawer/slots/KitSlot.tsx`
- Create: `src/components/compte/drawer/cards/KitCard.tsx`
- Create: `src/components/compte/drawer/cards/WearGauge.tsx`
- Test: `src/components/compte/drawer/__tests__/KitSlot.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche le poids réel et l’usure dérivée', () => {
  render(<KitSlot kits={[{ id: 'k1', n: 'Kit 3 saisons', w: 4200, items: 10, gen: 'Lignée G2', proven: 3 }]}
    gearItems={[{ id: 'g1', n: 'Sac', w: 900, c: 'Sac', cond: 'bon' }]} wear={{ percent: 62, reason: '12 sorties · 180 km' }} />);
  expect(screen.getByText('4,20 kg')).toBeTruthy();
  expect(screen.getByText('62 %')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/KitSlot.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`KitCard` : nom, poids, objets, génération, reprises, preuves terrain.
`WearGauge` : barre, seuil d'entretien, raison, CTA « Planifier l'entretien ».
`KitSlot` : lentilles Kits / Inventaire / Usure. Vue visiteur : `is_public` uniquement.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/KitSlot.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/slots/KitSlot.tsx src/components/compte/drawer/cards/KitCard.tsx src/components/compte/drawer/cards/WearGauge.tsx src/components/compte/drawer/__tests__/KitSlot.test.tsx
git commit -m "feat(compte): slot kit, inventaire et usure"
```

---

### Task 7: Prêts & Locations

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

Route `loans` : actions `request | accept | decline | return | rate | dispute`,
refus 401, RLS `materiel_loans` (select/update involved). `LoanCard` : objet,
personne, dates, statut, contrat, notes. `LoansSlot` : lentilles Je prête /
J'emprunte / Confiance.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/design/compte-loans-api.spec.ts src/components/compte/drawer/__tests__/LoansSlot.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/compte/loans/route.ts src/components/compte/drawer/slots/LoansSlot.tsx src/components/compte/drawer/cards/LoanCard.tsx tests/design/compte-loans-api.spec.ts src/components/compte/drawer/__tests__/LoansSlot.test.tsx
git commit -m "feat(compte): prêts, locations et confiance"
```

---

### Task 8: Sorties & Souvenirs

**Files:**
- Create: `src/components/compte/drawer/slots/MemoriesSlot.tsx`
- Create: `src/components/compte/drawer/cards/StampTile.tsx`
- Test: `src/components/compte/drawer/__tests__/MemoriesSlot.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche un tampon par lieu réellement visité', () => {
  render(<MemoriesSlot stamps={[{ id: 's1', name: 'Néouvielle', kind: 'massif', outings: 2, verified: true }]} outings={[]} />);
  expect(screen.getByText('Néouvielle')).toBeTruthy();
  expect(screen.getByText('2 sorties')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/MemoriesSlot.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`StampTile` : nom, type, nombre de sorties, badge vérifié. `MemoriesSlot` :
lentilles Timeline / Passeport / Souvenirs. Pas de compagnons ici (slot 5).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/MemoriesSlot.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/slots/MemoriesSlot.tsx src/components/compte/drawer/cards/StampTile.tsx src/components/compte/drawer/__tests__/MemoriesSlot.test.tsx
git commit -m "feat(compte): sorties, passeport de lieux et souvenirs"
```

---

### Task 9: Communauté — lentille Défis (privé)

**Files:**
- Create: `src/components/compte/drawer/slots/CommunitySlot.tsx`
- Create: `src/components/compte/drawer/cards/ChallengeRow.tsx`
- Test: `src/components/compte/drawer/__tests__/CommunityChallenges.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche les défis réels et la progression', () => {
  render(<CommunitySlot lens="challenges" challenges={[
    { id: 'c1', title: 'Kit parfait', category: 'Équipement', difficulty: 'Moyen', xp: 300, progress: 2, target: 5 },
  ]} />);
  expect(screen.getByText('Kit parfait')).toBeTruthy();
  expect(screen.getByText('2 / 5')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/CommunityChallenges.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`ChallengeRow` : titre, catégorie, difficulté, XP, échéance, barre de progression.
`CommunitySlot` : lentilles Défis / Clubs / Cordée. Aucun classement public.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/CommunityChallenges.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/slots/CommunitySlot.tsx src/components/compte/drawer/cards/ChallengeRow.tsx src/components/compte/drawer/__tests__/CommunityChallenges.test.tsx
git commit -m "feat(compte): communauté — défis personnels"
```

---

### Task 10: Communauté — lentille Clubs (privé)

**Files:**
- Create: `src/components/compte/drawer/cards/ClubCard.tsx`
- Modify: `src/components/compte/drawer/slots/CommunitySlot.tsx`
- Test: `src/components/compte/drawer/__tests__/CommunityClubs.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche le prochain événement et le rôle réel', () => {
  render(<CommunitySlot lens="clubs" clubs={[{
    id: 'c1', n: 'Club Alpin', role: 'Membre actif', members: 142, joined: true,
    nextEvent: { title: 'Sortie Néouvielle', event_date: '2026-10-24', location: 'Néouvielle', participants: 12, max: 20 },
  }]} />);
  expect(screen.getByText('Sortie Néouvielle')).toBeTruthy();
  expect(screen.getByText('Membre actif')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/CommunityClubs.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`ClubCard` : emoji, nom, catégorie, rôle, membres actifs, prochain événement,
RSVP, 2 derniers sujets, bouton Rejoindre/Quitter.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/CommunityClubs.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/cards/ClubCard.tsx src/components/compte/drawer/slots/CommunitySlot.tsx src/components/compte/drawer/__tests__/CommunityClubs.test.tsx
git commit -m "feat(compte): communauté — clubs et événements"
```

---

### Task 11: Communauté — lentille Cordée et compagnons (privé)

**Files:**
- Create: `src/components/compte/drawer/cards/CompanionRow.tsx`
- Modify: `src/components/compte/drawer/slots/CommunitySlot.tsx`
- Test: `src/components/compte/drawer/__tests__/CommunityCordee.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche les compagnons réels et leurs sorties communes', () => {
  render(<CommunitySlot lens="cordee" followers={[]} following={[]} companions={[
    { id: 'u2', n: 'Léa', ps: 'lea', outings: 2, mass: 'Néouvielle' },
  ]} />);
  expect(screen.getByText('Léa')).toBeTruthy();
  expect(screen.getByText('2 sorties communes')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/CommunityCordee.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`CompanionRow` : avatar, nom, @handle, sorties communes, dernier massif partagé.
`CommunitySlot` cordée : abonnés, abonnements, compagnons, confiance.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/CommunityCordee.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/cards/CompanionRow.tsx src/components/compte/drawer/slots/CommunitySlot.tsx src/components/compte/drawer/__tests__/CommunityCordee.test.tsx
git commit -m "feat(compte): communauté — cordée et compagnons de sortie"
```

---

### Task 12: Atelier — Brouillons (privé)

**Files:**
- Create: `src/components/compte/drawer/slots/AtelierSlot.tsx`
- Create: `src/components/compte/drawer/cards/DraftCard.tsx`
- Create: `src/app/api/compte/drafts/route.ts`
- Test: `tests/design/compte-drafts-api.spec.ts`, `src/components/compte/drawer/__tests__/AtelierDrafts.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
it('refuse un visiteur non authentifié', async () => {
  const res = await POST(new Request('http://x/api/compte/drafts', { method: 'POST', body: JSON.stringify({ action: 'delete', draftId: 'd1' }) }));
  expect(res.status).toBe(401);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/design/compte-drafts-api.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Route `drafts` : `list | save | publish | delete`, refus 401, RLS `community_post_drafts`
(select/insert/update/delete own). `DraftCard` : titre, extrait, type, audience,
club, date, actions Reprendre / Publier / Supprimer. `AtelierSlot` : lentilles
Brouillons / Republication / Partages / Modération.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/design/compte-drafts-api.spec.ts src/components/compte/drawer/__tests__/AtelierDrafts.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/compte/drafts/route.ts src/components/compte/drawer/slots/AtelierSlot.tsx src/components/compte/drawer/cards/DraftCard.tsx tests/design/compte-drafts-api.spec.ts src/components/compte/drawer/__tests__/AtelierDrafts.test.tsx
git commit -m "feat(compte): atelier — brouillons réels"
```

---

### Task 13: Atelier — Republication attribuée

**Files:**
- Create: `src/components/compte/drawer/cards/RepostCard.tsx`
- Create: `src/app/api/compte/repost/route.ts`
- Modify: `src/components/compte/drawer/slots/AtelierSlot.tsx`
- Test: `tests/design/compte-repost-api.spec.ts`, `src/components/compte/drawer/__tests__/AtelierRepost.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
it('exige une source et une audience', async () => {
  const res = await POST(new Request('http://x/api/compte/repost', { method: 'POST', body: JSON.stringify({ postId: 'p1' }) }));
  expect([400, 401]).toContain(res.status);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/design/compte-repost-api.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Route `repost` : lit la publication source, vérifie l'audience autorisée, crée une
nouvelle ligne `community_posts` avec `reposted_from_id`, `linked_carnet_id` /
`linked_kit_id` si applicable, `snapshot_payload` figé, `client_request_id` pour
l'idempotence. `RepostCard` : source, auteur d'origine, audience cible, club,
aperçu, bouton Republier. Attribution toujours affichée.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/design/compte-repost-api.spec.ts src/components/compte/drawer/__tests__/AtelierRepost.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/compte/repost/route.ts src/components/compte/drawer/cards/RepostCard.tsx src/components/compte/drawer/slots/AtelierSlot.tsx tests/design/compte-repost-api.spec.ts src/components/compte/drawer/__tests__/AtelierRepost.test.tsx
git commit -m "feat(compte): atelier — republication attribuée"
```

---

### Task 14: Atelier — Partages et liens

**Files:**
- Create: `src/components/compte/drawer/cards/ShareRow.tsx`
- Modify: `src/components/compte/drawer/slots/AtelierSlot.tsx`
- Test: `src/components/compte/drawer/__tests__/AtelierShares.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche les partages DM et les liens de kit', () => {
  render(<AtelierSlot lens="shares"
    shares={[{ id: 's1', post_id: 'p1', conversation_id: 'c1', created_at: '2026-10-01T10:00:00Z' }]}
    shareTokens={[{ id: 't1', token: 'abc', kit_id: 'k1', permission: 'read', expires_at: '2026-11-01', last_accessed_at: null }]} />);
  expect(screen.getByText(/Conversation/)).toBeTruthy();
  expect(screen.getByText(/Lien de kit/)).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/AtelierShares.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`ShareRow` : type (DM ou lien), cible, date, statut d'expiration, dernier accès,
bouton Révoquer pour un token. `AtelierSlot` partages : `post_shares`,
`share_tokens`, `community_posts.shares_count`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/AtelierShares.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/cards/ShareRow.tsx src/components/compte/drawer/slots/AtelierSlot.tsx src/components/compte/drawer/__tests__/AtelierShares.test.tsx
git commit -m "feat(compte): atelier — partages et liens de kit"
```

---

### Task 15: Atelier — Modération et performance

**Files:**
- Create: `src/components/compte/drawer/cards/ModerationRow.tsx`
- Create: `src/components/compte/drawer/cards/PerformanceTile.tsx`
- Modify: `src/components/compte/drawer/slots/AtelierSlot.tsx`
- Test: `src/components/compte/drawer/__tests__/AtelierModeration.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche les signalements réels et les compteurs', () => {
  render(<AtelierSlot lens="moderation"
    moderation={[{ id: 'm1', source: 'post_comment', status: 'pending', reason: 'spam', created_at: '2026-10-01T10:00:00Z' }]}
    performance={[{ post_id: 'p1', title: 'Lac Blanc', likes: 7, comments: 2, shares: 1 }]} />);
  expect(screen.getByText('spam')).toBeTruthy();
  expect(screen.getByText('Lac Blanc')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/AtelierModeration.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`ModerationRow` : source, statut, raison, date, action. `PerformanceTile` :
publication, vues/likes/commentaires/partages, meilleure publication, audience.
`AtelierSlot` modération : `community_moderation_queue` + compteurs
`community_posts`. Actions : modifier, dépublier, supprimer.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/AtelierModeration.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/cards/ModerationRow.tsx src/components/compte/drawer/cards/PerformanceTile.tsx src/components/compte/drawer/slots/AtelierSlot.tsx src/components/compte/drawer/__tests__/AtelierModeration.test.tsx
git commit -m "feat(compte): atelier — modération et performance"
```

---

### Task 16: Vue visiteur (4 slots), accessibilité et E2E

**Files:**
- Modify: `src/components/compte/drawer/SlotRail.tsx`
- Modify: `src/components/compte/drawer/ProfileDrawerHost.tsx`
- Create: `tests/e2e/compte-drawer-v2.spec.ts`
- Test: `src/components/compte/drawer/__tests__/VisitorMode.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('ne montre jamais Communauté ni Atelier à un visiteur', () => {
  render(<SlotRail viewer="visitor" active="vitrine" onSelect={() => {}} />);
  expect(screen.queryByText('Communauté')).toBeNull();
  expect(screen.queryByText('Atelier')).toBeNull();
  expect(screen.getByText('Vitrine')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/VisitorMode.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`SlotRail` filtre `visitorSlots` (vitrine, kit, loans, memories). `ProfileDrawerHost`
masque les actions d'écriture pour un visiteur. E2E Playwright : propriétaire ouvre
les 6 slots, visiteur n'en voit que 4 et ne voit jamais Communauté/Atelier.
Vérifier `role="tablist"`, cible 44 px, réduction de mouvement.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/VisitorMode.test.tsx && npx playwright test tests/e2e/compte-drawer-v2.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/SlotRail.tsx src/components/compte/drawer/ProfileDrawerHost.tsx tests/e2e/compte-drawer-v2.spec.ts src/components/compte/drawer/__tests__/VisitorMode.test.tsx
git commit -m "test(compte): vue visiteur 4 slots et e2e du drawer"
```

---

## Self-review

- **Spec coverage** : les 6 slots, les lentilles, le rail, la vue visiteur, les
  liens BDD et la migration sont couverts par les tâches 1 à 16.
- **Slots 5 et 6 privés** : Task 3 et Task 16 les excluent explicitement de la vue visiteur.
- **Couronne retirée** : Task 4 l'interdit par test.
- **Republication** : Task 13 avec `reposted_from_id`, attribution et idempotence.
- **Types cohérents** : `SlotId`, `viewer`, `mapBadges`, `mapCompanions`,
  `DraftCard`, `RepostCard`, `ShareRow` définis une fois.
- **Dépendances** : Task 1–2 avant Task 3 ; Task 3 avant les slots ; Task 16 en dernier.
