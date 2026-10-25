import { describe, expect, it } from 'vitest';
import {
  normalizeArea,
  parseMeteoalarm,
  withinPublishedHorizon,
} from '../engine/officialAlerts';

/** Une émission au format réel du flux Meteoalarm France (2026-10-01). */
const warning = (o: {
  id: string;
  sent: string;
  level: string;
  type: string;
  areas: string[];
  onset: string;
  expires: string;
  event?: string;
  msgType?: string;
}) => ({
  alert: {
    identifier: o.id,
    msgType: o.msgType ?? 'Alert',
    sent: o.sent,
    info: [
      {
        language: 'fr-FR',
        event: o.event ?? 'Vigilance',
        onset: o.onset,
        expires: o.expires,
        senderName: 'METEO-FRANCE',
        area: o.areas.map((a) => ({ areaDesc: a, geocode: [{ valueName: 'NUTS3', value: 'FR000' }] })),
        parameter: [
          { valueName: 'awareness_level', value: o.level },
          { valueName: 'awareness_type', value: o.type },
        ],
      },
      { language: 'en-GB', event: 'Warning', onset: o.onset, expires: o.expires, area: [], parameter: [] },
    ],
  },
});

const NOW = new Date('2026-10-01T18:00:00+02:00');
const opts = (area: string, from = '2026-10-01', to = '2026-10-03') => ({
  area,
  from,
  to,
  now: NOW,
  fetchedAt: '2026-10-01T16:00:00.000Z',
});

describe('parseMeteoalarm', () => {
  it('lit niveau et phénomène sur les champs structurés, pour la zone du voyage', () => {
    const feed = {
      warnings: [
        warning({
          id: 'a1',
          sent: '2026-09-30T16:04:08+02:00',
          level: '3; orange; Severe',
          type: '13; rain-flood',
          areas: ['Gard', 'Hérault'],
          onset: '2026-10-01T00:00:00+02:00',
          expires: '2026-10-02T00:00:00+02:00',
        }),
      ],
    };
    expect(parseMeteoalarm(feed, opts('Hérault'))).toEqual([
      {
        id: 'a1',
        source: 'Météo-France via Meteoalarm',
        sent: '2026-09-30T14:04:08.000Z',
        updatedSince: null,
        hazard: 'pluie-inondation',
        level: 'orange',
        area: 'Hérault',
        onset: '2026-10-01T00:00:00+02:00',
        expires: '2026-10-02T00:00:00+02:00',
        fetchedAt: '2026-10-01T16:00:00.000Z',
      },
    ]);
    expect(parseMeteoalarm(feed, opts('Isère'))).toEqual([]);
  });

  it('CONTRE-EXEMPLE — le libellé « jaune » ne l’emporte pas sur un niveau vert', () => {
    const feed = {
      warnings: [
        warning({
          id: 'v',
          sent: '2026-10-01T06:00:00+02:00',
          level: '1; green; Minor',
          type: '3; Thunderstorm',
          event: 'Vigilance jaune orages',
          areas: ['Landes'],
          onset: '2026-10-02T00:00:00+02:00',
          expires: '2026-10-03T00:00:00+02:00',
        }),
      ],
    };
    expect(parseMeteoalarm(feed, opts('Landes'))).toEqual([]);
  });

  it('une mise à jour plus récente met fin à l’alerte précédente', () => {
    const base = {
      type: '3; Thunderstorm',
      areas: ['Landes'],
      onset: '2026-10-02T00:00:00+02:00',
      expires: '2026-10-03T00:00:00+02:00',
    };
    const feed = {
      warnings: [
        warning({ ...base, id: 'j', sent: '2026-10-01T06:00:00+02:00', level: '2; yellow; Moderate' }),
        warning({ ...base, id: 'fin', sent: '2026-10-01T16:00:00+02:00', level: '1; green; Minor', msgType: 'Update' }),
      ],
    };
    expect(parseMeteoalarm(feed, opts('Landes'))).toEqual([]);
    // Dans l'ordre inverse du flux, même résultat : seule l'heure d'émission compte.
    expect(parseMeteoalarm({ warnings: [...feed.warnings].reverse() }, opts('Landes'))).toEqual([]);
  });

  it('accepte « Hautes Alpes » pour « Hautes-Alpes » et ignore les dates hors voyage', () => {
    const feed = {
      warnings: [
        warning({
          id: 'ha',
          sent: '2026-10-01T16:00:21+02:00',
          level: '2; yellow; Moderate',
          type: '3; Thunderstorm',
          areas: ['Hautes Alpes'],
          onset: '2026-10-02T00:00:00+02:00',
          expires: '2026-10-03T00:00:00+02:00',
        }),
      ],
    };
    expect(parseMeteoalarm(feed, opts('Hautes-Alpes'))).toHaveLength(1);
    // Voyage du 3 au 5 : l'alerte couvre le 2 seulement (fin à minuit).
    expect(parseMeteoalarm(feed, opts('Hautes-Alpes', '2026-10-03', '2026-10-05'))).toEqual([]);
  });

  it('écarte une alerte expirée et un flux illisible', () => {
    const feed = {
      warnings: [
        warning({
          id: 'old',
          sent: '2026-09-30T16:00:00+02:00',
          level: '4; red; Extreme',
          type: '12; flooding',
          areas: ['Hérault'],
          onset: '2026-09-30T00:00:00+02:00',
          expires: '2026-10-01T00:00:00+02:00',
        }),
      ],
    };
    expect(parseMeteoalarm(feed, opts('Hérault', '2026-09-30', '2026-10-02'))).toEqual([]);
    expect(parseMeteoalarm(null, opts('Hérault'))).toEqual([]);
    expect(parseMeteoalarm({ warnings: 'x' }, opts('Hérault'))).toEqual([]);
  });
});

