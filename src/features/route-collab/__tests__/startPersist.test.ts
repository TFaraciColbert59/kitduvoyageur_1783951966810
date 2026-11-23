import { describe, expect, it, vi } from 'vitest';
import { isRealTripId, persistBody, persistWorkspaceToServer } from '../startPersist';
import { createBlankWorkspace } from '../startWorkspace';

const ws = createBlankWorkspace({ id: 'ws-x1', tripId: '11111111-2222-4333-8444-555555555555', title: 'Boucle', userId: 'u', userName: 'U', nowIso: '2026-11-22T00:00:00Z' });

describe('startPersist · premier enregistrement (1.1, 1.7)', () => {
  it('seul un UUID de voyage est un rattachement réel', () => {
    expect(isRealTripId('11111111-2222-4333-8444-555555555555')).toBe(true);
    expect(isRealTripId('trip-compas-active')).toBe(false);
    expect(isRealTripId(null)).toBe(false);
  });

  it('envoie l’état complet (sans jamais réclamer les données d’exemple du serveur)', () => {
    const body = persistBody(ws);
    expect(body.tripId).toBe(ws.tripId);
    expect((body.workspace as { points: unknown[] }).points).toEqual([]);
    expect(persistBody({ ...ws, title: ' ' }).title).toBe('Itinéraire');
  });

  it('dit pourquoi l’enregistrement échoue, sans repli silencieux', async () => {
    const f = (status: number, json?: unknown) =>
      vi.fn().mockResolvedValue({ ok: status < 300, status, json: async () => json }) as unknown as typeof fetch;
    expect(await persistWorkspaceToServer(ws, f(401))).toMatchObject({ ok: false, status: 401, reason: 'Connexion requise pour enregistrer.' });
    expect(await persistWorkspaceToServer(ws, f(403))).toMatchObject({ ok: false, status: 403 });
    expect(await persistWorkspaceToServer(ws, f(500))).toMatchObject({ ok: false, status: 500 });
    expect(await persistWorkspaceToServer(ws, f(201, {}))).toMatchObject({ ok: false });
    const net = vi.fn().mockRejectedValue(new Error('x')) as unknown as typeof fetch;
    expect(await persistWorkspaceToServer(ws, net)).toMatchObject({ ok: false, status: null });
    const ok = await persistWorkspaceToServer(ws, f(201, { workspace: { ...ws, id: 'uuid-serveur' } }));
    expect(ok).toMatchObject({ ok: true });
    expect(ok.ok && ok.workspace.id).toBe('uuid-serveur');
  });
});
