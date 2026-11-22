// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { clearGuestWorkspace, hasDraftContent, loginHrefForRoute, readGuestWorkspace, saveGuestWorkspace } from '../guestDraft';
import { baseWorkspace } from '../insights/__tests__/fixtures';
import { createBlankWorkspace } from '../startWorkspace';
import { clearPendingRouteDraft, readPendingRouteDraft, savePendingRouteDraft } from '@/features/compas/engine/pendingDraft';

const UUID = '6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f';

describe('guestDraft · brouillon sans compte, repris après /connexion (1.7)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearPendingRouteDraft();
  });

  it('un atelier vide n’est pas un brouillon : rien n’est gardé', () => {
    const blank = createBlankWorkspace({ id: 'w', tripId: 't', userId: 'g', userName: 'G', nowIso: '2026-11-22T10:00:00Z' });
    expect(hasDraftContent(blank)).toBe(false);
    expect(saveGuestWorkspace(blank)).toBe('empty');
    expect(readGuestWorkspace()).toBeNull();
  });

  it('garde puis reprend l’atelier à l’identique', () => {
    const ws = baseWorkspace({ sport: 'marche' });
    expect(saveGuestWorkspace(ws)).toBe('saved');
    const back = readGuestWorkspace();
    expect(back?.points).toHaveLength(3);
    expect(back?.sections[0].geometry.coordinates).toEqual(ws.sections[0].geometry.coordinates);
  });

  it('ne reprend pas le brouillon d’un autre voyage', () => {
    saveGuestWorkspace({ ...baseWorkspace({ sport: 'marche' }), tripId: 'autre' });
    expect(readGuestWorkspace('un-voyage')).toBeNull();
    expect(readGuestWorkspace('autre')).not.toBeNull();
  });

  it('refuse un contenu qui n’est pas un atelier', () => {
    savePendingRouteDraft({ workspace: { id: 'x', points: 'non' }, tripId: null });
    expect(readGuestWorkspace()).toBeNull();
  });

  it('expire au bout de 24 h', () => {
    saveGuestWorkspace(baseWorkspace({ sport: 'marche' }));
    expect(readPendingRouteDraft(Date.now() + 25 * 3600_000)).toBeNull();
    expect(readPendingRouteDraft(Date.now() + 3600_000)).not.toBeNull();
  });

  it('s’efface une fois repris', () => {
    saveGuestWorkspace(baseWorkspace({ sport: 'marche' }));
    clearGuestWorkspace();
    expect(readGuestWorkspace()).toBeNull();
  });

  it('le lien de connexion ramène sur le même voyage', () => {
    expect(loginHrefForRoute(UUID)).toBe(`/connexion?next=${encodeURIComponent(`/compas/itineraire?trip=${UUID}`)}`);
    expect(loginHrefForRoute()).toBe(`/connexion?next=${encodeURIComponent('/compas/itineraire')}`);
  });
});
