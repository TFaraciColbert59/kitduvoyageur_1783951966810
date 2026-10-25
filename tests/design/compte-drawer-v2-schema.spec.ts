import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261022100000_profile_visibility_invitations.sql'),
  'utf8'
);

describe('Compte drawer v2 — schéma confidentialité et invitations', () => {
  it('deux niveaux, invitations, republication', () => {
    expect(sql).toContain("profile_visibility in ('public','prive')");
    expect(sql).toContain('profile_invitations');
    expect(sql).toContain('reposted_from_id');
    expect(sql).toContain('story_highlights_owner_position_idx');
    // Une invitation sans destinataire ne doit jamais déverrouiller un profil privé.
    expect(sql).not.toContain('invitee_id is null');
  });
});
