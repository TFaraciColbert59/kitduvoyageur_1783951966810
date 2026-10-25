# H1 — Moteur et registres du hub voyageur — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer `hubProfileEngine` (fonction pure, composition de `deriveTripProfile`, zéro duplication) + `hubSectionRegistry` + `hubWidgetRegistry` + garde-fou H-D85, le tout testé TDD.

**Architecture:** Le moteur compose (jamais duplique) `deriveTripProfile` pour la nature sortie ; les natures possession/collectif ont leurs propres règles dérivées de l'inventaire (aucune migration schéma). Les registres sont la source unique (règles H-D85 R13/R14).

**Tech Stack:** TypeScript strict, vitest, lucide-react (icônes), alias `@/` → `src/`.

**Spec:** `docs/CHANTIER_H_HUB_VOYAGEUR.md` §2.2 + §9.2 (H1), `docs/H_DECISIONS.md` (H-AUTO-8 : R2 = allowlist tokens.css).

## Global Constraints

- Fonction pure : zéro import React, zéro `window`, horloge injectée (`now`).
- `reason` complet pour CHAQUE `HubSectionId` (traçabilité affichée par le picker).
- `metadata.enabled_sections` (utilisateur) fusionné comme Y2.4, jamais verrouillé.
- Héights widgets : total par nature ≤ 1800 (2 × 900).
- Compteur tests non décroissant (plancher 1056/142).

---

### Task 1: hubProfileEngine + spec (~40 tests)

**Files:**
- Create: `src/features/hub/engine/hubProfileEngine.ts`
- Test: `tests/features/hub/hubProfileEngine.spec.ts`

**Interfaces:**
- Consumes: `deriveTripProfile(trip: TripFull, now: Date): TripProfile` from `@/features/trips/engine/tripProfileEngine`; type `TripFull` from `@/features/trips/types/trip.types`.
- Produces: `deriveHubProfile(input: HubAdventureInput, now: Date): AdventureProfile`; types `AdventureNature`, `AdventureProfile`, `HubSectionId`, `HubWidgetId`, `HUB_SECTION_ORDER`.

**Types (exact) :**

```typescript
export type AdventureNature = 'possession' | 'sortie' | 'collectif';
export type PossessionSectionId = 'inventaire' | 'kit' | 'preparation' | 'depart' | 'disponibilite' | 'alertes';
export type CollectifSectionId = 'groupe' | 'invitations' | 'voyages-lies';
export type HubSectionId = PossessionSectionId | CollectifSectionId | TripSectionId;
export type HubWidgetId = TripWidgetId | 'stock-apercu' | 'alertes-materiel' | 'dispo-apercu' | 'prochain-depart' | 'invitations-apercu' | 'presence-groupe' | 'entrer-voyage';
export interface AdventureProfile {
  nature: AdventureNature;
  scale: 'day' | 'short' | 'long' | 'expedition' | null;
  party: 'solo' | 'duo' | 'group';
  density: 'compact' | 'comfortable';
  sections: HubSectionId[];
  widgets: HubWidgetId[];
  reason: Record<HubSectionId, string>;
}
export type HubAdventureInput =
  | { kind: 'possession'; itemsCount: number; loansCount: number; alertsCount: number; hasDepartEnCours: boolean; enabledSections?: HubSectionId[] }
  | { kind: 'sortie'; trip: TripFull; enabledSections?: HubSectionId[] }
  | { kind: 'collectif'; membersCount: number; pendingInvites: number; linkedTripsCount: number; hasLinkedTrip: boolean; enabledSections?: HubSectionId[] };
export const HUB_SECTION_ORDER: HubSectionId[] = ['inventaire','kit','preparation','depart','disponibilite','alertes','overview','itinerary','gear','team','budget','docs','checklist','safety','journal','export','groupe','invitations','voyages-lies'];
```

