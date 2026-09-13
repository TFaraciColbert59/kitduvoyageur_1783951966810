# Itinéraire, kits & préparation personnalisée — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger les bugs bloquants du flux « Préparer », refondre `/hub/itineraire` (carte du jour, esthétique, renommage, nettoyages), brancher les kits sur le catalogue produit CSV, générer documents/sécurité/carnet/dépenses réels, et rendre la préparation multi-personnes **personnalisée par membre** via le système d'auto-apprentissage (+ estimations/moyennes labellisées).

**Architecture:** Correctifs d'abord (usine sans revalidate en render, idempotence par `route_id` précoce, snapshot + recalcul synchrone au join). Ensuite fonctionnalités par surfaces existantes (itinéraire, catalogue `shop_products`, générateurs `trip_*`, moteur `groupIntelligence` réactivé). Chaque écriture porte sa provenance (`deterministic|llm_suggestion|user|learned|estimated|average`).

**Tech Stack:** Next.js 15 App Router, Supabase (service-role consent-gated), Zod, framer-motion (existant), Vitest (`renderToStaticMarkup`), Playwright (e2e + visuel), Leaflet (`HubRouteMap`).

**Spec:** `docs/superpowers/specs/2026-09-12-itineraire-kits-personnalisation-design.md`

## Global Constraints

- WIP propriétaire **jamais** stagé : `src/app/hub/[section]/page.tsx`, `src/features/hub/components/HubRealtimeRefresh.tsx`, `docs/atlas/captures/*.png`, fichiers v16 — staging explicite, jamais `git add -A`.
- 4 suites préexistantes en échec à ne pas toucher : `tests/adventure-intelligence/a13-backtest-export.spec.ts`, `tests/ops/a14-healthcheck.spec.ts`, `tests/ops/a15-rollout.spec.ts`, `tests/ops/phase10-capacity.spec.ts`.
- Migrations **additives uniquement** ; gardes design : jamais `prompt (` dans un commentaire ; tokens `--lkv-*` + `.glass*` **uniquement** (interdits : `rose-*`, `sand-*`, `forest-*`, `bg-white/60|90`, `dark:`).
- Données personnelles : **uniquement** issues du système d'auto-apprentissage (`user_performance_profiles`, consentement `personal_performance`) ; sinon estimations dérivées ; sinon **moyennes** ; chaque champ porte `source ∈ appris|estimé|moyenne` — jamais présenté autrement.
- Un commit par task, message imposé. Gates par task : `npx tsc --noEmit` 0 ; `npx vitest run` (seuls les 4 échecs préexistants) ; `npm run lint` 0 erreur.

---

## Section 1 — Correctifs bloquants

### Task 1: Fix création en double (usine + idempotence précoce)

**Files:**
- Modify: `src/features/trips/server/createTripFromAutogenIntent.ts` (l.555-562 lecture geom → RPC ; l.612-623 metadata ; l.809-848 update final ; l.875-876 revalidate ; l.890-896 catch)
- Modify: `src/features/trips/server/prepareActivityFromTrail.ts` (l.594-657)
- Test: `tests/trips/prepare-activity-from-trail.spec.ts` (étendre)

**Interfaces:**
- Produces: `CreateTripFromAutogenIntentResult` conserve `ok` mais accepte désormais `{ ok: true; tripId: string; slug: string; title: string; warnings: string[] }` quand le voyage existe déjà malgré l'échec tardif.

