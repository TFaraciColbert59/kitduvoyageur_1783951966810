import { describe, expect, it } from 'vitest';
import lausanne from './fixtures/meteoalarm-ch-lausanne.json';
import { METEOALARM_FEEDS } from '../engine/meteoalarmFeeds';
import { digestMeteoalarm, readDigest, readMeteoalarm } from '../engine/officialAlerts';

/**
 * Alertes Meteoalarm hors France (plan 4.9). Les fixtures ont la FORME des flux
 * relus le 2026-10-10 sur https://feeds.meteoalarm.org/api/v1/warnings/feeds-<pays> ;
 * les valeurs (zones, dates) sont celles du test, pas des alertes réelles.
 */

interface AreaSpec {
  name: string;
  polygon?: string[];
}
interface InfoSpec {
  language: string;
  areas: AreaSpec[];
  headline?: string;
  web?: string;
  senderName?: string;
  level?: string;
  type?: string | null;
  onset?: string;
  expires?: string;
}
const info = (o: InfoSpec) => ({
  language: o.language,
  event: 'ignoré : seuls les champs structurés font foi',
  headline: o.headline,
  web: o.web,
  senderName: o.senderName ?? 'Service',
  onset: o.onset ?? '2026-10-11T06:00:00+02:00',
  expires: o.expires ?? '2026-10-11T21:00:00+02:00',
  area: o.areas.map((a) => ({
    areaDesc: a.name,
    ...(a.polygon ? { polygon: a.polygon } : { geocode: [{ valueName: 'EMMA_ID', value: 'XX001' }] }),
  })),
  parameter: [
    { valueName: 'awareness_level', value: o.level ?? '3; orange; Severe' },
    ...(o.type === null ? [] : [{ valueName: 'awareness_type', value: o.type ?? '1; Wind' }]),
  ],
});
const warning = (id: string, sent: string, infos: ReturnType<typeof info>[], msgType = 'Alert') => ({
  alert: { identifier: id, msgType, sent, info: infos },
});

const NOW = new Date('2026-10-11T07:00:00+02:00');
const BASE = { from: '2026-10-11', to: '2026-10-12', now: NOW, fetchedAt: '2026-10-11T05:00:00.000Z' };

/* ---------- Italie : zones nommées, deux langues ---------- */
const ITALIE = {
  warnings: [
    warning('it-1', '2026-10-10T18:00:00+02:00', [
      info({
        language: 'en-GB',
        areas: [{ name: 'Sardegna' }],
        headline: 'Orange Wind Warning for Italy - Sardegna',
        web: 'https://meteoalarm.org/en/live/region/IT?s=sardegna',
        senderName: 'Italian Air Force National Meteorological Service',
      }),
      info({
        language: 'it-IT',
        areas: [{ name: 'Sardegna' }],
        headline: 'Allerta Arancione Vento per Italia - Sardegna',
        senderName: "Servizio Meteorologico dell'Aeronautica Militare",
      }),
    ]),
  ],
};

describe('zone reconnue par son nom, dans n’importe quelle langue du flux', () => {
  it('Sardaigne : niveau et phénomène des champs structurés, texte officiel et service nommé', () => {
    const r = readMeteoalarm(ITALIE, { ...BASE, names: ['Sardegna'], feed: METEOALARM_FEEDS.it });
    expect(r.alerts).toHaveLength(1);
    expect(r.alerts[0]).toMatchObject({
      id: 'it-1',
      source: 'Servizio Meteorologico dell’Aeronautica Militare (MeteoAM) via Meteoalarm',
      level: 'orange',
      hazard: 'vent violent',
      area: 'Sardegna',
      sent: '2026-10-10T16:00:00.000Z',
      // Le texte officiel accompagne la mise en forme du Compas (conditions, § 5).
      headline: 'Orange Wind Warning for Italy - Sardegna',
      web: 'https://meteoalarm.org/en/live/region/IT?s=sardegna',
    });
  });

  it('une zone voisine ne reçoit rien', () => {
    expect(readMeteoalarm(ITALIE, { ...BASE, names: ['Sicilia'], feed: METEOALARM_FEEDS.it }).alerts).toEqual([]);
  });

  it('plusieurs noms (du plus fin au plus large) : le premier qui correspond à une zone du flux', () => {
    const r = readMeteoalarm(ITALIE, {
      ...BASE,
      names: ['Provincia di Cagliari', 'Sardegna', 'Italia'],
      feed: METEOALARM_FEEDS.it,
    });
    expect(r.alerts.map((a) => a.area)).toEqual(['Sardegna']);
  });
});