describe('parseMeteoalarm — mises à jour à fenêtre nulle (flux réel Hérault, 30/09–01/10)', () => {
  const rouge = warning({
    id: 'rouge',
    sent: '2026-09-30T16:04:23+02:00',
    level: '4; red; Extreme',
    type: '12; flooding',
    areas: ['Hérault'],
    onset: '2026-10-01T00:00:00+02:00',
    expires: '2026-10-02T00:00:00+02:00',
  });
  const cloture = (sent: string, onset: string) =>
    warning({
      id: `clot-${sent}`,
      msgType: 'Update',
      sent,
      level: '1; green; Minor',
      type: '12; flooding',
      event: 'Vigilance orange inondations',
      areas: ['Hérault'],
      onset,
      expires: onset,
    });

  it('une clôture à fenêtre nulle n’efface pas l’alerte : elle la marque « à vérifier »', () => {
    const feed = {
      warnings: [rouge, cloture('2026-09-30T22:05:48+02:00', '2026-10-01T00:00:00+02:00')],
    };
    const [a] = parseMeteoalarm(feed, opts('Hérault'));
    expect(a).toMatchObject({ level: 'rouge', hazard: 'inondations' });
    expect(a.updatedSince).toBe('2026-09-30T20:05:48.000Z');
  });

  it('une clôture suivie d’une nouvelle alerte : la nouvelle fait foi, sans réserve', () => {
    const nouvelle = warning({
      id: 'orange',
      sent: '2026-09-30T22:05:50+02:00',
      level: '3; orange; Severe',
      type: '12; flooding',
      areas: ['Hérault'],
      onset: '2026-10-01T00:00:00+02:00',
      expires: '2026-10-02T00:00:00+02:00',
    });
    const feed = {
      warnings: [rouge, cloture('2026-09-30T22:05:48+02:00', '2026-10-01T00:00:00+02:00'), nouvelle],
    };
    const out = parseMeteoalarm(feed, opts('Hérault'));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'orange', level: 'orange', updatedSince: null });
  });
});

describe('normalizeArea / withinPublishedHorizon', () => {
  it('normalise accents, tirets et apostrophes', () => {
    expect(normalizeArea('Côtes-d’Armor')).toBe(normalizeArea("cotes d'armor"));
  });
  it('Météo-France ne publie que pour aujourd’hui et demain', () => {
    expect(withinPublishedHorizon('2026-10-02', '2026-10-04', '2026-10-01')).toBe(true);
    expect(withinPublishedHorizon('2026-10-03', '2026-10-04', '2026-10-01')).toBe(false);
    expect(withinPublishedHorizon('2026-09-20', '2026-09-22', '2026-10-01')).toBe(false);
  });
});