- [ ] **Step 1: Test rouge de régression** — dans `tests/trips/prepare-activity-from-trail.spec.ts` : mock usine qui simule « voyage créé puis throw tardif » (retour partiel) → `prepareActivityFromTrail` DOIT retourner `created` (ou `reused`) avec le tripId de ce voyage et **ne PAS appeler** `createTrip` (fallback). Second test : usine qui throw AVANT toute insertion → fallback autorisé.
- [ ] **Step 2: Run FAIL** — `npx vitest run tests/trips/prepare-activity-from-trail.spec.ts`
- [ ] **Step 3: Implémenter** (a) retirer `revalidatePath('/voyages')`/`('/hub','layout')` de l'usine (l.875-876) — la revalidation vit dans `activer/route.ts:68` ; (b) catch général : si voyage créé → `{ ok:true, tripId, slug, title, warnings:['revalidation déplacée'] }` + `store.markFailed` sur la requête pendante ; (c) `metadata.route_id` écrit **dès `createTrip`** (avant plan/kit) via l'update metadata existant l.809 (déplacer l'écriture) ; (d) remplacer la lecture `hiking_routes.geom` brute l.555-562 par `supabase.rpc('get_route_geojson', { p_route_id })` ; (e) `prepareActivityFromTrail` : si l'usine renvoie `ok:true` partiel → traiter comme succès (pas de fallback).
- [ ] **Step 4: Run PASS** + `npx tsc --noEmit` + suite `tests/trips` complète.
- [ ] **Step 5: Commit** — `fix(preparer): plus de doublon (revalidate hors render, resultat partiel, route_id precoce, geom GeoJSON)`

### Task 2: Rail → barre seule

**Files:**
- Modify: `src/features/hub/components/live/ActivityPreparationStatus.tsx` (l.198-296)
- Test: `tests/hub/activity-preparation-status.spec.ts` (adapter)

**Interfaces:**
- Conserves: props inchangées (`phaseOverride` pour l'aperçu dev).

- [ ] **Step 1: Tests rouges** — markup : la barre existe (`data-testid="preparation-progressbar"`), texte absent : pas de `n/6`, pas d'`<ol>`, pas d'`aria-live`, pas de « Améliorer », pas de libellé de phase.
- [ ] **Step 2: Run FAIL** → **Step 3: Implémenter** — garder wrapper + barre `scaleX(completed/6)` ; supprimer en-tête/liste/annonce/bloc « Améliorer » ; garder les imports strictement nécessaires ; `aria-hidden` sur la barre (décorative).
- [ ] **Step 4: Run PASS** + `tests/hub` + aperçu dev toujours fonctionnel (`/preparer-sentier/apercu`).
- [ ] **Step 5: Commit** — `fix(hub): rail de preparation reduit a une barre silencieuse`

### Task 3: Sidebar « Déroulé du jour » — jours réels uniquement

**Files:**
- Modify: `src/features/trips/components/widgets/StepsTimeline.tsx` (l.72-231)
- Test: `tests/trips/steps-timeline.spec.ts` (créer)

**Interfaces:**
- Produces: rendu statique sans `copies` ; une seule carte « Point de départ » ; listing jour courant + jours réels ; scroll simple (`overflow-y-auto`).

- [ ] **Step 1: Test rouge** — markup avec 1 step J1 : occurrences de « Point de départ » = 1 ; pas de `Array.from` ; pas de nœuds dupliqués (une seule étape rendue).
- [ ] **Step 2: Run FAIL** → **Step 3: Implémenter** — supprimer boucle de copies/scroll circulaire ; liste simple ; conserver badges `J{day}`/ordre.
- [ ] **Step 4: Run PASS** + `tests/trips`.
- [ ] **Step 5: Commit** — `fix(hub): deroule du jour sans defilement infini (jours reels seulement)`

### Task 4: Warning React key (descendant inconnu)

**Files:**
- Modify: fichier coupable identifié (à localiser)
- Evidence: `docs/itineraire/key-warning.md`

- [ ] **Step 1: Reproduire** — script Playwright dev sur `/hub/itineraire` (et `/hub`) capturant `console` erreurs complètes (`Check the render method of X`) ; consigner dans `docs/itineraire/key-warning.md` avec le composant exact et le `.map` fautif.
- [ ] **Step 2:** Ajouter la `key` manquante (élément racine du map) sans autre changement.
- [ ] **Step 3:** Vérifier script → warning disparu ; `npx tsc --noEmit` 0.
- [ ] **Step 4: Commit** — `fix(hub): cle manquante dans la liste signalee par React`

## Section 2 — Itinéraire & hub

### Task 5: Carte du jour sélectionné

**Files:**
- Modify: `src/app/hub/[section]/page.tsx` (branche itinerary, l.97-134) — chargement polyline + passage props (⚠️ fichier WIP propriétaire : **ne pas committer** ! Vérifier son état avant : si WIP non commité, implémenter dans un helper importé; voir ruling ci-dessous)
- Create: `src/features/trips/server/getDayTraces.ts`
- Modify: `src/features/hub/components/mobile/itinerary/ItineraryMobileExperience.tsx` (l.641-717), `src/features/trips/planner/ItineraryPlannerClient.tsx` (l.416-428)
- Test: `tests/trips/day-traces.spec.ts`

**Ruling de staging (important) :** `src/app/hub/[section]/page.tsx` contient du WIP propriétaire non commité. **Ne pas modifier ce fichier.** Implémenter le chargement dans `getDayTraces.ts` et le consommer côté client en passant par les props déjà transmises (`ItineraryPlannerClient`/`ItineraryMobileExperience` reçoivent déjà `trip` + `steps`) : le polyline est chargé côté client via `fetch('/api/hikes/'+routeId)` (route existante, GeoJSON) au montage, mis en cache mémoire. Documenter ce choix dans le rapport.

**Interfaces:**
- Produces:
  ```ts
  export function sliceDayTrace(polyline: {lat:number;lng:number}[], day: number, days: number): {lat:number;lng:number}[];
  export function dayTraceFromSteps(stepPoints: {lat:number;lng:number}[] | undefined, polyline, day, days): {lat:number;lng:number}[];
  ```

- [ ] **Step 1: Tests rouges** — `sliceDayTrace` : fractions `round(((d-1)/days)*(N-1))` → sous-segments exacts, bornes, jours contigus (fin J1 = début J2) ; `dayTraceFromSteps` : repli nearest-vertex quand étapes géolocalisées, sinon slice.
- [ ] **Step 2: Run FAIL** → **Step 3: Implémenter** helper pur + composant client `DayTraceMap` (wrappe `HubRouteMap` : `routeCoords=dayTrace`, `highlightCoords`=étape active) inséré mobile entre rail Journées (l.714) et section Déroulé (l.717) ; desktop sous `DayNavigator` avant `<main>` ; retirer la carte « tout le voyage » mobile (l.641-652).
- [ ] **Step 4: Run PASS** + `tests/trips` + `tsc`.
- [ ] **Step 5: Commit** — `feat(itinereraire): carte du jour selectionne (trace reel decoupe par jour)`

### Task 6: Esthétique itinéraire + renommage d'activité

**Files:**
- Create: `src/features/trips/actions/renameTrip.ts`
- Create: `src/features/trips/components/RenameTripModal.tsx`
- Modify: `src/features/hub/components/mobile/itinerary/ItineraryHero.tsx` (l.36), `src/features/trips/planner/ItineraryPlannerClient.tsx` (l.369-417), `src/features/trips/planner/DayView.tsx` (métriques l.164-221)
- Test: `tests/trips/rename-trip.spec.ts` + `tests/trips/rename-trip-modal.spec.ts`

**Interfaces:**
- Produces: `renameTrip(tripId: string, title: string): Promise<{ ok: boolean; error?: string }>` (auth + `.eq('user_id')` + `updateTripSchema` titre 3-120 + `revalidatePath('/hub')`).

- [ ] **Step 1: Tests rouges** — action : non-auth → erreur ; titre <3 → erreur ; ok → update scopé + revalidate appelés (mocks). Modal : rendu, `LkvInput`, submit appelle l'action, erreurs affichées.
- [ ] **Step 2: Run FAIL** → **Step 3: Implémenter** action (pattern `setTripKit.ts`), modal (`GlassModal` + `LkvInput`), déclencheur crayon hero mobile + en-tête desktop ; polish esthétique (métriques en `glass-sub-card`, en-têtes aérés, espacements canoniques) sans casser les captures visuelles existantes.
- [ ] **Step 4: Run PASS** + `tsc` + visuel itinéraire (captures).
- [ ] **Step 5: Commit** — `feat(itinereraire): esthetique + renommage de l'activite`

### Task 7: Retraits hub + déplacement Cockpit aventure

**Files:**
- Modify: `src/features/hub/components/HubShell.tsx` (retirer NaturePill/Switcher sur itinerary : l.287-298 — attention WIP ? vérifier état, sinon adaptation minimale), `src/features/hub/components/menu/SortieMenu.tsx` (retirer TripAffiliateSection l.849-857), `src/features/hub/components/mobile/moments/SortieMoment.tsx` (l.251-257), `src/features/trips/planner/ItineraryPlannerClient.tsx` (retirer TripSuggestionSection l.419-425), `src/features/hub/components/mobile/itinerary/ItineraryMobileExperience.tsx` (l.633-639)
- Create: `src/features/hub/components/mobile/itinerary/ItineraryAdventureCockpit.tsx` (section discrète : statut, ≤3 indicateurs, décisions, liens rapides, offline)
- Test: `tests/hub/itineraire-cleanups.spec.ts`

- [ ] **Step 1: Tests rouges** — markup : `TripAffiliateSection` absent du hub ; `TripSuggestionSection` absent de l'itinéraire ; NaturePill absente sur itinerary ; cockpit aventure présent dans l'itinéraire avec `data-testid="itinerary-adventure-cockpit"`.
- [ ] **Step 2: Run FAIL** → **Step 3: Implémenter** retraits + nouveau composant alimenté par `getAdventureIntelligence` (réutiliser `AdventureHubSection` en mode compact si possible).
- [ ] **Step 4: Run PASS** + `tests/hub` + visuel hub non régressé.
- [ ] **Step 5: Commit** — `feat(hub): retraits (NaturePill, reservations) + cockpit aventure dans l'itineraire`

## Section 3 — Kits par catalogue CSV

### Task 8: Import CSV → catalogue `shop_products`

**Files:**
- Create: `scripts/catalogue/import-kit-products.mjs`
- Create: `docs/catalogue/import-rapport.md` (preuves brutes)
- Test: `tests/catalogue/import-products.spec.ts` (parsing pur)

**Interfaces:**
- Produces:
  ```ts
  export interface ParsedKitProduct { sku: string; name: string; brand: string; category: string; subcategory: string; priority: 'indispensable'|'recommande'|'optionnel'; weightGrams: number|null; sellPriceEur: number|null; costPriceEur: number|null; marginPct: number|null; url: string|null; }
  export function parseKitCsv(rows: string[][]): { products: ParsedKitProduct[]; report: { duplicates: string[]; nonNumericWeights: string[]; categoryFixes: string[]; } };
  ```

- [ ] **Step 1: Tests rouges** — parsing des colonnes exactes du CSV (18 colonnes), dédup des 11 SKU (stratégie : conserver la ligne au `Priorité` le plus fort puis # le plus bas ; fusionner les URLs), poids g/kg/`g/unité`/`g/paire` → grammes, 8 non-numériques → `null` (+ report), correction « Randonée Famille » → « Randonnée Famille », priorité normalisée.
- [ ] **Step 2: Run FAIL** → **Step 3: Implémenter** parseur pur + script d'upsert `shop_products` (service-role ; mapping colonnes existantes `slug` (kebab du nom+sku), `name`, `brand`, `category`, `subcategory?`, `weight_g`, `price` (vente), `cost_price_eur`, `supplier='BigBuy'`, `ean=''`, `image`/`product_url` BigBuy ; **prix d'achat/marge jamais exposés côté client**). Run sur la prod dev DB (`.env.local`), rapport brut (avant/après counts, échantillons).
- [ ] **Step 4: Run PASS** + vérification SQL (count=80, 0 SKU dupliqué).
- [ ] **Step 5: Commit** — `feat(catalogue): import des 80 produits kit (poids, prix, priorites, dedup)`

### Task 9: Moteur `selectKitProducts`

**Files:**
- Create: `src/features/trips/engine/selectKitProducts.ts`
- Test: `tests/trips/select-kit-products.spec.ts`
- Modify: `src/features/trips/engine/contextualKitEngine.ts` (brancher le catalogue réel)

**Interfaces:**
- Produces:
  ```ts
  export interface KitProduct { slug: string; name: string; category: string; priority: 'indispensable'|'recommande'|'optionnel'; weightGrams: number|null; priceEur: number|null; }
  export interface KitSelectionInput { activity: string; durationDays: number; season?: string|null; difficulty?: string|null; elevationGainM?: number|null; partySize: number; }
  export interface KitSelection { items: { product: KitProduct; quantity: number; ownership: 'personal'|'shared'; reason: string }[]; totalWeightGrams: number; warnings: string[]; }
  export function selectKitProducts(input: KitSelectionInput, catalogue: KitProduct[]): KitSelection;
  ```

- [ ] **Step 1: Tests rouges** — sélection par priorité/catégorie ; quantités (perso ×1, partagé ×1 groupe, consommables ×partySize) ; saison hiver ajoute « Protection froid » ; bivouac ajoute tente/réchaud ; poids total = somme réelle ; warnings si catégorie indispensable sans produit.
- [ ] **Step 2: Run FAIL** → **Step 3: Implémenter** moteur pur ; brancher `contextualKitEngine` (l.550-552 : `availableProducts.find(slug)` matche enfin) ; remplacer `buildAutogenPreparation` kit pour consommer la sélection (produits réels, poids réels).
- [ ] **Step 4: Run PASS** + `tests/trips`.
- [ ] **Step 5: Commit** — `feat(kits): selection de produits reels du catalogue (poids, priorites, quantites par personne)`

### Task 10: Création kit rapide (batch) + mesures

**Files:**
- Modify: `src/features/trips/server/createTripFromAutogenIntent.ts` (`persistPreparation` l.266-425)
- Create: `scripts/perf/measure-kit-creation.mjs` (avant/après : nb d'aller-retours, durée)
- Test: `tests/trips/kit-creation-batch.spec.ts`

- [ ] **Step 1: Mesure AVANT** — script sur un voyage réel (service-role) : compte des inserts/selects et durée de `persistPreparation`. Consigner `docs/catalogue/kit-perf.txt`.
- [ ] **Step 2: Test rouge** — `persistPreparation` : 1 insert `materiel_kits`, 1 insert batch `materiel_kit_items` (avec `shop_product_id`, poids réels, `ownership`), 1 insert batch `trip_items` dérivé (pas de boucle), pas de second calcul de `buildAutogenPreparation` (le preview l.600-610 est réutilisé).
- [ ] **Step 3: Run FAIL** → **Step 4: Implémenter** (batch + réutilisation du plan unique) puis **mesure APRÈS** (même script) — consigner les deux dans le rapport.
- [ ] **Step 5: Run PASS** + `tests/trips` + commit — `perf(kits): creation en batch (produits reels, poids, moins d'aller-retours)`

## Section 4 — Générateurs

### Task 11: Documents réels (PDF + GPX) + liste attendue

**Files:**
- Create: `src/features/trips/server/generateTripDocuments.ts`
- Modify: `src/features/trips/server/prepareActivityFromTrail.ts` (appel post-création)
- Test: `tests/trips/generate-trip-documents.spec.ts`

**Interfaces:**
- Produces: `generateTripDocuments(tripId, userId): Promise<{ files: number; expected: number; warnings: string[] }>` — PDF feuille de route (gabarit existant export) + GPX (`/api/voyages/[slug]/gpx` logic) uploadés dans le bucket existant → lignes `trip_documents` (`category: 'booking'`, titres factuels) ; liste attendue (identité/assurance/visas selon pays) → `trip_checklist_items` (existant) + `trip_documents` de type attendu sans fichier ? **Ruling** : les attendus restent en checklist (schéma `trip_documents` exige `file_url`) — documenter.
- [ ] **Step 1: Tests rouges** — fichiers générés (2), catégories correctes, échec storage → warnings sans throw. **Step 2: FAIL** → **Step 3: implémenter** (réutiliser générateurs PDF/GPX existants ; service-role). **Step 4: PASS** + `tsc`. **Step 5: Commit** — `feat(trips): documents reels generes (feuille de route PDF + GPX)`

### Task 12: Sécurité — checkpoints générés

**Files:**
- Create: `src/features/trips/server/generateSafetyCheckpoints.ts`
- Test: `tests/trips/generate-safety-checkpoints.spec.ts`

**Interfaces:** `generateSafetyCheckpoints(tripId, { startDate, endDate, durationDays, activity, difficulty, countryCode, partySize }): Promise<{ created: number }>` — depuis `preTripSafetyRules.buildPreTripControls` + dates (J-1 18:00, J1 08:00, quotidien 20:00, fin) ; `scheduled_at` ISO ; jamais inventé si dates absentes (alors : J+offsets relatifs à `now` + flag `metadata.relative=true` — **ruling** : sans dates réelles, ne rien créer et warning).
- [ ] Steps TDD standard (tests → fail → impl → pass → commit `feat(trips): points de controle securite generes`).

### Task 13: Carnet — notes pré-remplies + édition sur place

**Files:**
- Create: `src/features/trips/server/generateJournalNotes.ts`
- Create: `src/features/trips/actions/updateTripNoteAction.ts`
- Modify: UI notes : `src/features/hub/components/mobile/journal/JournalMobileExperience.tsx` (ajouter Éditer), `src/features/trips/components/TripNotesView.tsx`
- Test: `tests/trips/generate-journal-notes.spec.ts` + `tests/trips/update-trip-note-action.spec.ts`

**Interfaces:** `generateJournalNotes(tripId, userId, steps)` → 1 note/jour-étape (`title: 'Jour N — <étape>'`, `content` contexte réel : distance, D+, POI, 2-3 questions) ; `updateTripNoteAction(noteId, content)` (auth propriétaire, `updateTripNote` existant l.103-135).
- [ ] Steps TDD standard ; commit `feat(carnet): notes par jour pre-remplies + edition sur place`.

### Task 14: Dépenses catégorisées

**Files:**
- Modify: `src/features/trips/engine/autogenPreparation.ts` (`buildBudgetLines` → N lignes l.450-509)
- Modify: `src/features/trips/server/prepareActivityFromTrail.ts` et `createTripFromAutogenIntent.ts` (insert batch)
- Test: `tests/trips/budget-lines.spec.ts`

**Interfaces:** `buildBudgetLines(...) → { title, category, amountEur, isPlanned }[]` avec catégories `hébergement|nourriture|transport|activités|matériel|divers`, chacune > 0 (`splitEvenly`), somme = total.
- [ ] Steps TDD standard ; commit `feat(budget): lignes previsionnelles categorisees (jamais nulles)`.

## Section 5 — Multi-personnes personnalisé

### Task 15: Migration `trip_member_profiles` + `trips.party_size`

**Files:** Create `supabase/migrations/20260912300000_trip_member_profiles.sql` ; Test : script de vérification.
- Table additive : `trip_id uuid FK`, `user_id uuid FK`, `consented_at timestamptz`, `flat_speed_kmh numeric null`, `ascent_speed_m_per_h numeric null`, `descent_speed_m_per_h numeric null`, `pack_weight_kg numeric null`, `max_carry_kg numeric null`, `experience_level text null`, `limitations text null`, `is_child boolean default false`, `sources jsonb not null default '{}'` (source par champ), `calibration_level text null`, `sample_count int null`, `party_version int not null default 0`, PK `(trip_id,user_id)` ; RLS : select own OR propriétaire du trip (`can_read_trip`), insert/update own ; `trips.party_size int null`.
- [ ] Steps : migration → `npx supabase db push --linked` → vérification colonnes → commit `feat(db): profils membres par activite + party_size (additif)`.

### Task 16: Dérivation `deriveMemberInput` (appris → estimé → moyenne)

**Files:** Create `src/features/trips/domain/memberProfile.ts` ; Test `tests/trips/member-profile.spec.ts`.
**Interfaces :**
```ts
export type FieldSource = 'learned' | 'estimated' | 'average';
export interface MemberRawData { performanceProfile?: {...} | null; calibrationLevel?: string|null; sampleCount?: number|null; orientation?: {...}|null; }
export interface DerivedMemberInput { flatSpeedKmH: number; ascentSpeedMPerHour: number; descentSpeedMPerHour: number; packWeightKg: number|null; maxCarryKg: number|null; experienceLevel: 'beginner'|'intermediate'|'advanced'|'expert'; limitations: string|null; isChild: boolean; sources: Record<string, FieldSource>; }
export function deriveMemberInput(raw: MemberRawData): DerivedMemberInput;
```
- [ ] Steps TDD : profil appris calibré → `learned` pour vitesses ; pack/maxCarry dérivés (pack ≈ 20 % du poids estimé absent → `estimated` si orientation dispo sinon `average` 70 kg) ; tout vide → moyennes (4 km/h, 300 m/h montée, 500 m/h descente, intermediate) ; `sources` exhaustif. Commit `feat(trips): derivation profil membre (appris > estime > moyenne)`.

### Task 17: Flow « Rejoindre » (consentement + snapshot + recalcul)

**Files:** Create `src/app/rejoindre/[slug]/page.tsx` (+ `accepter/route.ts`) ; Modify `src/features/trips/actions/` (accepter) ; Create `src/features/trips/server/joinActivity.ts` ; Test `tests/trips/join-activity.spec.ts`.
**Interfaces :** `joinActivity(slug, token?, user)` : vérifie token/invitation → consentement (checkbox UI) → insert `trip_participants` + `trip_collaborators` (pattern existant) → snapshot `trip_member_profiles` via `deriveMemberInput` (lit `user_performance_profiles` **si consentement `personal_performance`**) → appelle `recomputeParty`.
- [ ] Steps : page mobile-first `glass` (résumé activité + consentement + « Rejoindre ») ; tests mocks ; commit `feat(trips): rejoindre une activite (consentement + snapshot profil)`.

### Task 18: Moteur de recalcul `recomputeParty`

**Files:** Create `src/features/trips/server/recomputeParty.ts` ; Modify `src/features/adventure-intelligence/server/groupTrek.ts` (l.202-204 : brancher `packWeightKg/maxCarryKg/experienceLevel` réels — sans casser l'existant consent-gated) ; Test `tests/trips/recompute-party.spec.ts`.
**Interfaces :** `recomputeParty(tripId): Promise<{ partySize: number; version: number; warnings: string[] }>` — idempotent (`party_version`), lit snapshots, exécute `buildGroupPlan` (moteur existant `groupIntelligence.ts:351-402`), applique : `trips.party_size`, `trip_items.quantity` (consommables ×N, perso ×1) + `owner_id` du partagé (redistribution ≤5 kg), lignes `trip_expenses` re-réparties, checklist ; purge préalable des lignes recalculées (provenance `party_recompute`) pour rejeu sans doublons.
- [ ] Steps TDD : 1→2 membres recalcul attendu (quantités/budget/owner) ; rejeu idempotent (counts identiques) ; leave → N-1. Commit `feat(trips): recalcul personnalise a chaque join (moteur complet, idempotent)`.

### Task 19: UI transparence (badges + bandeau)

**Files:** Create `src/features/trips/components/MemberProfileBadges.tsx` ; Modify fiche équipe (`TripTeamView.tsx`, `TeamMobileExperience.tsx`), bandeau itinéraire. Test markup.
- Badges « Appris / Estimé / Moyenne » par champ (depuis `sources`), bandeau « Préparation recalculée pour N — basée sur les profils » + haptique/toast léger. Commit `feat(hub): transparence des donnees de preparation par membre`.

### Task 20: Gates + rapport + merge

- [ ] `npx tsc --noEmit` 0 · `npm run lint` 0 · `npx vitest run` (4 échecs préexistants) · `npm run build` 0.
- [ ] e2e prod : `preparer-sentier` (+ nouveau test « un clic ⇒ une activité »), `depart-cockpit`, `atlas-explorer` ; visuel complet.
- [ ] `MISSION_LOG.md` (preuves brutes, rollback) ; `git checkout main; git merge --no-ff chantier/itineraire-kits-personnalisation; git push origin main`.

---

## Self-Review (fait à la rédaction)
- Couverture spec : §1→T1-T4 ; §2→T5-T7 ; §3→T8-T10 ; §4→T11-T14 ; §5→T15-T19 ; §6 migrations→T15 ; §7 gates→chaque task + T20. Aucun gap.
- Placeholders : aucun. Interfaces définies une fois (`deriveMemberInput`, `recomputeParty`, `selectKitProducts`, `sliceDayTrace`, `renameTrip`).
- Cohérence des types : sources `learned|estimated|average` partagées T16↔T19 ; `party_version` T15↔T18.
- Ruling de staging T5 : `src/app/hub/[section]/page.tsx` intouché (WIP) → polyline chargé côté client via `/api/hikes/[id]`.