describe('connaissance de la zone : jamais « aucune alerte » sans preuve', () => {
  it('nom trouvé hors France : alertes lues mais liste partielle (une zone plus fine a pu nous échapper)', () => {
    const r = readMeteoalarm(ITALIE, { ...BASE, names: ['Sardegna'], feed: METEOALARM_FEEDS.it });
    expect(r.knowledge).toBe('partielle');
  });

  it('CONTRE-EXEMPLE — nom absent hors France : zone non rapprochée, pas « aucune alerte »', () => {
    const r = readMeteoalarm(ITALIE, { ...BASE, names: ['Sicilia'], feed: METEOALARM_FEEDS.it });
    expect(r).toMatchObject({ alerts: [], knowledge: 'aucune' });
  });

  it('France : les départements sont nommés comme la carte, un département absent est calme', () => {
    const r = readMeteoalarm(ITALIE, { ...BASE, names: ['Isère'], feed: METEOALARM_FEEDS.fr });
    expect(r).toMatchObject({ alerts: [], knowledge: 'complete' });
    // Sans aucun nom de zone, même la France ne prétend rien.
    expect(readMeteoalarm(ITALIE, { ...BASE, names: [], feed: METEOALARM_FEEDS.fr }).knowledge).toBe('aucune');
  });

  it('Lyon : le « comté » de la carte est la métropole, le département Rhône vient après et suffit', () => {
    const feed = {
      warnings: [
        warning('fr-69', '2026-10-10T18:00:00+02:00', [
          info({ language: 'fr-FR', areas: [{ name: 'Rhône' }], type: '3; Thunderstorm', level: '2; yellow; Moderate' }),
        ]),
      ],
    };
    const r = readMeteoalarm(feed, {
      ...BASE,
      names: ['Métropole de Lyon', 'Rhône', 'Auvergne-Rhône-Alpes'],
      feed: METEOALARM_FEEDS.fr,
    });
    expect(r.alerts).toMatchObject([{ level: 'jaune', hazard: 'orages', area: 'Rhône' }]);
    expect(r.knowledge).toBe('complete');
  });

  it('flux vide : rien d’actif dans tout le pays, quel que soit le lieu', () => {
    expect(readMeteoalarm({ warnings: [] }, { ...BASE, names: ['Nulle part'], feed: METEOALARM_FEEDS.de })).toMatchObject({
      alerts: [],
      knowledge: 'complete',
    });
  });

  it('flux illisible : rien n’est affirmé', () => {
    expect(digestMeteoalarm(null)).toBeNull();
    expect(digestMeteoalarm({ warnings: 'x' })).toBeNull();
    const sansFenetre = { warnings: [{ alert: { identifier: 'x', sent: '2026-10-10T10:00:00Z', info: [{ language: 'en' }] } }] };
    const d = digestMeteoalarm(sansFenetre);
    expect(d?.unreadable).toBe(true);
    expect(readDigest(d!, { ...BASE, names: ['x'], feed: METEOALARM_FEEDS.de }).knowledge).toBe('aucune');
  });
});

/* ---------- Suisse : contours, trois langues ---------- */
// Un carré de ~11 km autour de (46,7) ; le lieu « dedans » est au milieu.
const CARRE = ['45.95,6.95 45.95,7.05 46.05,7.05 46.05,6.95 45.95,6.95'];
const DEDANS = { lat: 46.0, lon: 7.0 };
const DEHORS = { lat: 46.5, lon: 8.5 };
const SUISSE = {
  warnings: [
    warning('ch-1', '2026-10-10T20:00:00+02:00', [
      info({
        language: 'en',
        areas: [{ name: 'Zone test', polygon: CARRE }],
        headline: 'Orange wind warning',
        senderName: 'MeteoSwiss',
        type: null,
      }),
      info({ language: 'de', areas: [{ name: 'Testzone', polygon: CARRE }], senderName: 'MeteoSwiss', type: null }),
      info({ language: 'fr', areas: [{ name: 'Zone d’essai', polygon: CARRE }], senderName: 'MeteoSwiss', type: null }),
    ]),
  ],
};

