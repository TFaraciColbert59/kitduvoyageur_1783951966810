/**
 * Overpass simulé pour `lookupWaterSources` (plan 100, 2.12 : aucun test
 * unitaire n'appelle un serveur public ; avant, ces tests interrogeaient
 * overpass-api.de pour de vrai).
 *
 * La réponse a la forme réelle d'Overpass (`{ elements: [...] }`) et contient
 * les nœuds `amenity=drinking_water` de la zone pilote Chamonix (ceux du
 * repli du connecteur), plus un nœud fictif à Annecy, hors de toutes les boîtes
 * testées : le filtre de la boîte du connecteur est donc éprouvé, pas celui du
 * faux serveur.
 */
import { vi } from 'vitest';

export interface OverpassNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

export const OVERPASS_WATER_NODES: OverpassNode[] = [
  { type: 'node', id: 1875111743, lat: 45.9037283, lon: 6.8348914, tags: { amenity: 'drinking_water', name: 'Puits du Glacier' } },
  { type: 'node', id: 3953793268, lat: 45.9406346, lon: 6.8869224, tags: { amenity: 'drinking_water', name: 'Fontaine des Praz' } },
  { type: 'node', id: 4440723933, lat: 45.9319265, lon: 6.9174517, tags: { amenity: 'drinking_water' } },
  // Nœud fictif à Annecy : hors des boîtes de Chamonix, du Sahara et du Maroc testées.
  { type: 'node', id: 1, lat: 45.8992, lon: 6.1294, tags: { amenity: 'drinking_water', name: 'Fontaine hors boîte' } },
];

/** `fetch` qui répond comme Overpass ; tout autre hôte est une erreur du test. */
export function overpassWaterFetch(nodes: OverpassNode[] = OVERPASS_WATER_NODES) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== 'overpass-api.de') throw new Error(`Appel inattendu dans le test : ${url.host}`);
    return new Response(JSON.stringify({ version: 0.6, elements: nodes }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}
