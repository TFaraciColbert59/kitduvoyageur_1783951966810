-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Réseau — sourdine de contenu privée par utilisateur
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Objet : permettre à un lecteur de masquer les publications de fil et les
-- stories d'un compte, sans le bloquer et sans couper la conversation directe.
-- La sourdine de conversation reste portée par
-- `conversation_members.is_muted` ; le blocage reste porté par `user_blocks`.
--
-- Cette migration est additive et privée :
--   • une seule table nouvelle, `public.user_content_mutes`, dont la RLS ne
--     laisse lire/écrire que les lignes du lecteur (`muter_id = auth.uid()`).
--     La cible ne peut jamais lire la ligne : aucune notification, aucun
--     compteur, aucun état « tu es masqué » n'est exposé ;
--   • une fonction d'autorisation `viewer_mutes_author(uuid)` qui ne consulte
--     que le mute du porteur du JWT (aucun `p_viewer` fourni par l'appelant,
--     donc aucun sondage du mute d'autrui) ;
--   • une policy RESTRICTIVE ajoutée à `community_posts`, plus deux policies
--     restrictives sur les albums À la une : elles se combinent en ET avec les
--     policies existantes, sans les supprimer ni élargir un droit ;
--   • le corps de `can_view_story(uuid, uuid)` est remplacé pour appliquer la
--     même règle aux stories et à leurs médias. La vérification du mute n'est
--     appliquée que lorsque `p_viewer = auth.uid()` : un appel direct avec
--     l'identifiant d'un autre lecteur ne révèle pas ses préférences ;
--   • l'insertion n'est permise que sur un compte réellement suivi
--     (`user_follows`), car la sourdine sert à rester abonné.
--
-- Aucune table, policy, donnée ou grant existant n'est retiré. Aucune donnée
-- n'est migrée. Le rollback est fourni dans
-- `supabase/migrations_down/20261113125000_user_content_mutes.down.sql`.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Table privée de sourdine de contenu ─────────────────────────────────
create table if not exists public.user_content_mutes (
  muter_id uuid not null references auth.users(id) on delete cascade,
  muted_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  constraint user_content_mutes_no_self check (muter_id <> muted_id)
);

comment on table public.user_content_mutes is
  'Réseau : sourdine de contenu privée. Le lecteur (muter_id) masque les publications et stories de muted_id sans blocage ni sourdine de conversation. RLS own-only : la cible ne lit jamais la ligne.';
comment on column public.user_content_mutes.muter_id is
  'Lecteur qui a demandé la sourdine. Seule personne autorisée à lire, créer ou supprimer la ligne.';
comment on column public.user_content_mutes.muted_id is
  'Compte dont les contenus de fil et les stories sont masqués pour muter_id. Aucune lecture par ce compte.';
comment on column public.user_content_mutes.created_at is
  'Horodatage de la préférence. Conservé jusqu''à la révocation ou la suppression du compte (ON DELETE CASCADE).';

-- Index de service pour la cascade de suppression du compte masqué et les
-- jointures d'administration. La clé primaire couvre déjà (muter_id, muted_id).
create index if not exists user_content_mutes_muted_idx
  on public.user_content_mutes (muted_id);

alter table public.user_content_mutes enable row level security;

-- Aucune policy UPDATE : une sourdine ne se réécrit pas, elle se pose ou se
-- révoque. Aucune policy SELECT pour la cible ni pour anon.
drop policy if exists user_content_mutes_select_own on public.user_content_mutes;
create policy user_content_mutes_select_own on public.user_content_mutes
  for select to authenticated
  using (muter_id = auth.uid());

drop policy if exists user_content_mutes_insert_own on public.user_content_mutes;
create policy user_content_mutes_insert_own on public.user_content_mutes
  for insert to authenticated
  with check (
    muter_id = auth.uid()
    and muted_id <> auth.uid()
    and not public.is_anonymous_session()
    -- La sourdine de contenu sert à rester abonné tout en masquant les
    -- contenus : elle n'est posable que sur un compte réellement suivi. La
    -- révocation, elle, reste possible après un désabonnement.
    and exists (
      select 1
        from public.user_follows f
       where f.follower_id = auth.uid()
         and f.following_id = muted_id
    )
  );

drop policy if exists user_content_mutes_delete_own on public.user_content_mutes;
create policy user_content_mutes_delete_own on public.user_content_mutes
  for delete to authenticated
  using (muter_id = auth.uid());

revoke all on public.user_content_mutes from public;
revoke all on public.user_content_mutes from anon;
revoke all on public.user_content_mutes from authenticated;
grant select, insert, delete on public.user_content_mutes to authenticated;

-- ── 2. Autorisation : le lecteur a-t-il masqué cet auteur ? ─────────────────
-- La fonction ne prend que l'auteur : le lecteur vient toujours du JWT. Un
-- appelant ne peut donc pas demander « est-ce que X a masqué Y ? ».
create or replace function public.viewer_mutes_author(p_author_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.user_content_mutes m
     where m.muter_id = (select auth.uid())
       and m.muted_id = p_author_id
  );
$$;

comment on function public.viewer_mutes_author(uuid) is
  'Réseau : vrai si le porteur du JWT a mis en sourdine de contenu l''auteur demandé. Ne permet pas de sonder la sourdine d''un autre lecteur.';

revoke all on function public.viewer_mutes_author(uuid) from public;
revoke all on function public.viewer_mutes_author(uuid) from anon;
revoke all on function public.viewer_mutes_author(uuid) from authenticated;
grant execute on function public.viewer_mutes_author(uuid) to authenticated;

-- Helper dédié aux albums : le propriétaire de l'album n'est pas exposé par
-- `story_highlight_items`. Il est lu en security definer pour que la policy
-- restrictive de l'album ne rende pas la sous-requête vide (et donc l'item
-- visible) à cause de sa propre RLS.
create or replace function public.viewer_mutes_highlight(p_highlight_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.story_highlights h
      join public.user_content_mutes m on m.muted_id = h.owner_id
     where h.id = p_highlight_id
       and m.muter_id = (select auth.uid())
  );
