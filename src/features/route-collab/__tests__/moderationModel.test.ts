import { describe, expect, it } from 'vitest';
import {
  isRouteModerationType,
  previewOf,
  toAuditRow,
  toItems,
  withAuditStatus,
} from '../moderationModel';

describe('Audit de modération des itinéraires (10.10)', () => {
  it('une décision devient une ligne de journal, sans contenu de tracé', () => {
    const input = { type: 'route_share_link', id: 'ws-1', moderatorId: 'mod-1', decision: 'reject' } as const;
    expect(toAuditRow({ ...input, before: 'en_attente' })).toEqual({
      admin_id: 'mod-1', action: 'REJECT', cible_type: 'route_share_link', cible_id: 'ws-1',
      avant: { statut: 'en_attente' }, apres: { statut: 'rejete' },
    });
  });

  it('les valeurs de statut et d\'action sont celles des énumérations existantes', () => {
    const a = toAuditRow({ type: 'route_comment', id: 'c', moderatorId: 'm', decision: 'approve', before: null });
    const f = toAuditRow({ type: 'route_comment', id: 'c', moderatorId: 'm', decision: 'flag', before: null });
    expect(['APPROVE', 'REJECT', 'UPDATE']).toContain(a.action);
    expect(f.action).toBe('UPDATE');
    expect(a.avant).toBeNull();
    expect(f.apres).toEqual({ statut: 'signale' });
  });

  it('refuse un type hors périmètre', () => {
    expect(isRouteModerationType('route_comment')).toBe(true);
    expect(isRouteModerationType('review')).toBe(false);
  });

  it('borne et nettoie l\'aperçu', () => {
    expect(previewOf('a'.repeat(300))?.length).toBe(120);
    expect(previewOf('ligne1\n\u0000ligne2')).toBe('ligne1 ligne2');
    expect(previewOf('   ')).toBeNull();
    expect(previewOf(42)).toBeNull();
  });

  it('applique le dernier statut consigné et ignore les lignes sans identifiant', () => {
    const items = toItems('route_public_trace', [{ id: 'p1', preview: 'Crête', created_at: '2026-11-20T00:00:00Z' }, { preview: 'sans id' }]);
    expect(items).toHaveLength(1);
    const out = withAuditStatus(items, [
      { cible_type: 'route_public_trace', cible_id: 'p1', apres: { statut: 'signale' } },
      { cible_type: 'route_public_trace', cible_id: 'p1', apres: { statut: 'approuve' } },
      { cible_type: 'route_comment', cible_id: 'p1', apres: { statut: 'rejete' } },
      { cible_type: 'route_public_trace', cible_id: 'p1', apres: { enforced: 'remove' } },
    ]);
    expect(out[0].status).toBe('approuve');
  });
});

describe('mise en œuvre d’un rejet (10.10)', () => {
  it('chaque type n’admet que les actions qui lui conviennent ; défaut = la moins destructive', async () => {
    const { defaultEnforcement, isEnforcementAllowed } = await import('../moderationModel');
    expect(defaultEnforcement('route_comment')).toBe('hide');
    expect(defaultEnforcement('route_share_link')).toBe('revoke');
    expect(defaultEnforcement('route_public_trace')).toBe('remove');
    expect(isEnforcementAllowed('route_comment', 'remove')).toBe(true);
    expect(isEnforcementAllowed('route_comment', 'revoke')).toBe(false);
    expect(isEnforcementAllowed('route_share_link', 'hide')).toBe(false);
    expect(isEnforcementAllowed('route_public_trace', 'hide')).toBe(false);
  });
});
