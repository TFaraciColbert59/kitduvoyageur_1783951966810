# AUDIT.md — LKDV : état réel mesuré du dépôt

> **Dépôt :** `TFaraciColbert59/kitduvoyageur_1783951966810`
> **Commit audité :** `098a95e` (branche `main`, clone du 2026-09-26)
> **Méthode :** inspection du code cloné (literals `find`/`rg`/lecture), lecture des 3 projets Genspark antérieurs (audit 32 p., stratégie API, deep research), lecture des docs officielles RouteStack et Viator.
> **Règle de rédaction :** uniquement des faits observés dans les fichiers ; chaque chiffre est une mesure reproductible, pas une estimation.

---

## 1. Chiffres mesurés

| Mesure | Commande | Valeur |
|---|---|---|
| Routes de page (`page.tsx`) | `find src/app -name page.tsx` | **81** |
| Routes API (`route.ts`) | `find src/app/api -name route.ts` | **107** |
| Layouts | `find src/app -name layout.tsx` | **42** |
| Domaines métier (`src/features/*`) | `ls -d src/features/*/` | **20** |
| Composants (`src/components/**/*.tsx`) | `find src/components -name "*.tsx"` | **259** |
| Migrations SQL | `ls supabase/migrations/*.sql` | **241** |
| Tests | `find tests -name "*.spec.ts" -o -name "*.test.ts"` | **417** |
| Occurrences mock / placeholder / EXAMPLE_ | `rg -i "mock\|placeholder\|EXAMPLE_" src` | **437** |
| Références RouteStack dans `src/` | `rg -i routestack src` | **0** |
| Références Amadeus | `rg -i amadeus src supabase scripts` | **0** |

**Lecture :** l'application n'est pas un squelette — c'est une base mature (Next.js 15.5, React 19, TS strict, Supabase/PostGIS, 241 migrations, 417 tests). Le problème n'est **pas la quantité de fonctionnalités, mais leur dispersion** : 81 pages concurrentes là où la vision en demande 2, et 437 marqueurs de données non réelles à éliminer.

---

## 2. Stack réel constaté

| Couche | Réalité dans le repo |
|---|---|
| Front | Next.js `15.5.25` (App Router), React `19.0.3`, TypeScript, Tailwind 3.4 |
| BDD | Supabase (PostgreSQL + **PostGIS** activé — `supabase/migrations/20260811134022_enable_postgis.sql`) |
| Paiement | Stripe (`src/app/api/checkout/route.ts`, `src/app/api/stripe/webhook/route.ts`) |
| IA | OpenRouter (défaut) + providers legacy (`src/lib/ai/providers/{openrouter,noop}.ts`) |
| Carto | `leaflet` 1.9.4 **et** `maplibre-gl` 6.4.1 (+ `react-globe.gl`) |
| Mobile | Capacitor 8 (iOS/Android) |
| Ports | `dev` = 4000, `start` = 4028 |

---

## 3. Les 2 routes cibles : ce qui existe, ce qui manque

### 3.1 `/hub` — **existe et est déjà structuré** ✅

- `src/app/hub/page.tsx` = menu de cartes-onglets, avec surfaces de phase `?phase=live|recount` (`PhaseLiveView`, `PhaseRecountView`).
- Sous-route `src/app/hub/[section]/page.tsx` pilotée par un **registre** : `src/features/hub/registry/hubSectionRegistry.ts`.
- Domaine `src/features/hub/` complet : `menu`, `mobile` (13 sous-dossiers : itinerary, gear, team, budget, safety, journal, moments, checklist, docs…), `live`, `collectif`, `engine`, `services`, `stores`.

**Verdict :** le Hub est le socle le plus sain du dépôt. Il faut le **brancher**, pas le reconstruire.

### 3.2 `/prepare` — **n'existe pas, éclaté en 6 routes** ❌

| Route actuelle | Rôle actuel | Fichier |
|---|---|---|
| `/ai-configurator` | Configurateur de **sac** (IA + boutique) | `src/app/ai-configurator/page.tsx` → `KitConfiguratorWizard` |
| `/voyages/[slug]` | Configurateur de **voyage** (overview + phases) | `src/app/voyages/[slug]/page.tsx` |
| `/preparer-sentier/[id]` | Préparation depuis un **sentier** | `src/app/preparer-sentier/[id]/page.tsx` |
| `/preparer-randonnee` | **Redirection** héritée → `/hub` ou `/preparer-sentier/*` | `src/app/preparer-randonnee/page.tsx` |
| `/apercu-preparation` | Aperçu **dev-only** (`notFound()` en prod) | `src/app/apercu-preparation/page.tsx` |
| `/copilote` | Assistant/co-pilote | `src/app/copilote/page.tsx` |

