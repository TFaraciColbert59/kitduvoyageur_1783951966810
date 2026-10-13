import { describe, expect, it } from 'vitest';
import {
  MISSING_TEXT,
  PAUSE_FACTOR,
  ROUND_MIN,
  dayLightClock,
  passageModel,
  stepPassages,
  type PassageInput,
  type PassageStepInput,
} from '../engine/passage';
import { buildCompasModel } from '../engine/compasModel';
import { clockMinutes } from '../engine/sun';
import { walkingMinutes } from '../engine/weather';
import { compasInput } from './helpers/compasData';

/*
 * Heure de passage à chaque étape — l'heure est CALCULÉE (départ + temps pour
 * atteindre l'étape), jamais supposée : sans départ, sans distance ou sans
 * allure connue, la ligne reste « non renseignée ».
 */

const step = (
  id: string,
  distanceKm: number | null,
  gainM: number | null = 0,
  lossM: number | null = 0,
  startTime: string | null = null
): PassageStepInput => ({
  id,
  title: `Étape ${id}`,
  distanceKm,
  gainM,
  lossM,
  startTime,
});

const base: PassageInput = {
  activity: 'hiking',
  departure: '07:30',
  steps: [step('a', 12.4, 900, 300)],
  flatSpeedKmh: 4.6,
  pace: 'normal',
};
const run = (over: Partial<PassageInput> = {}) => stepPassages({ ...base, ...over });
const minutes = (hhmm: string | null) => clockMinutes(hhmm) as number;

describe('stepPassages : à pied (DIN 33466, pauses +15 %)', () => {
  it('départ 07:30, 12,4 km, +900 m / −300 m au pas de 4,6 km/h : 13:10', () => {
    // DIN : 3,6 h de vertical + 2,7 h / 2 d'horizontal = 297 min ; pauses +15 % = 341,6 min ; 450 + 341,6 → 13:10.
    const [p] = run();
    expect(p.time).toBe('13:10');
    expect(p.missing).toBeNull();
    expect(p.nextDay).toBe(false);
    expect(p.sinceStartMin).toBe(342);
  });

  it('la dernière étape du jour retombe sur le temps de marche du jour × 1,15 (même calcul que « Départ conseillé »)', () => {
    const walk = walkingMinutes({ distanceKm: 12.4, gainM: 900, lossM: 300, flatSpeedKmh: 4.6, pace: 'normal' }) as number;
    const [p] = run();
    expect(Math.abs(minutes(p.time) - (450 + walk * PAUSE_FACTOR))).toBeLessThanOrEqual(ROUND_MIN / 2 + 0.01);
  });

  it('une heure par étape, croissante, calculée sur la distance cumulée depuis le départ', () => {
    const out = run({ steps: [step('a', 5, 300, 0), step('b', 4, 100, 200), step('c', 6, 400, 100)] });
    const times = out.map((p) => minutes(p.time));
    expect(out.every((p) => p.time != null)).toBe(true);
    expect(times[0]).toBeLessThan(times[1]);
    expect(times[1]).toBeLessThan(times[2]);
    // La cumulée de la dernière étape EST le total du jour.
    const whole = run({ steps: [step('z', 15, 800, 300)] })[0];
    expect(out[2].time).toBe(whole.time);
  });

  it('le rythme du groupe compte : tranquille arrive plus tard que soutenu', () => {
    const slow = minutes(run({ pace: 'tranquille' })[0].time);
    const fast = minutes(run({ pace: 'soutenu' })[0].time);
    expect(slow).toBeGreaterThan(fast);
  });

  it('allure du plus lent inconnue : 4 km/h de la méthode, comme walkingMinutes', () => {
    const [p] = run({ flatSpeedKmh: null, steps: [step('a', 20, 0, 0)] });
    // 20 km à 4 km/h = 5 h, pauses +15 % = 5 h 45 → 13:15.
    expect(p.time).toBe('13:15');
  });

  it('l’heure est arrondie à 5 minutes', () => {
    for (const d of ['07:31', '07:33', '07:37', '08:02']) {
      const [p] = run({ departure: d });
      expect(minutes(p.time) % ROUND_MIN).toBe(0);
    }
  });

  it('l’arrondi va au multiple de 5 le plus proche (pas vers le bas)', () => {
    const at = (departure: string) => run({ activity: 'cycling', departure, steps: [step('a', 36)] })[0].time;
    expect(at('07:33')).toBe('09:35');
    expect(at('07:32')).toBe('09:30');
  });

  it('un départ lu depuis une colonne « time » (HH:MM:SS) est compris', () => {
    expect(run({ departure: '07:30:00' })[0].time).toBe('13:10');
  });
});

