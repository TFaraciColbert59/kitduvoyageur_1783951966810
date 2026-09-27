# PLAN.md — Architecture cible et plan d'action complet

> Suite de `AUDIT.md`. Dépôt `TFaraciColbert59/kitduvoyageur_1783951966810`, commit `098a95e`.
> Principe directeur : **2 routes** (`/prepare`, `/hub`), **1 configurateur**, **0 mock**, **tout en BDD**, **clés serveur uniquement**.

---

## 1. Architecture cible (vue d'ensemble)

```
                    ┌──────────────────────────────────────────────┐
   CARTE / ACCUEIL  │  /            (point d'entrée)                │
   « Activité      │   → « Activité libre »                        │
     libre »       │      ├─ catalogue exhaustif (table activities)│
                    │      └─ description libre → IA (NLU)          │
                    └───────────────┬──────────────────────────────┘
                                    │  crée / reprend un trip + intent
                    ┌───────────────▼──────────────────────────────┐
                    │  /prepare    — CONFIGURATEUR UNIQUE           │
                    │                                               │
                    │  ┌─────────┐  ┌─────────┐  ┌──────────────┐  │
                    │  │  SAC    │  │  CARTE  │  │  LOGISTIQUE  │  │
                    │  │ (IA +   │  │ (randos,│  │ (vols,       │  │
                    │  │ inven-  │  │ POI,    │  │ hôtels,      │  │
                    │  │ taire)  │  │ tracé)  │  │ voitures,    │  │
                    │  └────┬────┘  └────┬────┘  │ activités)   │  │
                    │       │            │        └──────┬───────┘  │
                    │       └──────┬─────┴───────────────┘          │
                    │              ▼                                │
                    │        PANIER UNIQUE ──► affiliation layer    │
                    └───────────────┬──────────────────────────────┘
                                    │  validation
                    ┌───────────────▼──────────────────────────────┐
                    │  /hub  — PILOTAGE (avant / pendant / après)   │
                    │  menu sections + ?phase=live | ?phase=recount │
                    └───────────────┬──────────────────────────────┘
                                    │  issue observée
                    ┌───────────────▼──────────────────────────────┐
                    │  MOTEUR APPRENANT (adventure-intelligence)    │
                    │  observations → profils A3 → collectif A4     │
                    │  → prédiction → backtesting → promotion       │
                    └──────────────────────────────────────────────┘
```

**Carte des couches techniques :**

| Couche | Décision |
|---|---|
| Rendu | Next.js App Router (inchangé) |
| Accès données | Supabase (server components + RPC), RLS partout |
| IA produit | `configuratorCore` (sac) + `adventure-intelligence` (apprentissage) — **reliés** |
| Réservation | **Interface commune** `BookingProvider` → adaptateurs RouteStack (vols/hôtels/voitures) + Viator (activités) + affiliations existantes |
| Panier | **1 seul** panier : lignes produit (`shop_products`) **et** lignes réservation (`bookings`) |
| Routage | Registre de routes unique + `redirects()` dans `next.config.mjs` |

---

## 2. Interface commune de réservation (le point névralgique)

Tout passe par un contrat unique, côté serveur :

```ts
// src/features/booking/types.ts
export type BookingVertical = 'flight' | 'hotel' | 'car' | 'activity';

export interface BookingProvider {
  readonly id: 'routestack' | 'viator' | 'affiliate';
  readonly verticals: BookingVertical[];
  search(input: BookingSearchInput): Promise<BookingOffer[]>;
  revalidate(offer: BookingOffer): Promise<BookingOffer>;
  checkoutUrl(offer: BookingOffer, ctx: BookingContext): Promise<CheckoutResult>;
}

export interface CheckoutResult {
  mode: 'deeplink' | 'acp' | 'external';
  url?: string;               // RouteStack deeplink OU viator.com (navigateur intégré)
  session?: unknown;          // cas ACP
  bookingId?: string;         // ligne bookings en base
}
```

- **RouteStack** → `flight`, `hotel`, `car` (adaptateur `src/features/booking/providers/routestack.ts`).
- **Viator** → `activity` : la réservation se fait **sur viator.com, ouverte dans le navigateur intégré** (`mode: 'external'`), avec les paramètres d'attribution.
- **Affiliation existante** → reste pour le reste (assurances, eSIM, location…).

Chaque `checkoutUrl` **enregistre une ligne `bookings`** liée au `trip_id`, puis alimente **le panier unique**.

---

## 3. Adaptateur RouteStack (conforme à la doc officielle)

Fichier cible : `src/features/booking/providers/routestack.ts` (**serveur uniquement**).

