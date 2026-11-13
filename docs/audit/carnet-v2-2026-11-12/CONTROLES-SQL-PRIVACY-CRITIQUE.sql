-- ============================================================================
-- Carnet v2 — contrôles SQL de la revue privacy de `eff7db1`
-- ============================================================================
-- Fichier de contrôle, NON exécuté dans la session de correction.
-- À jouer sur une copie / un environnement de recette, puis en production
-- après sauvegarde. Les blocs d'attaque sont dans une transaction annulée.
--
-- Prérequis : psql, rôle assez privilégié pour lire pg_policies et le registre
-- Supabase. Remplacer les UUID `:<...>` par ceux de la fixture de recette.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Inventaire des policies sensibles
-- ----------------------------------------------------------------------------
select schemaname,
       tablename,
       policyname,
       cmd,
       roles,
       qual,
       with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'carnets',
    'carnet_collaborators',
    'carnet_moments',
    'carnet_kit_items',
    'carnet_nights',
    'carnet_live_positions',
    'hike_sessions',
    'hike_session_participants'
  )
order by tablename, cmd, policyname;

-- Attendu après 20261112121000 + 20261112122000 :
--   • aucune policy nommée carnet_collab_manage, carnet_collab_read,
--     "Public read carnet_collaborators" ;
--   • aucune policy auth_manage_carnet_moments ;
--   • aucune policy public_read_carnet_moments / public_read_carnet_kit_items ;
--   • une seule policy SELECT sur hike_sessions
--     (hike_sessions_select_owner_or_participant) ;
--   • hike_participants_owner_write absente, remplacée par
--     hike_participants_owner_insert/update/delete.

select policyname, cmd
from pg_policies
where schemaname = 'public'
  and (
    policyname in (
      'carnet_collab_manage',
      'carnet_collab_read',
      'Public read carnet_collaborators',
      'auth_manage_carnet_moments',
      'public_read_carnet_moments',
      'public_read_carnet_kit_items',
      'seed_public_read_carnet_moments',
      'seed_public_read_carnet_kit_items',
      'hike_participants_owner_write'
    )
  )
order by policyname;
-- Attendu : 0 ligne.

-- ----------------------------------------------------------------------------
-- 2. Vérifier les expressions réellement déployées, pas seulement les noms
-- ----------------------------------------------------------------------------
select tablename,
       policyname,
       cmd,
       pg_get_expr(polqual, polrelid)       as using_expr,
       pg_get_expr(polwithcheck, polrelid)  as check_expr
from pg_policies
where schemaname = 'public'
  and tablename in ('carnet_collaborators', 'carnet_moments', 'carnet_kit_items', 'hike_sessions')
order by tablename, policyname;

-- Attendu :
--   • carnet_collaborators : INSERT/UPDATE/DELETE avec exists(... carnets.author_id = auth.uid()) ;
--   • carnet_moments : écriture avec is_carnet_editor(carnet_id) ;
--   • hike_sessions : SELECT avec user_id = auth.uid() ou participants ;
--   • hike_session_participants : pas de policy FOR ALL propriétaire.

-- ----------------------------------------------------------------------------
-- 3. Helpers : SECURITY DEFINER et search_path verrouillé
-- ----------------------------------------------------------------------------
select n.nspname,
       p.proname,
       p.prosecdef,
       p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_carnet_editor', 'is_carnet_participant', 'can_view_carnet', 'can_view_hike_session')
order by p.proname;

-- Attendu : prosecdef = true et proconfig contient search_path=public.

-- ----------------------------------------------------------------------------
-- 4. Registre des migrations (F7 — renumérotation 121200/121210/121220)
-- ----------------------------------------------------------------------------
select version, name
from supabase_migrations.schema_migrations
where version in ('20261112120000', '20261112121000', '20261112122000')
order by version;

-- Attendu :
--   • au plus une ligne pour 20261112120000, et elle doit être la migration
--     `explorer_v2_activity_finish_hardening` (branche a01-session), jamais une
--     ancienne migration carnet ;
--   • une seule ligne 20261112121000 et une seule 20261112122000 ;
--   • si 20261112122000 a déjà été appliquée AVANT la présente correction,
--     les nouveaux DROP/CREATE de cette version ne seront pas rejoués :
--     appliquer un forward-fix explicite (nouvelle version) ou rejouer le SQL
--     de durcissement, puis revérifier les sections 1 et 2.

