-- M05 — rollback.
-- ATTENTION : les colonnes moderation_state / moderated_by / moderated_at /
-- moderation_reason NE SONT PAS SUPPRIMÉES. Le garde-fou § 1.1 interdit un
-- DROP COLUMN sur une table LKDV de production, et ces colonnes sont inoffensives
-- (défaut 'visible', aucune policy active après ce rollback). Elles seront
-- réutilisées si la migration est réappliquée.
do $$
declare t text;
  tables constant text[] := array[
    'community_posts','post_comments','carnet_comments','carnet_day_comments',
    'carnet_moment_comments','place_reviews','product_reviews','post_stories',
    'club_topics','club_topic_replies'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists %I on public.%I', t || '_moderation_lock', t);
    execute format('drop policy if exists moderation_read_guard on public.%I', t);
  end loop;
end $$;

-- Les fonctions en dernier : les déclencheurs en dépendent.
drop function if exists admin.moderation_counts();
drop function if exists admin.guard_moderation_columns();
drop function if exists admin.is_team();