1. **Auth HMAC → partner token** (`POST /mcp/auth/partner-token`) :
   `data = ${apiKey}:${timestamp}:${nonce}` → `hmac = base64url(HMAC_SHA256(partnerSecret, data))` ; réponse `{ token, expiresIn }` mise en cache jusqu'à expiration (re-appel avant expiry ou après `401`).
2. **Appels skill** : `Authorization: Bearer <token>` **uniquement** (jamais `x-api-key`/`x-member-token` par appel).
3. **Hôtel** : `search-destinations` → `search-hotels` (**persister `result.correlationId` + `result.token`**, TTL ~2 h) → `get-hotel-details-and-rates` → `revalidate` → `get-payment-url`.
4. **Vol** : `flight/session` → `flight/locations` → `flight/search` → `flight/revalidate` → `flight/get-payment-url`.
5. **Voiture** : `car/locations` → `car/search` → `car/get-payment-url`.
6. **Checkout** : gérer `checkoutMode: 'deeplink'` (ouvrir `url`) et `'acp'` (session).
7. **Attribution marchand** : envoyer `routestack_external_userid` (= `auth.uid()`) et `routestack_metadata` (`{ trip_id, vertical, campaign }`) **sur les `get-payment-url` uniquement** ; ne **jamais** envoyer `routestack_accountid`.
8. **Quota** : seuls `search-hotels` / `flight/search` / `car/search` sont facturés ; gérer `402` (quota) et `401` (token) explicitement.

---

## 4. Adaptateur Viator (Sandbox ↔ Full/Booking en une variable)

Fichier cible : `src/features/booking/providers/viator.ts` (réutilise `discovery/providers/viator/*`).

- **Bascule** : `VIATOR_MODE=sandbox|full` (nouvelle variable) pilote `VIATOR_API_BASE_URL` :
  - `sandbox` → `https://api.sandbox.viator.com/partner`
  - `full` → `https://api.viator.com/partner`
  Prévoir aussi `VIATOR_BOOKING_ENABLED=true` pour activer le **Booking** côté Full.
