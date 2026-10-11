# Revue indépendante P0/T04 — jobs SQL et reprise locale

10 octobre 2026, Europe/Paris. Revue de fichiers locaux dans
`/workspace/kitduvoyageur_1783951966810`, sans exécution SQL, appel distant,
test relancé, commit ou modification du code. Seul ce rapport est écrit.

Périmètre : migration `20261010165856_progression_ops_scheduled_consumers`,
down, pgTAP `progression_ops_jobs.test.sql`, deux scripts locaux de replay et
restauration, correction provider/payload de `route_persist.sql`. Les fonctions
consommées et protections existantes sont lues pour comprendre les privilèges
effectifs et la reprise ; elles ne sont pas proposées comme nouveau barème.

## Verdicts

**Conformité : activation production T04 à retenir jusqu'à correction de la
reprise leaderboard et preuves de panne/reprise.** La migration n'émet pas de
nouvelles transactions économiques, ne recalcule pas les soldes et ne modifie
pas les anciens droits. Elle planifie les consumers existants, dont un défaut
de retry est toutefois exposé par la nouvelle activation périodique.

**Qualité : changements demandés sur le retry et les assertions pgTAP.** La
structure du wrapper, les lots 50/100 et le down sont cohérents. Les tests en
cours de l'agent DB ne sont pas déclarés réussis par cette revue.

## Constats concrets

**[P1] La nouvelle planification leaderboard active un retry sans borne et une
transition d'erreur perdue.** L'appel est introduit à
`supabase/migrations/20261010165856_progression_ops_scheduled_consumers.sql:50`
et programmé à `:69`. Dans le consumer existant
`supabase/migrations/20260920109000_leaderboard.sql:245`, la mise à jour
`processing` et l'incrément `attempts` sont dans le bloc dont l'exception annule
les effets. Si `refresh_leaderboard_for_user` échoue, la ligne revient à son
état `pending`/`failed` initial, puis l'UPDATE à `:259` utilise à nouveau
`WHERE status='processing'` et ne trouve plus cette ligne. La tentative et
son état ne sont donc pas enregistrés. Le SELECT à `:238` n'a aucune limite
de tentatives ni délai de reprise ; le job reconsidère indéfiniment les mêmes
premières lignes par ancienneté. Cent lignes empoisonnées peuvent monopoliser
le lot et empêcher la suite d'être traitée.

Ce défaut préexiste dans le consumer : il n'est pas une nouvelle mutation de
droits introduite par ce patch, mais empêche de valider la condition T04 de
reprise bornée avant activation du nouveau job. Corriger additivement les
tentatives persistées après exception, le backoff/état final et la récupération
explicite ; tester une erreur déterministe, une erreur temporaire et la
progression du reste de la file. À défaut, garder cette activation fermée.

**[P2] Le test d'exécution réussit même si les consumers ne peuvent pas tourner.**
`supabase/tests/database/progression_ops_jobs.test.sql:11` vérifie seulement
`lives_ok`, et `:12` seulement deux entrées avec `finished_at`. Le wrapper
capture les erreurs à `20261010165856_progression_ops_scheduled_consumers.sql:54`
et termine alors avec `status='failed'`. Deux appels refusés par permissions
ou indisponibles satisfont donc ces assertions. Vérifier le statut et le
résultat attendus, avec une fixture canonique qui prouve un événement créé
puis stable au replay, et contrôler les privilèges effectifs du rôle job.

## Points vérifiés à la lecture

- Le rôle neuf est NOLOGIN, NOINHERIT et NOBYPASSRLS. Le wrapper est possédé
  par ce rôle et SECURITY DEFINER, avec search_path fixé ; les deux noms de
  consumers sont qualifiés. Il possède usage public, execute des deux
  consumers, accès limité à son journal privé et sa séquence. Les consumers
  sont eux-mêmes SECURITY DEFINER avec propriétaires existants : le wrapper
  ne remplace pas leurs propriétaires ni leur sécurité. Le rôle n'obtient
  aucune table économique en écriture ni RPC d'attribution supplémentaire.
- Le journal a RLS, une policy du seul rôle job et aucun accès client au
  schéma/wrapper. Les erreurs ordinaires peuvent être enregistrées après
  rollback du bloc consumer ; l'opération reste transactionnelle.
- Les jobs cron restent des connexions du rôle qui applique la migration
  (postgres attendu), puis le wrapper adopte son propriétaire. Un rôle
  NOLOGIN n'est pas utilisé comme connexion cron, ce qui est compatible avec
  `cron.use_background_workers=off`. Cela ne prouve pas l'authentification
  libpq ni le schedule effectif : vérifier cron.job.username, un run réel et
  cron.job_run_details en production avant de déclarer l'exploitation saine.
