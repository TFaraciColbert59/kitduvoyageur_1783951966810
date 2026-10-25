# Itinéraire, kits & préparation personnalisée — Design

- **Date** : 2026-09-12
- **Statut** : validé (carte blanche propriétaire, design présenté et approuvé)
- **Branche cible** : `chantier/itineraire-kits-personnalisation`
- **Portée** : chantier unique séquentiel — correctifs bloquants + refonte itinéraire + kits par catalogue produit + générateurs (documents, sécurité, carnet, dépenses) + préparation multi-personnes personnalisée par le système d'auto-apprentissage.

## 1. Correctifs bloquants (cause racine prouvée)

### 1.1 Activité créée en double
**Cause** : `createTripFromAutogenIntent.ts` insère le voyage A (l.644) puis `revalidatePath('/voyages')` (l.875-876) jette **pendant le render** (appelé depuis `src/app/preparer-sentier/[id]/page.tsx:35`) → catch général (l.890-896) renvoie 500 **sans compensation** ; `prepareActivityFromTrail.ts:620-657` déclenche son fallback `createTrip` → voyage B. A n'obtient pas `metadata.route_id` (polyline lue sur la colonne brute `hiking_routes.geom` l.555-562, non-GeoJSON) → l'index `uniq_trips_user_route` ne le protège pas.
**Correctif** :
1. Retirer les `revalidatePath` de l'usine ; la revalidation reste dans les Route Handlers (`activer/route.ts:68`).
2. Catch général : si le voyage existe → retour **partiel `{ ok: true, tripId, slug, title, warnings }`** (jamais de 500 créateur) + `store.markFailed` de la requête de génération.
3. Écrire `metadata.route_id` (numérique, normalisé) **dès la création du voyage**, avant plan/kit.
4. Lire la géométrie via RPC `get_route_geojson` (GeoJSON) partout où `polylineFromRouteGeom` consomme `geom` brut.
5. Test de régression : un clic « Préparer » ⇒ **une seule** activité (aucun orphelin, `generation_requests` non pendante).

### 1.2 Rail bloqué → barre seule
`ActivityPreparationStatus.tsx` : ne garder que le wrapper + la barre (`transform: scaleX(completed/6)` l.246-252) ; supprimer en-tête n/6 (l.205-213), liste des phases (l.215-244), annonce (l.254-261) et bloc « Améliorer » (l.263-295). Échec = barre masquée (aucun texte).

### 1.3 Sidebar « Déroulé du jour » répétée
`StepsTimeline.tsx` : supprimer la boucle de copies (l.79 `copies`, l.118 `Array.from`) — scroll simple, **jours/étapes réels uniquement**, carte « Point de départ » rendue une fois.

### 1.4 Warning React key
Le warning ne provient pas de `AppShellDesktop`/`HubLayout` (aucun `.map`). Reproduire avec le message React complet (capture console) pour cibler le descendant, puis corriger la `key` manquante.

## 2. Itinéraire & hub

### 2.1 Carte du jour sélectionné
- Charger le polyline réel côté serveur dans la branche `itinerary` (`trip.metadata.route_id` → RPC `get_route_geojson` → `samplePolyline`, 120 pts).
- Découper par jour : fractions `startPointForDay` (`deterministicActivityContent.ts:103-113`) ; repli « nearest vertex » pour jours enrichis sans lat/lng.
- Afficher **entre le sélecteur de jour et l'itinéraire du jour** : mobile `ItineraryMobileExperience.tsx` (entre l.714 et l.717, la carte actuelle l.641-652 est retirée/remplacée) ; desktop `ItineraryPlannerClient.tsx` (sous `DayNavigator` l.416, avant `<main>` l.428). Composant `HubRouteMap` (Leaflet) — tracé du jour seul + points d'étapes.

### 2.2 Esthétique
Harmonisation glass/tokens, métriques `glass-sub-card`, en-têtes aérés (mobile + desktop) sans casser les tests visuels existants.

### 2.3 Renommage d'activité
Server action `renameTrip` (pattern `setTripKit.ts:16-69`, `updateTripSchema` titre 3-120), UI : bouton crayon → `GlassModal` + `LkvInput` sur hero mobile (`ItineraryHero.tsx:36`) et en-tête desktop ; `revalidatePath('/hub')`.

### 2.4 Retraits / déplacement (confirmés)
- Retirer `NaturePill`/`NatureSwitcherSheet` sur `/hub/itineraire` (`HubShell.tsx:287-298`).
- Retirer `TripAffiliateSection` du hub (`SortieMenu.tsx:849-857`, `SortieMoment.tsx:251-257`) et `TripSuggestionSection` de l'itinéraire (`ItineraryPlannerClient.tsx:419-425`, `ItineraryMobileExperience.tsx:633-639`).
- **Déplacer** « Cockpit aventure » (`AdventureHubSection.tsx`) dans l'itinéraire (statut, ≤3 indicateurs, décisions requises, liens rapides, offline) via `getAdventureIntelligence`. Le bouton « Cockpit » reste.

## 3. Kits par catalogue produit (CSV 80 produits)

