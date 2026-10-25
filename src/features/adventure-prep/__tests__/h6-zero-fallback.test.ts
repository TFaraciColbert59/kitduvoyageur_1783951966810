/**
 * H6 — « null » honnete > donnee inventee.
 *
 * Ces tests verrouillent l absence de valeur de REPLI sur une MESURE.
 *
 * Un `?? 18` sur une temperature, un `?? 0` sur une serie meteo ou un
 * `?? 15` sur un vent ne sont pas des defauts de programmation : ce sont des
 * mensonges qui ont l apparence d une mesure. L ecran affiche alors
 * « 15 °C — 20 °C » pour une sortie dont personne n a releve la meteo, ou
 * « Dégagé » pour un code WMO absent — le code 0 d Open-Meteo vaut ciel
 * degage, donc un trou dans la reponse devient un ciel bleu.
 *
 * Ces tests doivent ECHOUER sur le code d avant, et rester verts apres.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  calculateHikeConsumables,
  resolveDeparturePlan,
  type DepartureHikeContext,
} from '@/lib/preparation/SmartDepartureEngine';
import { DEFAULT_SAMPLE_HIKES } from '@/lib/preparation/plannedHikes';
import { getWeather } from '@/features/materiel/services/getWeather';

const srcDir = join(__dirname, '..', '..', '..');
const prepDir = join(srcDir, 'lib', 'preparation');
const engineSource = readFileSync(join(prepDir, 'SmartDepartureEngine.ts'), 'utf8');
const plannedSource = readFileSync(join(prepDir, 'plannedHikes.ts'), 'utf8');
const weatherSource = readFileSync(
  join(srcDir, 'features', 'materiel', 'services', 'getWeather.ts'),
  'utf8',
);

/** Un contexte de sortie, sans aucune meteo : c est l etat le plus frequent. */
function dryContext(overrides: Partial<DepartureHikeContext> = {}): DepartureHikeContext {
  return {
    id: 'h1',
    name: 'Sortie test',
    distanceKm: 10,
    durationHours: 4,
    ...overrides,
  };
}

/** Une reponse Open-Meteo complete, telle que le fournisseur la renvoie. */
function openMeteoPayload(): unknown {
  return {
    current_weather: { temperature: 12.4, weathercode: 3 },
    hourly: {
      time: ['2026-09-29T08:00', '2026-09-29T09:00', '2026-09-29T10:00'],
      temperature_2m: [12.4, 13.1, 14.8],
      precipitation_probability: [10, 20, 30],
      weathercode: [3, 3, 61],
    },
    daily: {
      time: ['2026-09-29', '2026-09-30'],
      weathercode: [3, 61],
      temperature_2m_max: [17.2, 15.0],
      temperature_2m_min: [7.1, 6.4],
      precipitation_probability_max: [30, 80],
    },
  };
}

// getWeather lit MET Norway via un pont qui rend la forme Open-Meteo : le
// test fournit directement cette forme, comme le pont la rendrait.
const metno = vi.hoisted(() => ({ payload: null as unknown }));
vi.mock('@/lib/weather/metnoFetch', () => ({
  fetchMetnoAsOpenMeteo: vi.fn(async () => metno.payload),
}));

function stubFetch(payload: unknown): void {
  metno.payload = payload;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => payload })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('H6-1 — aucune valeur de repli sur une MESURE, dans le code', () => {
  it('H6-1a : pas de temperature par defaut dans le moteur de depart', () => {
    // Un repli NON nul sur une mesure est interdit. `?? null` reste la
    // forme honnete : c est exactement ce que la mission demande.
    expect(engineSource).not.toMatch(
      /tempC\s*\?\?\s*(?!null\b|undefined\b)\S/,
    );
    expect(engineSource).not.toMatch(/\?\?\s*18\b/);
  });

  it('H6-1b : pas de vent ni de pluie par defaut dans le moteur de depart', () => {
    expect(engineSource).not.toMatch(
      /(windKmH|precipitationProbability|uvIndex)\s*\?\?\s*(?!null\b|undefined\b)\S/,
    );
    expect(engineSource).not.toMatch(/precipitationProbability\s*\?\?\s*0/);
  });

  it('H6-1c : pas de temperature inventee dans les randonnees d exemple', () => {
    expect(plannedSource).not.toMatch(/tempC:\s*\d+/);
    for (const hike of DEFAULT_SAMPLE_HIKES) {
      const weather = (hike as { weather?: { tempC?: number } }).weather;
      expect(weather?.tempC ?? null).toBeNull();
    }
  });

  it('H6-1d : pas de zero par defaut sur une mesure meteo du hub', () => {
    // `?? 0` sur une temperature, une precipitation ou un code WMO est
    // precisement le piege : le code 0 d Open-Meteo signifie « ciel degage ».
    // Aucun repli CHIFFRE nulle part dans ce fichier : un zero pose sur
    // une mesure est un mensonge qui ressemble a un ciel degage.
    expect(weatherSource).not.toMatch(/\?\?\s*\d/);
  });
});