describe('stepPassages : une heure notée sur l’étape est un fait, pas un départ', () => {
  it('09:00 notée sur une étape à 5 km : 09:00 telle quelle (jamais 09:00 + le temps pour 5 km), départ saisi ou non', () => {
    for (const departure of [null, '07:30']) {
      const [p] = run({ departure, steps: [step('a', 5, 300, 0, '09:00')] });
      expect(p.time).toBe('09:00');
      expect(p.source).toBe('note');
      expect(p.missing).toBeNull();
      expect(p.from).toBeNull();
      expect(p.sinceStartMin).toBeNull();
      expect(p.nextDay).toBe(false);
    }
  });

  it('une heure notée est gardée à la minute (jamais arrondie à 5 min), « HH:MM:SS » comprise', () => {
    expect(run({ steps: [step('a', 5, 0, 0, '09:07')] })[0].time).toBe('09:07');
    expect(run({ steps: [step('a', 5, 0, 0, '09:07:00')] })[0].time).toBe('09:07');
  });

  it('une heure notée est dite même sans allure connue, sans distance, sans départ', () => {
    const out = run({ activity: 'roadtrip', departure: null, steps: [step('a', null, null, null, '08:15'), step('b', null)] });
    expect(out[0].time).toBe('08:15');
    expect(out[0].source).toBe('note');
    // L'étape sans heure, elle, dit ce qui manque (l'allure d'abord).
    expect(out[1].time).toBeNull();
    expect(out[1].missing).toBe('allure');
  });

  it('les étapes sans heure sont estimées À PARTIR de la dernière heure notée avant elles, pas du départ du jour', () => {
    const out = run({
      departure: '06:00',
      steps: [step('a', 6, 300, 0), step('b', 4, 0, 0, '12:00'), step('c', 8, 200, 100)],
    });
    expect(out[1].time).toBe('12:00');
    // c = 12:00 + le temps pour SES 8 km (et non la cumulée depuis 06:00) : identique à un départ de 12:00 sur 8 km.
    const fromNoon = run({ departure: '12:00', steps: [step('c', 8, 200, 100)] })[0];
    expect(out[2].time).toBe(fromNoon.time);
    expect(out[2].source).toBe('estime');
    expect(out[2].from).toEqual({ kind: 'etape', time: '12:00', title: 'Étape b' });
    expect(out[2].sinceStartMin).toBe(fromNoon.sinceStartMin);
    // a, avant toute heure notée, part du départ du jour.
    expect(out[0].from).toEqual({ kind: 'depart', time: '06:00' });
  });

  it('une heure notée sur la première étape sert de point de départ aux suivantes, sans départ saisi', () => {
    const out = run({ departure: null, steps: [step('a', 5, 300, 0, '09:00'), step('b', 8, 0, 0)] });
    expect(out[0].time).toBe('09:00');
    expect(out[1].time).toBe(run({ departure: '09:00', steps: [step('b', 8, 0, 0)] })[0].time);
    expect(out[1].from?.kind).toBe('etape');
  });

  it('avant toute heure notée et sans départ : « non renseigné », la raison est le départ', () => {
    const out = run({ departure: null, steps: [step('a', 5), step('b', 4, 0, 0, '12:00'), step('c', 3)] });
    expect(out[0].missing).toBe('depart');
    expect(out[1].time).toBe('12:00');
    expect(out[2].time).not.toBeNull();
  });

  it('une heure illisible n’est pas une heure notée : l’étape est estimée', () => {
    for (const bad of ['tôt', '25:00', '', '9h']) {
      const [p] = run({ steps: [step('a', 12.4, 900, 300, bad)] });
      expect(p.source, bad).toBe('estime');
      expect(p.time, bad).toBe('13:10');
    }
  });

  it('une distance inconnue coupe l’estimation jusqu’à la prochaine heure notée, qui la rétablit', () => {
    const out = run({
      steps: [step('a', 6, 0, 0, '08:00'), step('b', null), step('c', 5), step('d', 4, 0, 0, '14:00'), step('e', 5)],
    });
    expect(out[1].missing).toBe('distance');
    expect(out[2].missing).toBe('distance');
    expect(out[3].time).toBe('14:00');
    expect(out[4].time).toBe(run({ departure: '14:00', steps: [step('e', 5)] })[0].time);
  });

  it('la lumière d’une heure notée est dite aussi (après le coucher, avant le lever), jamais « le lendemain »', () => {
    const sun = { sunrise: '07:40', sunset: '18:30' };
    expect(run({ ...sun, steps: [step('a', 5, 0, 0, '19:10')] })[0].light).toBe('apres-coucher');
    expect(run({ ...sun, steps: [step('a', 5, 0, 0, '06:10')] })[0].light).toBe('avant-lever');
    expect(run({ ...sun, steps: [step('a', 5, 0, 0, '12:00')] })[0].light).toBe('jour');
    expect(run({ ...sun, steps: [step('a', 5, 0, 0, '19:10')] })[0].nextDay).toBe(false);
  });

  it('sans heure notée, rien ne change : départ + temps pour atteindre l’étape, source « estime »', () => {
    const [p] = run();
    expect(p.time).toBe('13:10');
    expect(p.source).toBe('estime');
    expect(p.from).toEqual({ kind: 'depart', time: '07:30' });
  });
});

