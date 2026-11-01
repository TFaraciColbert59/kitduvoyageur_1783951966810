# PERF_BASELINE — Mission « Fusée » (relevé du 01/11/2026)

Document de référence contre lequel chaque phase se compare. Les chiffres viennent de la production (`icxyvwzfjbflcbqukpfz`, Postgres 17.6, eu-west-3) et d'un build local. Ce qui n'est pas encore mesuré est listé à la fin, sans estimation.

## 1. Corrections du contexte de la mission

| Supposé dans la mission | Constaté | Conséquence |
|---|---|---|
| Next.js 16 (`cacheComponents`, `partialPrefetching`) | **Next 15.5.25** (épinglé), React 19.3 | Le PPR « par défaut » demande une montée de version majeure : décision à part (D-05) |
| Ajouter `web-vitals` + table RUM | **Un RUM existe déjà** : `src/components/WebVitalsReporter.tsx` (`useReportWebVitals`) envoie `web_vitals` vers `hub_telemetry` par lots de 20, `fetch` `keepalive`, hors interaction | On exploite l'existant ; pas de nouvelle librairie |
| `hub_telemetry` à 31 ms « sur le chemin critique » | Côté client, l'envoi n'est pas attendu (`WebVitalsReporter.tsx:49`, `useHubTelemetry.ts:63`, vidage toutes les 30 s). Les 31 ms sont du temps serveur (route edge `/api/telemetry/hub` → insert) | Gain serveur, pas de gain perçu attendu |
| Realtime = 90 min de CPU, problème n° 1 | Vrai en part relative (22 % du temps base), mais **≈ 100 s/jour** en absolu ; la base est peu chargée en moyenne (voir §2) | Le vrai symptôme est la **latence de queue** (pointes de 2 à 7 s), pas la charge moyenne |
| Carte à migrer vers MapLibre / tuiles | L'Explorer est déjà **MapLibre 6.4** (`src/features/explorer-v2/map/MapStage.tsx`), tuiles OpenFreeMap, données par `/api/explorer/v2/*` et GeoJSON statiques | Le chantier tuiles vectorielles porte sur les couches de données, pas sur le moteur |

## 2. Base de données

Compteurs `pg_stat_statements` cumulés depuis le **07/09/2026** (54,5 jours). Temps d'exécution total : **24 409 s ≈ 448 s/jour**, soit environ 0,5 % d'un cœur en moyenne. Instance : `shared_buffers` 224 Mo, `max_connections` 60 (petite instance ; taille exacte à lire dans le tableau de bord).

### Schéma

| Objet | Nombre |
|---|---|
| Tables `public` | 320 |
| Politiques RLS | 770 |
| Index `public` | 952 |
| Fonctions `public` | 1 084 |
| Vues / vues matérialisées | 17 / 7 |
| Taille de la base | 293 Mo |
| Migrations appliquées depuis le 07/09 | 243 (369 au total) |

### Advisors performance (01/11/2026)

| Lint | Nombre |
|---|---|
| `unindexed_foreign_keys` | 165 |
| `unused_index` | 186 |
| `multiple_permissive_policies` | **291** (absent de la mission, levier RLS réel) |
| `auth_rls_initplan` | 8 (`story_comments` ×2, `activity_sessions` ×3, `activity_points` ×2, `sos_alerts`) |
| `duplicate_index` | 2 (`admin_regions_geo`, `hiking_routes`) |

### Top du temps base