**Règles (exact) :**
- possession : base `['inventaire','kit']` ; `+preparation` si itemsCount>0 ; `+depart` si hasDepartEnCours ; `+disponibilite` si loansCount>0 ; `+alertes` si alertsCount>0. scale=null, party='solo', density='comfortable'. widgets : `stock-apercu` toujours, `alertes-materiel` si alerts>0, `dispo-apercu` si loans>0, `prochain-depart` si depart en cours (ordre priorité : alertes 90, prochain-depart 85, stock 70, dispo 60).
- sortie : `deriveTripProfile(trip, now)` → scale/party/density/sections/widgets repris tels quels (mêmes ids) ; nature='sortie' ; reason = reason du trip + `'profil : nature sortie (composition tripProfileEngine, zéro duplication)'` sur `overview`.
- collectif : base `['groupe']` ; `+invitations` si pendingInvites>0 ; `+voyages-lies` si linkedTripsCount>0. scale=null, party par membres (≤1 solo, 2 duo, ≥3 group), density='comfortable'. widgets : `presence-groupe` toujours, `invitations-apercu` si invites>0, `entrer-voyage` si hasLinkedTrip (priorités 75/90/88).
- enabledSections : ajoutés puis triés selon HUB_SECTION_ORDER (comme Y2.4) ; reason `'affiché : activé manuellement (HubSectionPicker)'`.
- reason : une phrase par id de HUB_SECTION_ORDER (affiché/masqué + motif chiffré).

- [ ] **Step 1: Write the failing test** — créer `tests/features/hub/hubProfileEngine.spec.ts` (matrice possession ×3 cas, sortie composition ×5 cas, collectif ×4 cas, enabledSections, reason complet, cas limites : trip annulé, compteurs zéro, membres 0).
- [ ] **Step 2: Run test to verify it fails** — Run: `npx vitest run tests/features/hub/hubProfileEngine.spec.ts` Expected: FAIL (module inexistant).
- [ ] **Step 3: Write minimal implementation** — créer `src/features/hub/engine/hubProfileEngine.ts` selon types+règles ci-dessus.
- [ ] **Step 4: Run test to verify it passes** — Run: même commande Expected: PASS + suite complète verte.
- [ ] **Step 5: Commit** — `git add` des 2 fichiers, message `feat(h1): hubProfileEngine pur + 40 tests (composition tripProfileEngine)`.

### Task 2: hubSectionRegistry + hubWidgetRegistry + spec (~14 tests)

**Files:**
- Create: `src/features/hub/registry/hubSectionRegistry.ts`, `src/features/hub/registry/hubWidgetRegistry.ts`
- Test: `tests/features/hub/hubRegistries.spec.ts`

**Interfaces:**
- Consumes: `HUB_SECTION_ORDER`, `HubSectionId`, `HubWidgetId` (engine) ; `tripSectionHref` (trips registry, délégation sortie) ; `LucideIcon` (lucide-react).
- Produces: `hubSectionRegistry: readonly HubSectionDef[]`, `hubSectionHref(adventure: { nature: AdventureNature; slug?: string }, sectionId: HubSectionId): string`, `visibleHubSections(profile: AdventureProfile): HubSectionDef[]`, `hubWidgetRegistry`, `hubWidgetsForNature(nature)`, `hubEstimatedHeight(ids)`, `HUB_WIDGET_COLUMN_MAX_HEIGHT = 1800`.

**Sections (exact, id/label/segment/natures) :**
inventaire/Inventaire/inventaire/[possession] · kit/Kits/kit/[possession] · preparation/Préparation/preparation/[possession] · depart/Départ/depart/[possession] · disponibilite/Disponibilité/disponibilite/[possession] · alertes/Alertes/alertes/[possession] · overview/Aperçu/''/[sortie] · itinerary/Itinéraire/itineraire/[sortie] · gear/Équipement/kit-voyage/[sortie] · team/Équipage/equipage/[sortie,collectif] · budget/Budget/budget/[sortie] · docs/Documents/documents/[sortie] · checklist/Checklist/checklist/[sortie] · safety/Sécurité/securite/[sortie] · journal/Journal/journal/[sortie] · export/Export/export/[sortie] · groupe/Groupe/groupe/[collectif] · invitations/Invitations/invitations/[collectif] · voyages-lies/Voyages liés/voyages/[collectif].

Icônes (lucide) : inventaire Package, kit Backpack, preparation FlaskConical, depart Footprints, disponibilite CalendarCheck, alertes BellRing, overview Compass, itinerary Navigation, gear Package, team Users, budget CreditCard, docs FileText, checklist CheckSquare, safety Shield, journal BookOpen, export Share2, groupe Users, invitations MailPlus, voyages-lies Map.