describe('stepPassages : jamais d’heure supposée', () => {
  it('sans heure de départ : « non renseigné » pour toutes les étapes, aucune heure par défaut', () => {
    for (const departure of [null, '', 'tôt', '25:00']) {
      const out = run({ departure, steps: [step('a', 8), step('b', 9)] });
      expect(out.map((p) => p.time)).toEqual([null, null]);
      expect(out.map((p) => p.missing)).toEqual(['depart', 'depart']);
      expect(out.map((p) => p.sinceStartMin)).toEqual([null, null]);
    }
  });

  it('distance inconnue ou nulle : cette étape et les suivantes restent sans heure', () => {
    for (const bad of [null, 0, -3, Number.NaN]) {
      const out = run({ steps: [step('a', 6), step('b', bad), step('c', 5)] });
      expect(out[0].time).not.toBeNull();
      expect(out[1].time).toBeNull();
      expect(out[1].missing).toBe('distance');
      expect(out[2].time).toBeNull();
      expect(out[2].missing).toBe('distance');
    }
  });

  it('première étape sans distance : toute la journée reste sans heure', () => {
    const out = run({ steps: [step('a', null), step('b', 5)] });
    expect(out.map((p) => p.time)).toEqual([null, null]);
  });

  it('activité sans allure connue (ou aucune activité) : pas d’heure, même avec un départ', () => {
    for (const activity of ['roadtrip', 'citytrip', 'ski', 'climbing', 'vanlife', 'beach', 'cultural', null]) {
      const [p] = run({ activity });
      expect(p.time, String(activity)).toBeNull();
      expect(p.missing, String(activity)).toBe('allure');
    }
  });

  it('plusieurs données manquent : l’allure d’abord, puis le départ, puis la distance', () => {
    expect(run({ activity: 'roadtrip', departure: null, steps: [step('a', null)] })[0].missing).toBe('allure');
    expect(run({ departure: null, steps: [step('a', null)] })[0].missing).toBe('depart');
    expect(run({ steps: [step('a', null)] })[0].missing).toBe('distance');
  });

  it('chaque raison a sa phrase', () => {
    expect(MISSING_TEXT).toEqual({
      allure: 'pas d’allure connue pour cette activité',
      depart: 'heure de départ',
      distance: 'distance de l’étape',
    });
  });

  it('sans étape : liste vide', () => {
    expect(run({ steps: [] })).toEqual([]);
  });
});

