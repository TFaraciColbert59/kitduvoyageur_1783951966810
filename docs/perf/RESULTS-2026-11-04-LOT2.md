# Performance LKDV — suite du 4 novembre 2026 (lot 2)

État de départ vérifié : production `c157de20` (`dpl_9KXQT…`, URL
`kitduvoyageur-1783951966810-p7n99sr5f.vercel.app`), `origin/main` au même SHA.
Le lot 1 (Communauté) reste acquis. Budget supplémentaire : 0 €.

## 1. Fiabilité — métrique séparée

La fiabilité n'est pas mélangée aux latences. Un passage est un échec s'il ne rend pas
l'écran attendu (erreur de navigation, chemin différent, fil vide, carte absente).

| Mesure | Passages | Échecs | Réussite | Cause |
|---|---|---|---|---|
| Surfaces locales `/explorer,/hub,/compte,/` | 24 | 0 | 100 % | — |
| Explorer local, repères carte | 5 | 0 | 100 % | — |
| Explorer production, repères carte | 5 | 0 | 100 % | — |
| A/B Communauté production `c157de20` | 10 | 1 | 90 % | un fil vide à 648 ms, exclu des latences |
| A/B Communauté local après correctif | 6 | 0 | 100 % | — |
| Explorer après précharge GeoJSON | 5 | 0 | 100 % | mais phases plus lentes, voir §4 |

## 2. Surfaces HUB, Compte, Explorer (laboratoire, connecté, 393×852, CPU ×4, 1,6 Mbit/s)

Médiane / p75, 5 passages après préchauffage. Ce sont des mesures de laboratoire,
pas un gain terrain.

| Surface | TTFB | FCP | LCP | CLS max | JS transféré |
|---|---|---|---|---|---|
| `/explorer` local | 350 / 437 | 1 188 / 1 300 | 1 188 / 1 300 | 0 | 388 Ko |
| `/hub` local | 54 / 85 | 300 / 352 | 492 / 560 | 0 | 2 137 Ko\* |
| `/compte` local | 58 / 121 | 552 / 568 | 916 / 1 684 | 0 | 1 500 Ko\* |
| `/` local | 16 / 17 | 220 / 232 | 220 / 232 | 0 | 1 298 Ko\* |

\* Somme des scripts transférés jusqu'à `load`, préchargements et chunks différés
compris ; ce n'est pas la mesure gzip du budget. Le détail des chunks est au §3.

### Explorer : trois phases distinctes

| Phase | Local (n=5) | Production `c157de20` (n=5) |
|---|---|---|
| Interface visible (FCP/LCP) | 1 212 / 1 220 ms | 1 288 / 1 348 ms |
| Premiers pixels de carte (`map:first-paint`) | 7 578 / 7 591 ms | 7 635 / 7 786 ms |
| Carte interactive (`map:interactive`) | 18 451 / 18 455 ms | 18 461 / 18 519 ms |

La carte reste le coût dominant. La chronologie production montre :
`countries.geojson` (382 Ko compressés) demandé à 5 965 ms et terminé à 15 861 ms ;
MapLibre partagé (135 Ko) demandé à 9 319 ms et terminé à 14 074 ms ; les glyphes
commencent à 19 026 ms. L'interface est prête en 1,3 s, la carte en 7,6 s, l'interactivité
en 18,5 s.

## 3. JS partagé et imports réellement chargés

`npm run perf:budget` après le lot (gzip, union manifeste) :

| Surface | JS | Plafond |
|---|---|---|
| Mise en page racine | 331 Ko | 350 Ko |
| `/communaute` | 442 Ko | 460 Ko |
| `/hub` | 557 Ko | 590 Ko |
| `/compas` | 527 Ko | 560 Ko |
| `/compte` | 436 Ko | 460 Ko |
| `/explorer` | 369 Ko | 390 Ko |
| `/clubs/[id]` | 454 Ko | 475 Ko |
| `/` | 377 Ko | 400 Ko |

