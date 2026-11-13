import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Contrat statique de la migration de sourdine de contenu. Ces vérifications
 * ne remplacent pas les tests pgTAP sur une base de préproduction : elles
 * empêchent une régression silencieuse du texte (table publique, policy
 * permissive, EXECUTE trop large, mute divulgué à un tiers).
 */
const MIGRATION = path.join(
  process.cwd(),
  'supabase/migrations/20261113125000_user_content_mutes.sql'
);
const DOWN = path.join(
  process.cwd(),
  'supabase/migrations_down/20261113125000_user_content_mutes.down.sql'
);

const raw = readFileSync(MIGRATION, 'utf8');
const sql = raw.replace(/--[^\n]*/g, '');
const down = readFileSync(DOWN, 'utf8').replace(/--[^\n]*/g, '');

describe('migration sourdine de contenu — table privée', () => {
  it('crée la table avec une clé par paire et une garde anti-auto-sourdine', () => {
    expect(sql).toMatch(/create table if not exists public\.user_content_mutes/i);
    expect(sql).toMatch(/muter_id uuid not null references auth\.users\(id\) on delete cascade/i);
    expect(sql).toMatch(/muted_id uuid not null references auth\.users\(id\) on delete cascade/i);
    expect(sql).toMatch(/primary key \(muter_id, muted_id\)/i);
    expect(sql).toMatch(/check \(muter_id <> muted_id\)/i);
  });

  it('active la RLS et n’autorise que le lecteur', () => {
    expect(sql).toMatch(/alter table public\.user_content_mutes enable row level security/i);
    expect(sql).toMatch(
      /create policy user_content_mutes_select_own[\s\S]{0,160}using \(muter_id = auth\.uid\(\)\)/i
    );
    expect(sql).toMatch(
      /create policy user_content_mutes_insert_own[\s\S]{0,260}muter_id = auth\.uid\(\)[\s\S]{0,120}muted_id <> auth\.uid\(\)/i
    );
    expect(sql).toMatch(
      /from public\.user_follows f[\s\S]{0,80}f\.follower_id = auth\.uid\(\)[\s\S]{0,80}f\.following_id = muted_id/i
    );
    expect(sql).toMatch(
      /create policy user_content_mutes_delete_own[\s\S]{0,160}using \(muter_id = auth\.uid\(\)\)/i
    );
    expect(sql).not.toMatch(/for update/i);
    expect(sql).not.toMatch(/using \(true\)/i);
  });

  it('ne donne aucun accès à anon et retire EXECUTE au public', () => {
    expect(sql).toMatch(/revoke all on public\.user_content_mutes from public/i);
    expect(sql).toMatch(/revoke all on public\.user_content_mutes from anon/i);
    expect(sql).toMatch(/grant select, insert, delete on public\.user_content_mutes to authenticated/i);
    expect(sql).not.toMatch(/grant [^;]*\bto\s+(anon|public)\b/i);
    expect(sql).not.toMatch(/grant all on public\.user_content_mutes/i);
  });
});

