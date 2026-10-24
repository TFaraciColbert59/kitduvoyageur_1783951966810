/**
 * Task 14 + revue finale (C3, I10) — contrat SQL des invitations.
 *
 * Une invitation `pending` a `invitee_id = NULL` : l'invité ne peut ni la lire
 * ni la modifier directement sous RLS. L'acceptation passe donc par une
 * fonction `SECURITY DEFINER` bornée aux utilisateurs authentifiés, qui lie
 * `invitee_id = auth.uid()` et ne peut jamais être exécutée par `anon`/`public`.
 *
 * Deux garanties verrouillées ici :
 * - C3 : la clé `invitee_id` est `on delete cascade`. Avec `on delete set null`,
 *   la suppression d'un invité mettait `invitee_id = NULL` sur une invitation
 *   acceptée, violait `profile_invitations_accepted_bound` et faisait échouer
 *   `auth.admin.deleteUser` (effacement RGPD impossible).
 * - I10 : l'expiration est vérifiée AVANT le raccourci « déjà acceptée »,
 *   parce que `public_profiles` masque le profil dès que l'invitation est
 *   expirée : `already:true` promettrait un accès disparu.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATIONS = 'supabase/migrations';
const TABLE_FILE = '20261022100000_profile_visibility_invitations.sql';
const BOUND_FILE = '20261022101000_drawer_profile_index_hygiene.sql';
const ORIGINAL_RPC_FILE = '20261022107000_profile_invitation_accept_rpc.sql';
const CASCADE_FILE = '20261022111200_profile_invitation_invitee_cascade.sql';
const RPC_FILE = '20261022111400_profile_invitation_expiry_before_accept.sql';

const read = (file: string) => readFileSync(resolve(process.cwd(), MIGRATIONS, file), 'utf8');

/** Retire les commentaires : on teste le SQL exécuté, pas la prose. */
function stripComments(source: string): string {
  return source.replace(/--[^\n]*/g, '');
}

const cascade = stripComments(read(CASCADE_FILE));
const sql = stripComments(read(RPC_FILE));

function grantStatements(): string[] {
  return sql.match(/grant[^;]*;/gi) ?? [];
}

describe('RPC accept_profile_invitation — contrat SQL', () => {
  it('redéfinit la fonction d’origine dans une migration postérieure', () => {
    expect(RPC_FILE > ORIGINAL_RPC_FILE).toBe(true);
    expect(sql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.accept_profile_invitation\s*\(\s*p_token\s+text\s*\)/i
    );
  });

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

  it('conserve la règle du pending seul et le refus d’une invitation nominative d’un autre', () => {
    expect(sql).toMatch(
      /if\s+v\.status\s*<>\s*'pending'\s+then\s+raise\s+exception\s+'invitation_not_pending'/i
    );
    expect(sql).toMatch(
      /if\s+v\.invitee_id\s+is\s+not\s+null\s+and\s+v\.invitee_id\s*<>\s*uid\s+then\s+raise\s+exception\s+'invitation_reserved'/i
    );
  });
});

describe('C3 — suppression de compte d’un invité', () => {
  it('supprime la clé étrangère par son nom réel puis la recrée en on delete cascade', () => {
    expect(cascade).toMatch(
      /alter\s+table\s+public\.profile_invitations\s+drop\s+constraint\s+if\s+exists\s+profile_invitations_invitee_id_fkey/i
    );
    expect(cascade).toMatch(
      /add\s+constraint\s+profile_invitations_invitee_id_fkey\s+foreign\s+key\s*\(\s*invitee_id\s*\)\s+references\s+auth\.users\s*\(\s*id\s*\)\s+on\s+delete\s+cascade/i
    );
  });

  it('ne laisse aucune clause on delete set null sur invitee_id', () => {
    expect(cascade).not.toMatch(/on\s+delete\s+set\s+null/i);
    expect(cascade).not.toMatch(/references\s+auth\.users\s*\(\s*id\s*\)\s+on\s+delete\s+set\s+null/i);
  });

  it('laisse la contrainte accepted_bound en place', () => {
    const bound = stripComments(read(BOUND_FILE));
    expect(bound).toMatch(
      /add\s+constraint\s+profile_invitations_accepted_bound\s+check\s*\(\s*status\s*<>\s*'accepted'\s+or\s+invitee_id\s+is\s+not\s+null\s*\)/i
    );
    // La correction de C3 ne doit pas contourner le problème en relâchant la
    // contrainte : elle reste la garantie qu’une invitation acceptée est liée.
    expect(cascade).not.toMatch(/drop\s+constraint[^;]*profile_invitations_accepted_bound/i);
  });

  it('reste la dernière définition de la clé dans l’ordre des migrations', () => {
    const files = readdirSync(resolve(process.cwd(), MIGRATIONS))
      .filter((name) => name.endsWith('.sql'))
      .sort();
    const index = files.indexOf(CASCADE_FILE);
    expect(index).toBeGreaterThan(-1);

    for (const file of files.slice(index + 1)) {
      const source = stripComments(read(file));
      expect(source).not.toMatch(/profile_invitations_invitee_id_fkey/i);
      expect(source).not.toMatch(/invitee_id[^;]{0,120}references\s+auth\.users/i);
    }
  });
});

describe('I10 — l’expiration prime sur l’idempotence', () => {
  it('vérifie expires_at avant le raccourci « déjà acceptée »', () => {
    const expiredAt = sql.search(
      /if\s+v\.expires_at\s+is\s+not\s+null\s+and\s+v\.expires_at\s*<=\s*now\(\)\s+then/i
    );
    const alreadyAt = sql.search(
      /if\s+v\.status\s*=\s*'accepted'\s+and\s+v\.invitee_id\s*=\s*uid\s+then/i
    );

    expect(expiredAt).toBeGreaterThan(-1);
    expect(alreadyAt).toBeGreaterThan(-1);
    expect(expiredAt).toBeLessThan(alreadyAt);
  });

  it('marque l’invitation expired puis lève invitation_expired (409)', () => {
    const markAt = sql.search(/set\s+status\s*=\s*'expired'/i);
    const raiseAt = sql.search(/raise\s+exception\s+'invitation_expired'/i);

    expect(markAt).toBeGreaterThan(-1);
    expect(raiseAt).toBeGreaterThan(-1);
    expect(markAt).toBeLessThan(raiseAt);
    // Le refus doit rester un 409 côté route : SQLSTATE 55000.
    expect(sql).toMatch(/raise\s+exception\s+'invitation_expired'\s+using\s+errcode\s*=\s*'55000'/i);
  });

  it('refuse une invitation expirée avant même la règle du pending', () => {
    const expiredAt = sql.search(/v\.expires_at\s*<=\s*now\(\)/i);
    const pendingAt = sql.search(/v\.status\s*<>\s*'pending'/i);

    expect(expiredAt).toBeGreaterThan(-1);
    expect(pendingAt).toBeGreaterThan(-1);
    expect(expiredAt).toBeLessThan(pendingAt);
  });

  it('garde le chemin idempotent pour une invitation acceptée non expirée', () => {
    expect(sql).toMatch(
      /return\s+jsonb_build_object\s*\(\s*'ok'\s*,\s*true\s*,\s*'already'\s*,\s*true\s*,\s*'owner_id'\s*,\s*v\.owner_id\s*\)/i
    );
  });
});
