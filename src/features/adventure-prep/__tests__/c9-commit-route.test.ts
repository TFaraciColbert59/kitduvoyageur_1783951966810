/**
 * C9 — la route de commit, elle.
 *
 * `c9-heure-depart.test.ts` verifie la REGLE (forme de l'heure, ecriture dans
 * la metadata). Ce fichier verifie que la route l'APPLIQUE reellement : c'est
 * une autre question, et une regle non branchee ne prouve rien.
 *
 * Deux verifications distinctes :
 *   - une heure hors forme est REFUSEE (400) avant tout ecriture ;
 *   - une heure valide atteint la ligne `trips` posee.
 *
 * Le second lit la ligne reellement passee a Supabase : il n'emet pas
 * `expect(unechose).toHaveBeenCalled()`, il regarde ce que la base aurait
 * recu.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft } from '../types';

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), enforceRateLimit: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: mocks.enforceRateLimit }));
vi.mock('@/lib/events/eventBus', () => ({ emitEvent: vi.fn() }));

import { POST } from '@/app/api/adventure/commit/route';

/** Ligne `trips` reellement posee, relevee au moment du insert. */
let ligneTrips: Record<string, unknown> | null = null;
let insere = false;
/** Lignes que la route tenterait d'inserer dans `trip_collaborators`. */
let insertsCollab: Record<string, unknown>[] = [];
/** Le trigger a-t-il pose la ligne owner ? */
let ownerPose = true;
/** Tables dont la route a demande la suppression (annulation). */
let suppressions: string[] = [];

function clientFactice() {
  const selectSlug = {
    eq: () => Promise.resolve({ data: [], error: null }),
  };
  const from = (table: string) => {
    if (table === 'trips') {
      return {
        select: () => selectSlug,
        insert: (row: Record<string, unknown>) => {
          ligneTrips = row;
          insere = true;
          return { select: () => ({ single: () => Promise.resolve({ data: { id: 't1', slug: row.slug }, error: null }) }) };
        },
        delete: () => {
          suppressions.push('trips');
          return { eq: () => Promise.resolve({ data: null, error: null }) };
        },
      };
    }
    if (table === 'trip_steps') {
      return {
        insert: () => Promise.resolve({ data: null, error: null }),
        delete: () => {
          suppressions.push('trip_steps');
          return { eq: () => Promise.resolve({ data: null, error: null }) };
        },
      };
    }
    if (table === 'trip_collaborators') {
      // La base reelle : le trigger `trg_trips_insert_owner` a deja pose la
      // ligne owner, et la policy d'insertion refuse le role `owner` au client.
      return {
        insert: (row: Record<string, unknown>) => {
          insertsCollab.push(row);
          return Promise.resolve({
            data: null,
            error: row.role === 'owner' ? { code: '42501', message: 'new row violates row-level security policy' } : null,
          });
        },
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: ownerPose ? { role: 'owner' } : null, error: null }),
            }),
          }),
        }),
      };
    }
    return { insert: () => Promise.resolve({ data: null, error: null }) };
  };
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
    from,
  };
}

function requete(calendar: Partial<AdventurePrepDraft['calendar']>) {
  const draft = fullDraft({ calendar: { ...fullDraft().calendar, ...calendar } as never });
  return new NextRequest('http://localhost/api/adventure/commit', {
    method: 'POST',
    body: JSON.stringify({ draft }),
  });
}

beforeEach(() => {
  ligneTrips = null;
  insere = false;
  insertsCollab = [];
  ownerPose = true;
  suppressions = [];
  mocks.createClient.mockReset().mockImplementation(async () => clientFactice());
  mocks.enforceRateLimit.mockReset().mockResolvedValue(null);
});

describe('C9-5 — la route refuse une heure qui n’en est pas une', () => {
  it('C9-5a: CONTRE-EXEMPLE — `25:00` est refuse et RIEN n’est ecrit', async () => {
    const rep = await POST(requete({ startTime: '25:00' }));
    expect(rep.status).toBe(400);
    expect(insere).toBe(false);
    expect(ligneTrips).toBeNull();
  });

  it('C9-5b: `12:60` et un texte libre sont refusés de la même façon', async () => {
    for (const mauvaise of ['12:60', 'demain matin', '']) {
      const rep = await POST(requete({ startTime: mauvaise }));
      expect(rep.status).toBe(400);
      expect(insere).toBe(false);
    }
  });

  it('C9-5c: l’erreur nomme le champ fautif', async () => {
    const rep = await POST(requete({ startTime: '25:00' }));
    const corps = (await rep.json()) as { fields?: string[] };
    expect(corps.fields).toContain('draft.calendar.startTime');
  });
});

describe('C9-6 — la route depose l’heure saisie, et rien d’autre', () => {
  it('C9-6a: une heure valide atteint la ligne posee', async () => {
    const rep = await POST(requete({ startTime: '08:30' }));
    expect(rep.status).toBe(201);
    expect(insere).toBe(true);
    const prep = (ligneTrips as unknown as { metadata: { prep: Record<string, unknown> } }).metadata.prep;
    expect(prep.startTime).toBe('08:30');
  });

  it('C9-6b: CONTRE-EXEMPLE — sans heure saisie, la ligne n’en porte aucune', async () => {
    const draft = fullDraft();
    // Le champ disparait completement : c'est le cas d'un brouillon enregistre
    // avant que l'heure existe.
    const { startTime: _ignore, ...calendarSansHeure } = draft.calendar;
    const req = new NextRequest('http://localhost/api/adventure/commit', {
      method: 'POST',
      body: JSON.stringify({ draft: { ...draft, calendar: calendarSansHeure } }),
    });
    const rep = await POST(req);
    expect(rep.status).toBe(201);
    const prep = (ligneTrips as unknown as { metadata: { prep: Record<string, unknown> } }).metadata.prep;
    expect(Object.prototype.hasOwnProperty.call(prep, 'startTime')).toBe(false);
  });

  it('C9-6c: la ligne conserve ce que le commit avait deja pose', async () => {
    await POST(requete({ startTime: '06:15' }));
    const prep = (ligneTrips as unknown as { metadata: { prep: Record<string, unknown> } }).metadata.prep;
    // `days` vient de `tripCommit`, pas de la route : la route ne l'efface pas.
    expect(prep.days).toBeDefined();
    expect(prep.startTime).toBe('06:15');
  });
});

describe('C9-7 — le proprietaire vient du trigger, pas de la route', () => {
  it('C9-7a: la route n’insere jamais la ligne owner (la policy la refuse au client)', async () => {
    const rep = await POST(requete({ startTime: '08:30' }));
    expect(rep.status).toBe(201);
    expect(insertsCollab).toEqual([]);
    expect(suppressions).toEqual([]);
  });

  it('C9-7b: CONTRE-EXEMPLE — sans ligne owner posee, le voyage est annule', async () => {
    ownerPose = false;
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rep = await POST(requete({ startTime: '08:30' }));
    expect(rep.status).toBe(503);
    expect(suppressions).toEqual(['trip_steps', 'trips']);
    erreur.mockRestore();
  });
});
