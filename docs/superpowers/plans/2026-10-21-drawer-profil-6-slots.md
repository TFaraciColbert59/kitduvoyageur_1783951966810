# Drawer Profil 6 slots — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les 5 onglets actuels du drawer Profil par 6 slots réels, lisibles par le propriétaire et par un visiteur, avec une identité LKDV distinctive.

**Architecture:** Le runtime conserve la feuille, les gestes et les transitions ; chaque slot est un composant React monté dans la feuille via un portail (`#lkdv-slot-root`). Les données viennent de `/api/compte/bootstrap` (lecture) et de routes dédiées (écriture), avec une visibilité par bloc stockée dans `user_profiles.profile_section_visibility`.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Supabase (Postgres + RLS), Vitest, Playwright, Tailwind + tokens Liquid Glass existants.

**Spec:** `docs/superpowers/specs/2026-10-21-drawer-profil-6-slots-design.md`

## Global Constraints

- Aucune donnée de démonstration sur un compte connecté : toute liste vide affiche un état vide explicite.
- La vue visiteur ne montre que les blocs autorisés par `profile_section_visibility` ; les blocs privés affichent un état verrouillé, jamais un contenu partiel.
- Les classes et tokens existants (`--glass-*`, `--lkv-*`, `.lg`, `.segc`, `.li`, `.mbtn`) sont réutilisés ; pas de nouvelle palette.
- Cible tactile 44 px, `prefers-reduced-motion` respecté, contraste extérieur conservé.
- Tests : `npx vitest run tests/design`, tests unitaires dans `src/features/compte/__tests__/`, Playwright `tests/e2e/compte-drawer-v2.spec.ts`.
- Commits fréquents, message `feat(compte): …` ou `fix(compte): …`.
- Aucun secret, aucune clé, aucun service_role dans le client.

---

### Task 1: Migration visibilité + correction clubs + index

**Files:**
- Create: `supabase/migrations/20261022100000_profile_section_visibility.sql`
- Modify: `src/features/compte/data/accountBootstrap.ts` (mapping clubs)
- Test: `tests/design/compte-drawer-v2-schema.spec.ts`

**Interfaces:**
- Produces: `profile_section_visibility jsonb not null default '{}'::jsonb` sur `user_profiles` ; `mapClubs` renvoie `nextEvent` depuis `club_events`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/migrations/20261022100000_profile_section_visibility.sql', 'utf8');

