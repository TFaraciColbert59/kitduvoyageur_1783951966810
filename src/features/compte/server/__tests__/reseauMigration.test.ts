import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Contrat statique de la migration additive du réseau. Ces vérifications ne
 * remplacent pas les tests sur base de préproduction : elles empêchent
 * seulement une régression silencieuse du texte de la migration (acteur non
 * authentifié, EXECUTE trop large, retrait d'anciennes policies).
 */
const MIGRATION = path.join(
  process.cwd(),
  'supabase/migrations/20261111130000_reseau_follow_contract.sql'
);

const raw = readFileSync(MIGRATION, 'utf8');
const sql = raw.replace(/--[^\n]*/g, '');

describe('migration réseau — contrat de suivi', () => {
  it('déclare les trois RPC avec un acteur implicite auth.uid()', () => {
    expect(sql).toMatch(
      /create or replace function public\.reseau_follow\(p_target_id uuid\)/i
    );
    expect(sql).toMatch(
      /create or replace function public\.reseau_respond_follow_request\(\s*p_request_id uuid,\s*p_action text\s*\)/i
    );
    expect(sql).toMatch(
      /create or replace function public\.reseau_unfollow\(p_target_id uuid\)/i
    );

    expect(sql.match(/security definer/gi)).toHaveLength(3);
    expect(sql.match(/set search_path = public, pg_temp/gi)).toHaveLength(3);
    expect(sql.match(/\(select auth\.uid\(\)\)/gi)).toHaveLength(3);
    expect(sql).not.toMatch(/\bp_actor\b|\bp_user_id\b/i);
  });

  it('borne EXECUTE au rôle authenticated pour chaque RPC', () => {
    for (const signature of [
      'public.reseau_follow(uuid)',
      'public.reseau_respond_follow_request(uuid, text)',
      'public.reseau_unfollow(uuid)',
    ]) {
      const escaped = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(sql).toMatch(
        new RegExp(`revoke all on function ${escaped} from public;`, 'i')
      );
      expect(sql).toMatch(
        new RegExp(`grant execute on function ${escaped} to authenticated;`, 'i')
      );
    }

    expect(sql).not.toMatch(/grant execute[\s\S]{0,80}\bto\s+(public|anon)\b/i);
    expect(sql).not.toMatch(/grant\s+all[\s\S]{0,80}\bto\s+(public|anon)\b/i);
    expect(sql).not.toMatch(/service_role/i);
  });

  it('reste additive : aucune policy, table, donnée ni grant existant retiré', () => {
    expect(sql).not.toMatch(/\bdrop\s+(policy|table|function)\b/i);
    expect(sql).not.toMatch(/\balter\s+table\b/i);
    expect(sql).not.toMatch(/\brevoke[\s\S]{0,80}?\bon\s+table\b/i);
    expect(sql).not.toMatch(/\bdisable\s+row\s+level\s+security\b/i);
    expect(sql).not.toMatch(/\bdelete\s+from\s+public\.user_profiles\b/i);
    expect(sql).not.toMatch(/\bupdate\s+public\.user_profiles\b/i);
  });

  it('sérialise les décisions et ne réécrit jamais une demande existante', () => {
    expect(sql).toMatch(/from public\.user_profiles p[\s\S]{0,80}for share/i);
    expect(sql).toMatch(/from public\.follow_requests r[\s\S]{0,120}for update/i);
    expect(sql.match(/on conflict/gi)?.length).toBeGreaterThanOrEqual(3);
    expect(sql).toMatch(/raise exception 'blocked'/i);
    expect(sql).toMatch(/raise exception 'follow_request_closed'/i);
    expect(sql).toMatch(/raise exception 'request_not_pending'/i);
    expect(sql).toMatch(/status in \('pending', 'accepted'\)/i);
  });
});
