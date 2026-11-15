-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK: Réseau — sourdine de contenu privée par utilisateur
-- ═══════════════════════════════════════════════════════════════════════════
--
-- À exécuter uniquement après avoir retiré l'application qui appelle la route
-- /api/compte/reseau/content-mute. Le down retire les policies restrictives
-- (fil et albums À la une), la fonction d'autorisation et la table nouvelle,
-- puis restaure le corps historique de can_view_story (sans sourdine).
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists community_posts_not_content_muted on public.community_posts;
drop policy if exists story_highlights_not_content_muted on public.story_highlights;
drop policy if exists story_highlight_items_not_content_muted on public.story_highlight_items;

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
         s.author_id = p_viewer
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
  'Stories V2 : source unique d''autorisation lecture (RLS + /api/stories/:id/media).';

revoke all on function public.can_view_story(uuid, uuid) from public;
revoke all on function public.can_view_story(uuid, uuid) from anon;
grant execute on function public.can_view_story(uuid, uuid) to authenticated;

drop function if exists public.viewer_mutes_highlight(uuid);
drop function if exists public.viewer_mutes_author(uuid);

drop table if exists public.user_content_mutes;
