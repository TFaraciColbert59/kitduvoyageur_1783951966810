# Application en production — Communauté v2 (à faire par Tony / le Lead)

État au 2026-11-08 : **aucune migration appliquée en prod**. Le workflow `db-backup.yml` a été
déclenché (run 42482429006, vert) mais **n'a produit aucun artefact** : le secret
`BACKUP_PASSPHRASE` est absent du dépôt (seuls `SUPABASE_DB_URL`, `CAPACITOR_SERVER_URL`,
`GEO_POIS_IMPORT` existent). Conformément à `00 § 5` / `06 § 3.1`, on ne touche pas la prod tant
qu'aucun dump vérifiable n'existe.

Projet : `icxyvwzfjbflcbqukpfz` (Postgres 17) · registre au 2026-11-08 : 377 versions, max
`20261108000000` (export : `/tmp/prod-ledger.txt`, 377 lignes triées).

## Séquence exacte

### 1. Poser le secret de sauvegarde
GitHub → Settings → Secrets and variables → Actions : ajouter `BACKUP_PASSPHRASE` (valeur fournie
par Tony, jamais dans le dépôt).

### 2. Sauvegarde vérifiée (bloquant)
```bash
# déclencher
curl -s -X POST -H "Authorization: Bearer $GH_TOKEN" \
  https://api.github.com/repos/TFaraciColbert59/kitduvoyageur_1783951966810/actions/workflows/db-backup.yml/dispatches \
  -d '{"ref":"main"}'
# attendre la fin, puis :
gh run download <run-id> -n sauvegarde-base      # ou API artifacts
ls -l sauvegarde-base/*.dump*                     # contrôler : daté d'aujourd'hui + taille non nulle
```
**Sans artefact daté du jour : arrêt** (`00 § 5`).

### 3. Appliquer, fichier par fichier (phase 1)
```bash
export PROD_DB_URL='postgresql://postgres:<mdp>@db.icxyvwzfjbflcbqukpfz.supabase.co:5432/postgres'
cd supabase/migrations
for f in 20261108130001_communaute_v2_lot_a_search.sql \
         20261108130002_communaute_v2_lot_b_geo_feeds.sql \
         20261108130003_communaute_v2_lot_c_events_columns.sql \
         20261108130004_communaute_v2_lot_d_clubs_membership.sql \
         20261108130005_communaute_v2_lot_e_atomic_creations.sql \
         20261108130006_communaute_v2_lot_f_stories.sql; do
  psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -1 -f "$f" || { echo "ECHEC $f — STOP"; break; }
done
```
Puis, **uniquement après revue `05 § 3` et pgTAP verts** (phase 2) :
```bash
psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -1 -f 20261108130007_communaute_v2_phase2_event_waitlist.sql
psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -1 -f 20261108130008_communaute_v2_phase2_clubs_privacy.sql
```
`-1` = une transaction par fichier ; un échec n'applique rien du fichier. Ne pas utiliser
`supabase db push` (registre en retard : il rejouerait des fichiers déjà passés, `06 § 3.2`).

### 4. Aligner le registre (après succès)
```sql
insert into supabase_migrations.schema_migrations(version, name) values
  ('20261108130001','20261108130001_communaute_v2_lot_a_search'),
  ('20261108130002','20261108130002_communaute_v2_lot_b_geo_feeds'),
  ('20261108130003','20261108130003_communaute_v2_lot_c_events_columns'),
  ('20261108130004','20261108130004_communaute_v2_lot_d_clubs_membership'),
  ('20261108130005','20261108130005_communaute_v2_lot_e_atomic_creations'),
  ('20261108130006','20261108130006_communaute_v2_lot_f_stories'),
  ('20261108130007','20261108130007_communaute_v2_phase2_event_waitlist'),
  ('20261108130008','20261108130008_communaute_v2_phase2_clubs_privacy')
on conflict (version) do nothing;
```
Si le connecteur MCP applique un fichier avec une autre version, inscrire **la version réellement
appliquée** (contrôler `pg_proc`/`information_schema` avant, le fichier est idempotent).

### 5. Contrôles post-application (lecture seule)
```sql
-- Objets présents
select proname from pg_proc where proname in
 ('lkdv_norm','community_search','community_search_trending','community_carnets_feed',
  'community_clubs_feed','community_events_feed','community_events_agenda','join_club','leave_club',
  'cancel_join_request','review_join_request','check_club_slug','create_club_with_admin',
  'create_event_with_post','create_kit_with_items','create_carnet_v2','create_community_post');
select column_name from information_schema.columns
 where table_schema='public' and table_name='events'
   and column_name in ('starts_at','club_id','kit_id','level');
select column_name from information_schema.columns
 where table_schema='public' and table_name='event_participants' and column_name='status';
select column_name from information_schema.columns
 where table_schema='public' and table_name='clubs' and column_name='rules';
select column_name from information_schema.columns
 where table_schema='public' and table_name='community_posts' and column_name='creation_meta';
select count(*) from pg_indexes where schemaname='public'
 and indexname in ('uq_clubs_client_req','uq_events_client_req','uq_kits_client_req',
                   'uq_carnets_client_req','idx_community_posts_tags','idx_community_posts_place_geom',
                   'idx_events_starts_at','idx_events_club_id','idx_events_kit_id');
-- Plan de la recherche (jamais ANALYZE sur la prod)
explain select * from public.community_search('chamonix', 'all', 5, 0, null, null, '{}'::jsonb);
-- Policies inchangées (clubs/events/participants) + nouvelles policies éventuelles
select tablename, policyname from pg_policies
 where schemaname='public' and tablename in
  ('clubs','events','event_participants','community_posts','carnets','post_stories');
```
Puis : advisors Supabase (sécurité + performance) et comparaison avec le relevé *avant*
`/tmp/advisors-before.txt` (2026-11-08). Deltas attendus, à expliquer dans le rapport :
- `authenticated_security_definer_function_executable` **+9** : les 9 RPC d'écriture
  (join/leave/cancel/review + 5 `create_*`), toutes avec `auth.uid()` + `is_anonymous` vérifiés —
  c'est le patron exigé par le bundle ; les helpers `lkdv_*` sont révoqués.
- `anon_security_definer_function_executable` **inchangé** : les RPC de lecture sont
  `security invoker` ; aucun helper définer accordé à anon.
- `unused_index` (INFO) peut augmenter (~15 index neufs sans usage) : sans risque, surveiller.
- `unindexed_foreign_keys` : pas d'ajout (events.club_id / events.kit_id indexés).
- `function_search_path_mutable` : pas d'ajout (toutes les nouvelles fonctions ont `search_path`).

Vérifier enfin que les tiroirs v1 (`/communaute`, `/clubs/[id]`, `/communaute?tab=evenements`,
`/compte`) fonctionnent toujours.

### 6. Retour arrière
- Fichier en échec ou objet jamais utilisé : `.down.sql` correspondant dans l'ordre **inverse**
  (`130008` → `130001`), chacun avec `psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -1 -f`.
  Les `.down` refusent de supprimer une colonne qui contient des données (contrôle automatique) —
  après le premier usage réel, on ne supprime rien (`06 § 3.5`).
- Après usage réel : `NEXT_PUBLIC_COMMUNAUTE_V2=false` sur Production puis redéploiement Vercel
  (les tiroirs v1 reviennent) ; ne restaurer que les corps de fonctions de la phase 2 si revue
  d'incident.