**Verdict :** `/prepare` est à **créer par fusion** de ces 6 surfaces. Aucune ne couvre seule le parcours « activité → sac → carte → logistique ».

---

## 4. Les configurateurs : deux moteurs, jamais reliés

### 4.1 Configurateur de SAC (existant, solide)

- **Cœur pur, testable** : `src/lib/ai/configuratorCore.ts` (206 l.) → `analyzeKit(params): KitAnalysis`.
  Types réels : `OwnedGearItem`, `RealShopProduct`, `MissingShopItem`, `InadequateGearAlert`.
- **Orchestrateur** : `src/lib/ai/configuratorEngine.ts` (312 l.) → `fetchRealCatalog()` lit la table **`shop_products`** (colonnes réelles : `slug, name, brand, category, category_main, price_eur, weight_g, image, stock, rating`).
- **Feature IA** : `src/lib/ai/features/kitConfigurator.ts` (298 l.).
- **UI** : `src/app/ai-configurator/components/KitConfiguratorWizard.tsx`.

Le croisement **inventaire possédé ↔ catalogue boutique** existe déjà (`OwnedGearItem` vs `RealShopProduct`), avec score de préparation, poids, prix manquant, carbo. **C'est la brique à réutiliser telle quelle dans `/prepare`.**

### 4.2 Configurateur de VOYAGE (existant, riche, isolé)

- Wizard 5 étapes : `src/features/trips/wizard/{TripWizard,Step1Destinations,Step2Dates,Step3StylePace,Step4Travelers,Step5Preview}.tsx`.
- Pipeline auto-génération : `src/features/trips/engine/{tripBriefExtractor,autogenPreparation,autoGenPipeline}.ts`.
- Blueprints : `src/features/trips/blueprints/blueprintRegistry.ts` (16 blueprints cités dans HANDOFF).
- Schémas Zod : `src/features/trips/schemas/{autoGen,autogenTripCreate,trip}.schema.ts`.
- Seed de destinations : `src/features/trips/data/destinationsSeed.ts`.

### 4.3 Le problème

Les deux moteurs **ne se parlent pas** : le sac est indexé sur `shop_products`/`gear_items`, le voyage sur `trips`/`trip_stages`/`activities`. Rien ne propage « voici l'activité → voici les métriques → voici le sac → voici la logistique ». **C'est le trou central du produit.**

---

## 5. Moteur d'apprentissage : présent, sophistiqué, sous-exploité

`src/features/adventure-intelligence/` = **~45 modules de domaine + 20 fichiers serveur**, avec migrations dédiées :

| Brique | Fichier | Table SQL (migration) |
|---|---|---|
| Profil de performance appris (A3) | `server/buildUserProfile.ts`, `domain/performanceProfile.ts` | `user_performance_profiles` (`…a1_performance_profiles.sql`), snapshot versionné (`UNIQUE (profile_id, model_version)`) |
| Événements de domaine (A1) | `domain/events.ts` | `…a1_domain_events.sql` |
| Intelligence collective (A4) | `domain/collectiveIntelligence.ts` (436 l.) | agrégats par segment |
| Prédiction de durée | `domain/prediction.ts` (341 l.) | — |
| Backtesting / shadow mode | `domain/backtesting.ts`, `domain/shadowMode.ts`, `server/shadowRuns.ts` | `…a10_shadow_runs.sql` |
| Consentement (A10) | `server/consents.ts` | `…a10_consent_enforcement.sql` |
| Profil utilisateur agrégé | `server/buildUserProfile.ts` (`model_version = 'a3-v1'`, `PROFILE_BUILD_LIMIT = 500`) | `user_performance_profiles` |

**Constats durs :**
1. Le moteur **apprend par observations GPS** (`ProfileObservation`) et recalcule un profil (Naismith personnalisé : `flat_speed_kmh`, `ascent_speed_m_per_h`, `descent_speed_m_per_h`, `grade_response`, `surface_response`).
2. La publication collective exige **≥ 5 utilisateurs distincts** (`MIN_DISTINCT_USERS = 5`) et confiance ≥ 0.5 — donc **aucun apprentissage collectif n'est exploitable en base vide**.
3. **Aucune boucle de feedback fermée** trouvée : `rg -l "feedback"` ne remonte que des composants UI (haptique), jamais un cycle « résultat observé → correction du modèle → promotion de version ». `shadowMode`/`backtesting` existent mais rien ne les promeut automatiquement.
4. `/prepare` **n'appelle pas** ce moteur : l'IA de configuration et l'IA d'apprentissage sont deux univers.

---

## 6. Affiliations & APIs : état réel

### 6.1 Ce qui existe