describe('stepPassages : vitesse type de l’activité', () => {
  it('vélo : 36 km à 18 km/h depuis 09:00 → 11:00 (le dénivelé ne compte pas ici)', () => {
    const [p] = run({ activity: 'cycling', departure: '09:00', steps: [step('a', 36, 2000, 2000)] });
    expect(p.time).toBe('11:00');
  });

  it('course (9 km/h) et eau (5 km/h)', () => {
    expect(run({ activity: 'running', departure: '08:00', steps: [step('a', 18)] })[0].time).toBe('10:00');
    expect(run({ activity: 'water', departure: '08:00', steps: [step('a', 15)] })[0].time).toBe('11:00');
  });

  it('les modèles : à pied, vitesse type, ou aucun', () => {
    expect(passageModel('hiking')).toBe('pied');
    expect(passageModel('trekking')).toBe('pied');
    expect(passageModel('bivouac')).toBe('pied');
    expect(passageModel('mixed')).toBe('pied');
    expect(passageModel('cycling')).toEqual({ kmh: 18 });
    expect(passageModel('trail')).toEqual({ kmh: 7 });
    expect(passageModel('roadtrip')).toBeNull();
    expect(passageModel(null)).toBeNull();
    expect(passageModel('toString')).toBeNull();
  });
});

describe('stepPassages : de nuit', () => {
  const sun = { sunrise: '07:40', sunset: '18:30' };

  it('en pleine journée : « jour »', () => {
    expect(run({ ...sun })[0].light).toBe('jour');
  });

  it('après le coucher du soleil', () => {
    const [p] = run({ ...sun, departure: '12:00', steps: [step('a', 20, 900, 900)] });
    expect(minutes(p.time)).toBeGreaterThan(minutes(sun.sunset));
    expect(p.light).toBe('apres-coucher');
    expect(p.nextDay).toBe(false);
  });

  it('avant le lever du soleil', () => {
    const [p] = run({ ...sun, departure: '05:00', steps: [step('a', 3, 0, 0)] });
    expect(minutes(p.time)).toBeLessThan(minutes(sun.sunrise));
    expect(p.light).toBe('avant-lever');
  });

  it('pile au coucher ou au lever : encore « jour »', () => {
    const rise = run({ sunrise: '05:00', sunset: '20:00', departure: '05:00', steps: [step('a', 0.1)] })[0];
    expect(rise.time).toBe('05:00');
    expect(rise.light).toBe('jour');
    const set = run({ sunrise: '05:00', sunset: '13:10' })[0];
    expect(set.time).toBe('13:10');
    expect(set.light).toBe('jour');
    const after = run({ sunrise: '05:00', sunset: '13:05' })[0];
    expect(after.light).toBe('apres-coucher');
  });

  it('après minuit : le lendemain, l’heure est ramenée dans la journée', () => {
    const [p] = run({ ...sun, departure: '20:00', activity: 'cycling', steps: [step('a', 90)] });
    expect(p.nextDay).toBe(true);
    expect(p.time).toBe('01:00');
    // Lever et coucher sont ceux du jour de départ : la lumière du lendemain n'est pas dite.
    expect(p.light).toBeNull();
  });

  it('une arrivée le lendemain matin n\u2019est jamais « après le coucher »', () => {
    const [p] = run({ ...sun, departure: '23:00', activity: 'cycling', steps: [step('a', 120)] });
    expect(p.nextDay).toBe(true);
    expect(p.light).toBeNull();
  });

  it('pile à minuit : c’est déjà le lendemain', () => {
    const [p] = run({ ...sun, departure: '20:00', activity: 'cycling', steps: [step('a', 72)] });
    expect(p.time).toBe('00:00');
    expect(p.nextDay).toBe(true);
    const before = run({ ...sun, departure: '20:00', activity: 'cycling', steps: [step('a', 71)] })[0];
    expect(before.nextDay).toBe(false);
    expect(before.time).toBe('23:55');
  });

  it('soleil inconnu : on ne dit rien de la nuit', () => {
    expect(run({ sunrise: null, sunset: null })[0].light).toBeNull();
    expect(run({ sunrise: '07:40', sunset: null })[0].light).toBeNull();
    expect(run()[0].light).toBeNull();
  });

  it('sans heure, pas de position par rapport au soleil', () => {
    expect(run({ ...sun, departure: null })[0].light).toBeNull();
  });
});

