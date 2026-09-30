import { describe, it, expect, vi } from 'vitest';
import { isPlanId, loadSavedPlan, saveAdventure } from '../savedPlanClient';
import { buildAcceptedPlan } from '../adventureRequest';
import { migratePersistedPrep } from '../store/useAdventurePrepStore';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft } from './fixtures';

const PLAN_ID = 'c0000000-0000-4000-8000-0000000000aa';

function draftWithItinerary() {
  const base = fullDraft();
  return { ...base, itinerary: buildItinerary(base) };
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('isPlanId — seul un UUID ouvre un plan', () => {
  it('SP-01: accepte un UUID, refuse le reste', () => {
    expect(isPlanId(PLAN_ID)).toBe(true);
    expect(isPlanId('../../admin')).toBe(false);
    expect(isPlanId('')).toBe(false);
    expect(isPlanId(undefined)).toBe(false);
  });
});

describe('loadSavedPlan — ouvrir une aventure enregistrée', () => {
  it('SP-10: plan propriétaire ⇒ brouillon relu à l’identique', async () => {
    const accepted = buildAcceptedPlan(draftWithItinerary());
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { acceptedPlan: accepted, version: { version: 3 }, canEdit: true }),
    );
    const result = await loadSavedPlan(PLAN_ID, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith(`/api/adventure/${PLAN_ID}`, expect.objectContaining({ method: 'GET' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.planVersion).toBe(3);
    expect(buildAcceptedPlan(result.draft)).toEqual(accepted);
  });

  it('SP-11: plan d’un autre (lecture seule) ⇒ refus explicite', async () => {
    const accepted = buildAcceptedPlan(fullDraft());
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { acceptedPlan: accepted, version: { version: 1 }, canEdit: false }),
    );
    expect(await loadSavedPlan(PLAN_ID, { fetchImpl })).toMatchObject({ ok: false, reason: 'non_modifiable' });
  });

  it('SP-12: plan antérieur au contrat ⇒ ancien format, jamais un brouillon inventé', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { acceptedPlan: null, version: { version: 1 }, canEdit: true }));
    expect(await loadSavedPlan(PLAN_ID, { fetchImpl })).toMatchObject({ ok: false, reason: 'ancien_format' });
  });

  it('SP-13: 404, 401 et réseau ⇒ messages distincts', async () => {
    expect(await loadSavedPlan(PLAN_ID, { fetchImpl: vi.fn(async () => jsonResponse(404, {})) })).toMatchObject({
      reason: 'introuvable',
    });
    expect(await loadSavedPlan(PLAN_ID, { fetchImpl: vi.fn(async () => jsonResponse(401, {})) })).toMatchObject({
      reason: 'connexion',
    });
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await loadSavedPlan(PLAN_ID, { fetchImpl: offline })).toMatchObject({ reason: 'reseau' });
  });

  it('SP-14: identifiant invalide ⇒ aucun appel réseau', async () => {
    const fetchImpl = vi.fn();
    expect(await loadSavedPlan('pas-un-uuid', { fetchImpl })).toMatchObject({ ok: false, reason: 'introuvable' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('saveAdventure — création ou nouvelle version', () => {
  it('SP-20: sans plan ⇒ POST generate avec clé d’idempotence et plan accepté', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(201, { planId: PLAN_ID, version: 1 }));
    const result = await saveAdventure({
      draft: fullDraft(),
      planId: null,
      planVersion: null,
      idempotencyKey: 'k-1',
      fetchImpl,
    });
    expect(result).toEqual({ ok: true, planId: PLAN_ID, planVersion: 1 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/adventure/generate');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('k-1');
    expect(JSON.parse(String(init.body)).acceptedPlan.schemaVersion).toBe(1);
  });

  it('SP-21: plan ouvert ⇒ PUT avec version attendue, jamais une seconde aventure', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { planId: PLAN_ID, version: 4 }));
    const result = await saveAdventure({
      draft: fullDraft(),
      planId: PLAN_ID,
      planVersion: 3,
      idempotencyKey: 'k-1',
      fetchImpl,
    });
    expect(result).toEqual({ ok: true, planId: PLAN_ID, planVersion: 4 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`/api/adventure/${PLAN_ID}`);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toMatchObject({ expectedVersion: 3 });
  });

  it('SP-22: conflit de version ⇒ message non destructif, pas de réessai automatique', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(409, { error: 'version_conflict' }));
    const result = await saveAdventure({ draft: fullDraft(), planId: PLAN_ID, planVersion: 1, idempotencyKey: 'k', fetchImpl });
    expect(result).toMatchObject({ ok: false, reason: 'conflit', retryable: false });
  });

  it('SP-23: quota ⇒ délai lisible, réessai autorisé', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(429, { retryAfterS: 600 }, { 'retry-after': '600' }));
    const result = await saveAdventure({ draft: fullDraft(), planId: null, planVersion: null, idempotencyKey: 'k', fetchImpl });
    expect(result).toMatchObject({ ok: false, reason: 'quota', retryable: true, retryAfterS: 600 });
    if (!result.ok) expect(result.message).toContain('10 minutes');
  });

  it('SP-24: génération déjà en cours ⇒ réessai sûr avec la même clé', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(409, {}));
    const result = await saveAdventure({ draft: fullDraft(), planId: null, planVersion: null, idempotencyKey: 'k', fetchImpl });
    expect(result).toMatchObject({ ok: false, reason: 'en_cours', retryable: true });
  });

  it('SP-25: aucun détail technique n’atteint l’écran', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(500, { error: 'relation "adventure_plans" does not exist' }));
    const result = await saveAdventure({ draft: fullDraft(), planId: null, planVersion: null, idempotencyKey: 'k', fetchImpl });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toContain('relation');
      expect(result.message).not.toMatch(/\d{3}/);
    }
  });

  it('SP-26: réponse sans identifiant ⇒ jamais présentée comme enregistrée', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(201, { version: 1 }));
    const result = await saveAdventure({ draft: fullDraft(), planId: null, planVersion: null, idempotencyKey: 'k', fetchImpl });
    expect(result.ok).toBe(false);
  });
});

describe('store — un brouillon en cours n’est jamais perdu à la mise à jour', () => {
  it('SP-30: état v1 (sans planId) repris avec plan détaché', () => {
    const draft = fullDraft();
    const migrated = migratePersistedPrep({ adventureId: 'av-1', draft });
    expect(migrated.draft).toEqual(draft);
    expect(migrated.planId).toBeNull();
    expect(migrated.planVersion).toBeNull();
  });

  it('SP-31: état illisible ⇒ vide, jamais une exception', () => {
    expect(migratePersistedPrep(null)).toEqual({});
    expect(migratePersistedPrep('corrompu')).toEqual({});
  });
});
