/**
 * Navigation de jour et point de passage — les deux gestes que l utilisateur
 * fait sur le parcours : balayer pour changer de jour, maintenir la carte
 * pour poser un point de passage.
 *
 * Ces fonctions sont PURES. L'ecran ne fait qu'appeler `useDayFocusStore` et
 * `addStepToDay` avec ce qu'elles renvoient ; aucune coordonnee, aucune mesure
 * et aucun jour n'est decide dans un composant.
 */

import { describe, expect, it } from 'vitest';
import {
  insertWaypoint,
  swipeIntent,
  dayAfterSwipe,
  weatherOfDay,
  isHonestCoord,
  measureScope,
  programmeByDay,
  resolveActiveDay,
} from '../engine/dayNavigation';
import { PRICE_TO_CHECK } from '../types';
import type { ItineraryModel, ItineraryStep } from '../types';
import type { DayWeather } from '../engine/weather';
import { metricsFor } from '../engine/metrics';

function step(over: Partial<ItineraryStep> & { id: string; day: number; order: number }): ItineraryStep {
  return {
    kind: 'arret',
    title: 'Etape',
    placeName: null,
    startTime: null,
    durationMin: null,
    reason: null,
    price: PRICE_TO_CHECK,
    state: 'propose',
    kept: false,
    icon: 'map-pin',
    lat: null,
    lon: null,
    ...over,
  };
}

function model(over: Partial<ItineraryModel> = {}): ItineraryModel {
  const days = over.days ?? 3;
  const zero = { distanceKm: 10, movingMin: 20, activityMin: 120, elevGainM: 300, elevLossM: 280 };
  return {
    days,
    steps: [],
    totals: zero,
    perDay: Array.from({ length: days }, () => zero),
    weather: Array.from({ length: days }, () => null),
    metricsContext: 'voyage',
    budgetPerPerson: PRICE_TO_CHECK,
    activityCount: 3,
    contingencies: [],
    ...over,
  };
}

describe('DAY-01 — Le balayage separe les journees du scroll vertical', () => {
  it('DAY-01: un geste horizontal net va vers le jour suivant', () => {
    expect(swipeIntent(120, 8)).toBe('suivant');
  });

  it('DAY-02: un geste horizontal inverse va vers le jour precedent', () => {
    expect(swipeIntent(-120, -6)).toBe('precedent');
  });

  it('DAY-03: un scroll vertical reste un scroll, il ne change pas de jour', () => {
    expect(swipeIntent(30, 180)).toBeNull();
    expect(swipeIntent(-30, -180)).toBeNull();
  });

  it('DAY-04: un geste trop court est ignore', () => {
    expect(swipeIntent(20, 2)).toBeNull();
  });

  it('DAY-05: le geste diagonal est tranche par axe dominant', () => {
    // 100 horizontal pour 90 vertical : ce n'est pas un balayage de jour.
    expect(swipeIntent(100, -90)).toBeNull();
  });

  it('DAY-06: la valeur exacte de zero n est pas un geste', () => {
    expect(swipeIntent(0, 0)).toBeNull();
  });

  it('DAY-07: NaN ne fait pas basculer le jour', () => {
    expect(swipeIntent(Number.NaN, 10)).toBeNull();
  });
});

describe('DAY-08 — Le balayage ne sort jamais du perimetre', () => {
  it('DAY-08: depuis la vue ensemble, on entre par le jour 1', () => {
    expect(dayAfterSwipe(null, 3, 'suivant')).toBe(1);
  });

  it('DAY-09: on avance d un jour a la fois', () => {
    expect(dayAfterSwipe(1, 3, 'suivant')).toBe(2);
    expect(dayAfterSwipe(2, 3, 'suivant')).toBe(3);
  });

  it('DAY-10: le dernier jour ne boucle pas sur un jour inexistant', () => {
    expect(dayAfterSwipe(3, 3, 'suivant')).toBeNull();
  });

  it('DAY-11: le jour 1 revient a la vue ensemble', () => {
    expect(dayAfterSwipe(1, 3, 'precedent')).toBeNull();
  });

  it('DAY-12: on remonte d un jour a la fois', () => {
    expect(dayAfterSwipe(3, 3, 'precedent')).toBe(2);
  });

  it('DAY-13: un voyage mono-jour ne peut pas etre balaye', () => {
    expect(dayAfterSwipe(null, 1, 'suivant')).toBe(1);
    expect(dayAfterSwipe(1, 1, 'suivant')).toBeNull();
    expect(dayAfterSwipe(1, 1, 'precedent')).toBeNull();
  });

  it('DAY-14: un jour hors borne retombe sur la vue ensemble', () => {
    expect(dayAfterSwipe(7, 3, 'suivant')).toBeNull();
  });

  it('DAY-15b: le rail boucle, il n a pas de fin', () => {
    expect(dayAfterSwipe(null, 3, 'precedent')).toBe(3);
    expect(dayAfterSwipe(3, 3, 'suivant')).toBeNull();
    expect(dayAfterSwipe(null, 3, 'suivant')).toBe(1);
  });

  it('DAY-15: sans nombre de jours, rien ne bouge', () => {
    expect(dayAfterSwipe(null, 0, 'suivant')).toBeNull();
    expect(dayAfterSwipe(1, 0, 'precedent')).toBeNull();
  });
});

