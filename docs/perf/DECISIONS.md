# Registre des décisions — Mission « Fusée »

## Fait

| # | Date | Décision | Pourquoi | Statut |
|---|---|---|---|---|
| F-01 | 01/11 | Baseline serveur et bundle relevée avant tout changement (`PERF_BASELINE.md`) | Phase 0 non négociable | fait |
| F-02 | 01/11 | Lot 1 base (8 `auth_rls_initplan`, 2 index en double) écrit avec rollback : `supabase/migrations/20261101120000_perf_p1_rls_initplan_duplicate_indexes.sql` | Risque nul, même sémantique | **écrit, non appliqué** (application en production réservée à Tony) ; validation à blanc en transaction annulée non faite (confirmation Supabase restée sans réponse) |
| F-04 | 01/11 | `pg_stat_statements` remis à zéro le 01/11 à 07:35 UTC (D-01, autonomie accordée par Tony le 01/11) | Les cumuls du 07/09 sont conservés dans la baseline ; mesurer l'usage actuel (Explorer v2) et l'effet des changements | fait |
| F-05 | 01/11 | Chronométrage serveur du Compas (`traceStage`, no-op hors `LKDV_TRACE_SSR=1`), variable activée sur les aperçus de la branche seulement | Mesurer avant de changer : RUM Compas TTFB p75 4,2 s | fait |
| F-06 | 01/11 | **Boucle de rechargement de /explorer corrigée** (2 service workers sur la portée « / ») : portée propre pour l'Explorer, rechargement réservé au worker de l'app. Test de non-régression | 12 rechargements en 15 s en production → 0 constaté sur l'aperçu | fait (`2265e0b`) |
| F-07 | 01/11 | Allègement du JS : dictionnaires des langues éteintes, zod, Radix Dialog, Dexie (purge) hors mise en page racine ; MapLibre et moteur de la page club, tiroirs Communauté et Compas à la demande | Mise en page racine 518 → 332 Ko ; tableau Next : club 677 → 342, Communauté 413 → 329, Compas 537 → 387, HUB 554 → 403 | fait (`ee9240b`), relu |
| F-08 | 01/11 | Tests « 0 modification dans /compas » (refontes compte v10-v16, clubs v15) remplacés par une vérification d'isolation (comme v17+) | Échouaient sur toute branche touchant au Compas, sans rapport avec le produit | fait (`f647afb`) |
| F-09 | 01/11 | **Écran de démarrage plein écran (BootScreen) retiré** sur le web | Masquait le contenu rendu par le serveur jusqu'à l'hydratation (Explorer : contenu visible à 7,7 s en mobile ralenti) ; contraire à la règle « aucun spinner plein écran ». **Changement visible** : réversible en une ligne (`git revert`). L'app native garde son écran natif (`NativeAppBootstrap`) | fait sur la branche, à valider par Tony avant production |
| F-10 | 01/11 | Logo PNG 121 Ko → WebP sans perte 82 Ko (identique au pixel sur le fond de l'app) ; 3 préconnexions inutiles retirées de la mise en page racine (Rocket bloqué par la CSP, ArcGIS) | Octets et connexions concurrentes sur toutes les pages | fait |
| F-11 | 01/11 | Garde-fou CI `npm run perf:budget` (poids JS par surface, union mise en page + page) | Phase 8 : empêcher la régression | fait |
| F-03 | 01/11 | Garder le RUM existant (`WebVitalsReporter` → `hub_telemetry`) plutôt qu'ajouter `web-vitals` ou Speed Insights | Déjà en place, déjà en lots, budget 0 € | adopté |

## Écarté

| # | Option | Raison |
|---|---|---|
| E-01 | Indexer les 165 clés étrangères en bloc | La mission elle-même demande l'ordre mesuré ; les pointes viennent d'abord d'une contention systémique (voir baseline §2) |
| E-02 | Traiter `hike_sessions` par un index | Le plan mesure 4 ms ; l'index adéquat existe déjà |
| E-04 | `experimental.staleTimes.dynamic` (cache du routeur client) pour des onglets instantanés | Certaines mutations passent par des routes API sans invalider le cache du routeur : risque d'afficher un état périmé (« like » qui disparaît) ; à faire surface par surface après audit |
| E-05 | Compression avec perte du logo (WebP q92, 29 Ko) | Écart visible (PSNR 35 dB) : refusée, version sans perte retenue |
| E-03 | Retirer `post_comments` de la publication Realtime | Ajoutée volontairement (`20261021093000_worldwide_security_hardening.sql`), peu d'écritures : gain négligeable face au risque de casser une fonction prévue |

## En attente de Tony (décisions irréversibles ou en production)

| # | Décision | Options | Recommandation |
|---|---|---|---|
| D-01 | Remettre `pg_stat_statements` à zéro pour une baseline « 24 h propres » | oui / non | Oui, **après** commit de cette baseline (les cumuls du 07/09 y sont conservés) |
| D-02 | Appliquer le lot 1 (F-02) en production | SQL Editor | Oui ; puis relancer l'advisor : `auth_rls_initplan` doit tomber à 0 |
| D-03 | Restreindre l'exposition PostgREST à un schéma `api` (vues + RPC appelées par le front) | migration progressive / big bang | Progressif : créer `api`, migrer les appels surface par surface, puis retirer `public` des schémas exposés. Change le contrat d'API de tout le front |
| D-04 | Realtime : retirer `post_comments` de la publication ; décider du sort du rafraîchissement temps réel du HUB (aujourd'hui inopérant car ses 18 tables ne sont pas publiées) | (a) Broadcast from Database par voyage/groupe ; (b) supprimer ces souscriptions mortes | (b) tout de suite (aucune régression possible : rien n'arrive aujourd'hui), (a) ensuite si le temps réel du HUB est voulu |
| D-05 | Monter Next 15.5 → 16 pour `cacheComponents` / PPR | maintenant / après les phases données et carte | Après : montée majeure, gain non mesurable tant que les routes restent toutes dynamiques |
| D-06 | Taille de l'instance Supabase | garder / monter d'un cran (payant) | Garder (budget 0 €) tant que D-03 et D-04 n'ont pas été mesurés |
| D-07 | Supprimer les 186 index jamais utilisés | après vérification contrainte/job rare | Par lots, en excluant les index qui portent une contrainte et ceux des tables touchées par des tâches rares (cron quotidien, purges) ; vérifier d'abord la date de remise à zéro de `pg_stat_user_indexes` |

## Reste à faire (classé par gain estimé, au 01/11/2026)

| # | Chantier | Gain estimé | Risque | Note |
|---|---|---|---|---|
| R-01 | **Mettre en production** le lot de la branche (boucle de l'Explorer surtout : défaut actif en production) | Explorer utilisable ~5,7 s plus tôt pour tous | faible (testé, relu) ; changement visible : écran de démarrage retiré | décision de Tony (CLAUDE.md : pas de production sans accord) |
| R-02 | Carte : précharger les chunks MapLibre par leur nom haché dès le HTML, worker MapLibre versionné avec cache long (servi aujourd'hui en `max-age=0`), différer les données et glyphes après `map:first-paint`, couper les préchargements d'autres routes pendant le chargement de l'Explorer | premiers pixels −3 à −5 s (estimé) | moyen | piste du rapport ingénieur du 01/11 |
| R-03 | Carte : couches de données en tuiles vectorielles (PMTiles / Martin) | gros gain sur zoom/pan et mémoire | élevé | mission §9.1 |
| R-04 | Poids JS : framer-motion → `LazyMotion` (72 fichiers), séparer `dict.compas` du dictionnaire de base, page Compte (runtime v8 de 95 Ko) | −50 à −100 Ko par surface | moyen | |
| R-05 | Communauté : la vignette vidéo du fil (LCP 3,3 s) servie en image redimensionnée et prioritaire | LCP −1 à −2 s | faible | |
| R-06 | HUB : publier la réservation de la barre du bas (rail de jours) dès le rendu serveur | CLS 0,022 → 0 | faible à moyen | |
| R-07 | Compas : rendu serveur sans attendre `getHubAdventureData` complet (`lists`, `checklist`, liens affiliés inutiles au Compas), mise en cache des appels externes par aventure | −200 à −600 ms serveur | moyen | |
| R-08 | Base : appliquer le lot 1 (`20261101120000`), puis surface d'API `api` (D-03) | rechargements de schéma ~1,7 s évités | moyen | migrations en production : Tony |
| R-09 | RUM : accepter les mesures des visiteurs anonymes (sendBeacon, débit limité) et exclure les comptes de banc de test | mesure terrain fiable | faible | |
