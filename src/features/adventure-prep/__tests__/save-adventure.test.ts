import { describe, it, expect, vi } from 'vitest';
import { readSaveResponse, saveAdventure, COMMIT_ENDPOINT } from '../saveAdventure';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft } from '../types';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Brouillon minimalement enregistrable. */
function ready(overrides: Partial<AdventurePrepDraft> = {}): AdventurePrepDraft {
  return fullDraft(overrides);
}

describe('readSaveResponse — une reponse n est creditee que si elle prouve', () => {
  it('201 avec tripId = enregistre', async () => {
    const out = await readSaveResponse(json({ tripId: 'trip_1', slug: 'chamonix' }, 201));
    expect(out).toEqual({ status: 'saved', tripId: 'trip_1', slug: 'chamonix' });
  });

  it('200 sans tripId ne devient jamais « enregistre »', async () => {
    const out = await readSaveResponse(json({ ok: true }, 200));
    expect(out.status).toBe('failed');
  });

  it('un corps illisible ne fait pas echouer la lecture', async () => {
    const out = await readSaveResponse(new Response('pas du json', { status: 200 }));
    expect(out.status).toBe('failed');
  });

  it('401 devient un refus actionnable, pas une panne', async () => {
    const out = await readSaveResponse(json({ error: 'Authentification requise' }, 401));
    expect(out.status).toBe('rejected');
    expect(out).toHaveProperty('message', expect.stringContaining('Connecte-toi'));
  });

  it('422 remonte le motif du serveur', async () => {
    const out = await readSaveResponse(
      json({ error: 'Il manque une activité, un lieu de départ ou une date.' }, 422),
    );
    expect(out.status).toBe('rejected');
    expect(out).toHaveProperty('message', 'Il manque une activité, un lieu de départ ou une date.');
  });

  it('422 sans message reste actionnable', async () => {
    const out = await readSaveResponse(json({}, 422));
    expect(out).toHaveProperty('message', expect.stringContaining('incomplète'));
  });

  it('503 est une panne reessayable', async () => {
    const out = await readSaveResponse(json({ error: 'Base indisponible' }, 503));
    expect(out).toEqual({ status: 'failed', message: 'Base indisponible' });
  });

  it('429 est une panne reessayable avec un message dedie', async () => {
    const out = await readSaveResponse(json({}, 429));
    expect(out).toHaveProperty('message', expect.stringContaining('Trop d’enregistrements'));
  });
});

describe('saveAdventure — le bouton qui cree reellement le voyage', () => {
  it('appelle la route de commit avec le brouillon', async () => {
    const post = vi.fn().mockResolvedValue(json({ tripId: 'trip_9', slug: 'x' }, 201));
    const outcome = await saveAdventure(ready(), { post });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe(COMMIT_ENDPOINT);
    expect(post.mock.calls[0][1]).toHaveProperty('draft');
    expect(outcome).toEqual({ status: 'saved', tripId: 'trip_9', slug: 'x' });
  });

  it('refuse SANS appeler le serveur quand une donnee manque', async () => {
    const post = vi.fn();
    const outcome = await saveAdventure(ready({ calendar: { startDate: null, durationDays: 3, durationIsSuggested: false, returnDate: null } }), { post });
    expect(post).not.toHaveBeenCalled();
    expect(outcome.status).toBe('rejected');
    expect(outcome).toHaveProperty('message', expect.stringContaining('date'));
  });

  it('refuse SANS appeler le serveur quand l activite manque', async () => {
    const post = vi.fn();
    const outcome = await saveAdventure(ready({ activities: { primary: null, extra: [], nights: [] } }), { post });
    expect(post).not.toHaveBeenCalled();
    expect(outcome.status).toBe('rejected');
  });

  it('une panne reseau devient un echec, jamais une levee', async () => {
    const post = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const outcome = await saveAdventure(ready(), { post });
    expect(outcome.status).toBe('failed');
    expect(outcome).toHaveProperty('message', expect.stringContaining('connexion'));
  });

  it('une annulation est signalee comme telle, pas comme une panne', async () => {
    const controller = new AbortController();
    const post = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));
    controller.abort();
    const outcome = await saveAdventure(ready(), { post }, controller.signal);
    expect(outcome).toEqual({ status: 'failed', message: 'Enregistrement annulé.' });
  });
});
