# P0 — Base isolée, restauration et reprise observée

Preuves initiales du 10 octobre 2026, 16:54–17:06 UTC ; reprise ciblée et contrôles finaux **20:46–20:47 UTC (22:46–22:47 Europe/Paris)**. Dernier commit consulté : `d8aeac7e0873af4084b5749e0db772e34014ed85`. Migration ops testée non encore intégrée par ce sous-agent : SHA-256 `8eee4a62edec24d10da34b4763bae2cf94fedd861c181237c83ac5663c1a2238`. SQL de test ops : SHA-256 `4646b2e1fd081c828fad9ae5d1487d163923dc48755ca9624cebca1b3eaed2aa`.

## Environnement de preuve

Container **`lkdv-v2-test`**, port **127.0.0.1:55432** ; PostgreSQL **17.11**, PostGIS **3.5.7**, pgTAP **1.3.4**, pg_cron **1.6.7** et vrai runner **pg_prove 3.36**. Image `postgis/postgis:17-3.5-alpine`, digest `sha256:894f570c0cf0664ed5576a8fd5d5bfb8fb1b19d592885b686c3a88c8bd90c41f`. Daemon, driver vfs, proxy et vérification TLS conservés. L'image Supabase complète avait échoué faute d'espace ; l'image retenue est de 527 MB et a permis la preuve SQL sans migration d'infrastructure produit.

Le harnais auth contient les rôles anon/authenticated/service_role, les fonctions `auth.uid/role/jwt` lisant les claims PostgreSQL et une table auth.users locale. Les fonctions métier, triggers, transactions, verrous, grants et RLS sont réellement exécutés par PostgreSQL. Ce harnais **ne prouve pas GoTrue/PostgREST ou un parcours appareil**. La stack HTTP réelle et le clone `lkdv_producers` sont confiés séparément au sous-agent responsable ; ne pas compter ses tests avant son rapport.

Les sources pgTAP/pg_cron et le runner ont été téléchargés depuis leurs archives officielles. Les extensions ont été compilées réellement ; `with_llvm=no` a seulement évité la génération facultative de bitcode LLVM avec un clang absent. Aucun remplacement de fonction pgTAP, contournement `check_function_bodies` ou suppression d'assertion n'a servi à obtenir une réussite.

## Rejeu strict des migrations

Baseline officielle `supabase/baseline/prod_schema_20260911.sql`, intégration auth et grants appliqués avec `ON_ERROR_STOP=1`, puis migrations du dépôt. Le baseline public omet les policies Storage : leur section canonique du 31 août a été reprise exactement dans le harnais local, avec schema/table Storage minimaux, pour satisfaire la migration de vérification du 25 septembre.

Le premier rejeu s'est arrêté réellement sur `20260929010000_route_persist.sql` : provider et payload étaient inversés dans VALUES, produisant une erreur de type text/jsonb. L'orchestrateur a synchronisé cette ligne historique avec la définition correcte déjà présente en production (décision D05). Le rejeu a ensuite passé cette migration et la chaîne restante sans ignorer le contrôle SQL.

Ledger local final : **285 versions**, soit **143 baseline + 141 migrations post-baseline existantes + nouvelle migration ops**. I1/I1bis/I2/I4/I5 locaux appliqués. Les versions réellement appliquées en production ont été vérifiées par l'orchestrateur via management/SQL ; aucun push ou réparation de ledger distant par ce sous-agent.

Scripts de travail : `scripts/ops/progression_v2_local_db.mjs` pour le rejeu strict et `scripts/ops/progression_v2_local_db_restore.mjs` pour la restauration dédiée localhost. Le premier refuse une migration vide ; aucun fichier en cours d'écriture n'est marqué comme appliqué.

## T01 — Restauration comparée des points

Snapshot privé source `backups/progression-v2-2026-10-10T16-48-07-956Z/`, 18 tables, captures REST en lecture seule et profils minimisés. La base **`lkdv_restore`** a reçu le schéma et les extensions réels, puis chaque table capturée sous une seule transaction de chargement. Pendant ce chargement seulement, les triggers/FK ont été neutralisés par `session_replication_role=replica`. Les profils auth utilisent des emails synthétiques locaux ; aucune identité privée supplémentaire n'a été exportée.

Résultat : **18/18 tables restaurées, comptages exacts, zéro différence `EXCEPT ALL` entre lignes attendues et lignes PostgreSQL typées**. Hachages de chaque fichier vérifiés avant insertion. Profils comparés sur les quatre colonnes capturées ; les journaux/règles/projections sur toutes les colonnes. Preuve privée : `restore-evidence.json`.

Limites explicites : snapshot économique partiel, pas une restauration de toute l'application ; capture REST initiale non transactionnelle. La preuve ici porte sur les soldes, leurs journaux et les tables de progression conservées. Aucun test de restauration complète auth/commandes/documents privés revendiqué.

## T02/T03 — Tests SQL et rollback économique

Vrai pg_prove, base isolée, suites stockées dans le dépôt :

| Contrôle | Résultat réel |
|---|---|
| Phase1 + noyau canonique, premier passage | 11 suites, **142 tests réussis** |
| Cache + Phase1 + ensemble progression existant | 20 suites, **289 tests réussis** |
| Ops renforcé : poison, backoff, dead, recovery | 1 suite, **32 tests réussis** |
| Contrôle final après reprise : cache, quatre Phase1, ops | 6 suites, **136 tests réussis**, exit 0 |

