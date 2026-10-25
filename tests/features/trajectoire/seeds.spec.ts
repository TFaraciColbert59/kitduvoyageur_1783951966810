/**
 * T3 - Le carburant du plan : le constructeur de graines, et son gate de sortie.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  atScaleCountForZones,
  buildTraceSeeds,
  type PersonalHike,
  type TribeCarnet,
} from '@/features/trajectoire/domain/seeds';
import {
  AT_SCALE_THRESHOLD,
  countAtYourScale,
  matchTraces,
  scaleMatchScore,
  type TraceSeed,
} from '@/features/trajectoire/domain/traces';
import {
  H_MAX,
  hoursFromT,
  tAtZoneMiddle,
  zoneForHours,
  type TrajectoireZone,
} from '@/features/trajectoire/domain/scaleAxis';

/** Les trois zones representatives du gate de sortie du dossier. */
const GATE_ZONES: readonly TrajectoireZone[] = ['journee', 'raid', 'expedition'];

/**
 * Curseurs perso : deux zones couvertes en direct, une sortie courte en plus.
 * `Pyrenees` porte un accent ici et pas dans le carnet tribu - c'est
 * volontaire, la deduplication doit comparer sans diacritiques.
 */
const PERSONAL: readonly PersonalHike[] = [
  {
    id: 'p-bugey',
    label: 'Tour du lac de Sylans',
    hours: 2,
    distanceM: 9_400,
    region: 'Bugey',
    happenedAt: '2025-05-18',
  },
  {
    id: 'p-vercors',
    label: 'Grand Veymont',
    hours: 8,
    distanceM: 14_500,
    region: 'Vercors',
    happenedAt: '2024-06-02',
  },
  {
    id: 'p-pyrenees',
    label: 'Gavarnie - bivouac',
    hours: 30,
    distanceM: 62_000,
    region: 'Pyrénées',
    happenedAt: '2023-09-10',
  },
];

/** Carnets de la tribu : l'expedition du gate, et un doublon du Vercors. */
const TRIBE: readonly TribeCarnet[] = [
  { id: 'c-andes', author: 'Marco D.', label: 'Salkantay', hours: 144, region: 'Pérou' },
  {
    id: 'c-vercors-doublon',
    author: 'Kenji T.',
    label: 'Vercors - deux jours',
    hours: 8,
    region: 'vercors',
  },
  {
    id: 'c-dolomites',
    author: 'Sarah L.',
    label: 'Sentier des refuges',
    hours: 96,
    distanceM: 71_000,
    region: 'Dolomites',
  },
];

/** Entrees malformees : une seule doit survivre. */
const MALFORMED: readonly PersonalHike[] = [
  { id: 'x-zero', label: 'Sortie avortee', hours: 0, region: 'Neouvielle' },
  { id: 'x-negative', label: 'Course de fond', hours: -5, region: 'Ardeche' },
  { id: 'x-nan', label: 'Saisie cassee', hours: Number.NaN, region: 'Cerdagne' },
  { id: '   ', label: 'Sans identifiant', hours: 6, region: 'Queyras' },
  { id: 'x-distance', label: 'Trace sans longueur', hours: 5, distanceM: -3_200 },
  { id: 'x-plafond', label: 'Annee sabatique', hours: 5_000, region: 'Cercles polaires' },
];

describe('T3 - le carburant : gate de sortie', () => {
  it('GATE T3 : au moins 1 graine "a ton echelle" sur 3 zones distinctes (journee, raid, expedition)', () => {
    const seeds = buildTraceSeeds(PERSONAL, TRIBE);

    const counts = atScaleCountForZones(seeds, GATE_ZONES);
    expect(counts.map((entry) => entry.zone)).toEqual(['journee', 'raid', 'expedition']);
    for (const entry of counts) {
      expect(entry.count).toBeGreaterThanOrEqual(1);
    }

    // Les memes graines doivent passer le badge du moteur de matching
    // existant, sinon le gate ne dit rien du produit affiche.
    for (const entry of counts) {
      const matches = matchTraces(seeds, { hours: entry.hours, zone: entry.zone });
      expect(countAtYourScale(matches)).toBeGreaterThanOrEqual(1);
    }
  });

  it('le gate compte la graine qui franchit le seuil, pas celle qui frôle', () => {
    const seeds = buildTraceSeeds(PERSONAL, TRIBE);
    const journeeHours = hoursFromT(tAtZoneMiddle('journee'));
    const atScale = seeds.filter(
      (seed) => scaleMatchScore(seed.hours, journeeHours) >= AT_SCALE_THRESHOLD
    );

    // Le run de 2 h est proche de la journee sans franchir 0,82 : le gate est
    // discriminant, pas decoratif.
    expect(atScale.map((seed) => seed.id)).toEqual(['p-vercors']);
    expect(scaleMatchScore(2, journeeHours)).toBeLessThan(AT_SCALE_THRESHOLD);
  });
});