Le budget ne compte pas les chunks chargés dynamiquement. Le relevé réseau réel sur `/`
montre notamment : Supabase 185 Ko bruts (52 Ko gzip), React/Next 174 Ko (46 Ko),
`4bd1…` 173 Ko (54 Ko), **framer-motion 133 Ko (44 Ko)** chargé à 236–635 ms,
`4346` 121 Ko (40 Ko). framer-motion reste dans le premier affichage.

**Tentative de réduction** : plateaux de navigation et SearchOverlay passés en imports
dynamiques conditionnels. Le budget racine descend artificiellement à 290 Ko, mais le
chunk framer-motion est **toujours demandé à 236–635 ms** par le préchargement Next.
Aucun gain réseau réel : les deux changements ont été **annulés** pour ne pas laisser un
budget qui sous-estime le premier chargement.

Polices : trois petites WOFF2 (14–15 Ko) sur toutes les pages, plus une WOFF2 de 47 Ko
(Instrument Serif) sur `/compte` et `/explorer`. Aucun script tiers (GA, Rocket,
Travelpayouts, hCaptcha, Stripe) n'est chargé avant consentement sur les cinq surfaces
testées ; le chargement après consentement n'a pas été mesuré.

## 4. Explorer — précharge GeoJSON testée puis annulée

La précharge `<link rel=preload>` de `countries.geojson` fait bien démarrer la donnée à
**1 591 ms** (fin 2 080 ms) au lieu de 5 965 ms. Mais elle entre en concurrence avec les
chunks MapLibre sous 1,6 Mbit/s : carte peinte à **7 883 ms** (contre 7 578 ms) et
interactive à **19 619 ms** (contre 18 451 ms). Le changement a été **annulé**.
Le vrai levier reste la taille de la donnée (382 Ko compressés) ou des tuiles vectorielles,
pas une précharge qui vole la bande passante du JS.

## 5. Longue session du fil

Profil sur 240 posts chargés (fil complet), Chromium mobile :

| Métrique | Valeur |
|---|---|
| Posts montés | 240 |
| Nœuds DOM | 7 620 |
| Mémoire JS (`performance.memory`) | 14 Mo |
| Vidéos | 10 |
| Images | 415 |
| Hauteur de défilement | 2 765 794 px |
| Images/s en défilement | 61 |
| Requêtes `community_posts` | 29 |
| Octets WebM téléchargés | 15 677 281 |

**Décision : pas de virtualisation.** 240 posts, 7 620 nœuds, 14 Mo et 61 ips ne
justifient pas le risque d'une fenêtre virtualisée (hauteurs variables, focus, vidéos,
scroll). Le fil est borné par l'historique existant (241 posts).

**Vidéo : trois causes distinctes.**
1. Avec `preload=metadata`, 15 677 281 o de WebM sont téléchargés sur 240 posts.
2. Avec `preload=none` seul, 21 646 957 o sur 190 posts : Chrome charge quand même
   certaines ressources. Le fil n'ayant aucun contrôle de lecture, `src` n'est plus posé
   quand un poster existe (le poster optimisé reste affiché) ; il ne reste que les
   vidéos sans poster.
3. Le vrai puits était ailleurs : `warmFreedomReels()` (appelé au repos par la barre du
   bas, sur **toutes** les pages) créait cinq `<video preload="auto">` cachés. Le profil
   montre deux WebM complets de 5,9 Mo et 16,0 Mo (≈ 21,6 Mo) chargés pour un écran Reels
   jamais ouvert. Ce préchauffage ne charge plus que la **liste** des reels ; le viewer
   met en tampon les vidéos utiles à l'ouverture et à l'avance.

Vérification sur le build final : 10 posts, 4 cartes vidéo, toutes avec `src=null`,
`preload=none`, poster optimisé affiché, **0 octet WebM demandé** (contre 21,6 Mo).

## 6. Pagination et concurrence

Le fil utilisait un offset. Une suppression entre deux pages saute une publication ;
une insertion la duplique. Remplacé par un curseur stable `(created_at, id)` :
`created_at.lt.<curseur>,and(created_at.eq.<curseur>,id.lt.<id>)`, `limit(10)`.
Test réel sur Supabase : page 2 sans chevauchement avec la page 1. Test unitaire :
`useCommunityFeed.test.tsx` vérifie `limit(10)`, l'absence de offset et le curseur
`id.lt.post-10` à la page suivante.