$$;

comment on function public.viewer_mutes_highlight(uuid) is
  'Réseau : vrai si le porteur du JWT a mis en sourdine de contenu le propriétaire de l''album À la une. Ne permet pas de sonder la sourdine d''un autre lecteur.';

revoke all on function public.viewer_mutes_highlight(uuid) from public;
revoke all on function public.viewer_mutes_highlight(uuid) from anon;
revoke all on function public.viewer_mutes_highlight(uuid) from authenticated;
grant execute on function public.viewer_mutes_highlight(uuid) to authenticated;

-- ── 3. Fil : les publications de l'auteur masqué disparaissent ─────────────
-- La policy est RESTRICTIVE : elle s'ajoute en ET aux policies permissives
-- existantes. Aucune policy historique n'est supprimée, aucun accès public
-- anonyme n'est élargi (la policy ne vise que le rôle authenticated).
drop policy if exists community_posts_not_content_muted on public.community_posts;
create policy community_posts_not_content_muted on public.community_posts
  as restrictive
  for select
  to authenticated
  using (not public.viewer_mutes_author(author_id));

-- ── 4. Albums À la une : l'album entier de l'auteur masqué disparaît ────────
-- Sans cela, la coquille de l'album resterait visible alors que ses stories
-- sont filtrées par can_view_story : l'écran montrerait un album vide.
drop policy if exists story_highlights_not_content_muted on public.story_highlights;
create policy story_highlights_not_content_muted on public.story_highlights
  as restrictive
  for select
  to authenticated
  using (not public.viewer_mutes_author(owner_id));

drop policy if exists story_highlight_items_not_content_muted on public.story_highlight_items;
create policy story_highlight_items_not_content_muted on public.story_highlight_items
  as restrictive
  for select
  to authenticated
  using (not public.viewer_mutes_highlight(highlight_id));

-- ── 5. Stories : même règle dans la source unique can_view_story ───────────
-- Le corps est identique à 20261013280000_stories_v2_private_media.sql, avec
-- le mute ajouté dans la branche « tiers ». La branche auteur reste première :
-- une personne voit toujours ses propres stories (archive comprise).
create or replace function public.can_view_story(p_story_id uuid, p_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.post_stories s
     where s.id = p_story_id
       and p_viewer is not null
       and s.status <> 'removed'
       and s.moderation_state <> 'removed'
       and (
         s.author_id = p_viewer -- l'auteur voit toujours sa story (archive incluse)
         or (
           s.expires_at > now()
           and not exists (
             select 1 from public.user_blocks b
              where (b.blocker_id = s.author_id and b.blocked_id = p_viewer)
                 or (b.blocker_id = p_viewer and b.blocked_id = s.author_id)
           )
           and not exists (
             select 1 from public.story_hidden_users h
              where h.owner_id = s.author_id and h.hidden_user_id = p_viewer
           )
           -- Le mute n'est consulté que pour le porteur du JWT. Un appel
           -- direct avec un autre p_viewer ne divulgue pas ses préférences.
           and not exists (
             select 1 from public.user_content_mutes m
              where m.muter_id = p_viewer
                and m.muted_id = s.author_id
                and p_viewer = (select auth.uid())
           )
           and case s.visibility
             when 'public' then true
             when 'followers' then exists (
               select 1 from public.user_follows f
                where f.follower_id = p_viewer and f.following_id = s.author_id
             )
             when 'close_friends' then exists (
               select 1 from public.story_close_friends cf
                where cf.owner_id = s.author_id and cf.friend_id = p_viewer
             )
             when 'club' then s.club_id is not null and public.is_club_member(s.club_id, p_viewer)
             else false
           end
         )
       )
  );
$$;

comment on function public.can_view_story(uuid, uuid) is
  'Stories V2 : source unique d''autorisation lecture (RLS + /api/stories/:id/media). Applique aussi la sourdine de contenu privée du lecteur.';

revoke all on function public.can_view_story(uuid, uuid) from public;
revoke all on function public.can_view_story(uuid, uuid) from anon;
grant execute on function public.can_view_story(uuid, uuid) to authenticated;

-- ── Rollback ───────────────────────────────────────────────────────────────
-- Le down complet, y compris la restauration du corps historique de
-- can_view_story, est dans supabase/migrations_down/.