- **Auth** : en-tête `exp-api-key`, `Accept: application/json;version=2.0`, `Accept-Language: fr`.
- **Recherche** : `POST /products/search` (destination, tags, `startDate`/`endDate`, `currency=EUR`), ou `POST /search/freetext` (attractions/destinations/produits).
- **Détail** : `/products/{product-code}` pour le produit sélectionné uniquement (pas d'ingestion bulk par ce endpoint).
- **Ingestion** (optionnelle, si catalogue local) : `/products/modified-since` par **curseur** (`count=500`, `nextCursor`), process séparé de l'ingestion de disponibilité.
- **Réservation** : ouverture de `viator.com` **dans le navigateur intégré** de l'app, avec **attribution obligatoire** : `?pid=<9 chiffres>&mcid=<id>&medium=api&campaign=<code>` (caractères alphanumériques et tirets **uniquement**). Un usage incorrect des paramètres peut **annuler la commission**.
- **Retour d'état** : `GET /bookings/status` en cadence horaire si l'on suit les statuts.

---

## 5. Les 4 scénarios, résolus par la donnée

Règle : **l'ampleur réelle de l'activité commande la logistique.** Pas de vols pour un footing.

| Scénario | Activité | Métriques auto | Sac | Carte | Logistique |
|---|---|---|---|---|---|
| **Footing 45 min** | `running` | durée, distance, D+ | tenue + eau | tracé perso | **aucune** (pas de vol/hôtel) |
| **Rando à la journée** | `hiking_day` | distance, D+, technicité, durée | sac journée, eau, nutrition | randos existantes + POI | **accès + points d'eau** |
| **Bivouac 120 km** | `hiking_bivouac` | étapes, D+, durée multi-jours | bivouac, réchaud, eau | tracé perso + refuges | **étapes, eau, hébergements** |
| **Road trip Amérique du Sud** (langage naturel) | `roadtrip_multi` | pays, jours, budget | bagage, climat | POI + tracé | **vols + véhicules + hôtels + budget** |

Le **niveau de logistique est dérivé** d'un champ `logistics_scope` porté par l'activité (`none | access | stages | full`), **pas** d'un choix utilisateur.

---

## 6. Boucle de feedback (l'IA s'améliore seule)

Chaîne cible, branchée sur les tables A1/A3/A4 déjà présentes :

```
/hub (issue observée : durée réelle, fatigue, écarts, confort du sac)
        │  écrit un domain_event (A1)
        ▼
observations GPS (déjà : server/processHikeSession.ts)
        │
        ▼
buildUserProfile (A3)  ──►  user_performance_profiles (snapshot versionné)
        │
        ▼
collectiveIntelligence (A4, ≥5 users)  ──►  agrégats par segment
        │
        ▼
backtesting + shadowRuns (A10)  ──►  comparaison modèle courant vs candidat
        │
        ▼
PROMOTION (nouveau) : si le candidat bat le courant sur le backtest
        │  → écrit un domain_event de promotion, incrémente model_version
        ▼
recalcTriggers  ──►  prédictions (durée, difficulté, budget) affinées dans /prepare
```

**Ajout net :** un cycle `evaluate → promote` (déterministe, testable) qui ferme la boucle. Aujourd'hui le shadow mode **tourne** mais ne **promeut** jamais.

---

## 7. Schéma BDD à ajouter (migration unique)

| Table | Rôle | Colonnes clés |
|---|---|---|
| `activities` | **catalogue exhaustif** | `slug, label, family, logistics_scope, metrics` (jsonb), `sport_tags[], is_seed` |
| `activity_metrics` | métriques par activité | `activity_id, metric_key, unit, required, default_value, min, max` |
| `bookings` | **réservations liées au trip** | `id, trip_id, user_id, vertical, provider, external_ref, amount_eur, currency, status, checkout_mode, metadata jsonb, created_at` |
| `cart_lines` | **panier unique** | `id, user_id, trip_id, kind ('product'\|'booking'), ref_id, qty, unit_price_eur` |
| `model_promotions` | traces de promotion de modèle | `id, model_version, previous_version, score, promoted_at, evidence jsonb` |

Règles : **RLS explicite** (lecture propriétaire + politique publique ciblée pour les catalogues), index sur `trip_id`/`user_id`, RPC `activities_by_scope(scope)`.

---

## 8. Nettoyage du routage (aucun lien cassé)

1. Créer `src/constants/routeRegistry.ts` : source unique `ancien → cible` (tableau du §9 de `AUDIT.md`).
2. Générer les `redirects()` de `next.config.mjs` **depuis ce registre** (permanent: false, pas de chaîne : chaque ancien pointe **directement** vers la cible finale).
3. Supprimer les écrans dev-only (`/apercu-preparation`, `/preparer-sentier/apercu`) et le composant mort s'il en reste.
4. Test `tests/routing/no-broken-links.spec.ts` : pour chaque entrée du registre, la cible **existe** (fichier `page.tsx` présent) et aucune redirection en chaîne.

---

## 9. Phases d'exécution (build vert à chaque étape)

| Phase | Contenu | Porte de sortie |
|---|---|---|
| **P0 — Baseline** | `npm install`, `type-check`, `test`, `build` sur `098a95e` | 4 sorties vertes **constatées** |
| **P1 — Données** | Migration `activities` + `activity_metrics` + `bookings` + `cart_lines` + `model_promotions` ; seed catalogue exhaustif | migration appliquée, `SELECT count(*)` par famille |
| **P2 — Configurateur unique** | Créer `/prepare` : fusion sac + carte + logistique ; brancher `analyzeKit` et `fetchRealCatalog` | `/prepare` rend les 4 scénarios avec données réelles |
| **P3 — Réservation** | Contrat `BookingProvider` + adaptateurs RouteStack + Viator + panier unique | `search`→`checkoutUrl` testés (clés requises) |
| **P4 — Hub** | `/hub` pré-rempli par `/prepare`, sous-routes branchées sur `bookings`/`cart_lines` | parcours `/prepare`→`/hub` complet |
| **P5 — Apprentissage** | Boucle de promotion `evaluate → promote` + branchement `/prepare` | test déterministe de promotion |
| **P6 — Routage & zéro mock** | Registre de routes, redirections, purge des mocks ciblés | test « aucun lien cassé » + recensement mock = 0 réel |
| **P7 — Scénarios & rapport** | 4 scénarios bout-en-bout + `FINAL_REPORT.md` | 4/4 verts, build+test verts |

**Invariant de chaque phase :** `npx tsc --noEmit` = 0, `npm test` vert, `npm run build` vert. On n'avance jamais sur un rouge.

---

## 10. Ce qui dépend de vous (clés & config)

1. **RouteStack** : `apiKey` + **partner secret** (HMAC) + `ROUTESTACK_BASE_URL`.
2. **Viator** : passer en **Full** (clé Full) + activer **Booking** ; renseigner `pid` (9 chiffres) et `mcid` pour l'attribution.
3. **Supabase** : URL + anon key + service role (exécution des migrations).
4. **OpenRouter** : clé IA.
5. **Stripe** : clés + secret webhook (panier/checkout).
6. Optionnel : `TRAVELPAYOUTS_MARKER`, `KLOOK_AFFILIATE_URL`, `TRIPADVISOR_*`.

Sans ces clés, les phases P0–P2 et P6–P7 sont vérifiables ; P3–P5 restent **préparées mais non exécutables de bout en bout**.
