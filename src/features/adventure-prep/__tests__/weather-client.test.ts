/**
 * WEA-CLI — le passage par /api/weather, cote navigateur.
 *
 * L ecran de preparation importait le module SERVEUR et appelait Open-Meteo
 * depuis le navigateur : le rate limit, le cache central et la validation de la
 * plage etaient donc court-circuites. Ici on verifie que l ecran passe par la
 * route, et qu il ne fait surtout PAS confiance a la reponse.
 *
 * Le piege principal : une serie decalee. Si le fournisseur repond avec des
 * dates differentes de celles demandees, le jour 1 afficherait la meteo d un
 * autre jour. Aligner est interdit : on refuse la serie entiere.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWeatherThroughApi, readWeatherResponse, weatherQuery } from '../weatherClient';

const ANCHOR = { lat: 45.923, lon: 6.869 };
const DATES = ['2026-09-28', '2026-09-29'];

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function day(date: string, extra: Record<string, unknown> = {}) {
  return {
    date,
    tMaxC: 22.5,
    tMinC: 13,
    precipMm: 0,
    precipProbPct: 3,
    windMaxKmh: 7.7,
    code: 3,
    label: 'Partiellement nuageux',
    ...extra,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('WEA-CLI — la requete construite', () => {
  it('WEA-CLI-01: la cible est bien /api/weather, jamais Open-Meteo en direct', () => {
    const query = weatherQuery(ANCHOR, DATES) as string;
    expect(query.startsWith('/api/weather?')).toBe(true);
    expect(query).not.toContain('open-meteo');
  });

  it('WEA-CLI-02: les bornes de la plage sont les dates de l aventure', () => {
    const query = weatherQuery(ANCHOR, DATES) as string;
    expect(query).toContain('from=2026-09-28');
    expect(query).toContain('to=2026-09-29');
    expect(query).toContain('lat=45.923');
    expect(query).toContain('lon=6.869');
  });

  it('WEA-CLI-03: une plage vide ou une ancre non finie ne fabrique aucune requete', () => {
    expect(weatherQuery(ANCHOR, [])).toBeNull();
    expect(weatherQuery({ lat: Number.NaN, lon: 6.869 }, DATES)).toBeNull();
  });

  it('WEA-CLI-04: une seule journee se demande sur une plage d un jour', () => {
    const query = weatherQuery(ANCHOR, ['2026-09-28']) as string;
    expect(query).toContain('from=2026-09-28&to=2026-09-28');
  });
});

describe('WEA-CLI — la reponse ne fait pas confiance a la route', () => {
  it('WEA-CLI-10: une serie complete et alignee est reprise telle quelle', () => {
    const days = readWeatherResponse({ status: 'ok', days: [day(DATES[0]), day(DATES[1])] }, DATES);
    expect(days).toHaveLength(2);
    expect(days?.[0]).toMatchObject({ date: '2026-09-28', tMaxC: 22.5, tMinC: 13 });
  });

  it('WEA-CLI-11: une serie decalee est refusee, jamais re-alignee', () => {
    // Le jour 1 ne doit jamais afficher la meteo d une autre date.
    const days = readWeatherResponse({ status: 'ok', days: [day('2026-09-29'), day('2026-09-30')] }, DATES);
    expect(days).toBeNull();
  });

  it('WEA-CLI-12: une serie trop courte ou trop longue est refusee', () => {
    expect(readWeatherResponse({ status: 'ok', days: [day(DATES[0])] }, DATES)).toBeNull();
    expect(
      readWeatherResponse({ status: 'ok', days: [day(DATES[0]), day(DATES[1]), day(DATES[1])] }, DATES),
    ).toBeNull();
  });

  it('WEA-CLI-13: un statut autre que « ok » vaut meteo absente', () => {
    expect(readWeatherResponse({ status: 'unavailable', days: [] }, DATES)).toBeNull();
    expect(readWeatherResponse({ status: 'invalid', days: [] }, DATES)).toBeNull();
    expect(readWeatherResponse(null, DATES)).toBeNull();
    expect(readWeatherResponse({ days: [day(DATES[0]), day(DATES[1])] }, DATES)).toBeNull();
  });

  it('WEA-CLI-14: un nombre absent ou aberrant devient null, jamais zero', () => {
    const days = readWeatherResponse(
      { status: 'ok', days: [day(DATES[0], { tMaxC: 'chaud' }), day(DATES[1], { precipMm: null })] },
      DATES,
    );
    expect(days?.[0].tMaxC).toBeNull();
    expect(days?.[1].precipMm).toBeNull();
    expect(days?.every((d) => d.tMinC !== 0)).toBe(true);
  });

  it('WEA-CLI-15: le libelle est recalcule depuis le code, pas recopie', () => {
    const days = readWeatherResponse(
      { status: 'ok', days: [day(DATES[0], { code: 61, label: 'mensonge' }), day(DATES[1], { code: 0 })] },
      DATES,
    );
    expect(days?.[0].label).toBe('Pluie');
  });

  it('WEA-CLI-16: un code inconnu laisse le libelle vide plutot qu inventer un ciel', () => {
    const days = readWeatherResponse(
      { status: 'ok', days: [day(DATES[0], { code: null }), day(DATES[1], { code: null })] },
      DATES,
    );
    expect(days?.[0].label).toBe('');
  });
});

describe('WEA-CLI — aucun silence ni exception', () => {
  it('WEA-CLI-20: un 200 complet donne les jours', async () => {
    fetchMock.mockResolvedValue(response({ status: 'ok', days: [day(DATES[0]), day(DATES[1])] }));
    const days = await fetchWeatherThroughApi(ANCHOR, DATES);
    expect(days).toHaveLength(2);
  });

  it('WEA-CLI-21: un 503 devient null, jamais une liste vide affichable', async () => {
    fetchMock.mockResolvedValue(response({ status: 'unavailable', days: [] }, 503));
    expect(await fetchWeatherThroughApi(ANCHOR, DATES)).toBeNull();
  });

  it('WEA-CLI-22: un 400 devient null', async () => {
    fetchMock.mockResolvedValue(response({ status: 'invalid', reason: 'date_range_expected' }, 400));
    expect(await fetchWeatherThroughApi(ANCHOR, DATES)).toBeNull();
  });

  it('WEA-CLI-23: une panne reseau devient null, sans propager l exception', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await fetchWeatherThroughApi(ANCHOR, DATES)).toBeNull();
  });

  it('WEA-CLI-24: un corps illisible devient null', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('corps casse');
      },
    } as unknown as Response);
    expect(await fetchWeatherThroughApi(ANCHOR, DATES)).toBeNull();
  });

  it('WEA-CLI-25: une plage vide n appelle personne', async () => {
    expect(await fetchWeatherThroughApi(ANCHOR, [])).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
