# H2 — Contexte et sélecteur d'aventure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ActiveAdventureContext` (union 3 natures, persistance + miroir serveur, mémoire de section) + `AdventureSwitcher` (cmdk desktop / GlassSheet mobile, groupes par nature, clavier complet) + `GET /api/hub/adventures` (groupes/crews/possession, tables existantes uniquement).

**Architecture:** Généralisation d'`ActiveTripContext`/`ActiveTripSwitcher` (composition : les voyages viennent du contexte Y existant, jamais re-fetchés). Toute la logique testable est extraite en helpers purs (`adventureLists.ts`) — pas de @testing-library dans le projet.

**Tech Stack:** React 19 context, zod, cmdk, Next server actions + route handler, Supabase server (RLS).

**Spec:** `docs/CHANTIER_H_HUB_VOYAGEUR.md` §2.3 + §9.2 (H2).

## Global Constraints

- Tables lues (existantes, patterns copiés) : `travel_groups`+`group_members` (cf. `src/app/groupes/page.tsx:92-113`), `crews`+`crew_members`+`trips` via `fetchUserCrews` (`src/lib/queries-crews.ts:85`), `product_ownership`+`alerts`+`materiel_loans` (cf. `getMaterielSummary.ts:115-118`). Statuts prêts actifs = `!= 'rendu'`.
- Persistance : localStorage `lkdv_active_adventure` + cookie httpOnly `lkv_active_adventure` (miroir serveur, zod strict). Mémoire sections : `lkdv_adventure_last_section`.
- Raccourcis conservés : Ctrl/Cmd+K et J, Escape ferme. Zéro `/hub/` ou segment littéral hors registre (H-D85 R13/R14) — couleurs en `var(--…)` uniquement (R2).
- L'IA réordonne/suggère mais ne restreint jamais : la liste affiche TOUJOURS les 3 groupes.
- a11y : role=dialog, aria-labels, cibles ≥44px, focus visible, `prefers-reduced-motion` (aucune animation layout, transitions opacity/transform ≤300ms).

---

### Task 1: adventureSchema + adventureLists + specs (~26 tests)

**Files:**
- Create: `src/features/hub/context/adventureSchema.ts`, `src/features/hub/context/adventureLists.ts`
- Test: `tests/features/hub/adventureLists.spec.ts`, `tests/features/hub/adventureSchema.spec.ts`

**Interfaces (exact) :**

```typescript
// adventureSchema.ts
export const ACTIVE_ADVENTURE_COOKIE = 'lkv_active_adventure';
export const adventureSchema = z.discriminatedUnion('nature', [
  z.object({ nature: z.literal('possession') }),
  z.object({ nature: z.literal('sortie'), id: z.string().min(1), slug: z.string().min(1), title: z.string().min(1) }),
  z.object({ nature: z.literal('collectif'), kind: z.enum(['groupe', 'equipage']), id: z.string().min(1), title: z.string().min(1) }),
]);
export type ActiveAdventureData = z.infer<typeof adventureSchema>;
export function serializeActiveAdventure(d: ActiveAdventureData): string;   // base64url, miroir Y
export function deserializeActiveAdventure(raw: unknown): ActiveAdventureData | null;
export function parseStoredAdventure(raw: string | null): ActiveAdventureData | null; // JSON.parse + safeParse, null si invalide

// adventureLists.ts
export interface TripEntry { nature: 'sortie'; id: string; slug: string; title: string; status?: string; primary_activity?: string }
export interface GroupEntry { nature: 'collectif'; kind: 'groupe' | 'equipage'; id: string; title: string; membersCount: number; subtitle: string; linkedTripSlug: string | null }
export interface PossessionEntry { nature: 'possession'; itemsCount: number; loansCount: number; alertsCount: number }
export type AdventureEntry = TripEntry | GroupEntry | PossessionEntry;
export interface AdventureGroups { possession: PossessionEntry[]; sorties: TripEntry[]; collectifs: GroupEntry[] }
export function adventureKey(e: AdventureEntry): string; // 'possession' | `sortie:${slug}` | `collectif:${kind}:${id}`
export function groupAdventures(trips, groups: {id,name,member_count,my_role}[], crews: {id,name,slug,member_count,active_trips_count,next_trip}[], possession): AdventureGroups;
export function filterAdventures(g: AdventureGroups, query: string): AdventureGroups; // match titre, cap 8/groupe
export function resolveAdventureHref(e: AdventureEntry, getLastSection: (key: string) => string | null): string;
export function shouldToggleSwitcher(e: { metaKey: boolean; ctrlKey: boolean; key: string }): boolean; // Cmd/Ctrl+K ou J
```