| Brique | Fichier | État |
|---|---|---|
| Moteur d'affiliation (allowlist, anti-open-redirect, tracking) | `src/features/affiliation/engine/affiliateEngine.ts` | **Réel** — `ALLOWED_AFFILIATE_DOMAINS` en dur, `buildAffiliateUrl()` |
| Seed de liens réels | `src/features/affiliation/data/affiliateSeed.ts` | **Réel** — booking, aviasales, getyourguide, airalo, chapka |
| Proxy Travelpayouts | `src/app/api/affiliate/travelpayouts/route.ts` | **Réel** |
| Redirection sortante gardée | `src/app/go/[slug]/route.ts` | **Réel** |
| Tripadvisor (Terra + legacy) | variables `TRIPADVISOR_*` | Configuré côté env |
| **Viator** | `src/features/discovery/providers/viator/*` (7 fichiers) | **Client serveur réel** — `exp-api-key`, `version=2.0`, base `api.viator.com/partner` |

### 6.2 Viator : présent mais bridé

- `viatorClient.ts` est `server-only`, clé **jamais en URL** (en-tête `exp-api-key`), timeout 6 s, **sans retry**.
- `src/features/discovery/config.ts` : `DISCOVERY_PROVIDER` **défaut = `klook`**. Viator n'est sélectionné que si on force `DISCOVERY_PROVIDER=viator`.
- `.env.example` confirme : base prod `https://api.viator.com/partner`, plus des variables pour le **sandbox** (`api.sandbox.viator.com` documenté côté Viator), `VIATOR_DESTINATION_IDS` en JSON par pays, `VIATOR_LANGUAGE=fr`.
- **Manque :** la **bascule Sandbox↔Full/Booking** (une simple variable demandée par la mission), et le **tracking d'affiliation Viator** (params `pid`, `mcid`, `medium=api`, `campaign` — absents du code).

### 6.3 RouteStack : **absent du code** (chantier neuf)

- `rg -i routestack src` → **0 résultat**. Seules traces : projets Genspark antérieurs + mentions dans `CLAUDE.md`/`MISSION_LOG.md`.
- Doc officielle lue : c'est une **API de réservation** (hôtels, vols, voitures) exposée en MCP (`/mcp`) **et** en REST (`/mcp/hotel/*`, `/mcp/flight/*`, `/mcp/car/*`).
- **Auth production = HMAC → partner token** : `POST /mcp/auth/partner-token` avec `{ apiKey, hmac, timestamp, nonce }` (HMAC-SHA256 base64url de `apiKey:timestamp:nonce`), puis `Authorization: Bearer <jwt>` seul (jamais `x-api-key`/`x-member-token` par appel).
- **Flux hôtel** : `search-destinations` → `search-hotels` (retourne `result.correlationId` + `result.token` **à conserver**) → `get-hotel-details-and-rates` (ou `get-hotel-details` + `get-rooms-and-rates`) → `revalidate` → `get-payment-url`.
- **Flux vol** : `flight/session` → `flight/locations` → `flight/search` → `flight/revalidate` → `flight/get-payment-url`.
- **Flux voiture** : `car/locations` → `car/search` → `car/get-payment-url`.
- **Checkout** : réponse `{ checkoutMode: "deeplink", url }` **ou** `{ checkoutMode: "acp", session:{…} }`.
- **Tracking marchand** : `routestack_external_userid` + `routestack_metadata` à envoyer **uniquement** sur les `get-payment-url` — persistés sur la ligne `orders` RouteStack.
- **Quota** : seuls les `search-hotels`, `flight/search`, `car/search` sont facturés/limités ; `402` si épuisé.

**Tout est côté serveur — cohérent avec la contrainte « clés uniquement côté serveur ».**

### 6.4 Amadeus

`rg -i amadeus` → **0 occurrence**. La consigne « supprimer Amadeus Self-Service » est **déjà satisfaite** : rien à retirer, à documenter comme tel.

---

## 7. Mocks & dettes mesurées

| Constat | Preuve |
|---|---|
| 437 occurrences `mock`/`placeholder`/`EXAMPLE_` dans `src/` | `rg -i … src` |
| 2 fichiers de données fictives dédiés | `src/lib/mock/carnet-chartreuse.ts`, `src/lib/mock/compte-marceline.ts` |
| Pages de fixtures dev-only | `src/app/preparer-sentier/apercu/page.tsx`, `src/app/apercu-preparation/page.tsx`, `src/components/dev/glass/GlassLab.tsx` |
| Générateur de compteurs de fixture | `src/features/hub/components/live/preparationPhases.ts` → `fixtureCountsForPhase()` |
| Faux média en mémoire | `src/components/communaute/CommunityPostCard.tsx` → `const fakeUrl = URL.createObjectURL(...)` |
| « placeholder » majoritairement = `<input placeholder>` légitime | 19 occurrences dans `AdminProductsManager.tsx`, etc. |

