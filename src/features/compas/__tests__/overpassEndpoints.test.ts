import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../server/sharedCache', () => ({
  readShared: async () => undefined,
  cached: async (_kind: string, _key: string, _ttl: number, fn: () => Promise<unknown>) => fn(),
  coordKey: (lat: number, lon: number) => `${lat},${lon}`,
}));
import { lookupStagePois, OVERPASS_ENDPOINTS } from '../server/stagePoiLookup';
import { OVERPASS_ENDPOINTS as SITE_ENDPOINTS, resetOverpassQueue } from '@/lib/overpass';
import { __resetAmenityCache, fetchAmenitiesNear } from '@/lib/queries/amenities';
import { executeOverpassQuery } from '@/features/explorer-osm/adapters/overpassAdapter';
import { lookupWaterSources } from '@/features/trips/connectors/realDataConnectors';

/**
 * Plan 1.4 (8 octobre, lot B ; lot AA) : un seul serveur Overpass, celui dont
 * les conditions autorisent l'usage commercial. Le serveur principal du projet
 * et ses miroirs (kumi, .ru, mail.ru) renvoient les usages commerciaux vers
 * leurs propres serveurs. Le garde couvre TOUT `src/` : le Compas, « Partir
 * librement » (commodités), l'explorateur OSM et les points d'eau des voyages.
 */
const ALLOWED_HOST = 'overpass.private.coffee';

/** Les fichiers de code de `src/`, hors tests (qui peuvent nommer un serveur pour dire qu'il est interdit). */
function sourceFiles(): string[] {
  const root = path.join(process.cwd(), 'src');
  return (readdirSync(root, { recursive: true }) as string[])
    .map((f) => f.replace(/\\/g, '/'))
    .filter((f) => /\.(?:ts|tsx|js|jsx|mjs|cjs|json)$/.test(f))
    .filter((f) => !/(?:^|\/)__tests__\//.test(f) && !/\.(?:test|spec)\.[a-z]+$/.test(f))
    .map((f) => path.join(root, f));
}

/** Tout nom d'hôte qui désigne une instance Overpass (ou un miroir connu), dans le code comme dans les commentaires. */
const OVERPASS_HOST =
  /\b(?:[a-z0-9-]+\.)*overpass[a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:de|ru|fr|org|jp|ch|coffee|systems|eu|com|net|io|dev|cc)\b|\bmaps\.mail\.ru\b|\bkumi\.systems\b/gi;

describe('Overpass du site', () => {
  afterEach(() => vi.restoreAllMocks());

  it('interroge private.coffee seulement', () => {
    expect([...OVERPASS_ENDPOINTS]).toEqual(['https://overpass.private.coffee/api/interpreter']);
    // Le Compas et le reste du site partagent LA MÊME liste.
    expect([...SITE_ENDPOINTS]).toEqual([...OVERPASS_ENDPOINTS]);
  });

  it('aucune autre instance Overpass n’est référencée nulle part dans src/ (code et commentaires, hors tests)', () => {
    const files = sourceFiles();
    expect(files.length).toBeGreaterThan(500);
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(OVERPASS_HOST)) {
        if (m[0].toLowerCase() !== ALLOWED_HOST) offenders.push(`${path.relative(process.cwd(), file)} : ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
    // L'unique référence à l'adresse du serveur vit dans la file commune.
    const holders = files.filter((f) => readFileSync(f, 'utf8').includes(ALLOWED_HOST));
    expect(holders.map((f) => path.relative(process.cwd(), f).replace(/\\/g, '/'))).toContain('src/lib/overpass.ts');
  });

  it('le serveur ne se choisit pas par la configuration (plus de OVERPASS_API_URL)', () => {
    const offenders = sourceFiles().filter((f) => /OVERPASS_API_URL/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('une requête à la fois, même pour deux lieux cherchés ensemble (revue Codex)', async () => {
    resetOverpassQueue();
    let inFlight = 0;
    let maxInFlight = 0;
    const hosts: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      hosts.push(new URL(String(input)).host);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight -= 1;
      return new Response(JSON.stringify({ elements: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    await lookupStagePois([
      { lat: 45.92, lon: 6.87 },
      { lat: 46.2, lon: 7.1 },
    ]);
    expect(hosts).toEqual(['overpass.private.coffee', 'overpass.private.coffee']);
    expect(maxInFlight).toBe(1);
  });

  describe('la file est commune à tous les modules (Compas, commodités, explorateur, points d’eau)', () => {
    beforeEach(() => {
      resetOverpassQueue();
      __resetAmenityCache();
    });

    it('quatre modules qui interrogent Overpass en même temps : jamais deux requêtes ensemble, toutes sur private.coffee', async () => {
      let inFlight = 0;
      let maxInFlight = 0;
      const overpassHosts: string[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = new URL(String(input));
        // Photon (repli des commodités) est un autre service : ni compté ni retenu.
        if (url.host !== ALLOWED_HOST) {
          if (url.host.includes('overpass') || url.host.includes('mail.ru')) overpassHosts.push(url.host);
          return new Response(JSON.stringify({ features: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        overpassHosts.push(url.host);
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 12));
        inFlight -= 1;
        return new Response(JSON.stringify({ elements: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });
      await Promise.all([
        lookupStagePois([{ lat: 45.92, lon: 6.87 }]),
        fetchAmenitiesNear({ minLat: 45.8, maxLat: 45.95, minLng: 6.7, maxLng: 6.95 }),
        executeOverpassQuery('[out:json];node(1);out;'),
        lookupWaterSources({ minLat: 45.1, maxLat: 45.15, minLon: 6.1, maxLon: 6.15 }),
      ]);
      expect(overpassHosts.length).toBeGreaterThanOrEqual(4);
      expect(new Set(overpassHosts)).toEqual(new Set([ALLOWED_HOST]));
      expect(maxInFlight).toBe(1);
    });
  });
});