**Règles (exact) :**
- `groupAdventures` : possession TOUJOURS 1 entrée (même à 0) ; sorties = trips dans l'ordre reçu ; collectifs = groupes (`kind:'groupe'`, subtitle `${member_count} membre(s)` + rôle si non-member) puis crews (`kind:'equipage'`, subtitle `${member_count} membre(s)` + `· ${active_trips_count} voyage(s)` si >0, `linkedTripSlug` = next_trip?.slug ?? null).
- `filterAdventures` : query vide = identité ; sinon filtre insensible à la casse sur title (+status/activity pour sorties), cap 8 par groupe, possession conservée si 'matériel'/'materiel' matche sinon conservée quand query vide uniquement.
- `resolveAdventureHref` : possession → `hubSectionHref({nature:'possession'}, lastSectionValide ?? 'inventaire')` ; sortie → `tripSectionHref(slug, lastSectionValide ?? 'overview')` ; collectif → `hubSectionHref({nature:'collectif'}, lastSectionValide ?? 'groupe')`. Validité = id dans HUB_SECTION_ORDER ET nature compatible (via `hubSectionRegistry`). Fallback silencieux si invalide.
- `shouldToggleSwitcher` : `(metaKey||ctrlKey) && (key==='k'||key==='K'||key==='j'||key==='J')`.

- [ ] **Step 1: Write the failing tests** — les 2 specs (~26 tests : clés, groupement 3 natures + sous-titres, filtre + caps, hrefs + fallbacks + restore, clavier, schema round-trip + invalides→null).
- [ ] **Step 2: Run tests to verify they fail** — `npx vitest run tests/features/hub/adventure` Expected: FAIL (modules inexistants).
- [ ] **Step 3: Write minimal implementation** — les 2 fichiers.
- [ ] **Step 4: Run tests to verify they pass** — Expected: PASS + suite verte.
- [ ] **Step 5: Commit** — `feat(h2): adventureSchema + adventureLists purs (26 tests)`.

### Task 2: API + server actions + contexte

**Files:**
- Create: `src/app/api/hub/adventures/route.ts`, `src/features/hub/context/activeAdventureServer.ts`, `src/features/hub/context/ActiveAdventureContext.tsx`

**Interfaces :**
- `GET /api/hub/adventures` → `{ groups: {id,name,member_count,my_role}[], pendingInvites: number, crews: {id,name,slug,member_count,active_trips_count,next_trip}[], possession: {items,loans,alerts} }`. Non connecté → zéros/vides (jamais 401, miroir `mine`). `dynamic = 'force-dynamic'`.
- `getActiveAdventure/setActiveAdventureAction/clearActiveAdventureAction` — miroir `activeTripServer.ts` (cookie 30j, lax, path /).
- `ActiveAdventureContextValue { activeAdventure, setActiveAdventure(a): Promise<boolean>, setActiveAdventureByKey(key): Promise<boolean>, clearActiveAdventure(), isCurrentAdventure(key), isPending, groups: AdventureGroups, reloadAdventures(), getLastSection(key), setLastSection(key, sectionId) }`. Compose `useActiveTrip()` pour les voyages (userTrips + reloadUserTrips chaînés). Fallback hors provider (miroir Y). Clé persistée `lkdv_active_adventure` (JSON du schema), restauration au montage (parseStoredAdventure).

- [ ] Steps TDD adaptés (pas de RTL) : la logique est déjà couverte en Task 1 ; ce task = câblage vérifié par `tsc` + revue + test d'intégration H3 (hub consomme le contexte). Commit `feat(h2): ActiveAdventureContext + API adventures`.

### Task 3: AdventureSwitcher (cmdk + GlassSheet)

**Files:**
- Create: `src/features/hub/components/AdventureSwitcher.tsx`

**Spéc (miroir ActiveTripSwitcher, 3 natures) :** trigger (titre actif ou « Choisir une aventure », min-h 44px, aria-haspopup/expanded) ; desktop palette cmdk (groupes « Mon matériel / Mes voyages / Mes groupes » avec compteurs, sous-titres, check courant, recherche, empty states par groupe, footer détacher+recharger) ; mobile GlassSheet (même contenu) ; `activate(entry)` = setActiveAdventure + router.push(resolveAdventureHref(entry, getLastSection)) ; Escape ferme ; `window.innerWidth < 768` → sheet (miroir Y). Icônes : Package (possession), Compass (sortie), Users (collectif).

- [ ] Implémenter (logique pure déjà testée) → `tsc` + H-D85 + commit `feat(h2): AdventureSwitcher 3 natures`.

### Task 4: Portes + revue + tag

- [ ] G1 0 erreur ; G2 0 échec, total ≥ 1110 ; G3 (Y-D80 + H-D85 + invariants) ; G6 partiel : axe sur switcher desktop+mobile (si disfrue… si axe dispo, sinon reporté H7 avec mention).
- [ ] Revue : Jonathan Ive (simplicité radicale du sélecteur), Susan Kare (icônes/états vides) — objections traitées/consignées.
- [ ] MISSION_LOG + commit + `git tag h2-done` + push.

## Self-Review

- §2.3 couvert : union 3 natures ✅, groupes+compteurs+sous-titres ✅, persistance + miroir ✅, Ctrl/Cmd+K et J ✅, IA non restrictive (liste toujours complète) ✅, mémoire section/aventure ✅, rechargement = contexte conservé ✅.
- Pas de placeholder : clés, caps, fallbacks, tables, statuts tous chiffrés.
- Cohérence : `resolveAdventureHref` réutilise `hubSectionHref`/`tripSectionHref` (R13) ; aucun segment littéral (R14).