describe('zone reconnue par son contour (flux dont toutes les zones ont un contour)', () => {
  const opts = { ...BASE, names: [], feed: METEOALARM_FEEDS.ch };

  it('dedans : l’alerte, nommée dans la langue du Compas quand le flux la donne', () => {
    const r = readMeteoalarm(SUISSE, { ...opts, point: DEDANS });
    expect(r.alerts).toMatchObject([
      { level: 'orange', hazard: 'phénomène non précisé', area: 'Zone d’essai', source: 'Federal Office of Meteorology and Climatology MeteoSwiss via Meteoalarm' },
    ]);
    expect(r.knowledge).toBe('complete');
  });

  it('dehors : aucune alerte, et le flux entier l’a prouvé (tous les contours ont été testés)', () => {
    expect(readMeteoalarm(SUISSE, { ...opts, point: DEHORS })).toMatchObject({ alerts: [], knowledge: 'complete' });
  });

  it('CONTRE-EXEMPLE — sans position, un flux à contours ne dit rien', () => {
    expect(readMeteoalarm(SUISSE, { ...opts, point: null })).toMatchObject({ alerts: [], knowledge: 'aucune' });
  });

  it('flux mixte (une zone sans contour) : le contour qui couvre le lieu est montré, la liste reste partielle', () => {
    const mixte = {
      warnings: [
        ...SUISSE.warnings,
        warning('nl-2', '2026-10-10T20:00:00+02:00', [
          info({ language: 'nl-NL', areas: [{ name: 'Waddeneilanden' }], type: '10; Rain', level: '2; yellow; Moderate' }),
        ]),
      ],
    };
    const dedans = readMeteoalarm(mixte, { ...opts, point: DEDANS });
    expect(dedans.alerts.map((a) => a.id)).toEqual(['ch-1']);
    expect(dedans.knowledge).toBe('partielle');
    // Dehors : rien trouvé, mais une zone sans contour n’a pas pu être testée.
    expect(readMeteoalarm(mixte, { ...opts, point: DEHORS })).toMatchObject({ alerts: [], knowledge: 'aucune' });
  });
});

