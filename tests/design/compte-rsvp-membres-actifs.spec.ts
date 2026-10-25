/**
 * I11 — le RSVP à un événement de club ne peut plus contourner l'API via PostgREST.
 *
 * Contrat verrouillé sur la migration :
 * - l'ancienne policy INSERT permissive et l'ancienne policy ALL sont retirées ;
 * - l'INSERT exige l'appelant (`user_id = auth.uid()`) et une session non anonyme ;
 * - pour un événement rattaché à un club, une adhésion `active` dans CE club ;
 * - pour un événement sans club (`club_id is null`), l'accès reste ouvert ;
 * - le DELETE reste borné à `user_id = auth.uid()`.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION = 'supabase/migrations/20261022111000_club_event_rsvp_members_only.sql';

function normalizedSql(): string {
  return readFileSync(resolve(process.cwd(), MIGRATION), 'utf8')
    .replace(/--.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

describe('I11 — policy INSERT de club_event_participants', () => {
  const sql = normalizedSql();

  it('remplace la policy live et l’ancienne policy ALL permissive', () => {
    expect(sql).toContain('drop policy if exists event_participants_insert');
    expect(sql).toContain('drop policy if exists "users can manage own participation"');
    expect(sql).not.toContain('for all');
  });

  it('exige l’appelant et une session authentifiée non anonyme', () => {
    expect(sql).toContain(
      'create policy event_participants_insert on public.club_event_participants for insert to authenticated with check'
    );
    expect(sql).toContain('user_id = auth.uid()');
    expect(sql).toContain('not public.is_anonymous_session()');
  });

  it('exige une adhésion active dans le club de l’événement', () => {
    expect(sql).toContain('from public.club_events e');
    expect(sql).toContain('e.id = club_event_participants.event_id');
    expect(sql).toContain('from public.club_members m');
    expect(sql).toContain('m.club_id = e.club_id');
    expect(sql).toContain('m.user_id = auth.uid()');
    expect(sql).toContain("m.status = 'active'");
  });

  it('laisse ouvert un événement sans club', () => {
    expect(sql).toContain('e.club_id is null');
  });

  it('garde le DELETE strictement personnel', () => {
    expect(sql).toContain(
      'create policy event_participants_delete on public.club_event_participants for delete to authenticated using (user_id = auth.uid())'
    );
  });
});