| Poste | Appels | Moyenne | Max | Total | Part |
|---|---|---|---|---|---|
| Realtime : lecture du WAL (`postgres_changes`) | 638 705 | 8,5 ms | — | 5 434 s | 22 % |
| Rechargement du cache de schéma PostgREST (3 requêtes : fuseaux 939 ms + types 621 ms + 132 ms) | 1 702 | **≈ 1,69 s** | — | ≈ 2 880 s | 12 % |
| RPC `trails_in_viewport` (carte, via `/api/trails` et `/api/hikes`) | 16 963 | 126 ms | 5 289 ms | 2 136 s | 9 % |
| `SELECT … FROM trips` | 49 328 | 21,7 ms | — | 1 069 s | 4 % |
| RPC `rate_limit_consume` (garde de chaque route API) | 222 049 | 3,4 ms | 4 678 ms | 761 s | 3 % |
| RPC `get_trail_pois_bbox` | 7 080 | 72 ms | 3 523 ms | 510 s | 2 % |
| `hike_sessions` (liste par utilisateur, 2 variantes) | 3 701 | 235 ms | 7 465 ms | 871 s | 4 % |
| `progression_ops.run_job` (cron 5 et 15 min) | 7 873 | 53,5 ms | — | 421 s | 2 % |
| `INSERT hub_telemetry` | 12 843 | 31,5 ms | — | 404 s | 2 % |
| `SELECT trip_id FROM trip_collaborators` | 37 732 | 8,5 ms | — | 321 s | 1 % |
| RPC `compas_search_routes` | 520 | 483 ms | 3 606 ms | 251 s | 1 % |
| RPC `compas_route_pois` | 175 | 780 ms | 4 608 ms | 137 s | 0,6 % |

### Diagnostic `hike_sessions` (238 ms de moyenne)

- 149 lignes, 1,2 Mo, index `(user_id, started_at DESC)` présent.
- Plan sous l'identité du compte démo (`EXPLAIN ANALYZE`, transaction annulée) : **exécution 4,1 ms, planification 12,9 ms**, 17 tampons lus en mémoire.
- Statistiques : min 0 ms, max 7 465 ms, écart-type 542 ms, aucune lecture disque.
- **Conclusion** : la requête n'est pas lente ; elle subit des pointes systémiques. Toutes les RPC fréquentes ont des maxima de 2 à 7 s. Cause probable (à confirmer, voir §5) : rafales CPU sur une petite instance — chaque rechargement de schéma PostgREST occupe ~1,7 s de CPU (≈ 31 fois par jour), plus la lecture continue du WAL. **Le premier levier de la phase 1 est donc la surface d'API PostgREST, puis Realtime**, avant l'indexation.

### Realtime