## 7. `select('*')` et API

123 `select('*')` restants. Les plus gros fichiers : `queries-trips.ts` (11),
`queries/groupe.ts` (7), `AdminProductsManager.tsx` (6), `queries-compte.ts` (5),
`queries-places.ts` (5). Trois projections du Compte ont été réduites sans changer le
mapping : carnets (8 colonnes), commandes (6), activités (3).

Banc local, 20 passages par endpoint (sauf IA, un appel), session de test :

| API | p50 | p95 | Erreurs | Octets |
|---|---|---|---|---|
| `/api/compte/bootstrap` | 55 ms | 123 ms | 0 | 10 014 |
| `/api/compte/highlights` | 99 ms | 171 ms | 0 | 16 |
| `/api/compte/reseau/following` | 114 ms | 181 ms | 0 | 34 |
| `/api/explorer/v2/content` | 7 ms | 10 ms | 0 | 1 974 |
| `/api/explorer/v2/countries` | 6 ms | 10 ms | 0 | 347 |
| `/api/elevation` | 7 ms | 13 ms | 0 | 169 |
| `/api/ai/ping` | — | — | 20 × 403 | accès protégé, pas une panne |
| `/api/ai/chat-completion` | 237 ms | 237 ms | 0 | 180 (repli local) |

## 8. Requêtes lentes et tâches longues

`pg_stat_statements` (reset du 01/11) : `hike_sessions` 123,5 ms de moyenne (79 appels),
`trips` 38,9 ms (1 893), `progression_ops.run_job` 38,6 ms (1 379), `hub_telemetry`
insert 23,8 ms (1 138), `countries_geo` 32,5 ms (55). Les index existent
(`hike_sessions_user_started`, `trips_user_start_date`, `hub_telemetry_*`). **Aucun index
ajouté** : aucun plan ne le justifie, les pointes sont systémiques.

Tâches : 5 jobs `pg_cron` actifs (purge anonymes, rapport quotidien, purge outbox,
outbox toutes les 5 min, leaderboard toutes les 15 min) ; les jobs 6/7 réussissent en
~100 ms sur les 12 derniers passages. En revanche **60 `ai_jobs` sont `pending` depuis
septembre** et un est `processing` depuis le 4 septembre : la route consommatrice
`/api/cron/process-ai-jobs` existe mais n'est déclenchée ni par `vercel.json` (un seul
cron quotidien) ni par `pg_cron`. Le plan Hobby limite les crons ; non corrigé, documenté.

## 9. Streaming IA

Le port `AIProvider` expose désormais `stream?()`. L'adaptateur NVIDIA lit le SSE
OpenAI-compatible (UTF-8 fragmenté, CRLF, multi-`data`, `[DONE]`, erreur explicite,
mémoire bornée) et n'expose que `delta.content`, jamais le raisonnement. `askAIStream`
rejoue les précontrôles d'`askAI` : feature, mode IA, cache, quota par personne, plafond
du site, chaîne de providers autorisés. Un provider n'est abandonné qu'avant le premier
token (délai 12 s) ; après, une erreur est explicite. Les requêtes JSON structurées ne
passent pas par le flux.

La route `/api/ai/chat-completion` émet `start`, `chunk` (delta), `done` (modèle,
provider, degraded, cached) et `error`. `AiImproveButton` affiche le texte au fil de l'eau
(une mise à jour par frame), restaure le texte d'origine sur erreur et abandonne le flux
au démontage. Tests : 4 tests SSE (UTF-8 coupé, multi-data, erreur, JSON invalide) et
2 tests adaptateur NVIDIA (deltas, HTTP 503) verts. Test local de la route : 200,
premier frame à 564 ms, mais **repli déterministe** car `NVIDIA_API_KEY` est absent en
local ; le vrai provider sera vérifié en production.

## 10. RUM par version