describe('T3 - le carburant : priorite et coherence', () => {
  it('la graine perso prime sur la graine tribu a echelle identique', () => {
    const seeds = buildTraceSeeds(PERSONAL, TRIBE);

    const vercors = seeds.filter((seed) => seed.context.startsWith('Vercors'));
    expect(vercors).toHaveLength(1);
    expect(vercors[0].id).toBe('p-vercors');
    expect(vercors[0].source).toBe('randonnee_perso');
    expect(seeds.some((seed) => seed.id === 'c-vercors-doublon')).toBe(false);
  });

  it('le dedoublonnage ignore accents et casse, mais seulement si la destination est connue', () => {
    const deduped = buildTraceSeeds(
      [{ id: 'p-1', label: 'Gavarnie', hours: 30, region: 'Pyrénées' }],
      [{ id: 'c-1', author: 'Marco D.', label: 'Gavarnie', hours: 30, region: 'pyrenees' }]
    );
    expect(deduped.map((seed) => seed.id)).toEqual(['p-1']);

    // Sans region, deux traces peuvent parler de deux endroits differents :
    // aucune n'est sacrifiee sur un doute.
    const anonymous = buildTraceSeeds(
      [{ id: 'p-2', label: 'Sortie du matin', hours: 30 }],
      [{ id: 'c-2', author: 'Marco D.', label: 'Sortie du matin', hours: 30 }]
    );
    expect(anonymous.map((seed) => seed.id)).toEqual(['p-2', 'c-2']);
  });

  it('la zone de chaque graine derive de ses heures, jamais de la saisie', () => {
    const seeds = buildTraceSeeds(PERSONAL, TRIBE);
    for (const seed of seeds) {
      expect(seed.zone).toBe(zoneForHours(seed.hours).id);
    }

    const raid = seeds.find((seed) => seed.id === 'p-pyrenees');
    expect(raid).toBeDefined();
    expect(raid?.zone).toBe('raid');

    const expedition = seeds.find((seed) => seed.id === 'c-andes');
    expect(expedition?.zone).toBe('expedition');
  });

  it('le contexte se compose du lieu, de l intitule, de l annee et de la distance', () => {
    const seeds = buildTraceSeeds(PERSONAL, TRIBE);
    const vercors = seeds.find((seed) => seed.id === 'p-vercors');
    expect(vercors?.context).toBe('Vercors - Grand Veymont - 2024 - 14,5 km');

    const dolomites = seeds.find((seed) => seed.id === 'c-dolomites');
    expect(dolomites?.context).toBe('Dolomites - Sentier des refuges - 71,0 km');
    expect(dolomites?.distanceM).toBe(71_000);
  });
});

describe('T3 - le carburant : determinisme et robustesse', () => {
  it('deterministe : deux constructions sur la meme entree rendent le meme tableau', () => {
    const personalBefore = structuredClone(PERSONAL) as readonly PersonalHike[];
    const tribeBefore = structuredClone(TRIBE) as readonly TribeCarnet[];

    const first = buildTraceSeeds(PERSONAL, TRIBE);
    const second = buildTraceSeeds(PERSONAL, TRIBE);

    expect(first).toEqual(second);
    expect(first.map((seed) => seed.id)).toEqual([
      'p-bugey',
      'p-vercors',
      'p-pyrenees',
      'c-andes',
      'c-dolomites',
    ]);
    // Les entrees ne sont jamais mutatees : l'immuabilite est une exigence.
    expect(PERSONAL).toEqual(personalBefore);
    expect(TRIBE).toEqual(tribeBefore);
  });

  it('entrees vides ou malformees : jamais d exception, toujours des bornes', () => {
    expect(buildTraceSeeds([], [])).toEqual([]);
    expect(buildTraceSeeds()).toEqual([]);
    expect(() => buildTraceSeeds(MALFORMED, [])).not.toThrow();

    const seeds = buildTraceSeeds(MALFORMED, []);

    // Heures nulles, negatives, NaN ou identifiant vide : la graine est
    // ignoree, pas de trace a vivrer.
    expect(seeds.map((seed) => seed.id)).toEqual(['x-distance', 'x-plafond']);
    expect(seeds[0].distanceM).toBeNull();

    // Heures au-dela de l'axe : ramenees a H_MAX, donc zone monde.
    expect(seeds[1].hours).toBe(H_MAX);
    expect(seeds[1].zone).toBe('monde');
    expect(seeds[1].zone).toBe(zoneForHours(H_MAX).id);
  });

  it('pur : ni reseau ni horloge systeme dans la construction', () => {
    const fetchStub = vi.fn();
    vi.stubGlobal('fetch', fetchStub);
    vi.useFakeTimers();
    let at2020: TraceSeed[] = [];
    let at2031: TraceSeed[] = [];
    try {
      vi.setSystemTime(new Date('2020-01-01T00:00:00.000Z'));
      at2020 = buildTraceSeeds(PERSONAL, TRIBE);
      vi.setSystemTime(new Date('2031-07-04T18:30:00.000Z'));
      at2031 = buildTraceSeeds(PERSONAL, TRIBE);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }

    expect(at2020).toEqual(at2031);
    expect(at2020.length).toBeGreaterThan(0);
    expect(fetchStub).not.toHaveBeenCalled();
  });
});