- Publication `supabase_realtime` : 6 tables — `conversation_members`, `conversations`, `message_reactions`, `messages`, `notifications`, `post_comments`.
- Souscriptions `postgres_changes` dans le code : 5 canaux, 23 couples table × événement (messagerie, notifications de l'en-tête, HUB). Tous ont un `removeChannel` au démontage.
- **18 tables écoutées ne sont pas publiées** (`trip_*` ×9, `materiel_kits`, `materiel_kit_items`, `materiel_loans`, `alerts`, `group_*` ×5) : `HubRealtimeRefresh` et `ActivityLiveBridge` ne reçoivent jamais rien. Le rafraîchissement temps réel du HUB est donc **déjà inopérant** aujourd'hui.
- `post_comments` est publiée mais écoutée nulle part : elle coûte du WAL sans usage.
- Canaux à nom fixe (`hub-realtime-refresh`, `hub-live-bridge`) : collision possible en double montage. `useConversations` s'abonne sans resynchronisation à la reconnexion.

## 3. Client (build local du 01/11/2026, `next build`, Next 15.5.25)

Poids « First Load JS » rapporté par Next (compressé). Budget mission : < 120 Ko (plafond 180 Ko).

| Surface | Route | Rendu | Taille page | First Load JS | Écart au plafond |
|---|---|---|---|---|---|
| Accueil | `/` | dynamique | 5,1 Ko | 271 Ko | × 1,5 |
| Explorer | `/explorer` | dynamique | 35,3 Ko | 156 Ko\* | sous le plafond\* |
| HUB | `/hub` | dynamique | 61,4 Ko | **554 Ko** | × 3,1 |
| HUB section | `/hub/[section]` | dynamique | 95,6 Ko | 597 Ko | × 3,3 |
| Compas | `/compas` | dynamique | 16,2 Ko | **537 Ko** | × 3,0 |
| Compte | `/compte` | dynamique | 94,7 Ko | 284 Ko | × 1,6 |
| Communauté | `/communaute` | dynamique | 68,4 Ko | 413 Ko | × 2,3 |
| Page club | `/clubs/[id]` | dynamique | 360 Ko | **677 Ko** | × 3,8 |
| Partagé par toutes | — | — | — | 105 Ko | — |
| Middleware | — | — | — | 98,8 Ko | — |

\* MapLibre est chargé à part (worker `/maplibre/maplibre-gl-worker.mjs` et import dynamique) et n'est pas compté ici : à mesurer en trace réseau.

Autres faits : 809 fichiers `'use client'` sous `src/` ; aucune route principale statique ni PPR ; `optimizePackageImports` déjà configuré ; images AVIF/WebP déjà activées ; Service Worker présent (`src/app/sw.js`, `explorer-v2-sw.js`). Le build local exige `NODE_OPTIONS=--max-old-space-size=8192` (la vérification de types dépasse 2 Go).

## 4. Terrain : RUM des utilisateurs réels (30 jours au 01/11, `hub_telemetry`, mobile, en ms)

Source : `web_vitals` et `experience_metric` envoyés par `WebVitalsReporter`. Mobile = largeur < 768 px. Groupes ≥ 15 mesures.

| Surface | n (TTFB) | TTFB p75 | FCP p75 | LCP p75 | INP p75 | Navigation interne p75 |
|---|---|---|---|---|---|---|
| `/compas` | 1 001 | **4 181** (p95 13 261) | 4 361 | 3 114 | — | — |
| `/hub` | 143 | 242 | **3 567** | **4 743** | — | 600 |
| `/compte` | 1 204 | 996 | 2 077 | 4 128 | 122 | 384 |
| `/communaute` | 552 | 1 112 | 1 512 | 4 220 | 128 | 444 |
| `/explorer` | 154 | 559 | 676 | **5 600** (n = 33) | 136 | 560 |
| `/` | 186 | 882 | 1 440 | 1 530 | — | — |
| `/connexion` | 555 | 918 | 1 664 | 2 828 | — | — |

> **Correction du 01/11 (après analyse par compte)** : 998 des 1 007 mesures TTFB du Compas viennent d'**un seul compte** (2 oct. → 1er nov.), très probablement le banc de test automatisé du Compas (préparations IA en rafale). Le tableau ci-dessus est donc biaisé. Sans ce compte, mobile, 30 jours :
>
> | Surface | personnes | TTFB p75 | FCP p75 | LCP p75 | INP p75 |
> |---|---|---|---|---|---|
> | `/compas` | 8 | 1 680 (n = 10) | 2 719 (n = 18) | — | — |
> | `/hub` | 5 | 173 | 3 574 | 4 978 | — |
> | `/compte` | 13-16 | 970 | 1 974 | 4 081 | 112 |
> | `/communaute` | 7-11 | 1 010 | 1 443 | 3 246 | 132 |
> | `/explorer` | 3 | 516 | 640 | 5 600 | 136 |
> | `/` | 1-2 | 846 | 1 368 | 1 508 | — |
>
> Peu de personnes réelles : c'est une tendance, pas une statistique. La mesure de laboratoire (§6) devient la référence principale.

Lecture (sur le tableau brut, à nuancer par la correction ci-dessus) :
- **Compas** : la lenteur est serveur (TTFB ≈ FCP). La page attend, avant d'envoyer un octet, les données du HUB puis météo, alertes, relief, change et normales climatiques (délai maximal de 5 à 6 s par appel externe). « Chaque action du Compas recharge cette page » (commentaire du code) : chaque geste paie ce délai.
- **HUB** : le serveur répond vite (242 ms) mais le premier affichage arrive à 3,6 s : blocage côté navigateur (554 Ko de JS).
- **Explorer** : coquille rapide (FCP 676 ms) mais LCP à 5,6 s : le contenu principal (carte) arrive tard.
- INP correct partout où il est mesuré (≈ 120-140 ms) ; CLS non remonté en quantité suffisante.

## 5. Ce qui n'est pas encore mesuré (et pourquoi)

| Mesure | Statut | Ce qu'il faut |
|---|---|---|
| p75 LCP / INP / CLS / TTFB par route | Données déjà collectées dans `hub_telemetry` (`event_name = 'web_vitals'`) ; requête à lancer | Accès base (requête en lecture) |
| Marques `map:first-paint`, `map:interactive`, `drawer:open`, `hub:content-ready`, `compas:trip-created` | Non instrumentées | Code (phase 0, lot 2) puis déploiement de vérification |
| Traces Chrome 4G / CPU ×4 des 6 surfaces avec `demo@lkdv.app` | Non faites | Aperçu Vercel + jeton de partage + session démo |
| Poids réel de MapLibre et des données de l'Explorer, taille des réponses `/api/trails` | Non mesuré | Trace réseau sur l'aperçu |
| Baseline `pg_stat_statements` « 24 h propres » | Non faite | Remise à zéro décidée par Tony (D-01) |

## 6. Laboratoire : référence reproductible (01/11/2026)

Script : `scripts/perf/measure-surfaces.mjs` (Playwright, iPhone 393 × 852, **cache froid** = contexte neuf à chaque passage, profil Lighthouse mobile : CPU × 4, RTT 150 ms, 1,6 Mbit/s descendant). Médiane / p75 sur 3 à 4 passages après un passage de préchauffage. « Visible » = effacement de l'écran de démarrage plein écran (`.lkdv-boot`) s'il existe, sinon LCP. Version mesurée : aperçu `2265e0b` (code de `main` + correctif de la boucle de l'Explorer, sans allègement), redéployé avec la connexion démo (`DEMO_AUTO_LOGIN`, aperçus de la branche seulement), compte `demo@lkdv.app`, lecture seule.

| Surface | TTFB | FCP | LCP | Visible | CLS |
|---|---|---|---|---|---|
| `/hub` | 534 / 565 | 1 088 / 1 236 | 1 088 / 1 236 | > fin de mesure (écran de démarrage encore là ~4 s après `load`) | 0 |
| `/compas` | 454 / 479 | 980 / 1 160 | 980 / 1 160 | 1 532 / 1 837 | 0 |
| `/compte` | 491 / 524 | 1 048 / 1 196 | 1 048 / 1 244 | 1 818 / 1 848 | 0 |
| `/communaute` | 577 / 722 | 1 068 / 1 092 | 1 264 / 1 276 | 1 671 / 1 708 | 0 |
| `/explorer` | 593 / 608 | 1 576 / 1 656 | 3 260 / 3 268 | **7 732 / 7 746** | 0 |
| `/` (sans session) | 315 | 840 | 860 | — | 0 |
| `/connexion` (sans session) | 209 | 652 | 652 | — | 0 |

Rendu serveur chronométré (`LKDV_TRACE_SSR=1`, aperçu, région de la fonction `cdg1`) :
- HUB : `layout.adventure` 370-930 ms (dont `lists` 130-390, `trip.full` 140-390, `trip.enrich` 80-200), `layout.intelligence` 50-100.
- Compas : `compas.total` 870-1 450 ms = `compas.hub` 370-680 + `wave1` 45 + `wave2` 450-730 (météo, relief du tracé et altitude des lieux, caches froids sur un déploiement neuf).
- Le Compas répond pourtant en 0,4-0,5 s au premier octet grâce à `loading.tsx` (squelette diffusé d'abord).

Chronologie de l'Explorer à cache froid (mobile ralenti) : JS de la mise en page et de la page de 1,2 à ~6 s ; **MapLibre (256 Ko) ne part qu'à 7,4 s** (import au rendu client), style de la carte demandé à 11 s ; l'élément LCP est le logo de l'écran de démarrage (PNG de 119 Ko).