describe('migration sourdine de contenu — autorisation', () => {
  it('limite le helper au mute du porteur du JWT', () => {
    const helper = sql.slice(
      sql.indexOf('create or replace function public.viewer_mutes_author'),
      sql.indexOf('create policy community_posts_not_content_muted')
    );
    expect(helper).toMatch(
      /create or replace function public\.viewer_mutes_author\(p_author_id uuid\)/i
    );
    expect(helper).toMatch(/security definer/i);
    expect(helper).toMatch(/set search_path = public, pg_temp/i);
    expect(helper).toMatch(/m\.muter_id = \(select auth\.uid\(\)\)/i);
    expect(helper).not.toMatch(/p_viewer\b/i);
    expect(sql).toMatch(
      /revoke all on function public\.viewer_mutes_author\(uuid\) from public/i
    );
    expect(sql).toMatch(
      /revoke all on function public\.viewer_mutes_author\(uuid\) from anon/i
    );
    expect(sql).toMatch(
      /grant execute on function public\.viewer_mutes_author\(uuid\) to authenticated/i
    );
  });

  it('ajoute une policy restrictive au fil sans supprimer la policy d’audience', () => {
    expect(sql).toMatch(
      /create policy community_posts_not_content_muted on public\.community_posts[\s\S]{0,120}as restrictive[\s\S]{0,120}for select[\s\S]{0,120}to authenticated/i
    );
    expect(sql).toMatch(/using \(not public\.viewer_mutes_author\(author_id\)\)/i);
    expect(sql).not.toMatch(/drop policy[^;]*community_posts_select_audience/i);
    expect(sql).not.toMatch(/alter table public\.community_posts/i);
  });

  it('masque aussi les albums À la une de l’auteur mis en sourdine', () => {
    expect(sql).toMatch(
      /create policy story_highlights_not_content_muted on public\.story_highlights[\s\S]{0,120}as restrictive[\s\S]{0,120}using \(not public\.viewer_mutes_author\(owner_id\)\)/i
    );
    expect(sql).toMatch(
      /create policy story_highlight_items_not_content_muted on public\.story_highlight_items[\s\S]{0,160}using \(not public\.viewer_mutes_highlight\(highlight_id\)\)/i
    );
    const helper = sql.slice(
      sql.indexOf('create or replace function public.viewer_mutes_highlight'),
      sql.indexOf('-- ── 3. Fil')
    );
    expect(helper).toMatch(/security definer/i);
    expect(helper).toMatch(/from public\.story_highlights h/i);
    expect(helper).toMatch(/join public\.user_content_mutes m on m\.muted_id = h\.owner_id/i);
    expect(helper).toMatch(/m\.muter_id = \(select auth\.uid\(\)\)/i);
  });

  it('applique la sourdine à can_view_story sans divulguer le mute d’un tiers', () => {
    expect(sql).toMatch(/create or replace function public\.can_view_story\(p_story_id uuid, p_viewer uuid\)/i);
    expect(sql).toMatch(/from public\.user_content_mutes m/i);
    expect(sql).toMatch(/m\.muter_id = p_viewer/i);
    expect(sql).toMatch(/m\.muted_id = s\.author_id/i);
    expect(sql).toMatch(/p_viewer = \(select auth\.uid\(\)\)/i);
    // La branche auteur reste évaluée avant les contrôles de tiers.
    expect(sql).toMatch(
      /s\.author_id = p_viewer[\s\S]{0,180}s\.expires_at > now\(\)/i
    );
    expect(sql).toMatch(
      /revoke all on function public\.can_view_story\(uuid, uuid\) from public/i
    );
    expect(sql).toMatch(
      /revoke all on function public\.can_view_story\(uuid, uuid\) from anon/i
    );
    expect(sql).toMatch(
      /grant execute on function public\.can_view_story\(uuid, uuid\) to authenticated/i
    );
  });

  it('reste additive : aucune table ni policy existante retirée', () => {
    const dropped = Array.from(
      sql.matchAll(/drop policy if exists ([a-z0-9_]+)/gi),
      (match) => match[1]
    );
    expect(new Set(dropped)).toEqual(
      new Set([
        'user_content_mutes_select_own',
        'user_content_mutes_insert_own',
        'user_content_mutes_delete_own',
        'community_posts_not_content_muted',
        'story_highlights_not_content_muted',
        'story_highlight_items_not_content_muted',
      ])
    );
    expect(sql).not.toMatch(/\bdrop table\b/i);
    expect(sql).not.toMatch(/\bdrop function\b/i);
    expect(sql).not.toMatch(/\bdisable row level security\b/i);
  });
});

describe('rollback sourdine de contenu', () => {
  it('retire la policy, le helper et la table, puis restaure can_view_story', () => {
    expect(down).toMatch(/drop policy if exists community_posts_not_content_muted/i);
    expect(down).toMatch(/drop policy if exists story_highlights_not_content_muted/i);
    expect(down).toMatch(/drop policy if exists story_highlight_items_not_content_muted/i);
    expect(down).toMatch(/drop function if exists public\.viewer_mutes_author\(uuid\)/i);
    expect(down).toMatch(/drop function if exists public\.viewer_mutes_highlight\(uuid\)/i);
    expect(down).toMatch(/drop table if exists public\.user_content_mutes/i);
    expect(down).toMatch(/create or replace function public\.can_view_story/i);
    expect(down).not.toMatch(/user_content_mutes m/i);
  });
});