describe('services, langues et fenêtres', () => {
  it('Norvège, deux services : le nom suit l’expéditeur de l’alerte', () => {
    const feed = {
      warnings: [
        warning('no-nve', '2026-10-10T18:00:00+02:00', [
          info({
            language: 'no',
            areas: [{ name: 'Trøndelag' }],
            senderName: 'Norges vassdrags- og energidirektorat',
            type: '9; avalanches',
            level: '2; yellow; Moderate',
          }),
        ]),
      ],
    };
    const r = readMeteoalarm(feed, { ...BASE, names: ['Trøndelag'], feed: METEOALARM_FEEDS.no });
    expect(r.alerts[0]).toMatchObject({
      source: 'Norges Vassdrags- og Energidirektorat (NVE) via Meteoalarm',
      hazard: 'avalanches',
    });
  });

  it('un nom de personne dans l’expéditeur n’est jamais repris', () => {
    const feed = {
      warnings: [
        warning('cz-1', '2026-10-10T18:00:00+02:00', [
          info({ language: 'cs', areas: [{ name: 'Jihočeský kraj' }], senderName: 'ČHMÚ, Štefan Handžák' }),
        ]),
      ],
    };
    const r = readMeteoalarm(feed, { ...BASE, names: ['Jihočeský kraj'], feed: METEOALARM_FEEDS.cz });
    expect(JSON.stringify(r.alerts)).not.toContain('Handžák');
  });

  it('deux événements dans une même alerte (niveaux différents) restent deux alertes', () => {
    const feed = {
      warnings: [
        warning('de-1', '2026-10-10T18:00:00+02:00', [
          info({ language: 'de-DE', areas: [{ name: 'Kreis Fulda' }], level: '2; yellow; Moderate', type: '3; Thunderstorm' }),
          info({ language: 'en', areas: [{ name: 'Kreis Fulda' }], level: '2; yellow; Moderate', type: '3; Thunderstorm' }),
          info({ language: 'de-DE', areas: [{ name: 'Kreis Fulda' }], level: '3; orange; Severe', type: '1; Wind' }),
        ]),
      ],
    };
    const r = readMeteoalarm(feed, { ...BASE, names: ['Kreis Fulda'], feed: METEOALARM_FEEDS.de });
    expect(r.alerts.map((a) => [a.level, a.hazard])).toEqual([
      ['orange', 'vent violent'],
      ['jaune', 'orages'],
    ]);
  });

  it('un message annulé, un niveau vert, une alerte finie ou hors des dates du voyage ne sortent pas', () => {
    const feed = {
      warnings: [
        warning('annule', '2026-10-10T18:00:00+02:00', [info({ language: 'en', areas: [{ name: 'Z' }] })], 'Cancel'),
        warning('vert', '2026-10-10T18:00:00+02:00', [info({ language: 'en', areas: [{ name: 'Z' }], level: '1; green; Minor' })]),
        warning('fini', '2026-10-10T18:00:00+02:00', [
          info({ language: 'en', areas: [{ name: 'Z' }], onset: '2026-10-10T00:00:00+02:00', expires: '2026-10-11T06:00:00+02:00' }),
        ]),
        warning('plus-tard', '2026-10-10T18:00:00+02:00', [
          info({ language: 'en', areas: [{ name: 'Z' }], onset: '2026-10-20T06:00:00+02:00', expires: '2026-10-20T21:00:00+02:00' }),
        ]),
      ],
    };
    expect(readMeteoalarm(feed, { ...BASE, names: ['Z'], feed: METEOALARM_FEEDS.de }).alerts).toEqual([]);
  });

  it('tri : rouge avant orange avant jaune', () => {
    const w = (id: string, level: string) =>
      warning(id, '2026-10-10T18:00:00+02:00', [info({ language: 'en', areas: [{ name: 'Z' }], level, type: id === 'a' ? '1; Wind' : '10; Rain' })]);
    const feed = { warnings: [w('a', '2; yellow; Moderate'), w('b', '4; red; Extreme')] };
    expect(readMeteoalarm(feed, { ...BASE, names: ['Z'], feed: METEOALARM_FEEDS.de }).alerts.map((a) => a.level)).toEqual([
      'rouge',
      'jaune',
    ]);
  });
});

/* ---------- Flux réel de la Suisse (extrait du 7 octobre 2026) ---------- */
describe('contour réel de MétéoSuisse (zone « Lausanne - Lavaux », message du 7 octobre 2026)', () => {
  // Extrait fidèle du flux officiel : seuls le français et l'anglais sont gardés,
  // et les consignes détaillées sont retirées.
  const reel = { now: new Date('2026-10-08T08:00:00+02:00'), from: '2026-10-08', to: '2026-10-08' };
  const LAUSANNE = { lat: 46.5197, lon: 6.6323 };
  const ZERMATT = { lat: 46.0207, lon: 7.7491 };
  const opts = { ...BASE, ...reel, names: [], feed: METEOALARM_FEEDS.ch };

  it('le message réel est de niveau vert : pas de vigilance, mais la zone est reconnue', () => {
    expect(readMeteoalarm(lausanne, { ...opts, point: LAUSANNE })).toMatchObject({ alerts: [], knowledge: 'complete' });
  });

  it('même contour réel, niveau orange (valeur de test) : Lausanne dedans, Zermatt dehors', () => {
    const orange = JSON.parse(JSON.stringify(lausanne)) as typeof lausanne;
    for (const i of orange.warnings[0].alert.info)
      for (const p of i.parameter) if (p.valueName === 'awareness_level') p.value = '3; orange; Severe';

    const dedans = readMeteoalarm(orange, { ...opts, point: LAUSANNE });
    expect(dedans.alerts).toMatchObject([
      {
        level: 'orange',
        area: 'Lausanne - Lavaux',
        headline: 'Fortes pluies',
        web: 'http://www.meteoswiss.admin.ch',
        source: 'Federal Office of Meteorology and Climatology MeteoSwiss via Meteoalarm',
      },
    ]);
    expect(readMeteoalarm(orange, { ...opts, point: ZERMATT })).toMatchObject({ alerts: [], knowledge: 'complete' });
  });
});
