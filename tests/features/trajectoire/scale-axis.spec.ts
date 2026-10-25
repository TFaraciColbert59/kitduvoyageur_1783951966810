/**
 * T0 - L'axe d'echelle : le coeur du domaine.
 * Frontieres de zones, echelle logarithmique, idempotence.
 */

import { describe, expect, it } from 'vitest';

import {
  H_MAX,
  H_MIN,
  ZONES,
  ZONE_ORDER,
  dangerForHours,
  DANGER_SPAN,
  dangerLevel,
  dangerRange,
  firstResolvableHour,
  lastResolvableHour,
  hoursFromT,
  progressInZone,
  stepGrain,
  tAtZoneMiddle,
  tAtZoneStart,
  tForZone,
  tFromHours,
  zoneForHours,
  zoneForT,
  zoneIndex,
} from '@/features/trajectoire/domain/scaleAxis';

describe("axe d'echelle - echelle logarithmique", () => {
  it('expose des bornes 1 h -> 720 h', () => {
    expect(H_MIN).toBe(1);
    expect(H_MAX).toBe(720);
  });

  it("respecte les extremites de l'axe", () => {
    expect(hoursFromT(0)).toBe(H_MIN);
    expect(hoursFromT(1)).toBe(H_MAX);
  });

  it('va dans le bon sens (croissant, strict)', () => {
    let previous = 0;
    for (let step = 0; step <= 100; step += 1) {
      const hours = hoursFromT(step / 100);
      expect(hours).toBeGreaterThanOrEqual(previous);
      previous = hours;
    }
  });

  it('h(t) suit bien exp(ln 1 + t * ln 720)', () => {
    for (const t of [0, 0.13, 0.37, 0.5, 0.78, 0.91, 1]) {
      const expected = Math.round(Math.exp(Math.log(1) + t * (Math.log(720) - Math.log(1))));
      expect(hoursFromT(t)).toBe(expected);
    }
  });

  it("tFromHours est l'inverse d'hoursFromT a 1 h pres", () => {
    for (const hours of [1, 3, 7, 12, 24, 48, 120, 169, 240, 500, 720]) {
      const roundTrip = hoursFromT(tFromHours(hours));
      expect(Math.abs(roundTrip - hours) / hours).toBeLessThanOrEqual(0.01);
    }
  });

  it('borne les entrees hors domaine sans lever', () => {
    expect(hoursFromT(-5)).toBe(H_MIN);
    expect(hoursFromT(12)).toBe(H_MAX);
    expect(tFromHours(0)).toBe(0);
    expect(tFromHours(99_999)).toBe(1);
    expect(Number.isNaN(hoursFromT(Number.NaN))).toBe(false);
  });
});

