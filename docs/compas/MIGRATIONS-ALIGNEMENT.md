# Migrations — alignement dépôt ↔ registre de production

> PLAN-100, phase 9 : « Historique des migrations aligné dépôt ↔ base (versions divergentes du
> 4 octobre) ». Rédigé le 18 octobre 2026 sur la branche `claude/compas-p1-referentiel`,
> **sans accès à la base** : tout ce qui suit vient du dépôt (fichiers, commits, `ETAT.md`,
> `PLAN-100.md`). Aucun état de la base n'est affirmé ici ; ce qui doit être lu en base est
> dit « à vérifier ».

## 1. Ce que le dépôt sait (vérifié dans les fichiers)

- `supabase/migrations/` : **367 fichiers**, une version par fichier (test
  `tests/ops/migrationVersions.spec.ts`). Mêmes fichiers que `origin/main` au 18 oct., plus les six
  migrations des référentiels du 17 oct. (`20261017120000_geo_trails` à `20261017140000_geo_places_search`).
- `supabase/baseline/applied_migrations.txt` : **143 versions** de production intégrées à la
  baseline du 11 sept. (`prod_schema_20260911.sql`), de `20260710110000` à `20260911120000`. Les
  143 ont un fichier, et aucun fichier antérieur au 11 sept. n'est hors de cette liste
  (comparaison faite le 18 oct.). Les **224 fichiers suivants** sont rejoués par `database-gates`
  (`scripts/db/ci/install.sh`) sur une base jetable, jamais sur la production.
- Hors du flux `supabase db push` (à dessein) : `migrations_deferred/` (4 fichiers, dont
  `20261017000000_kit_attribution_reverse_bounded.sql`, **non appliqué** selon `ETAT.md`) et
  `migrations_frozen/20260903050000_kit_attributions.sql` (gelé, juridique).

## 2. Écarts connus

### 2.1 Les versions du 4 octobre et les correctifs passés en direct (traité le 13 oct.)

Le commit `2867f02a` (Tony, 13 oct.) a réintégré **14 fichiers `*_hotfix.sql`** reconstruits
depuis `supabase_migrations.schema_migrations` (« historique remote réaligné ») : `20260920095523`,
`20260930172335`, `20260930172358`, `20261001060957`, `20261001105214`, `20261002162802`,
**`20261004122953`, `20261004125021`, `20261004153524`, `20261004153525`, `20261004155324`** (les
cinq « versions du 4 octobre »), `20261012142746`, `20261012143322`, `20261013004818`. Le même
commit ajoute deux migrations nommées (`20260926010115_rls_role_helper_execute`,
`20260930172420_trajectoire_functions_security_invoker`).

Ce qui reste ouvert :

