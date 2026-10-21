/**
 * Task 14 — contrat SQL de l'acceptation d'invitation.
 *
 * Une invitation `pending` a `invitee_id = NULL` : l'invité ne peut ni la lire
 * ni la modifier directement sous RLS. L'acceptation doit donc passer par une
 * fonction `SECURITY DEFINER` bornée aux utilisateurs authentifiés, qui lie
 * `invitee_id = auth.uid()` et ne peut jamais être exécutée par `anon`/`public`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261022107000_profile_invitation_accept_rpc.sql'),
  'utf8'
);

function grantStatements(): string[] {
  return sql.match(/grant[^;]*;/gi) ?? [];
}

describe('RPC accept_profile_invitation — contrat SQL', () => {
  it('est SECURITY DEFINER avec un search_path fixé', () => {
    expect(sql).toMatch(/security\s+definer/i);
    expect(sql).toMatch(/set\s+search_path\s+to\s+'public'/i);
  });

  it('lie invitee_id = auth.uid() et marque l’invitation accepted', () => {
    expect(sql).toMatch(/invitee_id\s*=\s*uid/i);
    expect(sql).toMatch(/status\s*=\s*'accepted'/i);
    expect(sql).toMatch(/accepted_at\s*=\s*coalesce\s*\(\s*accepted_at\s*,\s*now\(\)\s*\)/i);
    expect(sql).toMatch(/for\s+update/i);
  });

  it('est réservée aux utilisateurs authentifiés', () => {
    expect(sql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.accept_profile_invitation\s*\(\s*text\s*\)\s+to\s+authenticated/i
    );
    expect(sql).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.accept_profile_invitation\s*\(\s*text\s*\)\s+from\s+public\s*,\s*anon/i
    );

    const grants = grantStatements();
    expect(grants.length).toBeGreaterThan(0);
    for (const grant of grants) {
      expect(grant).not.toMatch(/\bto\s+(public|anon)\b/i);
    }
  });

  it('ne contient pas d’update d’expiration annulé par l’exception', () => {
    expect(sql).not.toMatch(/set\s+status\s*=\s*'expired'/i);
  });
});