**href (exact) :** sortie → `tripSectionHref(slug, id)` (slug requis, throw sinon) ; possession/collectif → `` `/hub/${segment}` `` (overview n'existe pas hors sortie : throw si nature incompatible — `def.natures.includes(nature)` sinon throw).

**Widgets (exact, id/priority/height/natures) :** stock-apercu 70/110/[possession] · alertes-materiel 90/96/[possession] · dispo-apercu 60/96/[possession] · prochain-depart 85/72/[possession] · invitations-apercu 90/96/[collectif] · presence-groupe 75/110/[collectif] · entrer-voyage 88/72/[collectif] · + les 12 TripWidgetIds (priorités/hauteurs/phases du tripWidgetRegistry, natures [sortie]) — importés par référence, jamais recopiés (construire par `tripWidgetRegistry.map(...)`).

- [ ] **Step 1: Write the failing test** — `tests/features/hub/hubRegistries.spec.ts` : ids uniques, ordre == HUB_SECTION_ORDER filtré, href possession `/hub/kit`, href sortie délègue `/voyages/slug/itinaire…`, throw nature incompatible, compteurs non-négatifs, total hauteurs par nature ≤ 1800, icônes définies.
- [ ] **Step 2: Run test to verify it fails** — Expected: FAIL (modules inexistants).
- [ ] **Step 3: Write minimal implementation** — les 2 fichiers registre.
- [ ] **Step 4: Run test to verify it passes** — Expected: PASS + suite verte.
- [ ] **Step 5: Commit** — `feat(h1): registres sections/widgets + hubSectionHref typé`.

### Task 3: Garde-fou H-D85 (14 règles)

**Files:**
- Create: `tests/design/h-d85-guard.spec.ts`

**Interfaces:** aucune (scan statique, modèle `tests/design/y-d80-guard.spec.ts`).

- SCOPE = `src/features/hub`, `src/app/hub`, `src/components/mobile-nav`.
- R1–R12 = mêmes regex que Y-D80. R2 : allowlist = `#fff #ffffff #000 #000000` + hexes de `src/styles/tokens.css` et `tailwind.config.js` (H-AUTO-8).
- R13 : 0 littéral `'/hub/…'` hors `hubSectionRegistry.ts`.
- R14 : 0 littéral de segment (`'inventaire'`, `'disponibilite'`, `'voyages-lies'`, `'invitations'`…) hors engine/registre/tests/guard.
- LEGACY_ALLOWLIST documentée (composants terrain pré-D1, burn-down H3) — ajoutée APRÈS constat rouge.

- [ ] **Step 1: Write the failing test** — créer le spec SANS legacy allowlist.
- [ ] **Step 2: Run test to verify it fails** — Expected: FAIL avec violations legacy listées (preuve que le garde-fou mord).
- [ ] **Step 3: Write minimal implementation** — ajouter LEGACY_ALLOWLIST + entrée H_BLOCKERS/H_DECISIONS (dette H3), ZÉRO changement prod.
- [ ] **Step 4: Run test to verify it passes** — Expected: 14/14 PASS.
- [ ] **Step 5: Commit** — `test(h1): garde-fou H-D85 14 règles + dette legacy documentée`.

### Task 4: Portes + revue + tag

- [ ] G1 `npm run type-check` = 0 erreur ; G2 `npm test` = 0 échec, total ≥ 1056 ; G3 = Y-D80 12/12 + H-D85 14/14 + ci_invariants.
- [ ] Revue icon-agents : Kent Beck (frontières de conception), Leslie Lamport (pureté/invariants) — objections consignées dans le commit ou H_DECISIONS.
- [ ] MISSION_LOG.md + commit + `git tag h1-done` + push branche.

## Self-Review

- Spec §2.2 couvert : nature/scale/party/density/sections/widgets/reason ✅ ; enabled_sections ✅ ; composition (R2) ✅ ; registres + href typé ✅ ; H-D85 + R13/R14 ✅ ; portes G1–G3 ✅.
- Pas de placeholder : regex, ids, labels, segments, priorités, hauteurs tous chiffrés ci-dessus.
- Cohérence types : `HubSectionId` inclut `TripSectionId` (import type) ; sortie réutilise les ids trip sans les redéfinir.