describe('dayLightClock : lever et coucher du jour', () => {
  const at = { lat: 45.0, lon: 6.0, date: '2026-10-12' };

  it('la prévision d’abord (« HH:MM » ou ISO), telle qu’elle est publiée', () => {
    expect(dayLightClock({ sunrise: '07:41', sunset: '18:55' }, at, 'Europe/Paris')).toEqual({
      sunrise: '07:41',
      sunset: '18:55',
    });
    expect(
      dayLightClock({ sunrise: '2026-10-12T07:41', sunset: '2026-10-12T18:55' }, at, 'Europe/Paris')
    ).toEqual({ sunrise: '07:41', sunset: '18:55' });
  });

  it('sans prévision : le calcul astronomique au point et à la date (heure locale du lieu)', () => {
    const light = dayLightClock(null, at, 'Europe/Paris');
    expect(light).not.toBeNull();
    // Mi-octobre à 45° N, 6° E : lever vers 08:00, coucher vers 19:00, heure d'été de Paris.
    expect(minutes(light!.sunrise)).toBeGreaterThan(7 * 60 + 30);
    expect(minutes(light!.sunrise)).toBeLessThan(8 * 60 + 30);
    expect(minutes(light!.sunset)).toBeGreaterThan(18 * 60 + 30);
    expect(minutes(light!.sunset)).toBeLessThan(19 * 60 + 30);
  });

  it('une prévision incohérente (coucher avant le lever) cède la place au calcul', () => {
    const light = dayLightClock({ sunrise: '19:00', sunset: '07:00' }, at, 'Europe/Paris');
    expect(minutes(light!.sunrise)).toBeLessThan(minutes(light!.sunset));
  });

  it('étape sans point, sans date ou date illisible : null (jamais une heure inventée)', () => {
    expect(dayLightClock(null, { ...at, lat: null }, 'Europe/Paris')).toBeNull();
    expect(dayLightClock(null, { ...at, lon: null }, 'Europe/Paris')).toBeNull();
    expect(dayLightClock(null, { ...at, date: null }, 'Europe/Paris')).toBeNull();
    expect(dayLightClock(null, { ...at, date: 'demain' }, 'Europe/Paris')).toBeNull();
    expect(dayLightClock(null, { ...at, lat: Number.NaN }, 'Europe/Paris')).toBeNull();
  });

  it('nuit polaire : null', () => {
    expect(dayLightClock(null, { lat: 78.2, lon: 15.6, date: '2026-12-15' }, 'Arctic/Longyearbyen')).toBeNull();
  });

  it('fuseau du jour inconnu : le calcul astronomique n’est pas tenté (jamais l’heure d’un autre fuseau)', () => {
    expect(dayLightClock(null, at, null)).toBeNull();
    expect(dayLightClock(null, at, '')).toBeNull();
    expect(dayLightClock(null, at, 'Nulle/Part')).toBeNull();
  });

  it('fuseau inconnu mais prévision lisible : la prévision est dite telle qu’elle est publiée', () => {
    expect(dayLightClock({ sunrise: '07:41', sunset: '18:55' }, at, null)).toEqual({ sunrise: '07:41', sunset: '18:55' });
  });

  it('le calcul suit le fuseau DU JOUR : même point et même date, une heure locale de plus pour Paris que pour Lisbonne', () => {
    const lisbon = { lat: 38.72, lon: -9.14, date: '2026-10-13' };
    const local = dayLightClock(null, lisbon, 'Europe/Lisbon');
    const paris = dayLightClock(null, lisbon, 'Europe/Paris');
    expect(minutes(paris!.sunset) - minutes(local!.sunset)).toBe(60);
    expect(minutes(paris!.sunrise) - minutes(local!.sunrise)).toBe(60);
  });
});