**Nuance honnête :** le chiffre 437 est un majorant — il inclut des `placeholder` HTML légitimes et des états de chargement (skeleton). La dette **réelle** est concentrée : 2 fichiers `src/lib/mock/*`, 3 écrans dev-only, 1 générateur de fixtures Hub, 1 faux média. **Le chantier « zéro mock » est petit et traçable** ; l'affirmer demande un recensement ciblé, pas un grep brut.

---

## 8. Base de données : riche, à compléter

- **241 migrations**, RLS active, PostGIS activé, vues (`explore_trails`), buckets Storage.
- Tables existantes identifiées : `shop_products`, `gear_items`, `trips`, `trip_stages`, `trip_checklist_items`, `activities`, `hiking_routes`, `user_performance_profiles`, `domain_events`, `shadow_runs`, `saved_trails`, `clubs`, `carnets`…
- **Manque pour la vision :**
  1. **Catalogue d'activités exhaustif** (footing, rando journée, bivouac, road trip…) — point d'entrée du parcours.
  2. **Métriques par activité** (durée, D+, dénivelé, distance, technicité…) mappées automatiquement.
  3. **Réservations** (`bookings`) avec fournisseur, référence, montant, `trip_id`, `routestack_external_userid`.
  4. **Panier unifié** (produits boutique + réservations vols/hôtel/voiture/activités).
  5. **Boucle de feedback** (issue observée → proposition d'ajustement de modèle).

---

## 9. Cartographie route → cible (plan de nettoyage)

| Route actuelle | Cible | Action |
|---|---|---|
| `/ai-configurator` | `/prepare` | **Fusion** (sac) |
| `/voyages/[slug]` | `/hub` | **Redirection** (lecture seule via `?token=`) |
| `/preparer-sentier/[id]` | `/prepare` | **Redirection** |
| `/preparer-randonnee` | `/prepare` | Redirection (déjà redirigée → recible) |
| `/apercu-preparation` | — | **Supprimer** (dev-only) |
| `/preparer-sentier/apercu` | — | **Supprimer** (dev-only) |
| `/copilote` | `/prepare` | Redirection |
| `/randonnee-active` | `/hub?phase=live` | Redirection |
| `/carte-interactive` | `/prepare` (carte) | Redirection |
| `/communaute-pro` | `/communaute/pro` | Redirection (doublon) |
| `/hub/[section]` | `/hub/[section]` | **Conserver** |
| `/go/[slug]` | `/go/[slug]` | **Conserver** (redirection affiliée) |
| `/k/[token]` | `/k/[token]` | **Conserver** (partage) |

**Fondation favorable :** `next.config.mjs` possède déjà un bloc `redirects()` (l. 92) et le motif **registre** est déjà utilisé 4 fois (`hubSectionRegistry`, `paysSectionRegistry`, `engineRegistry`, `blueprintRegistry`). Le nettoyage est donc un travail de **routage**, pas de réécriture.

---

## 10. Bloquants vérifiés

1. **Aucune clé RouteStack** dans l'environnement (API key + partner secret pour HMAC).
2. **Viator non basculé** : `DISCOVERY_PROVIDER=klook` par défaut, aucune variable Sandbox↔Full.
3. **Pas de secrets IRL** : `.env.example` est vide côté valeurs → tout test bout-en-bout nécessite les vraies clés (Supabase, OpenRouter, Stripe, Viator, RouteStack).
4. **`node_modules` absent** au clone → un `npm install` + build complet est nécessaire pour un « build vert » constaté (lancé pendant cet audit, voir `FINAL_REPORT.md`).
5. **Apprentissage collectif** : seuil ≥ 5 utilisateurs → nécessite un jeu d'observations réalistes pour être démontré.

---

## 11. Ce qui est déjà « vert » (à ne pas casser)

- Base Next.js mature : 417 tests, TS strict, CI 4 portes.
- Hub + registres + phases live/recount.
- Cœur de configuration de sac pur et testable (`analyzeKit`).
- Moteur d'intelligence terrain versionné et idempotent.
- Garde-fous d'affiliation (allowlist + anti-open-redirect).
- Client Viator serveur déjà conforme « clé jamais côté client ».

---

## 12. Conclusion de faisabilité

**Le chantier est faisable, et les 4 scénarios sont atteignables — parce que les briques existent déjà séparément.** La difficulté n'est pas la création, c'est la **couture** : un seul `/prepare` qui chaîne `activité → métriques → sac → carte → logistique → panier`, branché sur le moteur apprenant, poussé jusqu'au `/hub`.

Risques à découvert : (a) dépendance aux clés RouteStack/Viator pour un bout-en-bout réel, (b) volume du nettoyage de routes (81 pages), (c) garantie « build vert » qui exige l'installation complète des dépendances.

Détail des choix, de l'architecture et des phases : **`PLAN.md`** et **`DECISIONS.md`**.
