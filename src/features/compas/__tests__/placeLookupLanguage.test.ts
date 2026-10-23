import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Recherche de lieux dans la langue de l'interface (PLAN-100 6.4) : Photon (`lang`), Nominatim
 * ou LocationIQ (`accept-language`), Geoapify (`lang`). En français, adresses et clés de cache
 * IDENTIQUES à celles d'avant (les entrées partagées restent servies) ; en anglais, `en` partout
 * et une clé de cache distincte. Réseau simulé : aucun appel réel.
 */
vi.mock('server-only', () => ({}));
vi.mock('@/lib/i18n/serverLocale', () => ({ getRequestLocale: vi.fn(async () => 'fr') }));
vi.mock('@/lib/siteSlot', () => ({ photonSlot: vi.fn(async () => true) }));
vi.mock('@/lib/apiCredits', () => ({ GEOAPIFY_DAILY_CREDITS: 2700, takeApiCredits: vi.fn(async () => true) }));
vi.mock('../server/sharedCache', async (orig) => ({
  ...(await orig<typeof import('../server/sharedCache')>()),
  cached: vi.fn(async (_kind: string, _key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
}));
vi.mock('../server/locationIq', async (orig) => ({
  ...(await orig<typeof import('../server/locationIq')>()),
  nominatimJson: vi.fn(async () => null),
}));

import { lookupDestination, lookupNatural, lookupReverse, stageAliasCandidates } from '../server/placeLookup';
import { cached } from '../server/sharedCache';
import { locationIqUrl, nominatimJson } from '../server/locationIq';
import { getRequestLocale } from '@/lib/i18n/serverLocale';
import { languageCacheKey, photonLang } from '../server/mapLanguage';

const fetchMock = vi.fn(async (..._args: unknown[]) => new Response('{}', { status: 503 }));
const urls = () => fetchMock.mock.calls.map((c) => String(c[0]));
const keys = () => vi.mocked(cached).mock.calls.map((c) => `${c[0]}|${c[1]}`);

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('GEOAPIFY_API_KEY', 'cle-test');
  vi.mocked(getRequestLocale).mockResolvedValue('fr');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('photonLang : les seules langues du Photon public', () => {
  it('fr, en, de passent tels quels ; une langue absente du serveur public → default', () => {
    expect(photonLang('fr')).toBe('fr');
    expect(photonLang('en')).toBe('en');
    expect(photonLang('de')).toBe('de');
    // Vérifié le 17 octobre 2026 : « Language is not supported. Supported are: default, de, en, fr ».
    expect(photonLang('it')).toBe('default');
    expect(photonLang('es')).toBe('default');
  });
  it('clé de cache : inchangée en français, préfixée par la langue sinon', () => {
    expect(languageCacheKey('v3:8:lyon', 'fr')).toBe('v3:8:lyon');
    expect(languageCacheKey('v3:8:lyon', 'en')).toBe('en:v3:8:lyon');
  });
});

describe('français : adresses et clés d’avant, à l’identique', () => {
  it('lieu naturel : Photon en lang=fr, clé natural:v1', async () => {
    await lookupNatural('Calanques', null);
    expect(urls()[0]).toContain('https://photon.komoot.io/api/?q=Calanques&limit=10&lang=fr&osm_tag=natural');
    expect(keys()).toEqual(['place|natural:v1:calanques']);
  });
  it('destination : Photon, Nominatim puis Geoapify, tous en français, clé v4', async () => {
    await lookupDestination('Lyon');
    expect(urls()[0]).toContain('&lang=fr');
    expect(String(vi.mocked(nominatimJson).mock.calls[0]?.[0])).toBe(
      'https://nominatim.openstreetmap.org/search?q=Lyon&format=jsonv2&addressdetails=1&limit=8&accept-language=fr'
    );
    const geo = urls().find((u) => u.includes('api.geoapify.com/v1/geocode/search')) ?? '';
    expect(geo).not.toBe('');
    expect(new URL(geo).searchParams.get('lang')).toBe('fr');
    expect(keys()).toEqual(['place|v4:8:lyon']);
  });
  it('géocodage inverse : Photon et Nominatim en français, clé v2', async () => {
    await lookupReverse(45.76, 4.83);
    expect(urls()[0]).toBe('https://photon.komoot.io/reverse?lat=45.76&lon=4.83&limit=1&lang=fr');
    expect(String(vi.mocked(nominatimJson).mock.calls[0]?.[0])).toContain('&accept-language=fr');
    const geo = urls().find((u) => u.includes('api.geoapify.com')) ?? '';
    expect(new URL(geo).searchParams.get('lang')).toBe('fr');
    expect(keys()).toEqual(['reverse|v2:45.76,4.83']);
  });
});

describe('anglais : la langue de l’interface transmise à chaque carte', () => {
  beforeEach(() => vi.mocked(getRequestLocale).mockResolvedValue('en'));

  it('lieu naturel : Photon en lang=en, clé distincte', async () => {
    await lookupNatural('Calanques', null);
    expect(urls()[0]).toContain('&lang=en&');
    expect(keys()).toEqual(['place|en:natural:v1:calanques']);
  });
  it('destination : Photon lang=en, Nominatim accept-language=en, Geoapify lang=en', async () => {
    await lookupDestination('Lyon');
    expect(urls()[0]).toContain('&lang=en');
    expect(String(vi.mocked(nominatimJson).mock.calls[0]?.[0])).toContain('&accept-language=en');
    const geo = urls().find((u) => u.includes('api.geoapify.com/v1/geocode/search')) ?? '';
    expect(new URL(geo).searchParams.get('lang')).toBe('en');
    expect(keys()).toEqual(['place|en:v4:8:lyon']);
  });
  it('géocodage inverse et autres noms : en anglais, clés distinctes', async () => {
    await lookupReverse(45.76, 4.83);
    await stageAliasCandidates('Aguas Calientes', 'PE');
    expect(urls()[0]).toContain('&lang=en');
    const nomi = vi.mocked(nominatimJson).mock.calls.map((c) => String(c[0]));
    expect(nomi.every((u) => u.includes('accept-language=en'))).toBe(true);
    expect(keys()).toEqual(['reverse|en:v2:45.76,4.83', 'place|en:alias:v1:PE:aguas calientes']);
  });
  it('LocationIQ garde la langue demandée à Nominatim', () => {
    const via = locationIqUrl('https://nominatim.openstreetmap.org/search?q=Lyon&format=jsonv2&accept-language=en', 'k')!;
    expect(new URL(via).searchParams.get('accept-language')).toBe('en');
  });
});
