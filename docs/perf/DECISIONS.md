# Registre des décisions — Mission « Fusée »

## Fait

| # | Date | Décision | Pourquoi | Statut |
|---|---|---|---|---|
| F-01 | 01/11 | Baseline serveur et bundle relevée avant tout changement (`PERF_BASELINE.md`) | Phase 0 non négociable | fait |
| F-02 | 01/11 | Lot 1 base (8 `auth_rls_initplan`, 2 index en double) écrit avec rollback : `supabase/migrations/20261101120000_perf_p1_rls_initplan_duplicate_indexes.sql` | Risque nul, même sémantique | **écrit, non appliqué** (application en production réservée à Tony) ; validation à blanc en transaction annulée non faite (confirmation Supabase restée sans réponse) |
| F-03 | 01/11 | Garder le RUM existant (`WebVitalsReporter` → `hub_telemetry`) plutôt qu'ajouter `web-vitals` ou Speed Insights | Déjà en place, déjà en lots, budget 0 € | adopté |

## Écarté

| # | Option | Raison |
|---|---|---|
| E-01 | Indexer les 165 clés étrangères en bloc | La mission elle-même demande l'ordre mesuré ; les pointes viennent d'abord d'une contention systémique (voir baseline §2) |
| E-02 | Traiter `hike_sessions` par un index | Le plan mesure 4 ms ; l'index adéquat existe déjà |

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
