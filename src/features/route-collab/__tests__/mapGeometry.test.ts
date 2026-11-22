import { describe, expect, it } from 'vitest';
import {
  cumulativeMeters,
  dayColorIndex,
  deviationFromTrack,
  findInsertionTarget,
  headingLabel,
  metersPerPixel,
  pointAtDistance,
  projectOnPolyline,
  sectionDayMap,
  slopeBucketOf,
  slopeLensSegments,
  sliceByRatio,
  splitPolylineAt,
  surfaceLensSegments,
} from '../mapGeometry';
import { baseWorkspace, section } from '../insights/__tests__/fixtures';

const LINE: Array<[number, number]> = [
  [6.0, 45.9],
  [6.13, 45.9],
  [6.26, 45.9],
];

describe('mapGeometry · projection sur le tracé', () => {
  it('projette un point voisin sur le bon segment avec sa distance au tracé', () => {
    const p = projectOnPolyline(LINE, [6.2, 45.9009]);
    expect(p?.index).toBe(1);
    expect(p!.distanceM).toBeGreaterThan(90);
    expect(p!.distanceM).toBeLessThan(110);
    expect(p!.point[0]).toBeCloseTo(6.2, 3);
  });

  it('borne la projection aux extrémités', () => {
    const p = projectOnPolyline(LINE, [5.9, 45.9]);
    expect(p?.t).toBe(0);
    expect(p?.alongM).toBe(0);
  });

  it('découpe la ligne au point projeté sans doublon', () => {
    const p = projectOnPolyline(LINE, [6.2, 45.9])!;
    const { first, second } = splitPolylineAt(LINE, p);
    expect(first[first.length - 1]).toEqual(p.point);
    expect(second[0]).toEqual(p.point);
    expect(first).toHaveLength(3);
    expect(second).toHaveLength(2);
  });

  it('interpole un point à une distance donnée et le borne', () => {
    const cum = cumulativeMeters(LINE);
    const mid = pointAtDistance(LINE, cum, cum[1])!;
    expect(mid[0]).toBeCloseTo(6.13, 5);
    expect(pointAtDistance(LINE, cum, -5)).toEqual([6.0, 45.9]);
    expect(pointAtDistance(LINE, cum, 1e9)).toEqual([6.26, 45.9]);
  });

  it('extrait une sous-ligne par ratios', () => {
    const half = sliceByRatio(LINE, 0, 0.5);
    expect(half[0]).toEqual([6.0, 45.9]);
    expect(half[half.length - 1][0]).toBeCloseTo(6.13, 3);
  });

  it('donne des mètres par pixel décroissants avec le zoom', () => {
    expect(metersPerPixel(45, 10)).toBeGreaterThan(metersPerPixel(45, 14));
  });
});

describe('mapGeometry · insertion dans le tronçon voisin (2.3)', () => {
  const ws = baseWorkspace();
  const ordered = ws.points;

  it('rend le tronçon voisin et le point de départ après lequel insérer', () => {
    const t = findInsertionTarget(ordered, ws.sections, 45.9006, 6.2, 150);
    expect(t?.sectionId).toBe('s2');
    expect(t?.afterPointId).toBe('b');
  });

  it('choisit le premier tronçon pour un geste près du début', () => {
    const t = findInsertionTarget(ordered, ws.sections, 45.9004, 6.05, 150);
    expect(t?.afterPointId).toBe('a');
  });

  it('ne rend rien au-delà du rayon : le point s’ajoutera en fin de liste', () => {
    expect(findInsertionTarget(ordered, ws.sections, 45.95, 6.2, 150)).toBeNull();
  });

  it('ignore un tronçon qui ne relie pas deux points consécutifs', () => {
    const [a, , c] = ordered;
    const skipping = [section('s-skip', a, c)];
    expect(findInsertionTarget(ordered, skipping, 45.9, 6.13, 500)).toBeNull();
  });
});

describe('mapGeometry · jours, lentilles', () => {
  it('rattache chaque tronçon au jour de son étape', () => {
    const ws = baseWorkspace();
    const m = sectionDayMap(ws.points, ws.sections, ws.stages);
    expect(m.get('s1')).toBe(1);
    expect(m.get('s2')).toBe(2);
  });

  it('cycle les couleurs de jour sur la palette', () => {
    expect(dayColorIndex(1, 8)).toBe(0);
    expect(dayColorIndex(9, 8)).toBe(0);
    expect(dayColorIndex(0, 8)).toBe(0);
    expect(dayColorIndex(3, 0)).toBe(0);
  });

  it('classe les pentes aux seuils 5, 10, 15 % et laisse « inconnu » sans altitude', () => {
    expect(slopeBucketOf(2)).toBe('flat');
    expect(slopeBucketOf(-7)).toBe('moderate');
    expect(slopeBucketOf(12)).toBe('sustained');
    expect(slopeBucketOf(-20)).toBe('steep');
    expect(slopeBucketOf(null)).toBe('unknown');
  });

  it('lentille Pente : un intervalle sans altitude est inconnu, pas plat', () => {
    const ws = baseWorkspace();
    const withEle = { ...ws.sections[0], elevationSamples: [1000, 1100, null] as Array<number | null> };
    const segs = slopeLensSegments([withEle]);
    expect(segs.length).toBe(2);
    expect(segs[0].bucket).not.toBe('unknown');
    expect(segs[1].bucket).toBe('unknown');
    expect(slopeLensSegments([ws.sections[1]])[0].bucket).toBe('unknown');
  });

  it('lentille Surface : découpe selon les ratios déclarés', () => {
    const ws = baseWorkspace();
    const s = {
      ...ws.sections[0],
      surfaceSegments: [
        { fromRatio: 0, toRatio: 0.4, surface: 'paved' as const },
        { fromRatio: 0.4, toRatio: 1, surface: 'trail' as const },
      ],
    };
    const segs = surfaceLensSegments([s]);
    expect(segs.map((x) => x.bucket)).toEqual(['paved', 'trail']);
  });
});

describe('mapGeometry · position en direct (2.9)', () => {
  it('mesure l’écart au tracé et dit quand on s’en éloigne', () => {
    const on = deviationFromTrack(LINE, [6.1, 45.90005]);
    expect(on?.offTrack).toBe(false);
    const off = deviationFromTrack(LINE, [6.1, 45.905]);
    expect(off?.offTrack).toBe(true);
    expect(off!.distanceM).toBeGreaterThan(400);
  });

  it('ne dit rien sans tracé (pas de 0 m inventé)', () => {
    expect(deviationFromTrack([[6, 45]], [6, 45])).toBeNull();
  });

  it('nomme le cap en points cardinaux, ou rien sans capteur', () => {
    expect(headingLabel(0)).toBe('N');
    expect(headingLabel(92)).toBe('E');
    expect(headingLabel(-45)).toBe('NO');
    expect(headingLabel(null)).toBeNull();
  });
});