describe('modèle : ce que les jours de marche portent pour le passage', () => {
  const plans = (startTimes: Array<string | null>) =>
    buildCompasModel(
      compasInput({
        steps: compasInput().steps.map((st, i) => ({ ...st, startTime: startTimes[i] ?? null })),
      })
    ).route.dayPlans;

  it('l’heure notée est celle de CHAQUE étape (« HH:MM »), jamais un départ de jour', () => {
    const [d1, d2] = plans(['07:30:00', '16:45']);
    expect(d1.steps?.[0].startTime).toBe('07:30');
    expect(d2.steps?.[0].startTime).toBe('16:45');
    // Le jour n'a pas de « départ » dérivé de sa première étape.
    expect(d1).not.toHaveProperty('startTime');
  });

  it('plusieurs étapes dans un jour : chacune garde sa propre heure', () => {
    const base = compasInput();
    const model = buildCompasModel(
      compasInput({
        steps: [
          { ...base.steps[0], id: 'x1', orderIndex: 0, startTime: '09:00' },
          { ...base.steps[0], id: 'x2', orderIndex: 1, title: 'Col', startTime: null },
          { ...base.steps[0], id: 'x3', orderIndex: 2, title: 'Lac', startTime: '15:30:00' },
        ],
      })
    );
    expect(model.route.dayPlans[0].steps?.map((st) => st.startTime)).toEqual(['09:00', null, '15:30']);
  });

  it('une heure illisible n’est pas une heure notée', () => {
    expect(plans(['tôt', '25:00'])[0].steps?.[0].startTime).toBeNull();
    expect(plans(['tôt', '25:00'])[1].steps?.[0].startTime).toBeNull();
  });

  it('les étapes du jour gardent distance et dénivelés, dans l’ordre', () => {
    const [d1] = plans([null, null]);
    expect(d1.steps).toEqual([{ id: 's1', title: 'Gavarnie', distanceKm: 12.4, gainM: 900, lossM: 300, startTime: null }]);
  });

  it('de bout en bout : une heure notée à Gavarnie reste 07:30 ; sans note, le départ saisi donne 13:10', () => {
    const [noted] = plans(['07:30', null]);
    const [p] = stepPassages({
      activity: 'hiking',
      departure: null,
      steps: noted.steps ?? [],
      flatSpeedKmh: 4.6,
      pace: 'normal',
    });
    expect(p.time).toBe('07:30');
    const [free] = plans([null, null]);
    const [q] = stepPassages({
      activity: 'hiking',
      departure: '07:30',
      steps: free.steps ?? [],
      flatSpeedKmh: 4.6,
      pace: 'normal',
    });
    expect(q.time).toBe('13:10');
  });
});