La route `/api/telemetry/hub` écrit maintenant `app_version` depuis
`VERCEL_GIT_COMMIT_SHA` (7 caractères), au lieu du `0.0.0` par défaut. Les 30 derniers
jours sont donc tous `0.0.0` (LCP p75 3 601 ms, INP 128 ms, CLS 0,018, n=1 924/71/40,
compte de test exclu). Les prochains relevés seront comparables par SHA ; aucune
comparaison avant/après n'est encore possible.

## 11. Matrice corrigée

Statuts : **vérifié** (mesuré ou inspecté, rien à faire), **incomplet** (présent mais
partiel, action identifiée), **non mesuré** (aucune conclusion), **bloqué** (obstacle
réel : matériel, plan, accès).

| # | Sujet | Statut | Preuve / reste |
|---|---|---|---|
| 14 | Squelettes, aria-busy, reduced-motion | vérifié | squelette 406/541, CLS 0 dans l'A/B local |
| 15 | Images AVIF/WebP, srcset, dimensions | vérifié | 45 954 o AVIF en production, `srcset` Next |
| 16 | LCP prioritaire, hors écran différé, vidéos | vérifié | première carte prioritaire ; 0 octet WebM sur le fil, poster affiché |
| 17 | Déduplication Query, clés, isolation | incomplet | fil hors TanStack ; 4 requêtes au remontage, 0 après déconnexion |
| 18 | Debounce recherche | vérifié | recherche par soumission, pas de frappe réseau |
| 19 | Pagination bornée, tri stable, curseur | vérifié | curseur `(created_at,id)`, test réel sans chevauchement |
| 20 | N+1, lectures groupées, parallélisme | vérifié | `Promise.all` profils/likes/favoris |
| 21 | Colonnes nécessaires | incomplet | 3 projections Compte réduites ; 120 `select('*')` restants |
| 22 | Index justifiés | vérifié | index existants, aucun ajout justifié |
| 23 | Pooling | vérifié | Supabase HTTP, aucun pool applicatif |
| 24 | CDN, cache, compression | vérifié | `br`, `HIT`, cache assets 1 j |
| 25 | Immutable versionné, privé hors CDN | vérifié | `_next/static` immutable, API privées no-store |
| 26 | Redis | vérifié | aucun besoin mesuré |
| 27 | Clés, TTL, invalidation, single-flight | incomplet | `sharedCache` non audité en concurrence |
| 28 | Proximité | vérifié | Vercel cdg1, Supabase eu-west-3 |
| 29 | Jobs, reprise, idempotence | incomplet | outbox/leaderboard OK ; 60 ai_jobs sans déclencheur |
| 30 | Timeouts, signal, retries | incomplet | premier token 12 s côté IA ; budget client global absent |
| 31 | Streaming IA de bout en bout | incomplet | implémenté et testé (SSE + adaptateur) ; provider réel à vérifier en production |
| 32 | Quotas, auth, modèles, JSON | vérifié | `askAIStream` rejoue les précontrôles, JSON non streamé |
| 33 | Optimisme, rollback, clics rapides | vérifié | tests like/favori |
| 34 | SSR/SSG, privé par requête | vérifié | routes inchangées |
| 35 | Scripts tiers, consentement | incomplet | aucun tiers avant consentement ; après consentement non mesuré |
| 36 | Code splitting | vérifié | drawers dynamiques, MapLibre dynamique |
| 37 | Virtualisation | vérifié | 240 posts, 7 620 nœuds, 14 Mo, 61 ips : non nécessaire |
| 38 | Re-renders | non mesuré | pas de profil React dédié |
| 39 | Dépendances inutiles | non mesuré | audit imports/plugins non fait |
| 40 | Polices | vérifié | 3 petites + 1 de 47 Ko sur Compte/Explorer |
| 41 | Load balancing | vérifié | Vercel géré |
| 42 | RUM par version | incomplet | `app_version` ajouté ; comparaison après déploiement |
| 43 | AVIF/WebP, compress, fonts, Query, RUM | vérifié | configuration existante |
| 44 | Fil : 10 pages, `select('*')`, offset, tri | vérifié | projection + curseur |
| 45 | Auteurs/likes groupés, parallélisme | vérifié | `Promise.all` |
| 46 | Média natif, vidéo auto | vérifié | next/image + `none` hors première carte |
| 47 | Tous les posts montés | vérifié | profil 240 posts, décision de ne pas virtualiser |
| 48 | Interactions optimistes | vérifié | verrous + tests |
| 49 | Route IA bufferisée | incomplet | flux réel codé et testé localement ; production à tester |
| 50 | `AIProvider.complete()` seulement | vérifié | `stream()` ajouté |
| 51 | Carte lente, JS lourd, LCP Communauté | incomplet | carte 7,6 s / 18,5 s ; LCP Communauté lot 1 |
| 52 | Portées service workers | vérifié | aucun changement SW |
| 53 | Migrations appliquées | vérifié | aucune migration dans ce lot |