describe("axe d'echelle - zones", () => {
  it('couvre la table du dossier sans trou ni recouvrement', () => {
    const sorted = [...ZONES].sort((a, b) => a.minHours - b.minHours);
    expect(sorted[0].minHours).toBe(H_MIN);
    expect(sorted[sorted.length - 1].maxHours).toBe(H_MAX);
    for (let index = 1; index < sorted.length; index += 1) {
      expect(sorted[index].minHours).toBe(sorted[index - 1].maxHours);
    }
  });

  it('respecte les bornes de la table du dossier', () => {
    const table: Array<[string, number, number, number, number]> = [
      ['run', 1, 3, 15, 14],
      ['journee', 3, 12, 80, 30],
      ['raid', 12, 48, 300, 46],
      ['expedition', 48, 240, 3000, 62],
      ['monde', 240, 720, 20000, 74],
    ];
    for (const [id, min, max, radius, danger] of table) {
      const zone = ZONES.find((candidate) => candidate.id === id);
      expect(zone, id).toBeDefined();
      expect(zone?.minHours, id).toBe(min);
      expect(zone?.maxHours, id).toBe(max);
      expect(zone?.radiusKm, id).toBe(radius);
      expect(zone?.dangerBase, id).toBe(danger);
    }
  });

  it('attribue chaque frontiere a la zone du dossier', () => {
    const boundaries: Array<[number, string]> = [
      [1, 'run'],
      [3, 'run'],
      [3.5, 'journee'],
      [12, 'journee'],
      [13, 'raid'],
      [48, 'raid'],
      [49, 'expedition'],
      [240, 'expedition'],
      [241, 'monde'],
      [720, 'monde'],
    ];
    for (const [hours, expected] of boundaries) {
      expect(zoneForHours(hours).id, `${hours} h`).toBe(expected);
    }
  });

  it("reste total sur tout l'axe (aucune heure sans zone)", () => {
    for (let hours = H_MIN; hours <= H_MAX; hours += 1) {
      expect(ZONE_ORDER).toContain(zoneForHours(hours).id);
    }
  });

  it('donne la meme zone par t et par heures', () => {
    for (let step = 0; step <= 50; step += 1) {
      const t = step / 50;
      expect(zoneForT(t).id).toBe(zoneForHours(hoursFromT(t)).id);
    }
  });

  it('donne un index de zone monotone et coherent', () => {
    let previous = -1;
    for (const id of ZONE_ORDER) {
      const index = zoneIndex(id);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
  });
});

describe("axe d'echelle - progression et grain", () => {
  it('progression interne nulle au plancher, une au plafond', () => {
    for (const zone of ZONES) {
      expect(progressInZone(zone.minHours, zone)).toBeCloseTo(0, 6);
      expect(progressInZone(zone.maxHours, zone)).toBeCloseTo(1, 6);
    }
  });

  it('progression bornee hors zone', () => {
    const raid = zoneForHours(24);
    expect(progressInZone(1, raid)).toBe(0);
    expect(progressInZone(720, raid)).toBe(1);
  });

  it("le grain s'elargit avec l'echelle", () => {
    const order = ZONE_ORDER.map((id) => stepGrain(id));
    expect(order).toEqual(['boucle', 'demi-journee', 'jour', 'journee', 'pays']);
  });

  it('tAtZoneMiddle retombe dans la zone visee', () => {
    for (const id of ZONE_ORDER) {
      expect(zoneForT(tAtZoneMiddle(id)).id, id).toBe(id);
    }
  });

  it("tForZone se place a l'interieur de la zone visee (frontieres partagees)", () => {
    for (const id of ZONE_ORDER) {
      expect(zoneForT(tForZone(id)).id, id).toBe(id);
    }
  });

  it("tForZone survit a l'aller-retour t -> heures (stabilite flottante)", () => {
    for (const id of ZONE_ORDER) {
      const t = tForZone(id);
      const roundTrip = tFromHours(hoursFromT(t));
      expect(zoneForT(roundTrip).id, id).toBe(id);
    }
  });

  it('tAtZoneStart est le plancher mathematique, pas forcement la zone', () => {
    // Les bornes du dossier sont inclusives des deux cotes : le plancher
    // partage la frontiere, et zoneForHours tranche en faveur de la zone fine.
    expect(tAtZoneStart('run')).toBe(tFromHours(1));
    expect(zoneForT(tAtZoneStart('journee')).id).toBe('run');
    expect(tForZone('journee')).toBeGreaterThan(tAtZoneStart('journee'));
  });
});

describe("axe d'echelle - dangerousite", () => {
  it('reste dans la plage 5..96', () => {
    for (let hours = H_MIN; hours <= H_MAX; hours += 7) {
      const score = dangerForHours(hours);
      expect(score).toBeGreaterThanOrEqual(5);
      expect(score).toBeLessThanOrEqual(96);
    }
  });

  it('ne redescend jamais quand la duree monte', () => {
    let previous = 0;
    for (let hours = H_MIN; hours <= H_MAX; hours += 3) {
      const score = dangerForHours(hours);
      expect(score).toBeGreaterThanOrEqual(previous);
      previous = score;
    }
  });

  it('expose des bornes de zone exactes et croissantes', () => {
    let previousCeiling = 0;
    for (const zone of ZONES) {
      const range = dangerRange(zone);
      expect(range.floor, zone.id).toBe(zone.dangerBase);
      expect(range.ceiling, zone.id).toBe(Math.round(zone.dangerBase * DANGER_SPAN));
      expect(range.ceiling, zone.id).toBeGreaterThanOrEqual(range.floor);
      // Pas de zone qui redescend sous la precedente : le risque est monotone
      // dans l'echelle, c'est ce qui rend le curseur lisible.
      expect(range.floor, zone.id).toBeGreaterThan(previousCeiling);
      previousCeiling = range.ceiling;
    }
  });

  it('dangerForHours reste dans les bornes de la zone resolue', () => {
    for (let hours = H_MIN; hours <= H_MAX; hours += 1) {
      const range = dangerRange(zoneForHours(hours));
      const score = dangerForHours(hours);
      expect(score, `${hours} h`).toBeGreaterThanOrEqual(range.floor);
      expect(score, `${hours} h`).toBeLessThanOrEqual(range.ceiling);
    }
  });

  it("atteint le plancher et le plafond sur l'intervalle continu de la zone", () => {
    for (const zone of ZONES) {
      const range = dangerRange(zone);
      // Juste apres la borne partagee on est au plancher, juste avant la
      // borne haute on est au plafond. L'echelle est continue, donc on
      // echantillonne a l'interieur reel de la zone.
      const floorSample = zone.minHours + (zone.maxHours - zone.minHours) * 0.001;
      const ceilingSample = zone.maxHours - (zone.maxHours - zone.minHours) * 0.001;
      expect(dangerForHours(floorSample), zone.id).toBe(range.floor);
      expect(dangerForHours(ceilingSample), zone.id).toBe(range.ceiling);
    }
  });

  it('le passage de zone fait sauter la dangerousite, jamais la decrease', () => {
    // A 3 h pile la frontiere est partagee : on lit le plafond sortie (16).
    // Juste apres, on lit le plancher journee (30). Le saut est semantique.
    expect(zoneForHours(3).id).toBe('run');
    expect(dangerForHours(3)).toBe(16);
    expect(zoneForHours(3.001).id).toBe('journee');
    expect(dangerForHours(3.001)).toBe(30);
    expect(dangerForHours(3.001)).toBeGreaterThan(dangerForHours(3));
  });

  it('expose les bornes entiere resolubles de chaque zone', () => {
    expect(firstResolvableHour('run')).toBe(1);
    expect(firstResolvableHour('journee')).toBe(4);
    expect(firstResolvableHour('raid')).toBe(13);
    expect(firstResolvableHour('expedition')).toBe(49);
    expect(firstResolvableHour('monde')).toBe(241);
    for (const zone of ZONES) {
      expect(lastResolvableHour(zone.id), zone.id).toBe(zone.maxHours);
      expect(firstResolvableHour(zone.id)).toBeLessThan(lastResolvableHour(zone.id));
    }
  });

  it('a 169 h on est bien en expedition, a mi-chemin du plafond', () => {
    expect(zoneForHours(169).id).toBe('expedition');
    expect(dangerForHours(169)).toBeGreaterThan(62);
    expect(dangerForHours(169)).toBeLessThan(71);
  });

  it('classe les niveaux de facon coherente', () => {
    expect(dangerLevel(14)).toBe('tranquille');
    expect(dangerLevel(30)).toBe('modere');
    expect(dangerLevel(62)).toBe('exigeant');
    expect(dangerLevel(80)).toBe('engage');
  });
});
