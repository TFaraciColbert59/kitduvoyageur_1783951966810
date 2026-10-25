# « Préparer » un sentier → activité complète (socle réel + enrichissement LLM live + affiliation + animations) — Design

- **Date** : 2026-09-12
- **Statut** : proposé (validé en brainstorming : carte blanche propriétaire)
- **Branche cible** : `chantier/preparer-activite`
- **Portée** : bouton « Préparer » (explorer + fiche sentier + carte legacy) → création d'une **vraie activité** en base, servie **complète** et **enrichie en direct** par un LLM gratuit.

## 1. Contexte & constat factuel

**Ce qui existe déjà (vérifié, prêt à connecter)**
- L'usine de génération déterministe `createTripFromAutogenIntent` (`src/features/trips/server/createTripFromAutogenIntent.ts:427`) crée : `trips` + plan Adventure (19 sections, `adventure_plans`) + route réelle sélectionnée + `materiel_kits` + `materiel_kit_items` + `trip_items` + `trip_expenses` (1 ligne prévisionnelle) + `trip_checklist_items` + documents attendus — avec quota/idempotence (`adventure_generation_requests`) et compensation en échec.
- Les moteurs déterministes : `runAutoGenPipeline` (`engine/autoGenPipeline.ts:19`), `extractTripBrief`, 16 blueprints, `buildAutogenPreparation`, `kitCompletenessEngine`, `buildItinerary` + Naismith (non branché), `trail_metadata` (difficulté/durée/D+/D− pour 1163/1169 sentiers).
- L'infrastructure LLM : OpenRouter Nemotron `:free` **garde-fou gratuit** (`src/lib/ai/providers/openrouter.ts`, `assertFreeModel`), et surtout les **jobs IA asynchrones** : enfilage `POST /api/ai/jobs` (rate-limit fail-closed 20/h) + cron `src/app/api/cron/process-ai-jobs/route.ts` (service existant : `HikeNarrativeService`).
- Le realtime hub : `HubRealtimeRefresh` écoute déjà `trip_steps`, `trip_pois`, `trip_expenses`, `trip_items`… → **toute écriture d'enrichissement apparaît en direct**.
- L'affiliation : table `affiliate_links` (21 liens réels : Booking, Aviasales, GetYourGuide, Airalo, Chapka), redirection trackée `/go/[slug]`, composants `TripAffiliateSection`/`AffiliateLinkCard`, disclosure, consentement — mais rendue uniquement sur la page de partage token.
- Données : 1 169 sentiers réels (962 FR / 172 BE — Hauts-de-France + Belgique), tracés PostGIS réels, `geom` navigable ; pas de colonne région fiable ; pas de photos réelles.