describe('DAY-16 — Une meteo jamais mesuree reste absente', () => {
  const meteo: DayWeather = {
    date: '2026-07-14',
    tMaxC: 27,
    tMinC: 14,
    precipMm: 0,
    precipProbPct: 10,
    windMaxKmh: 18,
    code: 1,
    label: 'Peu nuageux',
  };

  it('DAY-16: la meteo du jour est lue a son index', () => {
    const m = model({ weather: [null, meteo, null] });
    expect(weatherOfDay(m, 2)).toBe(meteo);
  });

  it('DAY-17: un jour non couvert vaut absence, pas report', () => {
    const m = model({ weather: [meteo, null, null] });
    expect(weatherOfDay(m, 2)).toBeNull();
  });

  it('DAY-18: un jour hors programme ne renvoie rien', () => {
    expect(weatherOfDay(model({ weather: [meteo, meteo, meteo] }), 9)).toBeNull();
    expect(weatherOfDay(model(), 0)).toBeNull();
  });
});

describe('DAY-19 — Le point de passage pose sur la carte', () => {
  it('DAY-19: une coordonnee exploitable est acceptee', () => {
    expect(isHonestCoord({ lat: 48.8566, lon: 2.3522 })).toBe(true);
    expect(isHonestCoord({ lat: -33.8688, lon: 151.2093 })).toBe(true);
  });

  it('DAY-20: le point nul n est pas une position, c est un trou', () => {
    expect(isHonestCoord({ lat: 0, lon: 0 })).toBe(false);
    expect(isHonestCoord({ lat: 0, lon: 2.3522 })).toBe(false);
  });

  it('DAY-21: une valeur non finie est refusee', () => {
    expect(isHonestCoord({ lat: Number.NaN, lon: 2.3522 })).toBe(false);
    expect(isHonestCoord({ lat: 48.8566, lon: Number.POSITIVE_INFINITY })).toBe(false);
  });

  it('DAY-22: la pose est refusee hors des bornes du globe', () => {
    expect(isHonestCoord({ lat: 91, lon: 2 })).toBe(false);
    expect(isHonestCoord({ lat: 48, lon: 181 })).toBe(false);
  });

  it('DAY-23: le point de passage porte la ou l utilisateur a appuye', () => {
    const m = model({ days: 1, steps: [step({ id: 'a', day: 1, order: 1 })] });
    const next = insertWaypoint(m, { lat: 48.8566, lon: 2.3522 }, 1);
    const added = next.steps.find((s) => s.id !== 'a');
    expect(added).toBeDefined();
    expect(added!.lat).toBe(48.8566);
    expect(added!.lon).toBe(2.3522);
    expect(added!.day).toBe(1);
  });

  it('DAY-24: l etape posee est un arret du programme, pas un brouillon', () => {
    const m = model({ days: 1 });
    const next = insertWaypoint(m, { lat: 48.8566, lon: 2.3522 }, 1);
    expect(next.steps[0].kind).toBe('arret');
  });

  it('DAY-25: une pose ne pretend rien sur le prix ni l horaire', () => {
    const m = model({ days: 1 });
    const next = insertWaypoint(m, { lat: 48.8566, lon: 2.3522 }, 1);
    expect(next.steps[0].price.amount).toBeNull();
    expect(next.steps[0].startTime).toBeNull();
    expect(next.steps[0].durationMin).toBeNull();
  });

  it('DAY-26: le point est insere entre les deux etapes qui l encadrent', () => {
    const m = model({
      days: 1,
      steps: [
        step({ id: 'a', day: 1, order: 1 }),
        step({ id: 'b', day: 1, order: 2 }),
        step({ id: 'c', day: 1, order: 3 }),
      ],
    });
    const next = insertWaypoint(m, { lat: 48.8566, lon: 2.3522 }, 1, 2);
    const order = next.steps.filter((s) => s.day === 1).map((s) => s.order);
    expect(order).toEqual([1, 2, 3, 4]);
  });

  it('DAY-27: les autres journees gardent leur ordre', () => {
    const m = model({
      days: 2,
      steps: [
        step({ id: 'a', day: 1, order: 1 }),
        step({ id: 'b', day: 2, order: 1 }),
        step({ id: 'c', day: 2, order: 2 }),
      ],
    });
    const next = insertWaypoint(m, { lat: 48.8566, lon: 2.3522 }, 1, 1);
    expect(next.steps.filter((s) => s.day === 2).map((s) => s.order)).toEqual([1, 2]);
  });

  it('DAY-28: la mesure du jour devient « à verifier », elle ne ment plus', () => {
    const m = model({
      days: 2,
      steps: [step({ id: 'a', day: 1, order: 1 })],
      perDay: [
        { distanceKm: 10, movingMin: 20, activityMin: 120, elevGainM: 300, elevLossM: 280 },
        { distanceKm: 12, movingMin: 25, activityMin: 200, elevGainM: 400, elevLossM: 390 },
      ],
    });
    const next = insertWaypoint(m, { lat: 48.8566, lon: 2.3522 }, 1, 1);
    expect(next.perDay[0].distanceKm).toBeNull();
    expect(next.perDay[0].activityMin).toBeNull();
  });

  it('DAY-29: le total du parcours ne se recompute pas de lui-meme', () => {
    const m = model({ days: 2, steps: [step({ id: 'a', day: 1, order: 1 })] });
    const next = insertWaypoint(m, { lat: 48.8566, lon: 2.3522 }, 1, 1);
    // Le total ne vaut plus : il faut remesurer sur le reseau routier.
    expect(next.totals.distanceKm).toBeNull();
  });

  it('DAY-30: la journee non touchee garde ses mesures', () => {
    const m = model({
      days: 2,
      perDay: [
        { distanceKm: 10, movingMin: 20, activityMin: 120, elevGainM: 300, elevLossM: 280 },
        { distanceKm: 12, movingMin: 25, activityMin: 200, elevGainM: 400, elevLossM: 390 },
      ],
    });
    const next = insertWaypoint(m, { lat: 48.8566, lon: 2.3522 }, 1, 1);
    expect(next.perDay[1].distanceKm).toBe(12);
  });

  it('DAY-31: une pose hors programme est refusee, le modele reste intact', () => {
    const m = model({ days: 2, steps: [step({ id: 'a', day: 1, order: 1 })] });
    const next = insertWaypoint(m, { lat: 48.8566, lon: 2.3522 }, 9);
    expect(next).toBe(m);
  });

  it('DAY-32: la pose ne modifie pas l objet d origine', () => {
    const m = model({ days: 1, steps: [step({ id: 'a', day: 1, order: 1 })] });
    const before = m.steps.length;
    insertWaypoint(m, { lat: 48.8566, lon: 2.3522 }, 1, 1);
    expect(m.steps.length).toBe(before);
  });

  it('DAY-33: un identifiant unique evite d ecraser une etape existante', () => {
    const m = model({ days: 1, steps: [step({ id: 'w-1', day: 1, order: 1 })] });
    const next = insertWaypoint(m, { lat: 48.8566, lon: 2.3522 }, 1, 1, 'w-1');
    expect(next.steps).toHaveLength(2);
    expect(new Set(next.steps.map((s) => s.id)).size).toBe(2);
  });
});