describe('H6-2 — le resume meteo assume l absence', () => {
  it('H6-2a : sans meteo, aucune fourchette de temperature n est affichee', () => {
    const plan = resolveDeparturePlan(dryContext(), [], []);
    expect(plan.weatherSummary.tempMinMax).toBeNull();
    expect(plan.weatherSummary.measured).toBe(false);
  });

  it('H6-2b : sans meteo, ni vent ni risque de pluie ne sont chiffres', () => {
    const plan = resolveDeparturePlan(dryContext(), [], []);
    expect(plan.weatherSummary.windKmh).toBeNull();
    expect(plan.weatherSummary.rainRiskPct).toBeNull();
    expect(plan.weatherSummary.condition).toBeNull();
  });

  it('H6-2c : sans meteo, le conseil ne promet pas le beau temps', () => {
    const plan = resolveDeparturePlan(dryContext(), [], []);
    expect(plan.weatherSummary.advice).toMatch(/non mesur/i);
    expect(plan.weatherSummary.advice).not.toMatch(/excellent/i);
  });

  it('H6-2d : une meteo reelle reste affichee, et nommee', () => {
    const plan = resolveDeparturePlan(
      dryContext({
        weather: {
          tempC: 14,
          condition: 'Ciel voilé',
          windKmH: 22,
          precipitationProbability: 0.4,
          uvIndex: 5,
          isAlert: false,
          fetchedAt: '2026-09-29T07:00:00.000Z',
        },
      }),
      [],
      [],
    );
    expect(plan.weatherSummary.measured).toBe(true);
    // La MESURE, telle quelle. Cette assertion pinait « 11 °C — 16 °C »,
    // c est a dire `tempC - 3` et `tempC + 2` : deux nombres ecrits en dur qui
    // transformaient une temperature instantanee en amplitude relevee.
    // `WeatherSnapshot` ne porte qu un point ; le point est donc ce qui sort.
    expect(plan.weatherSummary.tempC).toBe(14);
    // Et aucune amplitude n est deduite de ce point.
    expect(plan.weatherSummary.tempMinMax).toBeNull();
    expect(plan.weatherSummary.windKmh).toBe(22);
    expect(plan.weatherSummary.rainRiskPct).toBe(40);
    expect(plan.weatherSummary.condition).toBe('Ciel voilé');
  });
});

describe('H6-3 — les consommables lisent la mesure, ils ne la remplacent pas', () => {
  it('H6-3a : une temperature reelle chaude ajoute l eau mesuree', () => {
    const chaud = calculateHikeConsumables(
      dryContext({ weather: meteo(28) }),
    );
    const tempere = calculateHikeConsumables(
      dryContext({ weather: meteo(18) }),
    );
    // 18 °C est la valeur qui etait codee en dur : elle ne doit plus produire
    // le meme resultat qu une meteo reellement relevee.
    expect(chaud.waterLiters).toBeGreaterThan(tempere.waterLiters);
    expect(chaud.electrolytesRecommended).toBe(true);
  });

  it('H6-3b : une temperature reelle fraiche declenche la couche isolante', () => {
    const frais = calculateHikeConsumables(dryContext({ weather: meteo(3) }));
    expect(frais.warmLayerNeeded).toBe(true);
    const tempere = calculateHikeConsumables(dryContext({ weather: meteo(18) }));
    expect(tempere.warmLayerNeeded).toBe(false);
  });

  it('H6-3c : sans meteo, aucune recommandation n invente un indice UV', () => {
    const sans = calculateHikeConsumables(dryContext());
    const uvFort = calculateHikeConsumables(
      dryContext({ weather: { ...meteo(18), uvIndex: 8 } }),
    );
    expect(uvFort.sunProtectionNeeded).toBe(true);
    // Sans UV mesure, la protection solaire ne peut pas etre deduite du vide.
    expect(sans.sunProtectionNeeded).toBe(false);
  });
});

describe('H6-4 — getWeather ne fabrique pas une prevision', () => {
  it('H6-4a : un trou dans les temperatures rend la meteo indisponible', async () => {
    const payload = openMeteoPayload() as {
      hourly: { temperature_2m: number[] };
    };
    payload.hourly.temperature_2m = [12.4, null as unknown as number, 14.8];
    stubFetch(payload);
    await expect(getWeather(45.9, 6.9, 'Chamonix')).resolves.toBeNull();
  });

  it('H6-4b : un trou dans les codes WMO ne devient pas « Dégagé »', async () => {
    const payload = openMeteoPayload() as { daily: { weathercode: unknown[] } };
    payload.daily.weathercode = [null, 61];
    stubFetch(payload);
    await expect(getWeather(45.9, 6.9, 'Chamonix')).resolves.toBeNull();
  });

  it('H6-4c : une reponse complete est rendue telle quelle', async () => {
    stubFetch(openMeteoPayload());
    const forecast = await getWeather(45.9, 6.9, 'Chamonix');
    expect(forecast).not.toBeNull();
    expect(forecast?.current.tempC).toBe(12);
    expect(forecast?.current.weathercode).toBe(3);
    expect(forecast?.days[1]?.tempMaxC).toBe(15);
    expect(forecast?.days[1]?.precipPct).toBe(80);
    expect(forecast?.cells[2]?.tempC).toBe(15);
  });

  it('H6-4d : un ciel degage REEL reste un ciel degage', async () => {
    const payload = openMeteoPayload() as { daily: { weathercode: number[] } };
    payload.daily.weathercode = [0, 0];
    stubFetch(payload);
    const forecast = await getWeather(45.9, 6.9, 'Chamonix');
    // Le code 0 du fournisseur est une MESURE : le garde-fou ne doit pas
    // confondre « zero absent » et « zero mesure ».
    expect(forecast?.days[0]?.weathercode).toBe(0);
  });

  it('H6-4e : sans coordonnees, aucune demande n est faite', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    await expect(getWeather(null, null, 'nulle part')).resolves.toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});

/** Un instantane meteo minimal, sans uv ni alerte. */
function meteo(tempC: number): NonNullable<DepartureHikeContext['weather']> {
  return {
    tempC,
    condition: 'Mesure',
    windKmH: 10,
    precipitationProbability: 0,
    isAlert: false,
    fetchedAt: '2026-09-29T07:00:00.000Z',
  };
}
