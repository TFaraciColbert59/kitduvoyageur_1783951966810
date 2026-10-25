import type { CompasPoint } from '@/features/compas/server/getCompasData';
import type { V5StayOption } from '@/features/compas/v5/types';

/**
 * Données d'EXEMPLE du banc de la carte vivante v5 (Vercors). Elles servent à regarder la carte, pas à informer :
 * le tracé est une courbe calculée entre les lieux, les nuits, photos et prix sont fictifs. Rien de tout cela
 * n'existe en production (la page est introuvable hors `next dev`).
 */
export const SAMPLE_ORIGIN = { lat: 45.0, lon: 5.4, title: 'Sainte-Eulalie-en-Royans' };

export const SAMPLE_STAGES = [
  { day: 1, lat: 45.05, lon: 5.46, title: 'Sainte-Eulalie-en-Royans → Rencurel' },
  { day: 2, lat: 45.06, lon: 5.54, title: 'Rencurel → Corrençon-en-Vercors' },
  { day: 3, lat: 44.99, lon: 5.6, title: 'Corrençon-en-Vercors → La Chapelle-en-Vercors' },
];

/** Tracé d'exemple : une courbe sinueuse entre les lieux (pas un sentier réel). */
export function sampleTrack(): Record<string, unknown> {
  const pts: Array<[number, number]> = [
    [SAMPLE_ORIGIN.lat, SAMPLE_ORIGIN.lon],
    ...SAMPLE_STAGES.map((s) => [s.lat, s.lon] as [number, number]),
  ];
  const coordinates: Array<[number, number]> = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    const steps = 80;
    for (let k = 0; k < steps; k++) {
      const u = k / steps;
      const wiggle = Math.sin(u * Math.PI * 6 + i) * 0.003 + Math.sin(u * Math.PI * 17 + i * 2) * 0.0009;
      coordinates.push([a[1] + (b[1] - a[1]) * u + wiggle * 0.8, a[0] + (b[0] - a[0]) * u + wiggle]);
    }
  }
  const last = pts[pts.length - 1];
  coordinates.push([last[1], last[0]]);
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } };
}

/** Vignette d'exemple (dégradé), pour voir le chemin « avec photo » sans réseau. */
function swatch(a: string, b: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="96" height="96" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function stay(id: string, name: string, kind: V5StayOption['kind'], lat: number, lon: number, over: Partial<V5StayOption> = {}): V5StayOption {
  return { id, name, kind, lat, lon, distanceM: 300, elevationM: null, price: null, photo: null, source: 'Exemple', url: null, partner: null, ...over };
}

export const SAMPLE_NIGHTS = [
  {
    day: 1,
    chosen: stay('demo:gite', 'Gîte de Rencurel', 'hebergement', 45.052, 5.462, {
      photo: { url: swatch('rgb(120 160 110)', 'rgb(30 70 50)'), credit: 'Exemple', license: 'Domaine public', pageUrl: 'https://example.org' },
    }),
    alternatives: [
      stay('demo:hotel', 'Hôtel des Bruyères', 'hebergement', 45.055, 5.468, { price: { perPerson: 58, currency: 'EUR', basis: 'bareme', asOf: '2026-10-01' } }),
      stay('demo:camp', 'Camping de la Bourne', 'camping', 45.0535, 5.4655, { price: { perPerson: 12, currency: 'EUR', basis: 'bareme', asOf: '2026-10-01' } }),
      stay('demo:ref', 'Refuge de la Molière', 'refuge', 45.046, 5.456, {
        price: { perPerson: 24, currency: 'EUR', basis: 'partenaire', asOf: '2026-10-20' },
        photo: { url: swatch('rgb(190 170 120)', 'rgb(110 90 60)'), credit: 'Exemple', license: 'Domaine public', pageUrl: 'https://example.org' },
      }),
    ],
    booked: true,
    priceLabel: '52 €',
  },
  {
    day: 2,
    chosen: stay('demo:hotel2', 'Refuge de Corrençon', 'refuge', 45.062, 5.543),
    alternatives: [
      stay('demo:chalet', 'Chalet des Hauts-Plateaux', 'hebergement', 45.066, 5.55),
      stay('demo:bivouac', 'Bivouac du col', 'bivouac', 45.058, 5.537),
    ],
    booked: false,
    priceLabel: '28 €',
  },
];

/** Points utiles d'exemple, plus une centaine de « sources » pour éprouver le niveau de détail et le plafond. */
export function samplePoints(): CompasPoint[] {
  const base: CompasPoint[] = [
    { id: 'peak-1', kind: 'poi', category: 'peak', label: 'Le Moucherotte · 1 901 m', lat: 45.1, lon: 5.6 },
    { id: 'peak-2', kind: 'poi', category: 'peak', label: 'Grand Veymont · 2 341 m', lat: 44.94, lon: 5.52 },
    { id: 'shop-1', kind: 'poi', category: 'commerce', label: 'Magasin de sport, Villard-de-Lans', lat: 45.07, lon: 5.55 },
    { id: 'park-1', kind: 'poi', category: 'parking', label: 'Parking du départ', lat: 44.995, lon: 5.395 },
    { id: 'ref-1', kind: 'poi', category: 'refuge', label: 'Refuge des Hauts-Plateaux', lat: 45.01, lon: 5.58 },
    { id: 'camp-1', kind: 'poi', category: 'camping', label: 'Camping du Vercors', lat: 45.03, lon: 5.5 },
    { id: 'wc-1', kind: 'poi', category: 'toilets', label: 'Toilettes du col', lat: 45.058, lon: 5.52 },
    { id: 'view-1', kind: 'poi', category: 'viewpoint', label: 'Belvédère de Rencurel', lat: 45.045, lon: 5.475 },
    { id: 'food-1', kind: 'poi', category: 'resto', label: 'Auberge de Corrençon', lat: 45.064, lon: 5.538 },
    { id: 'step-1', kind: 'step', category: 'step', label: 'Une étape (ignorée)', lat: 45.02, lon: 5.45 },
  ];
  const springs: CompasPoint[] = Array.from({ length: 110 }, (_, i) => ({
    id: `spring-${i}`,
    kind: 'poi',
    category: 'water',
    label: `Source ${i + 1}`,
    lat: 44.97 + ((i * 37) % 100) * 0.0011,
    lon: 5.38 + ((i * 53) % 100) * 0.0024,
  }));
  return [...base, ...springs];
}