Phase1 couvre les colonnes protégées, profil ordinaire, écritures journal/commandes refusées, RPC clientes interdites, virement pending sans gain, confirmation et idempotence. Les tests demo/rebuild vérifient l'exclusion et le rejeu sans crédit supplémentaire. La suite cache ajoute neuf assertions : insert, provider text, payload JSON, lecture, upsert et privilèges clients.

Le down historique I4 a été **simulé dans une transaction locale ensuite annulée** : 33 transactions avant, 31 après suppression de deux écritures de provenance ; **un écart compte/journal apparaît**. La restauration est demeurée intacte après ROLLBACK. La lecture des downs I1/I2 montre également réouverture de droits/effacement d'ouvertures ou retrait de `is_demo`. **Ces descentes ne constituent donc pas un rollback production admissible au mandat actuel.** Le rollback application et la désactivation des nouveaux jobs doivent préserver ces protections et les journaux.

## T04 — Consumers sur la restauration réelle

Appels SQL réels sur `lkdv_restore`, aucune production :

| Compteur | Avant | Après outbox + refresh |
|---|---:|---:|
| Transactions | 33 | 33 |
| Somme points journal transactions | 11890 | 11890 |
| Événements XP | 15 | 15 |
| Somme événements XP | 9400 | 9400 |
| Projection lifetime | 9400 | 9400 |
| Refresh leaderboard pending | 9 | 0 |

Outbox : processed=0, failed=0. Leaderboard : processed=9, failed=0. Preuve privée `consumer-evidence.json`. La reprise des neuf refresh ne crée aucun gain ni événement.

## T04 — Planification, panne et reprise observées

La migration `20261010165856_progression_ops_scheduled_consumers.sql` est réellement appliquée localement. Deux jobs réels, outbox toutes les cinq minutes, refresh toutes les quinze ; lots 50/100, timeout 50 secondes. Wrapper propriétaire `lkdv_progression_job` NOLOGIN/NOINHERIT/NOBYPASSRLS, journal privé RLS, aucun accès client aux fonctions/jobs.

Le test ops renforcé provoque une **vraie exception de trigger d'agrégat**, sans mock du consumer : l'exception n'efface plus attempts ; délai de reprise conservé ; une ligne saine est traitée malgré la ligne fautive ; cinq échecs mènent à dead ; dead n'est pas repris automatiquement ; une nouvelle transition de projection réinitialise la file et récupère la ligne. Les réponses du wrapper et son journal succeeded/degraded sont vérifiés, pas seulement `lives_ok`. Aucun événement XP ou transaction économique issu du refresh.

Preuve d'interruption réelle à **20:46:38 UTC** : `cron.use_background_workers=off`, connexion libpq locale par socket, `cron.log_run=on`. Pour une observation bornée, le seul job outbox local a temporairement reçu une fréquence d'une seconde et un timeout de 150 ms. Un verrou détenu par une autre session a arrêté le consumer pendant l'actualisation de projection. `cron.job_run_details` a enregistré **failed / canceling statement due to statement timeout**. Le journal interne ne garantit pas une ligne quand la transaction entière est annulée : la preuve de timeout vient du journal du scheduler.

| Fixture de panne locale | Avant panne | Après timeout | Après libération + retry | Après replay |
|---|---:|---:|---:|---:|
| Transactions | 2 | 2 | 2 | 2 |
| Événements | 1 | 1 | 2 | 2 |
| XP projetées | 40 | 40 | 80 | 80 |
| Outbox pending | 1 | 1 | 0 | 0 |

La source/transaction de la deuxième action reste durable lors de l'arrêt, aucun événement partiel ou double gain ; le replay traite zéro ligne. Les fixtures locales ont ensuite été supprimées, et la commande d'origine avec cadence cinq minutes restaurée. Preuve privée : `crash-recovery.json`.

La descente **ops seule** a ensuite retiré les deux jobs : zéro job correspondant, **67 journaux conservés**, zéro transaction/événement local perdu. Réapplication : deux schedules exacts cinq/quinze minutes, mêmes 67 journaux. Preuve : `ops-down-up.json`. Ce down conserve aussi les fonctions de reprise corrigées et les droits existants.

## Artefacts et limites restantes

Les logs et résultats sont copiés dans le répertoire privé ignoré Git avec permissions 0600 ; `local-verification-manifest.json` donne leurs SHA-256. Aucun identifiant individuel ou ligne de journal privé exposé dans ce rapport.

Ce travail est **implémenté/testé localement** ; il ne constitue pas un déploiement ou une activation production. La production n'a reçu aucune écriture de ce sous-agent. L'orchestrateur conserve l'application progressive de la migration ops après ses gates, le bilan global de stabilisation et les tâches suivantes. Les validations mobiles/appareil, backup global, financement/population et API HTTP réelle restent des preuves distinctes.

Complément reçu après consolidation : [preuve HTTP des sept producteurs](p0-producers-http.md) réalisée par `level_presentation` sur **lkdv_producers**, GoTrue officiel et PostgREST : **9/9 tests exécutés, aucun ignoré**. Cette preuve lève le skip de l'intégration v1 sur son clone ; elle ne change pas les limites du harnais SQL décrit ici et ne valide pas les futures intentions/quotas v2. Les containers API restent disponibles ; ne pas redémarrer le container DB sans coordination avec leur propriétaire.