**Ce qui manque (le « plat » n'est pas dressé)**
- Le clic « Préparer » route vers `/hub/depart?id=none&route=X` = cockpit vitrine (`getShowcaseDepart`) : **aucune activité créée**.
- L'autogen **ne matérialise pas** : pas de `trip_steps` (étapes/roadbook), pas de `trip_pois` (arrêts), pas de moments de la journée (matin/AM/soir), pas de lignes transport/hébergement/resto, pas d'étapes horodatées. L'UI itinéraire lit `trip_steps` → vide.
- L'affiliation n'est pas visible dans le hub normal, pas de lien par étape, pas de voiture/train, webhook postback non configuré.
- `trip_steps` et `trip_pois` n'ont **pas** de `metadata`/`source` (pas de provenance « donnée » vs « suggestion »).

## 2. Objectifs / Non-objectifs

**Objectifs**
- Un clic « Préparer » = **une vraie activité créée** (ou réouverte), liée au sentier réel, atterrissage `/hub` activité active.
- Socle **instantané et complet** (déterministe) puis **enrichissement LLM gratuit en direct** (itinéraire, moments, transports/hébergements/restos+affiliation, descriptions, kit/checklist).
- **Rien d'inventé présenté comme un fait** : données venant de la base ; contenus LLM marqués « suggestion » et ancrés sur des candidats réels ; hôtels/restos = intentions de recherche affiliées, jamais d'inventaire/prix fictifs.
- Animations framer-motion qui donnent à voir la préparation en direct (charte ci-dessous).

**Non-objectifs**
- Pas de LLM payant (garde-fou `:free` conservé), pas de migration lourde.
- Pas de refonte des sections hub existantes : l'enrichissement « platé » s'affiche dans les composants existants (itinéraire, checklist, kit, carte) + un rail de statut et l'affiliation au hub.
- Le webhook Travelpayouts (secret) reste une **action propriétaire** documentée.

## 3. Décisions validées (propriétaire, 12/09)

| # | Décision |
|---|---|
| D1 | Second clic « Préparer » sur le même sentier → **réutilisation** de l'activité existante (même utilisateur + `metadata.route_id`), jamais de doublon volontaire |
| D2 | Non connecté → redirection `/connexion?redirect=/preparer-sentier/<id>` + **reprise automatique** après connexion |
| D3 | Contenu créé : cœur réel + **tout** l'enrichissement (itinéraire & arrêts, moments matin/AM/soir, transport/hébergement/restos + affiliation, descriptions, kit & checklist enrichis) |
| D4 | Atterrissage : **racine du hub, activité active** |
| D5 | Approche : **route serveur dédiée** `/preparer-sentier/[id]` (liens partout, zéro état client) |
| D6 | **Vrai LLM**, 100 % gratuit (OpenRouter Nemotron `:free`), filet déterministe garanti |
| D7 | UX : **arrivée immédiate** + **enrichissement en direct** (pas d'écran bloquant) |
| D8 | **Animations framer-motion** pour la création en direct (chantier 5) |

## 4. Architecture

### 4.1 Flux complet
```
Clic « Préparer » → <Link href="/preparer-sentier/<trailId>">
  Route serveur GET /preparer-sentier/[id] :
   1. sentier inconnu / sans nom / sans tracé navigable → page honnête « Données réelles indisponibles » (aucune écriture)
   2. non connecté → redirect /connexion?redirect=<same URL>
   3. connecté :
      a. activité existante (user_id + metadata->>'route_id') → réutilisée (slug, id)
      b. sinon : runAutoGenPipeline(brief dérivé du sentier) + createTripFromAutogenIntent(...)
         + socle matérialisé instantané (voir 4.2) ; échec usine → trip minimal déterministe direct (titre/destination/difficulté/route_id + triggers DB)
   4. cookie aventure active (id uuid + slug + titre réel) ; revalidatePath('/hub','layout')
   5. enfilage job IA « activity-enrichment » (POST interne /api/ai/jobs, best-effort)
   6. redirect /hub
  En fond : cron process-ai-jobs → ActivityEnrichmentService (LLM free, JSON strict)
            → écritures trip_steps/trip_pois/trip_expenses/trip_items/trip_checklist_items
            → realtime existant → hub s'enrichit EN DIRECT (animations chantier 5)
```

### 4.2 Socle déterministe matérialisé à la création (instantané)
Écrits immédiatement (service client, après l'usine) :
- `trip_steps` : J1 « <sentier> » avec `distance_km`, `elevation_gain_m`, `latitude/longitude` (start réel), `start_time` (matin), `description` factuelle ; jours suivants si multi-jours (découpage Naismith via `buildItinerary` ou fractionnement déterministe) ;
- `trip_pois` : POI réels ≤ 750 m du tracé (table `trail_pois` par proximité, comme `RouteService`) — seulement s'ils existent ;
- `trip_expenses` : lignes prévisionnelles par catégorie issues de `buildBudgetLines` (hébergement/nourriture/transport) en plus de l'agrégat existant ;
- kit/items/checklist : déjà créés par l'usine + trigger.
`metadata.source = 'deterministic'` partout.

### 4.3 Enrichissement LLM (chantier 3)
- **Enfilage** : extension de `POST /api/ai/jobs` avec `feature: 'activity-enrichment'`, payload `{ tripId }` (rate-limit existant fail-closed).
- **Traitement** : `src/app/api/cron/process-ai-jobs/route.ts` → nouvelle branche `ActivityEnrichmentService` :
  - construit un **vivier de candidats réels** (échantillons du tracé, POI base, étapes seed, couches blueprint transport/hébergement/food) ;
  - prompt système strict + **sortie JSON Schema (Zod)** : `{ days:[{ day, title, steps:[{ title, description, startTime, lat, lng, distanceKm?, transportMode?, accommodation? }], moments:{ matin:[], apresMidi:[], soir:[] } }], food:[...], suggestions:[{ category:'flight'|'hotel'|'activity', day?, label, searchTerms }], kitAdditions:[{ name, reason, category }], checklistAdditions:[{ label, dueOffsetDays }] }` ;
  - **anti-invention** : lat/lng obligatoirement à **≤ 3 km** du tracé réel (distance haversine au polyline échantillonné ; au-delà → item rejeté) ; `suggestions` transformées en liens affiliés via `affiliate_links` + `/go` (Booking/Aviasales/GYG) — jamais de nom d'établissement/prix présenté comme factuel (affichage « Suggestion » + « Lien partenaire ») ;
  - écritures avec `metadata = { source: 'llm_suggestion', enrichmentVersion: 'v1', model }` + `source='llm_suggestion'` ;
  - garde d'idempotence : si `trips.metadata.enrichment_version` présent → skip ;
  - échec/timeout/invalid → aucune écriture, le socle déterministe reste servi ; `trips.metadata.enrichment_status='failed'` + bouton « Améliorer » (relance l'enfilage).
- **Garde-fous** : modèle `:free` uniquement (`assertFreeModel`), timeout 60 s, 1 run/job, quota 20/h/user existant ; données envoyées = **uniquement** données du sentier/activité (aucune donnée personnelle).

### 4.4 Affiliation au hub (chantier 4)
- Servir `TripAffiliateSection` dans le **hub normal** (aujourd'hui token-only) : `getHubAdventureData` remonte les liens actifs pertinents (catégories vols/hébergement/activités/assurance/eSIM), rendu en overview en phase prepare.
- Liens par étape : pour `trip_steps` avec `accommodation_name` ou `transport_mode`, construire côté serveur un **lien de recherche affilié** (Booking/Aviasales) avec `marker` + `sub_id` (via `affiliateEngine`), rendu `AffiliateLinkCard` (`rel="sponsored nofollow"`), sans nouveau champ DB.
- `trip_items.affiliate_link_id` : renseigné pour le matériel quand un lien catégorie `gear` existe (facultatif, best-effort).
- Finitions documentées (action propriétaire) : `TRAVELPAYOUTS_WEBHOOK_SECRET` (postbacks), `TRAVELPAYOUTS_MARKER` en env, redéploiement Drive, seeds voiture/train (facultatif).

### 4.5 Animations live (chantier 5) — charte framer-motion
**Principe** : le mouvement raconte le service du plat ; calme, iOS-native, fondus + micro-translations, ressorts `400–500 / 25–38`, ease canonique `[0.22,1,0.36,1]`, stagger `min(i*0.04, 0.3)`.
1. **Rail de préparation** (`ActivityPreparationStatus`) : phases « Analyse → Itinéraire → Moments → Transports & hébergements → Kit → Finitions » ; phase en cours pulsante, phase terminée = coche spring snappy (500/25) + **une haptique `success`** ; progression en `scaleX`/`stroke-dashoffset` (jamais width/height).
2. **Squelettes pré-formés** (dimensions exactes, zéro CLS) : timeline 3 lignes, 3 cartes moment, 2 tuiles affiliation, 2 items kit ; shimmer CSS ; reduced-motion → statique.
3. **Arrivées realtime animées** (bus `useActivityLiveArrivals` : même canal realtime que `HubRealtimeRefresh`, `Set` d'ids déjà vus, `AnimatePresence` clés = ids DB) :
   - étapes : `opacity + y 10→0`, stagger ≤ 0.24 s ; ligne de timeline `scaleY 0→1` ; heure en dernier (+120 ms) ;
   - moments : pills matin/AM/soir en spring 450/30, stagger 60 ms ; **1 haptique `selection` par vague** (max 1/800 ms) ;
   - POI carte : fondu par lots + micro-scale 0.6→1 ; pas d'animation de dash ;
   - affiliation : cartes en stagger, badge « Suggestion »/disclosure en fondu retardé ;
   - kit/checklist : items `y 6` stagger 0.03 ; **compteurs animés** (`useMotionValue`+`animate`, chiffres tabulaires) ; % prêt en `stroke-dashoffset` 700 ms.
4. **Complétion** : toast `glass` « Votre préparation est prête » (spring, 4 s, `role="status"`) ; échec → « version essentielle servie » + « Améliorer » (press scale + haptique light).
**Contraintes dures** : GPU-only (`transform`/`opacity`) ; jamais `backdrop-filter`/largeurs/hauteurs animés ; animation uniquement si visible (IntersectionObserver) ; `useReducedMotion` → instantané ; `aria-live="polite"` ; pas de doublon d'animation ni d'abonnement realtime ; haptique anti-rafale.

## 5. Données & migrations (additives uniquement)

Migration `20260912200000_preparer_activity_enrichment.sql` :
1. `ALTER TABLE trip_steps ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;` + `ADD COLUMN IF NOT EXISTS source text;`
2. Idem `trip_pois` (`metadata`, `source`).
3. **Audit préalable anti-doublons** (`select user_id, metadata->>'route_id', count(*) from trips where metadata ? 'route_id' group by 1,2 having count(*)>1`) :
   - 0 doublon → `CREATE UNIQUE INDEX IF NOT EXISTS uniq_trips_user_route_active ON trips (user_id, (metadata->>'route_id')) WHERE metadata ? 'route_id';`
   - doublons → index **non unique** `idx_trips_user_route` + idempotence applicative (select-first) documentée.
4. Aucune autre migration : `trip_expenses.metadata` existe déjà ; les liens de réservation sont calculés au rendu.
Application : `supabase db push --linked` (prod, additif, réversible par drop).

Provenance : `source` ∈ `deterministic | llm_suggestion | user` ; badge UI « Suggestion IA » sur tout `llm_suggestion`.

## 6. Erreurs & cas limites
- Sentier inconnu/non navigable → page « Données réelles indisponibles » (aucune création) ; retour explorer.
- Usine autogen en échec → trip minimal déterministe (titre, destination, difficulté mappée, route_id, triggers) ; l'utilisateur a **toujours** son activité.
- LLM indisponible/quota 50-jour épuisé → enrichissement absent, statut `failed`, bouton « Améliorer » ; jamais de contenu inventé de remplacement.
- Double clic/2 onglets → idempotence (index unique ou select-first) ; réouverture silencieuse.
- Devise/dates absentes → pas de dates inventées (phase Préparer naturelle).

## 7. Tests & vérification
- **Unitaires** : builder sentier→brief/coordonnées ; mapping difficulté ; `buildDeterministicActivityContent` (étapes/POI/dépenses) ; validateur JSON enrichissement (items hors corridor rejetés) ; construction URL affiliée (marker/sub_id/allowlist) ; dérivation phases du rail + portail d'arrivées + reduced-motion instantané.
- **Intégration (vitest, mocks)** : `prepareActivityFromTrail` (auth requis, réutilisation, fallback minimal) ; `ActivityEnrichmentService` (fixture JSON valide/ invalide → écritures/aucune écriture).
- **e2e** : anonyme → clic Préparer → `/connexion?redirect=/preparer-sentier/<id>` ; connecté → création → `/hub` (activité active) — auth e2e via session de test dédiée si disponible, sinon protocole manuel documenté + e2e anonyme.
- **Visuels** : hub avec rail de préparation (squelette puis servi), captures mobile/desktop.
- **Gates** : `npx tsc --noEmit` · `npm run lint` · `npx vitest run` (seuls les 4 échecs préexistants) · `npm run build` · e2e atlas/depart non régressés.

## 8. Risques & atténuation
| Risque | Atténuation |
|---|---|
| Qualité du modèle gratuit (JSON, itinéraires) | Schéma strict + rejets ciblés + filet déterministe déjà servi + « Améliorer » |
| Quota 50/jour | Dégradation gracieuse (socle), statut visible, quota applicatif existant |
| Injection/hallucination | Vivier de candidats réels, corridor borné, aucune donnée personnelle envoyée, aucun fait précis inventé affiché |
| Migration prod | Additive seulement, audit doublons avant index |
| Scope large | Exécution par chantiers séquentiels SDD, gates par task, merge --no-ff |

## 9. Rollback
- Code : revert du merge ; les activités créées restent (données utilisateur légitimes).
- Migrations : `drop index` / `drop column` (additives) documentées dans la migration.
- Job : désactiver l'enfilage (constante) → retour au socle déterministe pur.

## 10. Hors périmètre / reliquats
- Secret webhook Travelpayouts + redéploiement Drive = action propriétaire documentée (`docs/`).
- Volet 2 explorer mobile/natif (T15 géoloc native + T16 SW/config) : **carried** depuis le chantier précédent, planifié en dernière phase de l'implémentation.