- `statement_timeout=50s` borne chaque appel. Une annulation ou un arrêt de
  backend annule aussi l'INSERT job_runs ; `WHEN OTHERS` ne capture pas
  query_canceled. Le log cron indépendant est donc nécessaire pour la preuve
  de crash, avec `cron.log_run` réellement activé. Aucun état running privé
  persistant ni reprise prouvée n'est déduit de cette transaction.
- Le down retire uniquement les deux schedules nommés. Il conserve journaux,
  protections, projections et droits ; aucun changement de solde ni ouverture
  de privilège client n'est ajouté.
- La correction historique `route_persist.sql:135` aligne les valeurs sur les
  colonnes `(provider, payload)` ; la relecture ne propose pas de rejouer cette
  ancienne migration en production, où la fonction est annoncée correcte.
- Le replay cible seulement le conteneur nommé `lkdv-v2-test`, avec une liste
  fermée de trois bases, ON_ERROR_STOP et marquage après réussite stricte. La
  restauration cible localhost:55432/lkdv_restore, vérifie hashes et égalité
  multiensembles typée, dans une transaction. Son DELETE et désactivation
  locale de triggers sont des opérations de fixture isolée ; aucun URL ou
  secret distant n'est consommé. Les stubs Auth ne valent pas test réel des
  sept producteurs par HTTP.

La validation et l'observation restantes relèvent de l'agent DB et de
l'orchestrateur. Les constats sont transmis avant toute production ; aucune
restauration, panne, réparation de backlog ou activation n'est revendiquée ici.

## Relecture du correctif en cours

Le correctif additif lu dans la migration remplace désormais le batch
leaderboard : le handler incrémente les tentatives par id après rollback du
bloc, garde last_error, applique un délai exponentiel, sélectionne uniquement
les lignes dues et arrête à cinq tentatives avec état dead. Le trigger
d'enqueue remet une ligne en attente quand une nouvelle projection le demande.
**Constat P1 retry : traité à la lecture du code, preuves SQL encore attendues.**

L'état dead ajouté exigeait un complément de supervision : sans compteur
leaderboard.dead, une file uniquement dead devenait faussement saine. Ce
constat additionnel a été transmis puis corrigé dans
`scripts/ops/progression_outbox_health.mjs` : six comptages HEAD exacts, retour
leaderboard.dead et ok=false si ce compteur est positif. Le test spécifique
garde cet état dégradé sans pending/failed. **Constat de supervision dead :
traité à la lecture** ; les six tests Node réussis sont rapportés par
l'orchestrateur, sans réexécution ici.

Le pgTAP initial n'est pas encore remplacé au dernier relevé du reviewer.
**Constat P2 assertions : ouvert jusqu'à lecture des nouvelles assertions.**
Les verdicts finaux attendent ce contrôle et les preuves de l'agent DB. Les
logs de crash attendus sont bien `cron.job_run_details`, distincts du journal
job_runs transactionnel qui peut être annulé.

## Verdict final de la tranche locale corrigée

Le pgTAP courant est passé de 10 à 32 assertions. Les appels outbox vérifient
maintenant failed=0 et des runs succeeded ; la fixture leaderboard provoque
une erreur réelle à l'INSERT d'agrégat, démontre la persistance de attempts,
last_error/backoff, le traitement de la ligne saine, cinq échecs puis dead,
l'absence de retry automatique, la reprise sur projection nouvelle et les
runs degraded/succeeded. Elle vérifie aussi zéro événement XP et zéro
transaction économique pour ces comptes. **Constat P2 assertions : traité.**

Preuves lues, non réexécutées : `/tmp/lkdv-v2-db/ops-pgtap.log` rapporte
**32 assertions, PASS** ; les avertissements d'options du lanceur pg_prove
précèdent ce résultat et ne sont pas présentés comme échecs SQL.
`/tmp/lkdv-v2-db/cron-observed.json`, daté 17:03:45 UTC, rapporte trois runs
succeeded de chaque wrapper, les logs cron correspondants et le rétablissement
des schedules 5/15 minutes après une observation locale accélérée à une seconde.
Il indique expressément background_workers=on : cette preuve locale ne
certifie pas le mode libpq background_workers=off de production. Elle ne
contient pas non plus de run interrompu ; la preuve de crash reste distincte.
Les six tests Node de santé réussis demeurent rapportés par l'orchestrateur.

**Verdicts finaux : conformité et qualité acceptables pour intégration de cette
tranche corrigée ; aucun défaut de code actionnable restant relevé.** Les
trois constats transmis (retry, assertions, supervision dead) sont traités.
Cet accord de revue concerne le code et les preuves locales disponibles ;
il ne constitue pas une déclaration de déploiement ni d'exploitation saine
en production. Avant activation/déclaration T04 complète, conserver les
contrôles prévus de username cron, connexion libpq réelle, interruption/reprise
avec logs cron, restauration/down et état du pipeline.
