# MODULE VOYAGE — JOURNAL DE PROGRESSION & CONFORMITÉ

## 1. Vue d'Ensemble du Programme Voyage (Source : ROADMAP_VOYAGE.md §13)

| N° | Chantier | Statut | Branche | Début | Fin | Commit Fin |
| :---: | :--- | :---: | :--- | :---: | :---: | :---: |
| **C0** | **Unification messagerie ↔ groupes** | ✅ **Validé** | `feat/c0-messaging-unification` | 2026-09-04 | 2026-09-04 | Inclus C1 |
| **C1** | **Fondations de l'entité Trip (Schéma, RLS, Services, Cockpit)** | ✅ **Validé** | `feat/c1-trips-core` | 2026-09-04 | 2026-09-04 | `9e9caed` |
| **C2** | **Wizard de création & moteur de répartition (5 étapes, déterministe)** | ✅ **Validé** | `feat/c2-trip-wizard` | 2026-09-05 | 2026-09-05 | `4a78964` |
| **C3** | **Planificateur d'itinéraire (Édition jour/jour, réordonnancement, dual-view)** | ✅ **Validé** | `feat/c3-itinerary-planner` | 2026-09-05 | 2026-09-05 | `f8ce1c6` |
| **C4** | **Lieux communautaires (Places, topos, avis, scoring, floutage éthique)** | ✅ **Validé** | `feat/c4-community-places` | 2026-09-05 | 2026-09-05 | En cours de commit |
| C5 | Affiliation Travelpayouts (Vols, hôtels, activités, disclosure légal) | ⬜ À venir | `feat/c5-affiliation` | - | - | - |
| C6 | IA & Kit contextuel (Boutique LKDV, équipement, marge pleine) | ⬜ À venir | `feat/c6-ai-kit` | - | - | - |
| C7 | Collaboratif, partage, offline, papiers, budget | ⬜ À venir | `feat/c7-collab-offline` | - | - | - |
| C8 | Rétrospective & Publication Communautaire (Carnet, Retour d'Expérience) | ⬜ À venir | `feat/c8-trip-completion` | - | - | - |
| RF | Recette Finale & Pré-lancement | ⬜ À venir | `release/voyage-v1` | - | - | - |

---

## 2. Chantier 1 — Suivi des Sous-Étapes

| Étape | Statut | Fichiers touchés | Preuve / Commande | Date |
| :--- | :---: | :--- | :--- | :---: |
| **1.0 Reconnaissance & Baseline** | | | | |
| 1.0.1 Vérifier PK auth.users | ✅ Fait | `supabase/migrations/*` | UUID confirmé dans les migrations actives et auth Supabase | 2026-09-04 |
| 1.0.2 Vérifier nom réel table groupes | ✅ Fait | `docs/reports/AUDIT_SUPPORT_ET_SCHEMA_GROUPE.md`, `20260716000000_group_system_complete.sql` | Table active = `public.travel_groups` (FK `group_id` adaptée) | 2026-09-04 |
| 1.0.3 Relever numéro dernière migration | ✅ Fait | `supabase/migrations/20260904040000_country_content_blocks.sql` | Dernière = `20260904040000`. C1 utilisera `20260904050000` | 2026-09-04 |
| 1.0.4 Baseline technique | ✅ Fait | Terminal | `tsc` : 0 err (code 0)<br>`lint` : 0 err, warnings préexistants (code 0)<br>`build` : Next.js 15.5.18 succès (code 0) | 2026-09-04 |
| 1.0.5 Créer fichier de suivi | ✅ Fait | `docs/PROGRESS_VOYAGE.md` | Fichier initialisé avec formats et sections imposés | 2026-09-04 |
| 1.0.6 Baseline visuelle | ✅ Fait | `scripts/baseline_screenshots.mjs`, `tests/visual/baseline/*` | Screenshots 1440px & 430px capturés pour `/` et `/materiel` | 2026-09-04 |
| 1.0.7 Créer branche git | ✅ Fait | Git | `git checkout -b feat/c1-trips-core` (exécuté avec succès) | 2026-09-04 |
| **1.1 Migration Supabase** | ✅ Fait | `supabase/migrations/20260904050000_trips_core.sql` | `apply_migration` exécuté avec succès sur `icxyvwzfjbflcbqukpfz`. Preuve SQL : 9 tables créées, 100% `rls_enabled = true`, 4 policies chacune. Fonctions anti-récursion `can_read_trip` et `can_edit_trip` créées. RGPD document policy active. | 2026-09-04 |
| **1.2 Types TypeScript & Schémas Zod** | ✅ Fait | `src/features/trips/types/trip.types.ts`, `schemas/trip.schema.ts`, `index.ts`, `tests/trips/trip-schemas.spec.ts` | Types canoniques complets, schémas Zod 4 avec validation dates et devises, `computeTripPermissions`. 20 tests Vitest réussis (100%), `npx tsc --noEmit` code 0. | 2026-09-04 |
| **1.3 Service Layer (Server-Only)** | ✅ Fait | `src/lib/queries-trips.ts`, `tests/trips/queries-trips.spec.ts` | 8 fonctions serveur (`getPublicTrips`, `getUserTrips`, `getTripBySlug`, `getTripById`, `createTrip`, `updateTrip`, `deleteTrip`, `getTripStats`). RGPD document gating validé, 7 tests Vitest réussis (100%), `npx tsc --noEmit` code 0. | 2026-09-04 |
| **1.4 Routes & Pages** | ✅ Fait | `src/app/voyages/*`, `src/app/api/voyages/*` | Routes `/voyages` (liste, recherche, filtres) et `/voyages/[slug]` (cockpit lecture seule avec 8 onglets). Route API GET/POST `/api/voyages`. Server Action `createTripAction`. Métadonnées SEO et schémas JSON-LD Schema.org. Build Next.js validé (`npm run build` exit 0). | 2026-09-04 |
| **1.5 Composants UI Dédiés** | ✅ Fait | `src/features/trips/components/*` | Composants créés : `TripBadge`, `TripCard`, `TripHero`, `TripOverviewTab`, `TripPlaceholderTab`, `TripFiltersBar`, `QuickCreateTripModal`. Palette Liquid Glass (Forest, Sage, Stone, zéro orange `#E4501C`), primitives `GlassCard`, `LkvButton`, `LkvChip`, `AppShell`. 9 tests unitaires dédiés verts. | 2026-09-04 |
| **1.6 Suite de Tests & Validation** | ✅ Fait | `tests/trips/*`, `npm run test`, `npm run build` | 47 tests unitaires/intégration trips (100% verts sur 4 fichiers). 402/402 tests globaux Vitest réussis (60 suites). Invariants CI vérifiés (`npm run verify:invariants`). Audit RLS automatisé. 0 erreur TypeScript, 0 erreur ESLint, build production Next.js exit 0. | 2026-09-04 |

---

## 2.bis Chantier 2 — Suivi des Sous-Étapes (Wizard & Moteur de Répartition)

| Étape | Statut | Fichiers touchés | Preuve / Commande | Date |
| :--- | :---: | :--- | :--- | :---: |
| **2.0 Reconnaissance & Baseline** | | | | |
| 2.0.1 Inventaire Skills & Agents | ✅ Fait | `.claude/skills/*`, `.claude/agents/*` | 12 skills & 7 pods chargés et confirmés | 2026-09-05 |
| 2.0.2 Constat des données réelles | ✅ Fait | Terminal / SQL | 1 169 routes et 1 811 POIs (100% Hauts-de-France, 0 en Islande/Népal/Pérou/Maroc). Nécessité d'un catalogue curé réel. | 2026-09-05 |
| 2.0.3 Baseline technique C2 | ✅ Fait | Terminal | `tsc` : 0 err (code 0) ; `lint` : 0 err (code 0) ; tests trips : 47/47 verts ; build : code 0 | 2026-09-05 |
| 2.0.4 Créer branche git | ✅ Fait | Git | `git checkout -b feat/c2-trip-wizard` (exécuté avec succès) | 2026-09-05 |
| **2.1 Moteur Déterministe (TDD)** | ✅ Fait | `src/features/trips/engine/*`, `tests/trips/engine/*` | 7 modules purs créés (`allocateDays`, `travelTime`, `paceRules`, `seasonality`, `selectCandidates`, `buildItinerary`, `antiLlm`). ZÉRO appel LLM garanti par test AST ripgrep. 27 tests unitaires verts. | 2026-09-05 |
| **2.2 Table & Seed Destinations** | ✅ Fait | `supabase/migrations/20260905090000_destination_steps.sql`, `src/features/trips/data/destinationsSeed.ts`, `scripts/seed-destinations.ts` | Table `public.destination_steps` créée avec RLS et policy publique. 33 étapes réelles curées pour FR (7), NP (8), PE (6), IS (6), MA (6) + matériel. Script idempotent exécuté avec succès (exit 0). | 2026-09-05 |
| **2.3 Wizard `/voyages/nouveau`** | ✅ Fait | `src/app/voyages/nouveau/page.tsx`, `src/features/trips/wizard/*` | Wizard 5 étapes synchronisé URL `?step=X` et `localStorage` (`lkdv:trip-draft`). Étape 1 : Destinations réordonnables. Étape 2 : Dates avec avertissement météo/saisonnalité live. Étape 3 : Style & Rythme. Étape 4 : Voyageurs & Groupe. Étape 5 : Aperçu complet. Dual-view responsive (Desktop Tailwind / Mobile `AppShell` avec touch targets $\ge 44\text{px}$). | 2026-09-05 |
| **2.4 Server Actions & Transactionnel** | ✅ Fait | `src/app/voyages/actions.ts`, `src/features/trips/schemas/trip.schema.ts` | Server Actions : `saveDraftTripAction` (sauvegarde dès étape 3), `generateAndPersistItinerary` (transactionnel, insertion `trip_steps` et `trip_items` template, statut planned), `regenerateItineraryAction` (préserve `source='user'`). Schémas Zod validés. | 2026-09-05 |
| **2.5 Intégration & Redirections** | ✅ Fait | `src/app/voyages/[slug]/TripDetailClient.tsx`, `src/features/trips/components/TripItineraryTab.tsx`, `next.config.mjs`, `src/app/preparation/page.tsx` | Onglet Itinéraire enrichi avec `TripItineraryTab`, bandeau saisonnalité live et modal de régénération. Redirection 308 permanente `/voyage-ia` -> `/voyages/nouveau`. Suppression de `src/app/voyage-ia/`. Lien d'accès créé dans `/preparation`. | 2026-09-05 |
| **2.6 Validation Globale & CI** | ✅ Fait | `npm run test`, `npm run build`, `npm run lint`, `npm run verify:invariants` | 81/81 tests trips verts (100%), 436/436 tests repo verts (66 suites), `tsc --noEmit` 0 erreur, `eslint` 0 erreur, build Next.js 15.5.18 exit 0, invariants CI validés. | 2026-09-05 |

---

## 2.ter Chantier 3 — Suivi des Sous-Étapes (Planificateur d'Itinéraire)

| Étape | Statut | Fichiers touchés | Preuve / Commande | Date |
| :--- | :---: | :--- | :--- | :--- |
| **3.0 Reconnaissance & Baseline** | | | | |
| 3.0.1 Baseline technique C3 | ✅ Fait | Terminal | `tsc` : 0 err (code 0) ; `lint` : 0 err (code 0) ; tests trips : 81/81 verts ; build : code 0 | 2026-09-05 |
| 3.0.2 Créer branche git | ✅ Fait | Git | `git checkout -b feat/c3-itinerary-planner` (exécuté avec succès) | 2026-09-05 |
| **3.1 Moteur d'Itinéraire & Métriques (TDD)** | ✅ Fait | `src/features/trips/planner/plannerEngine.ts`, `tests/trips/planner/plannerEngine.spec.ts` | Calculs déterministes (distance Haversine/explicite, D+, D-, durée Naismith/transport), renumérotation `order_index` continue, décalages `day_number`. 13 tests verts. | 2026-09-05 |
| **3.2 Server Actions Transactionnelles** | ✅ Fait | `src/app/voyages/actions.ts`, `src/features/trips/planner/planner.schema.ts`, `tests/trips/planner/plannerActions.spec.ts` | 8 mutations sécurisées par `can_edit_trip` (ajout, mise à jour, suppression retassée, réordonnancement 2-phases anti-collision `order_index`, déplacement inter-jours, insertion/suppression/duplication de jour). 8 tests verts. | 2026-09-05 |
| **3.3 Route `/voyages/[slug]/itineraire`** | ✅ Fait | `src/app/voyages/[slug]/itineraire/page.tsx`, `loading.tsx` | Route serveur Next.js avec SEO dynamique, fetch ordonné par `day_number, order_index`, skeleton de chargement et intégration `AppShell`. | 2026-09-05 |
| **3.4 Composants UI Dual-View (Apple HIG)** | ✅ Fait | `src/features/trips/planner/*`, `src/features/trips/components/TripItineraryTab.tsx` | `DayNavigator` tactile sticky avec auto-centrage, `DayView` avec métriques en temps réel, `StepCard` avec boutons monter/descendre/déplacer/éditer/supprimer (cibles $\ge 44\text{px}$), `StepEditModal`, `MoveStepModal`. Lien d'accès depuis le cockpit. 5 tests unitaires verts. | 2026-09-05 |
| **3.5 Tests & Validation Complète** | ✅ Fait | `tests/trips/planner/*`, `npm run test`, `npm run build` | 26/26 tests planner verts, 107/107 tests trips verts (13 suites), 462/462 tests repo verts (69 suites), `tsc --noEmit` 0 erreur, `eslint` 0 erreur (0 warning), build Next.js 15.5.18 validé, invariants CI validés. | 2026-09-05 |

---

## 2.quater Chantier 4 — Suivi des Sous-Étapes (Lieux Communautaires & Floutage Éthique)

| Étape | Statut | Fichiers touchés | Preuve / Commande | Date |
| :--- | :---: | :--- | :--- | :--- |
| **4.0 Reconnaissance & Baseline** | | | | |
| 4.0.1 Baseline technique C4 | ✅ Fait | Terminal | `tsc` : 0 err (code 0) ; `lint` : 0 err (code 0) ; tests : 462/462 verts ; build : code 0 | 2026-09-05 |
| 4.0.2 Créer branche git | ✅ Fait | Git | `git checkout -b feat/c4-community-places` | 2026-09-05 |
| **4.1 Migration Supabase & RLS** | ✅ Fait | `supabase/migrations/20260905110000_community_places.sql` | 4 tables créées (`places`, `place_reviews`, `place_photos`, `place_reports`). 100% `rowsecurity = true` vérifié via Supabase MCP `execute_sql`. Triggers PostGIS `sync_place_geom` et recalcul bayésien `recalculate_place_rating` actifs. | 2026-09-05 |
| **4.2 Types, Schémas & Moteur de Scoring (TDD)** | ✅ Fait | `src/features/places/types/place.types.ts`, `schemas/place.schema.ts`, `engine/placeScoring.ts`, `tests/places/scoring.spec.ts` | Calcul bayésien (C=3, m=3.5) et pondération x2 pour preuve terrain (`has_field_proof`). ZÉRO terme monétaire. Floutage serveur ~500m (2 décimales) pour sensibilité `sensitive` et ~5000m pour `protected`. 13 tests verts. | 2026-09-05 |
| **4.3 Données Réelles & Seed Idempotent** | ✅ Fait | `src/features/places/data/placesSeed.ts`, `scripts/seed-places.ts` | 42 lieux réels qualifiés (FR: 10, NP: 8, PE: 8, IS: 8, MA: 8). Seuil cold-start (40) dépassé. Script idempotent vérifié par double exécution (exit code 0). | 2026-09-05 |
| **4.4 Couche Service & Server Actions** | ✅ Fait | `src/lib/queries-places.ts`, `src/app/lieux/actions.ts`, `tests/places/queries-places.spec.ts`, `tests/places/placesActions.spec.ts` | `getPlaces`, `getPlaceBySlug`, `getPlaceById`, `createPlace`, `getUserTripsForPicker`. Actions serveur transactionnelles : `addPlaceReviewAction`, `reportPlaceAction`, `addPlaceToTripAction`. 10 tests unitaires verts. | 2026-09-05 |
| **4.5 Interface Utilisateur & Pages Apple HIG** | ✅ Fait | `src/features/places/components/*`, `src/app/lieux/page.tsx`, `loading.tsx`, `[slug]/page.tsx`, `tests/places/placeComponents.spec.ts` | Composants : `PlaceCard`, `PlacesExplorerClient`, `PlaceDetailClient`, `PlaceReviewSection`, `AddPlaceToTripModal`, `ReportPlaceModal`. Routes `/lieux` et `/lieux/[slug]` avec SEO Schema.org `Campground`/`TouristAttraction`. 6 tests verts. | 2026-09-05 |
| **4.6 Validation Globale & CI** | ✅ Fait | `npm run test`, `npm run build`, `npm run lint`, `npm run verify:invariants` | 29/29 tests places verts, 107/107 trips verts, 489/489 tests repo verts (73 suites), `tsc --noEmit` 0 erreur, `eslint` 0 erreur (0 warning), build Next.js 15.5.18 exit 0, invariants CI validés. | 2026-09-05 |

---

## 3. Journal des Décisions d'Architecture

| Date | Décision | Justification | Impact sur les chantiers suivants |
| :--- | :--- | :--- | :--- |
| 2026-09-04 | Utilisation de `public.travel_groups(id)` pour la FK `trips.group_id` | Audit approfondi de la base : `travel_groups` est la seule table de groupes active et alimentée (la table `groupes` étant un reliquat legacy vide). | Les chantiers C2 et C3 lieront directement les voyages aux groupes réels de la plateforme sans discordance de schéma. |
| 2026-09-04 | Pas de dépendance `date-fns` ; formateurs natifs `Intl.DateTimeFormat` | `package.json` n'inclut pas `date-fns`. `Intl` est natif, sans impact bundle, et couvre 100% des besoins de formatage FR/locale. | Cohérence et légèreté du First Load JS. |
| 2026-09-04 | Adoption exclusive d'`AppShell` (`@/components/shell`) pour `/voyages` | Règle ESLint stricte du projet interdisant les nouveaux imports de `MobilePageShell`. | Assure une gestion canonique du safe-area CSS (`--safe-top`, `--safe-bottom`). |
| 2026-09-04 | Fonctions RLS `security definer stable` pour casser la récursion | Empêche la récursion infinie entre `trips` et `trip_collaborators`. | Robustesse et performances d'accès sur toutes les tables filles (C1 à C8). |
| 2026-09-04 | `affiliate_link_id` sans foreign key sur `trip_items` au C1 | La table d'affiliation cible est programmée pour le Chantier 5. | Champ présent dès le schéma C1 pour ne pas bloquer les futures migrations C5. |
| 2026-09-04 | Onglets C2-C8 avec composant `TripPlaceholderTab` affichant les données réelles | Permet de rendre dès le C1 les éléments existants (étapes, matériel, participants, dépenses, etc.) en lecture seule sans modifier le scope des chantiers suivants. | Expérience utilisateur cockpit complète et prête à être enrichie aux chantiers C2 à C8. |
| 2026-09-05 | **ZÉRO appel LLM dans le Moteur de Répartition (C2)** | Fiabilité 100%, déterminisme bit-pour-bit, temps de réponse < 50ms, zéro coût API et zéro hallucination géographique. | Les étapes sont toujours réelles et vérifiables. L'IA sera réservée au Copilote C7 pour le conseil conversationnel sans toucher aux données socles. |
| 2026-09-05 | **Table catalogue `destination_steps` avec RLS publique** | Séparation claire entre le catalogue de référence (étapes curées, topo-guides) et les étapes instanciées d'un voyage (`trip_steps`). | Évolutivité : de nouveaux pays peuvent être ajoutés par simple INSERT sans altérer le code du moteur. |
| 2026-09-05 | **Colonne `source` sur `trip_items` ('template' vs 'user')** | Permet à l'utilisateur de régénérer son itinéraire ou modifier ses dates sans jamais perdre les articles de matériel ajoutés manuellement. | Préservation intégrale des données utilisateur lors des réitérations du planificateur. |
| 2026-09-05 | **Insertion France (`FR`) dans `countries_geo`** | `countries_geo` contenait 195 pays mais la France y était omise, bloquant la FK de `destination_steps`. Insertion propre avec géométrie et codes ISO officiels. | Cohérence territoriale totale pour les treks alpins et nationaux. |
| 2026-09-05 | **Réordonnancement en 2 phases anti-collision (C3)** | Pour respecter la contrainte `UNIQUE(trip_id, day_number, order_index)` sans violer l'intégrité SQL lors des swaps d'indices, les `order_index` sont d'abord basculés en négatif (`-1000 - i`) avant d'être réassignés en continu `0, 1, 2...`. | Zéro erreur de contrainte unique, atomicité garantie sur toutes les bases Supabase. |
| 2026-09-05 | **Décalages directionnels pour les jours (C3)** | Lors de l'insertion d'un jour, les étapes sont décalées en ordre décroissant de `day_number` ; lors de la suppression, en ordre croissant. | Élimine tout risque de collision sur `(trip_id, day_number, order_index)` lors des mutations de journées. |
| 2026-09-05 | **Floutage éthique serveur des coordonnées (~500m / 2 décimales) pour lieux sensibles (C4)** | Prévention active de la surfréquentation des spots fragiles (bivouacs non aménagés, sources d'eau en zone aride) et sécurité physique des randonneurs (ROADMAP §5.7). | Coordonnées protégées côté serveur avant restitution au client, préservant la biodiversité et l'éthique outdoor. |
| 2026-09-05 | **Scoring bayésien avec preuve terrain doublée (C4)** | Moyenne bayésienne pondérée ($C=3, m=3.5$) et coefficient x2 pour les avis certifiés avec `has_field_proof = true`. ZÉRO terme monétaire ou sponsorisé (Invariant CI 2). | Indépendance totale des notes communautaires face à tout intérêt commercial ou publicitaire. |
| 2026-09-05 | **Seuil cold-start de 42 lieux réels qualifiés (C4)** | Injection de 42 lieux réels (refuges alpins, bivouacs réglementés, cols, sources) répartis équitablement sur les 5 pays socles (FR: 10, NP: 8, PE: 8, IS: 8, MA: 8). | Catalogue immédiatement opérationnel pour l'exploration, l'ajout au voyage et l'affiliation (C5). |

---

## 4. Invariants de Sécurité & Conformité

| Règle / Invariant | Mécanisme de Contrôle | Statut | Preuve |
| :--- | :--- | :--- :---: | :--- |
| **RLS activée sur 100% des tables** (`trips` + 8 tables filles) | Migration SQL `alter table ... enable row level security;` + pg_policy check | ✅ Conforme | Vérifié via Supabase MCP `apply_migration` sur `icxyvwzfjbflcbqukpfz` : 9 tables avec RLS activée, 4 policies distinctes par table. |
| **Anti-récursion RLS** (`can_read_trip`, `can_edit_trip`) | Fonctions `security definer stable` avec `search_path = public` | ✅ Conforme | Testé dans `tests/trips/rls-isolation.spec.ts` (6 assertions RLS concluantes, zéro récursion). |
| **Protection RGPD Documents** (`trip_documents` SELECT réservé à `can_edit_trip`) | Policy restrictive : inaccessible aux simples `viewer` et visiteurs anonymes | ✅ Conforme | Testé dans `tests/trips/rls-isolation.spec.ts` (test RLS-06 garantit que `viewerCanReadDocs = false`). |
| **Conformité Palette Liquid Glass** (Zéro orange `#E4501C`, Zéro `#1C2620`, Forest `#17402C`, Sage `#5B7F55`, Stone `#FAF8F5`) | Script `scripts/verify/ci_invariants.mjs` + ripgrep complet | ✅ Conforme | `npm run verify:invariants` valide l'absence de tokens parallèles ; grep pour `#E4501C` dans `src/features/trips` et `src/app/voyages` = 0 résultat. |
| **Pas de composants custom réinventés** | Utilisation stricte de `GlassCard`, `LkvButton`, `LkvChip`, `LkvIcon` | ✅ Conforme | 100% des composants de `src/features/trips/components` et `src/features/trips/planner` consomment les primitives canoniques du Design System LKDV. |
| **Navigation Mobile Canonique** | `AppShell` avec safe-areas (`safeTop={true}`, `hasBottomNav={true}`) et touch-targets $\ge 44\text{px}$ | ✅ Conforme | Utilisé sur `/voyages`, `/voyages/[slug]`, `/voyages/[slug]/itineraire`, `loading.tsx` et `not-found.tsx`. |
| **Zero ESLint errors & zero TS errors** | `npx tsc --noEmit` & `npm run lint` | ✅ Conforme | `tsc --noEmit` exit 0 (0 erreur) ; `eslint src/features/trips src/app/voyages src/app/api/voyages src/lib/queries-trips.ts` exit 0 (0 erreur, 0 warning). |
| **Build de Production Next.js** | `npm run build` | ✅ Conforme | Next.js 15.5.18 compile et génère toutes les routes statiques et dynamiques (`/voyages`, `/voyages/[slug]`, `/voyages/[slug]/itineraire`, `/api/voyages`) sans erreur. |
| **Supabase Project ID officiel** | `icxyvwzfjbflcbqukpfz` (eu-west-3, jamais `lwrmuggefbmboikjgudc`) | ✅ Conforme | Configuration vérifiée dans `.env` et Supabase MCP. |
| **ZÉRO Appel LLM dans le Moteur C2 & C3** | Test AST ripgrep (`tests/trips/engine/antiLlm.spec.ts`) bannissant tout appel AI | ✅ Conforme | 0 import de `getChatCompletion`, 0 appel OpenRouter / OpenAI. Moteur 100% déterministe. |
| **Idempotence du Seed Destinations** | Script `scripts/seed-destinations.ts` avec contrainte unique `natural_key` | ✅ Conforme | Exécution double vérifiée : 33 lignes synchronisées sur les 5 pays sans doublon ni régression. |
| **Préservation Matériel Utilisateur** | Nettoyage sélectif `trip_items` (`source != 'user'`) lors de la régénération | ✅ Conforme | Testé dans `tests/trips/wizard.spec.ts` : les ajouts manuels du voyageur ne sont jamais écrasés. |
| **Ergonomie Mobile Apple HIG** | Cibles tactiles $\ge 44\text{px}$, sticky bottom bar, safe-areas via `AppShell` | ✅ Conforme | Conforme aux guidelines iOS et skills `apple-ui-designer` / `interaction-design`. |
| **Intégrité Ordonnancement C3** | Moteur déterministe `plannerEngine.ts` et tests TDD (compactage, réordonnancement, décalages) | ✅ Conforme | 26 tests unitaires et intégration verts dans `tests/trips/planner/`. |
| **RLS 100% sur Tables Lieux C4** | 4 tables (`places`, `place_reviews`, `place_photos`, `place_reports`) avec RLS activée | ✅ Conforme | Vérifié via Supabase MCP `execute_sql` : `rowsecurity = true` sur les 4 tables. |
| **Floutage Éthique Serveur C4** | Arrondi à 2 décimales (~500m) pour `sensitive` et 1 décimale (~5000m) pour `protected` | ✅ Conforme | Testé dans `tests/places/scoring.spec.ts` et `tests/places/queries-places.spec.ts`. |
| **ZÉRO Terme Monétaire Scoring C4** | Formule bayésienne pure, aucun biais publicitaire ou sponsorisé | ✅ Conforme | Test d'inspection et AST dans `tests/places/scoring.spec.ts` (Invariant CI 2 validé). |
| **Seuil Cold Start 40+ Lieux Réels C4** | 42 lieux réels qualifiés (FR, NP, PE, IS, MA) avec topos et contacts | ✅ Conforme | Synchronisé sur Supabase `icxyvwzfjbflcbqukpfz` via `scripts/seed-places.ts`. |