## 12. Bloqués et non mesurés

| Contrôle | Statut | Cause |
|---|---|---|
| iPhone physique / WKWebView / Capacitor | **bloqué** | aucun appareil dans cet environnement ; Playwright WebKit ne prouve pas le natif |
| API p95 en production | non mesuré | banc local uniquement ; logs Vercel Hobby 1 h |
| Re-renders React | non mesuré | pas de profil dédié |
| Dépendances inutiles | non mesuré | audit imports/plugins non exécuté |
| Scripts tiers après consentement | non mesuré | consentement non donné dans le banc |
| `ai_jobs` déclencheur | bloqué par plan | Hobby : un cron quotidien ; route consommrice non planifiée |
| Index supplémentaires | non nécessaire | plans et index existants |

## 13. WebKit et contrôles

Recette WebKit (moteur Safari, 393×852, session de test) : `/communaute` rend 10 posts et
4 cartes vidéo, `/hub`, `/compas` et `/compte` rendent leur contenu. Une erreur locale
`sw.js` apparaît sous WebKit en HTTP (`access control checks`) ; elle doit être revérifiée
en HTTPS sur la production. **Ce n'est pas un test iPhone/Capacitor** : aucun appareil
physique n'est disponible, et WKWebView ne se confond pas avec WebKit Playwright.

Build : `next build` vert, 37 tests ciblés verts (fil, interactions, SSE, adaptateur
NVIDIA), `perf:budget` vert sur les 8 surfaces. Le build local exige toujours
`NODE_OPTIONS=--max-old-space-size=6144`.

## 14. Livraison

- **SHA production : `45d32c93`**, déploiement `dpl_H17JSipzMudAuDb1qBixUMYm657F`,
  URL vérifiée : `https://kitduvoyageur-1783951966810-ncsx3vtcc.vercel.app`.
- `/communaute` (session de test) : 10 posts, 4 cartes vidéo `src=null`,
  `preload=none`, poster optimisé, **0 octet WebM** ; `/hub` et `/compas` rendent.
- **IA réelle en production** : `POST /api/ai/chat-completion` avec `stream:true`,
  session valide → 200 `text/event-stream`, premier token **828 ms**, total **984 ms**,
  texte « Bonjour ! Je te souhaite un excellent voyage. », provider `nvidia`,
  modèle `nvidia/nemotron-3.5-lightning-30b-a3b`, `degraded:false`. Sans session → 401.
- En-têtes production : `/assets` 1 jour, `/maplibre` 1 heure, `_next/static`
  immutable, `X-Vercel-Cache: HIT` ; aucune erreur runtime serveur sur la dernière heure.
- RUM : des lignes `app_version = 45d32c9` sont déjà écrites (`web_vitals`,
  `experience_metric`) ; elles viennent du compte de test et sont à exclure des p75.
- **WebKit Playwright** : `/communaute` (10 posts), `/hub`, `/compas`, `/compte`
  rendent. Deux incidents moteur : l'enregistrement `sw.js` est refusé
  (« access control checks ») et `/hub` émet un rejet de promesse `[object Event]`.
  Ce sont des constats WebKit navigateur, **pas** un test iPhone/WKWebView.
- **Chromium `/compte`** : quatre erreurs client `appendChild` (chunk `5032`,
  effet liquid-glass) sans blocage du rendu. Défaut préexistant probable, à traiter
  hors de ce lot.