describe('DAY-40 — Le jour affiche ne depend que d un programme reellement existant', () => {
  it('DAY-40: aucun jour selectionne = vue Ensemble', () => {
    expect(resolveActiveDay(3, null)).toBeNull();
  });

  it('DAY-41: un jour selectionne dans le programme est conserve tel quel', () => {
    expect(resolveActiveDay(3, 1)).toBe(1);
    expect(resolveActiveDay(3, 3)).toBe(3);
  });

  it('DAY-42: un jour hors programme retombe sur Ensemble, jamais sur un ecran vide', () => {
    expect(resolveActiveDay(3, 4)).toBeNull();
    expect(resolveActiveDay(3, 0)).toBeNull();
    expect(resolveActiveDay(3, -1)).toBeNull();
  });

  it('DAY-43: un programme inexistant ne focalise rien', () => {
    expect(resolveActiveDay(0, 1)).toBeNull();
    expect(resolveActiveDay(-2, 1)).toBeNull();
  });

  it('DAY-44: un jour non entier est refuse : le rail ne produit que des entiers', () => {
    expect(resolveActiveDay(3, 1.5)).toBeNull();
    expect(resolveActiveDay(3, Number.NaN)).toBeNull();
  });
});

describe('DAY-45 — Le programme montre des journees reellement peuplees', () => {
  it('DAY-45: sans focus, toutes les journees peuplees sont listees dans l ordre', () => {
    const m = model({
      days: 3,
      steps: [
        step({ id: 'a', day: 2, order: 1 }),
        step({ id: 'b', day: 1, order: 1 }),
        step({ id: 'c', day: 1, order: 2 }),
      ],
    });
    expect(programmeByDay(m, null).map((entry) => entry.day)).toEqual([1, 2]);
  });

  it('DAY-46: les etapes d une journee sont triees par ordre de parcours', () => {
    const m = model({
      days: 1,
      steps: [step({ id: 'c', day: 1, order: 3 }), step({ id: 'a', day: 1, order: 1 }), step({ id: 'b', day: 1, order: 2 })],
    });
    expect(programmeByDay(m, 1)[0].steps.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('DAY-47: une journee sans etape n apparait pas', () => {
    const m = model({ days: 3, steps: [step({ id: 'a', day: 3, order: 1 })] });
    expect(programmeByDay(m, null).map((entry) => entry.day)).toEqual([3]);
  });

  it('DAY-48: un focus sur une journee vide affiche un programme vide, pas le parcours entier', () => {
    const m = model({ days: 2, steps: [step({ id: 'a', day: 1, order: 1 })] });
    expect(programmeByDay(m, 2)).toEqual([]);
  });

  it('DAY-49: la fonction ne mute pas le modele', () => {
    const m = model({ days: 1, steps: [step({ id: 'b', day: 1, order: 2 }), step({ id: 'a', day: 1, order: 1 })] });
    const before = m.steps.map((s) => s.id);
    programmeByDay(m, 1);
    expect(m.steps.map((s) => s.id)).toEqual(before);
  });
});

describe('DAY-50 — Carte, programme et mesures parlent du meme perimetre', () => {
  it('DAY-50: la vue Ensemble mesure le parcours complet', () => {
    const m = model({ days: 2, totals: { distanceKm: 42.7, movingMin: 300, activityMin: 480, elevGainM: 1800, elevLossM: 1700 } });
    const { scope, day } = measureScope(resolveActiveDay(m.days, null));
    expect(scope).toBe('aventure');
    expect(metricsFor(m, scope, day).find((x) => x.id === 'distance')?.formatted).toBe('42,7 km');
  });

  it('DAY-51: le jour focalise mesure CE jour-la, pas le parcours', () => {
    const perDay = [
      { distanceKm: 18.4, movingMin: 120, activityMin: 240, elevGainM: 700, elevLossM: 680 },
      { distanceKm: 24.3, movingMin: 180, activityMin: 240, elevGainM: 1100, elevLossM: 1050 },
    ];
    const m = model({ days: 2, perDay, totals: { ...perDay[0], distanceKm: 42.7 } });
    const { scope, day } = measureScope(resolveActiveDay(m.days, 1));
    expect(scope).toBe('jour');
    expect(metricsFor(m, scope, day).find((x) => x.id === 'distance')?.formatted).toBe('18,4 km');
  });

  it('DAY-52: une selection hors programme rebascule sur le parcours complet', () => {
    const perDay = [
      { distanceKm: 18.4, movingMin: 120, activityMin: 240, elevGainM: 700, elevLossM: 680 },
      { distanceKm: 24.3, movingMin: 180, activityMin: 240, elevGainM: 1100, elevLossM: 1050 },
    ];
    const m = model({ days: 2, perDay, totals: { ...perDay[0], distanceKm: 42.7 } });
    const { scope, day } = measureScope(resolveActiveDay(m.days, 9));
    expect(scope).toBe('aventure');
    expect(metricsFor(m, scope, day).find((x) => x.id === 'distance')?.formatted).toBe('42,7 km');
  });

  it('DAY-53: la meteo du jour focalise suit le meme index que le programme', () => {
    const raveni: DayWeather = { date: '2026-07-11', tMaxC: 24, tMinC: 11, precipMm: 0, precipProbPct: 20, windMaxKmh: 14, code: 2, label: 'Partiellement nuageux' };
    const m = model({ days: 3, weather: [null, raveni, null] });
    expect(weatherOfDay(m, 1)).toBeNull();
    expect(weatherOfDay(m, 2)).toBe(raveni);
  });
});