- **Import** : script d'import (upsert par SKU normalisé) de `Produits - Kit du Voyageur – 80 Produits B.csv` → `shop_products` : nom, marque, catégorie/sous-catégorie (corriger « Randonée Famille » l.36/l.77), priorité (Indispensable/Recommandé/Optionnel), poids réels (parsing g/kg/g/unité/g/paire, repli moyenne par catégorie pour les 8 non-numériques), prix de vente public, prix d'achat + marge **admin-only** (`cost_price_eur`, `supplier`, `ean` existent), images/lien BigBuy, dédup des 11 groupes SKU (fusion/fusion variantes).
- **Moteur `selectKitProducts(input)`** (pur, TDD) : activités, durée, saison, difficulté, D+, N personnes, profil → produits réels par catégorie/priorité avec quotas, poids cible borné ; `contextualKitEngine` branché sur ce catalogue (les slugs préférés l.113/139/151/441 matchent enfin).
- **Création rapide** : kit persisté en un batch (`materiel_kits` + `materiel_kit_items` avec `shop_product_id`, poids réels sommés), `trip_items` dérivés explicitement, fin de la double matérialisation dispersée ; mesurer avant/après (nombre d'aller-retours, durée).

## 4. Générateurs

- **Documents** : générer réellement la **feuille de route PDF + GPX** (exports existants) → storage → lignes `trip_documents` ; plus la liste des documents attendus (identité, assurance, visas…) avec échéances dans l'onglet Documents.
- **Sécurité** : persister `trip_safety_checkpoints` réels depuis `preTripSafetyRules.ts:38-149` + dates de l'activité (J-1, J1, points quotidiens, fin) — fin du « Aucun point de contrôle ».
- **Carnet** : pré-générer une `trip_notes` par jour/étape (« Jour N — <étape> », contexte réel + 2-3 questions à documenter) ; **édition complète sur place** : `updateTripNoteAction` + UI (mobile + desktop).
- **Dépenses** : généraliser `buildBudgetLines` → **N lignes catégorisées** (hébergement, nourriture, transport, activités, matériel, divers), chacune > 0 (`splitEvenly`), `is_planned: true`, batch ; recalculées au join.

## 5. Multi-personnes personnalisé (règle de données propriétaire)

**Règle** : n'utiliser QUE les données du **système d'auto-apprentissage** (Profil Terrain : `user_performance_profiles` — vitesses, `pack_response`, fatigue, pauses, `calibration_level`, `sample_count`) ; pour le reste, **approximer par dérivation**, et **moyennes de remplacement** quand rien n'existe ; chaque champ porte sa provenance `appris | estimé | moyenne` (jamais présenté comme appris sinon).

- **Join** : lien de partage → page « Rejoindre » → **consentement seul** (« utilisez mon profil auto-appris pour préparer à plusieurs ») → acceptation → snapshot. Pas de formulaire lourd.
- **Snapshot** : table additive `trip_member_profiles` (trip_id, user_id, consented_at, champs dérivés, `source` par champ, `calibration_level`, `party_version`) + RLS (own + propriétaire du voyage) ; lectures moteur en service-role consent-gated ; colonne additive `trips.party_size`.
- **Dérivation pure `deriveMemberInput`** (TDD) : appris (consentement `personal_performance`) → estimations dérivées (ex. charge max ≈ 20 % poids estimé) → moyennes (70 kg, 4 km/h, expérience intermédiaire). Champs : vitesses, poids porté, charge max, niveau, limitations, enfants.
- **Moteur complet** : `groupIntelligence.buildGroupPlan` **dé-neutralisé** (`groupTrek.ts:202-204` : `packWeightKg`, `maxCarryKg`, `experienceLevel` réels) → rythme par membre, membre limitant, pauses, risque de séparation, **redistribution de portage ≤ 5 kg** (l.92, 286-331), assignation du matériel partagé (`owner_id`), quantités (perso ×1 / consommables ×N), budget re-réparti, `party_size` persisté.
- **Recalcul à chaque join/leave** : route serveur synchrone idempotente (`party_version` incrémenté, rejeu sans doublons), `revalidatePath('/hub')` + realtime existant.
- **Transparence UI** : badges Appris/Estimé/Moyenne sur la fiche participant de l'activité + bandeau « Préparation recalculée pour N ».

**Hors périmètre (dette notée)** : alimentation de production du Profil Terrain (chantier futur), unification `gear_items`/`custom_kits` legacy, split budget `custom` avancé, suppression du bouton « Cockpit ».

## 6. Migrations (additives uniquement)
- `trip_member_profiles` (nouvelle table, RLS own+owner).
- `trips.party_size int null`.
- Aucune autre : `trip_steps/trip_pois.metadata` (déjà livrés), `shop_products` colonnes existantes.

## 7. Tests & gates
- Unitaires : fix doublon (regression), dérivation membre (sources labellisées), `selectKitProducts`, slicing du tracé par jour, générateurs (documents/sécurité/carnet/dépenses), recompute idempotent.
- e2e : clic Préparer ⇒ 1 activité ; carte du jour sur `/hub/itineraire` ; join → recalcul visible.
- Visuels : itinéraire + barre unique ; captures avant/après.
- Gates : `tsc` 0 · `lint` 0 · `vitest` (seuls les 4 échecs préexistants) · `build` 0 · e2e prod · visuel complet.
- WIP propriétaire jamais stagé (`src/app/hub/[section]/page.tsx`, `HubRealtimeRefresh.tsx`, captures atlas, v16).

## 8. Rollback
Revert du merge ; migrations additives réversibles (drop table/colonne) ; correctifs unitaires indépendants.