-- ----------------------------------------------------------------------------
-- 5. Cycle RLS hike_sessions <-> hike_session_participants (F3)
-- ----------------------------------------------------------------------------
-- Remplacer :<session_id> et :<participant_uid>.
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = ':<participant_uid>';
select count(*) as sessions_lues
from public.hike_sessions
where id = ':<session_id>';
select count(*) as participants_lus
from public.hike_session_participants
where session_id = ':<session_id>';
rollback;
-- Attendu : aucune erreur 42P17. Le participant lit sa sortie et sa ligne.

-- ----------------------------------------------------------------------------
-- 6. Auto-promotion collaborateur (F1) — transaction annulée
-- ----------------------------------------------------------------------------
-- Remplacer :<carnet_id>, :<auteur_uid>, :<tiers_uid>.
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = ':<tiers_uid>';

-- Doit échouer en 42501 (policy auteur seulement).
insert into public.carnet_collaborators (carnet_id, user_id, role)
values (':<carnet_id>', ':<tiers_uid>', 'contributor');

rollback;

-- Variante : un `viewer` existant tente de se promouvoir.
-- Attendu : 0 ligne modifiée, rôle inchangé.
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = ':<tiers_uid>';
with promoted as (
  update public.carnet_collaborators
  set role = 'contributor'
  where carnet_id = ':<carnet_id>'
    and user_id = ':<tiers_uid>'
  returning 1
)
select count(*) as lignes_promues from promoted;
rollback;

-- ----------------------------------------------------------------------------
-- 7. Écriture de moment par un non-éditeur (F2)
-- ----------------------------------------------------------------------------
-- Remplacer :<carnet_id>, :<tiers_uid>.
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = ':<tiers_uid>';
insert into public.carnet_moments (carnet_id, jour_numero, citation, auteur_id)
values (':<carnet_id>', 1, 'test non éditeur', ':<tiers_uid>');
rollback;
-- Attendu : 42501, même avec auteur_id = auth.uid().

-- ----------------------------------------------------------------------------
-- 8. Lectures publiques historiques (F4) — carnet privé
-- ----------------------------------------------------------------------------
-- Remplacer :<carnet_prive_id>.
set role anon;
select count(*) as moments_anon
from public.carnet_moments
where carnet_id = ':<carnet_prive_id>';
select count(*) as kit_anon
from public.carnet_kit_items
where carnet_id = ':<carnet_prive_id>';
reset role;
-- Attendu : 0 et 0. Sur un carnet public, les policies scopées
-- (`carnet_moments_read_scoped`, `carnet_kit_items_read_scoped`,
-- `carnet_kit_items_select`) continuent d'autoriser la lecture publique :
-- c'est un choix produit, pas une fuite de carnet privé.

-- ----------------------------------------------------------------------------
-- 9. Vérifier qu'aucune policy `USING (true)` ne subsiste sur les tables
--    sensibles listées
-- ----------------------------------------------------------------------------
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'carnet_collaborators',
    'carnet_moments',
    'carnet_kit_items',
    'carnet_live_positions',
    'hike_sessions',
    'hike_session_participants'
  )
  and (qual = 'true' or with_check = 'true')
order by tablename, policyname;
-- Attendu : 0 ligne. Une policy `USING (true)` sur ces tables doit être
-- justifiée explicitement ou supprimée.

-- ----------------------------------------------------------------------------
-- 10. Lignes héritées de l'ancienne policy permissive (à revoir manuellement)
-- ----------------------------------------------------------------------------
-- La migration ne purge pas les lignes déjà auto-insérées avant son
-- application. `is_carnet_editor` continue de leur faire confiance tant
-- qu'elles existent : les lister, vérifier chaque invitation, puis supprimer
-- uniquement les lignes non légitimes (jamais en masse).
select cc.carnet_id,
       cc.user_id,
       cc.role,
       cc.created_at,
       c.author_id,
       c.title
from public.carnet_collaborators cc
join public.carnets c on c.id = cc.carnet_id
where cc.user_id is distinct from c.author_id
order by cc.created_at, cc.carnet_id;

-- Moments écrits par un utilisateur qui n'est ni auteur ni éditeur du carnet.
-- L'ancienne policy `auth_manage_carnet_moments` les autorisait.
select m.id,
       m.carnet_id,
       m.auteur_id,
       m.created_at,
       c.author_id
from public.carnet_moments m
join public.carnets c on c.id = m.carnet_id
where m.auteur_id is distinct from c.author_id
  and not exists (
    select 1
    from public.carnet_collaborators cc
    where cc.carnet_id = m.carnet_id
      and cc.user_id = m.auteur_id
      and cc.role in ('owner', 'contributor')
  )
order by m.created_at;

-- Vérifier aussi les policies recréées par un replay d'ancienne migration :
-- après un replay complet, rejouer 20261112122000 ou appliquer un forward-fix.
