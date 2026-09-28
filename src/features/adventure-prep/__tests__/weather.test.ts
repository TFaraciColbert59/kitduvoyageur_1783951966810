/**
 * Meteo reelle par journee — alignee sur les DATES de l aventure, pas sur
 * « aujourd hui ». Une date hors de la fenetre du fournisseur vaut `null` :
 * afficher la meteo du jour pour une date dans trois mois serait un mensonge.
 */
import { describe, expect, it } from 'vitest';
import { dateRange, weatherByDate, weatherForDay, weatherParts, isWetDay, type DayWeather } from '../engine/weather';
import { normalizeDailyForecast } from '../weatherService';
import { programWeather, weatherOnDay } from '../engine/itineraryPhases';
import { measureItinerary } from '../engine/measurements';
import { buildItinerary } from '../engine/itinerary';
import type { ItineraryModel } from '../types';
import { CHAMONIX, fullDraft } from './fixtures';

describe('la meteo en deux lignes courtes', () => {
  const jour: DayWeather = {
    date: '2026-09-28',
    label: 'Partiellement nuageux',
    code: 2,
    tMinC: 12.4,
    tMaxC: 21.8,
    precipMm: 0.3,
    precipProbPct: 34,
    windMaxKmh: 11,
  };

  it('separre le ciel des mesures : plus aucune ligne ne depasse la largeur', () => {
    const parts = weatherParts(jour);
    expect(parts.condition).toBe('Partiellement nuageux');
    expect(parts.measures).toBe('12° / 22° · 34 % de pluie');
  });

  it('n invente aucune mesure absente', () => {
    const parts = weatherParts({ ...jour, tMinC: null, tMaxC: null, precipProbPct: null });
    expect(parts.condition).toBe('Partiellement nuageux');
    expect(parts.measures).toBe('');
  });

  it('un fournisseur muet se dit, il ne s invente pas', () => {
    expect(weatherParts(null)).toEqual({ condition: 'Météo indisponible', measures: '' });
  });
});

describe('calendrier des dates', () => {
  it('enchain e les jours sans dependre du fuseau de la machine', () => {
    expect(dateRange('2026-07-11', 3)).toEqual(['2026-07-11', '2026-07-12', '2026-07-13']);
  });

  it('traverse un changement de mois', () => {
    expect(dateRange('2026-07-30', 3)).toEqual(['2026-07-30', '2026-07-31', '2026-08-01']);
  });

  it('sans date de depart ou avec une duree nulle, aucune date n est inventee', () => {
    expect(dateRange(null, 3)).toBeNull();
    expect(dateRange('2026-07-11', 0)).toBeNull();
    expect(dateRange('pas une date', 2)).toBeNull();
  });
});

describe('normalisation du fournisseur', () => {
  const PAYLOAD = {
    daily: {
      time: ['2026-07-11', '2026-07-12'],
      temperature_2m_max: [24.3, 21.1],
      temperature_2m_min: [11.0, 9.4],
      precipitation_sum: [0.0, 4.2],
      precipitation_probability_max: [5, 78],
      wind_speed_10m_max: [12.4, 31.0],
      weather_code: [1, 61],
    },
  };

  it('conserve la valeur reelle de chaque journee', () => {
    const days = normalizeDailyForecast(PAYLOAD, 2);
    expect(days).toHaveLength(2);
    expect(days?.[0]).toMatchObject({ date: '2026-07-11', tMaxC: 24.3, tMinC: 11, precipMm: 0, precipProbPct: 5, windMaxKmh: 12.4, code: 1 });
    expect(days?.[1]).toMatchObject({ date: '2026-07-12', tMaxC: 21.1, precipMm: 4.2, precipProbPct: 78, code: 61 });
  });

  it('un champ absent reste inconnu, il ne devient pas zero', () => {
    const days = normalizeDailyForecast(
      { daily: { time: ['2026-07-11'], temperature_2m_max: [20] } },
      1,
    );
    expect(days?.[0].tMaxC).toBe(20);
    expect(days?.[0].precipMm).toBeNull();
    expect(days?.[0].tMinC).toBeNull();
  });

  it('une charge inutile de dates ne remplace pas les dates demandees', () => {
    expect(normalizeDailyForecast(PAYLOAD, 5)).toBeNull();
  });

  it('une reponse vide ou deforme vaut absence', () => {
    expect(normalizeDailyForecast({}, 2)).toBeNull();
    expect(normalizeDailyForecast({ daily: { time: [] } }, 2)).toBeNull();
  });
});