| # | Écart | Source | Risque |
|---|---|---|---|
| A | **`20261005090000`** : version inscrite au registre **sans SQL** (« fantôme vide », dit le message de `2867f02a`). Elle vient du POC `pays-minichat` du 4 oct. (`594162f3`, branche `poc/pays-minichat`, renommé ensuite `20261005120000_pays_chat_embeddings`, **absent** du dépôt). Le message dit la version « documentée » : aucun document du dépôt ne la nomme. | commits `2867f02a`, `594162f3` | Faible : rien à rejouer. `supabase db push` / `migration list` la montre comme « distante seulement ». |
| B | **Doublon** `20261012100000_adventure_events_claim_lease.sql` (fichier nommé) et `20261012142746_hotfix.sql` (version du registre, même SQL au caractère près hors l'en-tête, vérifié par `diff`). `PLAN-100.md` 1.1 : appliquée sous `20261012142746`. | fichiers, `PLAN-100.md` | Moyen : si le registre n'a pas `20261012100000`, un `db push` la rejoue. Le SQL est rejouable (`IF NOT EXISTS`, `CREATE OR REPLACE`), à confirmer avant. |
| C | **Doublon** `20261013040000_legacy_loyalty_search_path.sql` et `20261012143322_hotfix.sql` (le fichier nommé se dit lui-même « reprise du hotfix … version distante 20261012143322 »). `ETAT.md` dit ce doublon « retiré » le 13 oct. : **le fichier est toujours là**. | fichiers, `ETAT.md` | Faible : une ligne idempotente (`alter function … set search_path = ''`). |

### 2.2 Migrations appliquées par le connecteur (version d'application ≠ version du fichier)

`apply_migration` (connecteur Supabase) inscrit au registre **l'heure d'application**, pas la
version du fichier : c'est ce qui a produit B (fichier `20261012100000`, registre `20261012142746`).
Ont été appliquées ainsi ou par le SQL Editor, d'après `ETAT.md` et `PLAN-100.md`, **versions au
registre non relevées dans le dépôt** (à vérifier) :

- `20261014090500_geo_pois` (appliquée, table remplie le 18 oct.) ;
- `20261017120000_geo_trails`, `20261017130000_geo_sites`, `20261017131000_geo_rivers`,
  `20261017132000_geo_areas`, `20261017133000_geo_massifs`, `20261017140000_geo_places_search`
  (« appliqué le 17 oct., relu en base ») ;
- toute migration passée par le **SQL Editor** n'est **pas** inscrite au registre du tout.

### 2.3 Migrations dont l'application n'est pas établie

`ETAT.md` les donne « à passer par Tony » sans preuve ultérieure dans le dépôt :
`20261008190000_base_scheduled_purges`, `20261009100000_app_errors_purge`,
`20261010100000_user_traveller` (sonde `scripts/verify/user_traveller_rls_probe.sql`). Leur état en
base est **inconnu ici**.

## 3. Outil (lecture seule)

`scripts/db/migrations-alignment.mjs` compare `supabase/migrations/` à un **export** du registre,
sans se connecter à rien (tests : `tests/ops/migrationsAlignment.spec.ts`). Il classe :
alignées ; **même nom, version différente** (renommer le fichier) ; fichiers sans ligne au
registre ; lignes sans fichier ; versions `deferred`/`frozen` déjà au registre. Il ne propose
jamais de rapprochement quand un nom est ambigu (ex. les `hotfix`).

## 4. Procédure sûre pour Tony

Rien de ce qui suit n'écrit en base avant l'étape 4, et l'étape 4 n'écrit que dans le registre.

1. **Exporter le registre** (SQL Editor, lecture seule) puis télécharger le résultat en CSV :
   ```sql
   select version || ',' || coalesce(name, '')
   from supabase_migrations.schema_migrations
   order by version;
   ```
   (ou `PROD_DB_URL=… node scripts/db/fetch-prod-ledger.mjs registre.txt`, versions seules : les
   renumérotations ne sont alors pas reconnues).
2. **Comparer** : `node scripts/db/migrations-alignment.mjs registre.csv`. Garder la sortie.
3. **Trancher fichier par fichier, dans le dépôt seulement** (une PR, CI `database-gates` verte) :
   - « même nom, version différente » → renommer le fichier à la version du registre
     (`git mv`), comme `geo_pois` le 13 oct. ;
   - doublons B et C → garder le `*_hotfix.sql` (version du registre) et retirer le fichier
     nommé **seulement si** sa version n'est pas au registre ; sinon les garder tous deux ;
   - « ligne sans fichier » → reconstruire un `<version>_hotfix.sql` depuis la colonne
     `statements` du registre (comme `2867f02a`), ou, pour un fantôme sans SQL comme
     `20261005090000`, l'écrire dans ce fichier ;
   - « fichier sans ligne » → vérifier en base que ses objets existent (`\d`, `pg_proc`,
     `pg_policies`) : présents → étape 4 ; absents → c'est une migration en attente
     (2.3) : l'appliquer **sur une copie d'abord**, puis par le SQL Editor.
4. **Inscrire au registre ce qui est déjà en place** (n'exécute aucun SQL de migration) :
   `npx supabase migration repair --status applied <version> --linked`, une version à la fois,
   uniquement pour les fichiers dont l'étape 3 a prouvé les objets.
5. **Contrôle final** : rejouer l'étape 2 → « Aucun écart. » (les `deferred` et `frozen`
   restent hors du dépôt actif). Ne jamais lancer `supabase db push` avant ce résultat : il
   appliquerait chaque fichier sans ligne au registre.

## 5. Ce qui n'est pas fait ici

- Aucune lecture du registre de production (pas d'accès depuis la session) : la liste réelle
  des écarts sort de l'étape 2.
- Aucun fichier de migration renommé ni retiré : sans le registre, ce serait deviner.