describe('Drawer v2 — schéma', () => {
  it('ajoute la visibilité par bloc', () => {
    expect(sql).toContain('profile_section_visibility');
    expect(sql).toContain("default '{}'::jsonb");
  });
  it('indexe les prêts et les événements de club', () => {
    expect(sql).toContain('materiel_loans_lender_status_idx');
    expect(sql).toContain('club_events_club_date_idx');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/design/compte-drawer-v2-schema.spec.ts`
Expected: FAIL — fichier de migration introuvable.

- [ ] **Step 3: Write minimal implementation**

```sql
alter table public.user_profiles
  add column if not exists profile_section_visibility jsonb not null default '{}'::jsonb;

create index if not exists materiel_loans_lender_status_idx
  on public.materiel_loans (lender_id, status);

create index if not exists club_events_club_date_idx
  on public.club_events (club_id, event_date);
```

Dans `accountBootstrap.ts`, remplacer la lecture `clubs.next_event` par une requête
`club_events` : sélectionner `id, club_id, title, event_date, location, participants_count, max_participants`
pour les clubs de l'utilisateur, trier par `event_date` croissant, garder le premier par club.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/design/compte-drawer-v2-schema.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261022100000_profile_section_visibility.sql src/features/compte/data/accountBootstrap.ts tests/design/compte-drawer-v2-schema.spec.ts
git commit -m "feat(compte): visibilité par bloc et prochains événements de club"
```

---

### Task 2: Payload bootstrap — stats, badges, défis, clubs, prêts, documents, checkpoints

**Files:**
- Modify: `src/features/compte/data/accountBootstrap.ts`
- Test: `tests/design/compte-bootstrap-api.spec.ts`

**Interfaces:**
- Produces: `loadAccountBootstrap()` renvoie en plus `stats`, `badges`, `challenges`, `clubs` enrichis, `loans`, `documents`, `checkpoints`, `visibility`.

- [ ] **Step 1: Write the failing test**

```ts
it('mappe les badges dédupliqués et les défis', () => {
  const badges = mapBadges([
    { id: 'b1', name: 'Explorateur', rarity: 'Commun', requirement_type: 'destination_visited', requirement_value: 5 },
    { id: 'b1', name: 'Explorateur', rarity: 'Commun' },
  ], [{ user_id: 'u1', badge_id: 'b1', earned_at: '2026-08-01T10:00:00Z' }], 'u1');
  expect(badges).toHaveLength(1);
  expect(badges[0].earned).toBe(true);
  expect(badges[0].requirement).toBe('destination_visited');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/design/compte-bootstrap-api.spec.ts`
Expected: FAIL — `mapBadges` n'existe pas.

- [ ] **Step 3: Write minimal implementation**

Ajouter dans `accountBootstrap.ts` :

```ts
export type BadgeRow = { id: string; name: string; description?: string | null; rarity?: string | null; requirement_type?: string | null; requirement_value?: number | null; points_reward?: number | null };
export type UserBadgeRow = { user_id: string; badge_id: string; earned_at?: string | null };
export type ChallengeRow = { id: string; title: string; description?: string | null; category?: string | null; difficulty?: string | null; xp?: number | null; deadline?: string | null };
export type UserChallengeRow = { user_id: string; challenge_id: string; progress?: number | null; completed?: boolean | null };

export function mapBadges(rows: BadgeRow[], earned: UserBadgeRow[], userId: string) {
  const byName = new Map<string, BadgeRow>();
  for (const row of rows) if (!byName.has(row.name)) byName.set(row.name, row);
  const earnedIds = new Set(earned.filter((e) => e.user_id === userId).map((e) => e.badge_id));
  return [...byName.values()].map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description || '',
    rarity: row.rarity || 'Commun',
    requirement: row.requirement_type || null,
    requirementValue: Number(row.requirement_value ?? 0),
    points: Number(row.points_reward ?? 0),
    earned: earnedIds.has(row.id),
    earnedAt: earned.find((e) => e.badge_id === row.id)?.earned_at || null,
  }));
}
```

Étendre `loadAccountBootstrap` avec les requêtes `badges`, `user_badges`, `challenges`,
`user_challenges`, `progression_challenges`, `club_events`, `club_topics`,
`materiel_loans`, `trip_safety_checkpoints`, `user_documents`, `trip_documents`
et `profile_section_visibility` (profil). Chaque requête passe par `safeRows`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/design/compte-bootstrap-api.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/compte/data/accountBootstrap.ts tests/design/compte-bootstrap-api.spec.ts
git commit -m "feat(compte): bootstrap badges, défis, clubs, prêts et sécurité"
```

---

### Task 3: Pont React dans la feuille + feature flag

**Files:**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js`
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx`
- Create: `src/components/compte/drawer/ProfileDrawerHost.tsx`
- Create: `src/components/compte/drawer/SlotShell.tsx`
- Test: `tests/design/compte-drawer-v2-shell.spec.ts`

**Interfaces:**
- Produces: `window.__lkdvOpenSlot(slotId: SlotId)` et `window.__lkdvMountSlot(root: HTMLElement, slotId: SlotId, payload: unknown)`.
- Consumes: `SlotId = 'vitrine' | 'kit' | 'loans' | 'memories' | 'safety' | 'privacy'`.

- [ ] **Step 1: Write the failing test**

```ts
it('expose le pont de slot et le feature flag', () => {
  const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
  const page = read('src/components/compte/CompteLiquidGlassV8.tsx');
  expect(runtime).toContain('__lkdvOpenSlot');
  expect(runtime).toContain('lkdv-slot-root');
  expect(page).toContain('ProfileDrawerHost');
  expect(page).toContain('drawerV2');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/design/compte-drawer-v2-shell.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Dans le runtime, pour `S.step === 0`, rendre :

```js
if (window.__lkdvDrawerV2) {
  return {
    title: 'Profil',
    noFooter: true,
    flow: [{ l: 'Profil', r: () => ({ per: [1, 1], rows: ['<div id="lkdv-slot-root"></div>'] }) }]
  };
}
```

Après `renderSheet()`, appeler `window.__lkdvMountSlot?.(document.getElementById('lkdv-slot-root'), slotId, S)`
et exposer `window.__lkdvOpenSlot = (slotId) => { S.step = 0; S.sh = { k: 'step', slotId }; openSheet('step', 0, 'large'); }`.

`ProfileDrawerHost.tsx` monte un `createPortal` vers `#lkdv-slot-root` et rend
`SlotShell` + le composant du slot actif. `SlotShell` fournit l'en-tête, la lentille
segmentée, les états chargement/vide/erreur.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/design/compte-drawer-v2-shell.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/compte-liquid-glass-v8-runtime.js src/components/compte/CompteLiquidGlassV8.tsx src/components/compte/drawer/ProfileDrawerHost.tsx src/components/compte/drawer/SlotShell.tsx tests/design/compte-drawer-v2-shell.spec.ts
git commit -m "feat(compte): pont React pour les slots du drawer profil"
```

---

### Task 4: Vitrine — lentille Stats

**Files:**
- Create: `src/components/compte/drawer/slots/VitrineSlot.tsx`
- Create: `src/components/compte/drawer/cards/StatTile.tsx`
- Test: `src/components/compte/drawer/__tests__/VitrineStats.test.tsx`

**Interfaces:**
- Consumes: `stats` du bootstrap (`km`, `dplus`, `outings`, `nights`, `massifs`, `countries`, `activeWeeks`, `streak`, `yearMonths`).
- Produces: `VitrineSlot` avec lentilles `stats | badges | clubs | cordee`.

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche les stats réelles et la couronne de régularité', () => {
  render(<VitrineSlot lens="stats" stats={{ km: 351, dplus: 20200, outings: 10, nights: 4, massifs: 3, countries: 2, activeWeeks: 7, streak: 3, yearMonths: [] }} />);
  expect(screen.getByText('351 km')).toBeTruthy();
  expect(screen.getByText('7 semaines actives')).toBeTruthy();
  expect(screen.queryByText('1 080')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/VitrineStats.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`StatTile` : composant verre avec label, valeur, cadenas public/privé.
`VitrineSlot` lentille stats : bandeau de 6 `StatTile`, couronne de régularité
(`activeWeeks / 12`), bloc année (12 barres), état vide si `outings === 0`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/VitrineStats.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/slots/VitrineSlot.tsx src/components/compte/drawer/cards/StatTile.tsx src/components/compte/drawer/__tests__/VitrineStats.test.tsx
git commit -m "feat(compte): vitrine — statistiques réelles et couronne de régularité"
```

---

### Task 5: Vitrine — lentille Trophées

**Files:**
- Create: `src/components/compte/drawer/cards/BadgeTile.tsx`
- Modify: `src/components/compte/drawer/slots/VitrineSlot.tsx`
- Test: `src/components/compte/drawer/__tests__/VitrineBadges.test.tsx`

**Interfaces:**
- Consumes: `badges`, `challenges` du bootstrap.
- Produces: armoire de 4 badges récents + grille complète + progression des défis.

- [ ] **Step 1: Write the failing test**

```tsx
it('met en avant les badges obtenus et laisse les autres en progression', () => {
  render(<VitrineSlot lens="badges" badges={[
    { id: 'b1', name: 'Explorateur', rarity: 'Commun', earned: true, earnedAt: '2026-08-01', requirementValue: 5, points: 100 },
    { id: 'b2', name: 'Légende vivante', rarity: 'Légendaire', earned: false, earnedAt: null, requirementValue: 50, points: 2000 },
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

`BadgeTile` : icône, nom, rareté, condition, état obtenu/verrouillé, date.
Armoire : trier les badges obtenus par date décroissante, afficher les 4 premiers,
puis « Tout voir » qui déplie la grille complète. Défis : barre de progression
`progress / target`, catégorie, échéance.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/VitrineBadges.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/cards/BadgeTile.tsx src/components/compte/drawer/slots/VitrineSlot.tsx src/components/compte/drawer/__tests__/VitrineBadges.test.tsx
git commit -m "feat(compte): vitrine — armoire de trophées et défis"
```

---

### Task 6: Vitrine — lentilles Clubs et Cordée

**Files:**
- Create: `src/components/compte/drawer/cards/ClubCard.tsx`
- Modify: `src/components/compte/drawer/slots/VitrineSlot.tsx`
- Test: `src/components/compte/drawer/__tests__/VitrineClubs.test.tsx`

**Interfaces:**
- Consumes: `clubs` (avec `nextEvent`, `topics`, `recommendedKits`), `followers`, `following`, `companions`.

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche le prochain événement et le rôle réel', () => {
  render(<VitrineSlot lens="clubs" clubs={[{
    id: 'c1', n: 'Club Alpin', role: 'Membre actif', members: 142, joined: true,
    nextEvent: { title: 'Sortie Néouvielle', event_date: '2026-10-24', location: 'Néouvielle', participants: 12, max: 20 },
  }]} />);
  expect(screen.getByText('Sortie Néouvielle')).toBeTruthy();
  expect(screen.getByText('Membre actif')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/VitrineClubs.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`ClubCard` : emoji, nom, catégorie, rôle, membres actifs, prochain événement avec
RSVP, aperçu des 2 derniers sujets, bouton Rejoindre/Quitter. Lentille Cordée :
abonnés, abonnements, compagnons de sortie, carte de confiance.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/VitrineClubs.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/cards/ClubCard.tsx src/components/compte/drawer/slots/VitrineSlot.tsx src/components/compte/drawer/__tests__/VitrineClubs.test.tsx
git commit -m "feat(compte): vitrine — clubs, événements et cordée"
```

---

### Task 7: Slot Kit & Sac

**Files:**
- Create: `src/components/compte/drawer/slots/KitSlot.tsx`
- Create: `src/components/compte/drawer/cards/WearGauge.tsx`
- Test: `src/components/compte/drawer/__tests__/KitSlot.test.tsx`

**Interfaces:**
- Consumes: `kits`, `gearItems`, `wear` calculé.
- Produces: cartes kit, inventaire groupé, jauge d'usure, actions.

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

`WearGauge` : barre avec seuil d'entretien, texte de raison, CTA « Planifier
l'entretien ». `KitSlot` : cartes kit, arbre de filiation, inventaire groupé,
coût par sortie, état de prêt. En vue visiteur : seulement `is_public`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/KitSlot.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/slots/KitSlot.tsx src/components/compte/drawer/cards/WearGauge.tsx src/components/compte/drawer/__tests__/KitSlot.test.tsx
git commit -m "feat(compte): slot kit, inventaire et usure vivante"
```

---

### Task 8: Slot Prêts & Locations

**Files:**
- Create: `src/components/compte/drawer/slots/LoansSlot.tsx`
- Create: `src/components/compte/drawer/cards/LoanCard.tsx`
- Create: `src/app/api/compte/loans/route.ts`
- Test: `tests/design/compte-loans-api.spec.ts`, `src/components/compte/drawer/__tests__/LoansSlot.test.tsx`

**Interfaces:**
- Consumes: `loans` du bootstrap.
- Produces: `GET/POST /api/compte/loans` pour demander, accepter, rendre, noter.

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

Route `src/app/api/compte/loans/route.ts` : `createClient()` serveur, `getUser()`,
refus 401 si absent, actions `request | accept | decline | return | rate | dispute`,
validation des ids, RLS. `LoansSlot` : deux lentilles, `LoanCard` avec dates,
statut, état, contrat, notes, carte de confiance.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/design/compte-loans-api.spec.ts src/components/compte/drawer/__tests__/LoansSlot.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/compte/loans/route.ts src/components/compte/drawer/slots/LoansSlot.tsx src/components/compte/drawer/cards/LoanCard.tsx tests/design/compte-loans-api.spec.ts src/components/compte/drawer/__tests__/LoansSlot.test.tsx
git commit -m "feat(compte): prêts, locations et carte de confiance"
```

---

### Task 9: Slot Sorties & Souvenirs

**Files:**
- Create: `src/components/compte/drawer/slots/MemoriesSlot.tsx`
- Create: `src/components/compte/drawer/cards/StampTile.tsx`
- Test: `src/components/compte/drawer/__tests__/MemoriesSlot.test.tsx`

**Interfaces:**
- Consumes: `outings`, `posts`, `stamps`, `companions`.
- Produces: timeline, passeport de lieux, souvenirs 3D, collections.

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

`StampTile` : tampon verre, nom, type, nombre de sorties, badge vérifié.
`MemoriesSlot` : timeline des sorties, passeport groupé par type, bouton
« Souvenir 3D » (flyover), compagnons, collections.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/MemoriesSlot.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/slots/MemoriesSlot.tsx src/components/compte/drawer/cards/StampTile.tsx src/components/compte/drawer/__tests__/MemoriesSlot.test.tsx
git commit -m "feat(compte): sorties, passeport de lieux et souvenirs"
```

---

### Task 10: Slot Voyage & Sécurité

**Files:**
- Create: `src/components/compte/drawer/slots/SafetySlot.tsx`
- Create: `src/components/compte/drawer/cards/SafetyTimeline.tsx`
- Create: `src/app/api/compte/safety/route.ts`
- Test: `src/components/compte/drawer/__tests__/SafetySlot.test.tsx`, `tests/design/compte-safety-api.spec.ts`

**Interfaces:**
- Consumes: `documents`, `checkpoints`, `liveSession`.
- Produces: `GET/POST /api/compte/safety` pour créer un checkpoint, pointer, partager.

- [ ] **Step 1: Write the failing test**

```tsx
it('affiche l’échéance d’un document et le prochain check-in', () => {
  render(<SafetySlot documents={[{ id: 'd1', name: 'Passeport', expiry: '2027-04-12' }]}
    checkpoints={[{ id: 'c1', label: 'Arrivée refuge', scheduled_at: '2026-10-24T18:00:00Z', status: 'pending' }]} />);
  expect(screen.getByText('Passeport')).toBeTruthy();
  expect(screen.getByText('Arrivée refuge')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/SafetySlot.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`SafetyTimeline` : liste des checkpoints avec statut et escalade. `SafetySlot` :
portefeuille de documents, alerte d'expiration, partage live, carte d'urgence
hors-ligne. Route API : création/pointage/partage, refus 401 visiteur.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/SafetySlot.test.tsx tests/design/compte-safety-api.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/slots/SafetySlot.tsx src/components/compte/drawer/cards/SafetyTimeline.tsx src/app/api/compte/safety/route.ts src/components/compte/drawer/__tests__/SafetySlot.test.tsx tests/design/compte-safety-api.spec.ts
git commit -m "feat(compte): documents, checkpoints et sécurité hors-ligne"
```

---

### Task 11: Slot Confidentialité & Réglages

**Files:**
- Create: `src/components/compte/drawer/slots/PrivacySlot.tsx`
- Create: `src/components/compte/drawer/cards/VisibilityMatrix.tsx`
- Create: `src/app/api/compte/visibility/route.ts`
- Test: `src/components/compte/drawer/__tests__/PrivacySlot.test.tsx`

**Interfaces:**
- Consumes: `visibility` du bootstrap.
- Produces: `PATCH /api/compte/visibility` avec `{ section, level }`.

- [ ] **Step 1: Write the failing test**

```tsx
it('permet de basculer un bloc en privé', async () => {
  const onChange = vi.fn();
  render(<VisibilityMatrix value={{ stats: 'public', kit: 'private' }} onChange={onChange} />);
  fireEvent.click(screen.getByLabelText('Kit & Sac privé'));
  expect(onChange).toHaveBeenCalledWith('kit', 'private');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/PrivacySlot.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`VisibilityMatrix` : 6 lignes, 3 niveaux (`private`, `followers`, `public`),
aperçu « vue visiteur ». Route `PATCH` : validation `section` parmi les 6,
`level` parmi les 3, écriture `profile_section_visibility`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/PrivacySlot.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/slots/PrivacySlot.tsx src/components/compte/drawer/cards/VisibilityMatrix.tsx src/app/api/compte/visibility/route.ts src/components/compte/drawer/__tests__/PrivacySlot.test.tsx
git commit -m "feat(compte): matrice de visibilité et vue visiteur"
```

---

### Task 12: Vue visiteur et états verrouillés

**Files:**
- Modify: `src/components/compte/drawer/ProfileDrawerHost.tsx`
- Create: `src/components/compte/drawer/LockedSlot.tsx`
- Test: `src/components/compte/drawer/__tests__/VisitorMode.test.tsx`

**Interfaces:**
- Consumes: `viewer: 'owner' | 'visitor'`, `visibility`.
- Produces: rendu visiteur avec slots publics et blocs verrouillés.

- [ ] **Step 1: Write the failing test**

```tsx
it('verrouille les prêts et la sécurité pour un visiteur', () => {
  render(<ProfileDrawerHost viewer="visitor" visibility={{ loans: 'private', safety: 'private' }} />);
  expect(screen.getByText('Ce bloc est privé')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/VisitorMode.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`LockedSlot` : icône cadenas, texte, bouton « Demander à suivre » si visiteur.
`ProfileDrawerHost` filtre les slots selon `viewer` et `visibility`, masque les
actions d'écriture.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/VisitorMode.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/ProfileDrawerHost.tsx src/components/compte/drawer/LockedSlot.tsx src/components/compte/drawer/__tests__/VisitorMode.test.tsx
git commit -m "feat(compte): vue visiteur et blocs verrouillés"
```

---

### Task 13: Carte de visite LKDV, flyover et finitions

**Files:**
- Create: `src/components/compte/drawer/cards/ShareCard.tsx`
- Modify: `src/components/compte/drawer/slots/VitrineSlot.tsx`
- Modify: `src/components/compte/drawer/slots/MemoriesSlot.tsx`
- Test: `src/components/compte/drawer/__tests__/ShareCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('génère une carte avec les stats réelles', () => {
  render(<ShareCard stats={{ km: 351, dplus: 20200, outings: 10 }} handle="tony_frc" />);
  expect(screen.getByText('351 km')).toBeTruthy();
  expect(screen.getByText('@tony_frc')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compte/drawer/__tests__/ShareCard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`ShareCard` : carte canvas/DOM avec stats, handle, QR, bouton télécharger/partager.
Flyover : bouton « Souvenir 3D » qui ouvre la carte existante centrée sur la sortie
avec une animation d'élévation ; repli sur l'image statique si WebGL absent.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compte/drawer/__tests__/ShareCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/cards/ShareCard.tsx src/components/compte/drawer/slots/VitrineSlot.tsx src/components/compte/drawer/slots/MemoriesSlot.tsx src/components/compte/drawer/__tests__/ShareCard.test.tsx
git commit -m "feat(compte): carte de visite LKDV et souvenir 3D"
```

---

### Task 14: E2E propriétaire + visiteur, accessibilité, performance

**Files:**
- Create: `tests/e2e/compte-drawer-v2.spec.ts`
- Modify: `src/components/compte/drawer/SlotShell.tsx`
- Test: `tests/e2e/compte-drawer-v2.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('propriétaire : les 6 slots s’ouvrent et affichent des données réelles', async ({ page }) => {
  await login(page, 'owner');
  await page.goto('/compte');
  await page.getByRole('button', { name: /Profil/ }).click();
  for (const slot of ['Vitrine', 'Kit & Sac', 'Prêts & Locations', 'Sorties & Souvenirs', 'Voyage & Sécurité', 'Confidentialité']) {
    await page.getByRole('tab', { name: slot }).click();
    await expect(page.getByTestId('slot-content')).toBeVisible();
  }
});

test('visiteur : les blocs privés sont verrouillés', async ({ page }) => {
  await page.goto('/u/ultime_1792596035591_e455');
  await page.getByRole('tab', { name: 'Prêts & Locations' }).click();
  await expect(page.getByText('Ce bloc est privé')).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/compte-drawer-v2.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Corriger les rôles ARIA (`tablist`, `tab`, `tabpanel`), les libellés, les états
de chargement, la réduction de mouvement, et les seuils de performance (pas de
requête bloquante > 300 ms, lazy load par slot).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/e2e/compte-drawer-v2.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/compte-drawer-v2.spec.ts src/components/compte/drawer/SlotShell.tsx
git commit -m "test(compte): e2e propriétaire et visiteur du drawer profil"
```

---

## Self-review

- **Spec coverage** : les 6 slots, les 4 lentilles de la Vitrine, les prêts, le
  passeport, la sécurité, la visibilité et les innovations sont couverts par les
  tâches 1 à 14.
- **Placeholders** : aucun « TODO » ni « à définir » ; chaque tâche a ses fichiers,
  ses tests et ses commandes.
- **Cohérence des types** : `SlotId`, `profile_section_visibility`, `mapBadges`,
  `mapClubs`, `WearGauge`, `VisibilityMatrix` sont définis une fois et réutilisés.
- **Dépendances** : Task 1 et 2 avant Task 3 ; Task 3 avant toutes les tâches de slot ;
  Task 12 après les slots ; Task 14 en dernier.