describe('lecture par journee', () => {
  const days: DayWeather[] = [
    { date: '2026-07-11', tMaxC: 24, tMinC: 11, precipMm: 0, precipProbPct: 5, windMaxKmh: 12, code: 1, label: 'Partiellement nuageux' },
    { date: '2026-07-12', tMaxC: 21, tMinC: 9, precipMm: 4.2, precipProbPct: 78, windMaxKmh: 31, code: 61, label: 'Pluie' },
  ];

  it('retrouve la meteo d une date donnee', () => {
    const index = weatherByDate(days);
    expect(weatherForDay(index, '2026-07-12')?.label).toBe('Pluie');
  });

  it('une date hors prevision reste inconnue, pas la metee d aujourd hui', () => {
    expect(weatherForDay(weatherByDate(days), '2026-12-25')).toBeNull();
  });

  it('une journee humide se reconnait a la pluie annoncee ou au vent fort', () => {
    expect(isWetDay(days[0])).toBe(false);
    expect(isWetDay(days[1])).toBe(true);
  });

  it('sans donnee, aucune conclusion de meteo', () => {
    expect(isWetDay({ date: 'x', tMaxC: null, tMinC: null, precipMm: null, precipProbPct: null, windMaxKmh: null, code: null, label: '' })).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* P0.2 — La meteo du programme, consumable par l ecran                 */
/* ------------------------------------------------------------------ */

describe('P0.2 : meteo du programme, par journee', () => {
  const measured = (date: string, tMaxC: number): DayWeather => ({
    date,
    tMaxC,
    tMinC: 8,
    precipMm: 0,
    precipProbPct: 4,
    windMaxKmh: 12,
    code: 1,
    label: 'Partiellement nuageux',
  });

  it('expose la plage de dates REELLES du programme et la meteo de chaque jour', () => {
    const draft = fullDraft();
    const model = buildItinerary(draft);
    if (!model) throw new Error('modele attendu');
    const withWeather: ItineraryModel = {
      ...model,
      weather: [measured('2026-07-11', 24), measured('2026-07-12', 21), measured('2026-07-13', 19)],
    };

    const program = programWeather(draft, withWeather);

    expect(program.anchor).toEqual({ lat: CHAMONIX.lat, lon: CHAMONIX.lon });
    expect(program.dates).toEqual(['2026-07-11', '2026-07-12', '2026-07-13']);
    expect(program.days.map((d) => d.day)).toEqual([1, 2, 3]);
    expect(program.days[0].date).toBe('2026-07-11');
    expect(program.days[0].status).toBe('mesuree');
    expect(program.days[0].weather?.tMaxC).toBe(24);
    expect(program.complete).toBe(true);
  });

  it('retrouve la meteo d UNE journee par son numero', () => {
    const draft = fullDraft();
    const model = buildItinerary(draft);
    if (!model) throw new Error('modele attendu');
    const withWeather: ItineraryModel = {
      ...model,
      weather: [measured('2026-07-11', 24), measured('2026-07-12', 21), measured('2026-07-13', 19)],
    };
    const program = programWeather(draft, withWeather);
    expect(weatherOnDay(program, 2)?.weather?.tMaxC).toBe(21);
    expect(weatherOnDay(program, 0)).toBeNull();
    expect(weatherOnDay(program, 9)).toBeNull();
  });

  it('BR-1 : un brouillon vierge (startDate null) ne casse rien et n invente aucune date', () => {
    const draft = fullDraft({
      calendar: {
        startDate: null,
        durationDays: 2,
        durationIsSuggested: true,
        startDateIsSuggested: false,
        returnDate: null,
      },
    });
    const model = buildItinerary(draft);
    if (!model) throw new Error('modele attendu');

    const program = programWeather(draft, model);

    expect(program.dates).toBeNull();
    expect(program.anchor).toEqual({ lat: CHAMONIX.lat, lon: CHAMONIX.lon });
    expect(program.days).toHaveLength(2);
    expect(program.days.every((d) => d.date === null)).toBe(true);
    expect(program.days.every((d) => d.weather === null)).toBe(true);
    expect(program.days.every((d) => d.status === 'absente')).toBe(true);
    expect(program.complete).toBe(false);
    expect(program.reason).toBe('Date de départ inconnue : la météo n’a pas pu être mesurée.');
  });

  it('BR-2 : sans date, la mesure ne part pas du tout — aucun appel, aucune date fantome', async () => {
    const draft = fullDraft({
      calendar: { startDate: null, durationDays: 2, durationIsSuggested: true, startDateIsSuggested: false, returnDate: null },
    });
    const model = buildItinerary(draft);
    if (!model) throw new Error('modele attendu');

    let weatherCalls = 0;
    const measured = await measureItinerary(
      draft,
      model,
      {
        route: {
          route: async () => null,
          elevation: async () => null,
        },
        weather: async () => { weatherCalls += 1; return null; },
      },
      new AbortController().signal,
    );

    // Le fournisseur meteo n'est JAMAIS appele sans plage de dates : aucune
    // requete ne peut donc partir avec un `from`/`to` vide vers /api/weather.
    expect(weatherCalls).toBe(0);
    expect(measured.weather.every((d) => d === null)).toBe(true);
  });

  it('une serie partielle ne comble jamais le trou : le jour manquant reste absent', () => {
    const draft = fullDraft();
    const model = buildItinerary(draft);
    if (!model) throw new Error('modele attendu');
    // Cas reel : le fournisseur ne couvre pas le dernier jour.
    const partial: ItineraryModel = {
      ...model,
      weather: [measured('2026-07-11', 24), measured('2026-07-12', 21), null],
    };
    const program = programWeather(draft, partial);
    expect(program.days[2].status).toBe('absente');
    expect(program.days[2].weather).toBeNull();
    expect(program.measuredCount).toBe(2);
    expect(program.complete).toBe(false);
  });

  it('un parcours qui n existe pas ne leve pas : la meteo vaut absence', () => {
    const program = programWeather(fullDraft(), null);
    expect(program.days).toEqual([]);
    expect(program.anchor).toEqual({ lat: CHAMONIX.lat, lon: CHAMONIX.lon });
    expect(program.complete).toBe(false);
  });
});


