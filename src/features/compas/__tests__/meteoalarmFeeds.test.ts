import { describe, expect, it } from 'vitest';
import {
  METEOALARM_DISCLAIMER,
  METEOALARM_DISCLAIMER_FR,
  METEOALARM_FEEDS,
  METEOALARM_HOME,
  METEOALARM_TERMS,
  feedUrl,
  formatIssuedUtc,
  isMeteoalarmSource,
  providerLabel,
} from '../engine/meteoalarmFeeds';

describe('table des flux Meteoalarm', () => {
  it('une adresse par pays, au format des flux relus le 10 octobre 2026', () => {
    expect(feedUrl(METEOALARM_FEEDS.fr)).toBe('https://feeds.meteoalarm.org/api/v1/warnings/feeds-france');
    expect(feedUrl(METEOALARM_FEEDS.ch)).toBe('https://feeds.meteoalarm.org/api/v1/warnings/feeds-switzerland');
    for (const [code, feed] of Object.entries(METEOALARM_FEEDS)) {
      expect(code).toMatch(/^[a-z]{2}$/);
      expect(feed.slug).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
      expect(feed.providers.length).toBeGreaterThan(0);
    }
    const slugs = Object.values(METEOALARM_FEEDS).map((f) => f.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('un pays sans flux utilisable n’y figure pas : Royaume-Uni, Luxembourg, Malte, Moldavie, Macédoine du Nord, Slovaquie', () => {
    // Flux vides à la lecture du 10 octobre 2026 : on ne sait pas s’ils sont
    // calmes ou à l’arrêt, donc on ne dit jamais « aucune alerte » pour eux.
    for (const code of ['gb', 'lu', 'mt', 'md', 'mk', 'sk']) expect(METEOALARM_FEEDS[code]).toBeUndefined();
    // Hors Europe, aucun flux : « non couvert ».
    for (const code of ['us', 'jp', 'au', 'ma', 'br']) expect(METEOALARM_FEEDS[code]).toBeUndefined();
  });

  it('seuls les noms de la France sont reconnus comme complets (départements)', () => {
    const complete = Object.entries(METEOALARM_FEEDS)
      .filter(([, f]) => f.namesAreComplete)
      .map(([code]) => code);
    expect(complete).toEqual(['fr']);
  });

  it('liens officiels', () => {
    expect(METEOALARM_HOME).toBe('https://meteoalarm.org/en/live/');
    expect(METEOALARM_TERMS).toBe('https://meteoalarm.org/en/live/page/terms-and-conditions');
  });
});

describe('providerLabel — le service national, jamais une personne', () => {
  it('un seul service : son nom officiel', () => {
    expect(providerLabel(METEOALARM_FEEDS.fr, ['METEO-FRANCE'])).toBe('Météo-France');
    expect(providerLabel(METEOALARM_FEEDS.de, ['Deutscher Wetterdienst', 'DWD / Seewetterdienst Hamburg'])).toBe(
      'Deutscher Wetterdienst (DWD)'
    );
    // Le nom d’un agent dans le flux tchèque n’est jamais repris.
    expect(providerLabel(METEOALARM_FEEDS.cz, ['ČHMÚ, Štefan Handžák'])).toBe('Czech Hydrometeorological Institute (CHMI)');
  });

  it('plusieurs services : celui qui a émis l’alerte, d’après l’expéditeur du flux', () => {
    expect(providerLabel(METEOALARM_FEEDS.no, ['MET Norway'])).toBe('Meteorologisk Institutt (MET Norway)');
    expect(providerLabel(METEOALARM_FEEDS.no, ['Norges vassdrags- og energidirektorat'])).toBe(
      'Norges Vassdrags- og Energidirektorat (NVE)'
    );
    expect(providerLabel(METEOALARM_FEEDS.no, ['The Norwegian Water Resources and Energy Directorate'])).toBe(
      'Norges Vassdrags- og Energidirektorat (NVE)'
    );
    expect(providerLabel(METEOALARM_FEEDS.ba, ['Hydrometeorological Institute of Federation of Bosnia and Herzegovina'])).toBe(
      'Federalni Hidrometeorološki Zavod BiH (FHMZ)'
    );
    expect(providerLabel(METEOALARM_FEEDS.ba, ['Republički hidrometeorološki zavod Republike Srpske'])).toBe(
      'Republički Hidrometeorološki Zavod Republike Srpske (RHMZ RS)'
    );
  });

  it('plusieurs services et expéditeur inconnu : tous sont nommés, aucun n’est choisi au hasard', () => {
    expect(providerLabel(METEOALARM_FEEDS.no, [])).toBe(
      'Meteorologisk Institutt (MET Norway) / Norges Vassdrags- og Energidirektorat (NVE)'
    );
    expect(providerLabel(METEOALARM_FEEDS.no, ['Quelqu’un d’autre'])).toBe(
      'Meteorologisk Institutt (MET Norway) / Norges Vassdrags- og Energidirektorat (NVE)'
    );
  });
});

describe('heure d’émission, toujours donnée avec l’alerte (conditions, § 5)', () => {
  it('en UTC, sans dépendre du fuseau de la machine', () => {
    expect(formatIssuedUtc('2026-10-10T16:00:00.000Z')).toBe('10 oct. 2026, 16 h 00 UTC');
    expect(formatIssuedUtc('2026-10-10T18:05:08+02:00')).toBe('10 oct. 2026, 16 h 05 UTC');
    expect(formatIssuedUtc('2026-01-02T00:09:00Z')).toBe('2 janv. 2026, 0 h 09 UTC');
  });

  it('une date sans heure, ou illisible : rien d’inventé', () => {
    expect(formatIssuedUtc('2026-10-12')).toBeNull();
    expect(formatIssuedUtc('hier')).toBeNull();
    expect(formatIssuedUtc(null)).toBeNull();
    expect(formatIssuedUtc(undefined)).toBeNull();
  });
});

describe('avertissement du redistributeur', () => {
  it('le texte officiel, mot pour mot (conditions, § 5, relues le 10 octobre 2026)', () => {
    expect(METEOALARM_DISCLAIMER).toBe(
      'Time delays between this website and the www.meteoalarm.org website are possible. For the most up-to-date awareness information as published by the participating National Meteorological and Hydrological Services, please refer to www.meteoalarm.org.'
    );
    expect(METEOALARM_DISCLAIMER_FR).toContain('meteoalarm.org');
  });

  it('une source « via Meteoalarm » se reconnaît', () => {
    expect(isMeteoalarmSource('Météo-France via Meteoalarm')).toBe(true);
    expect(isMeteoalarmSource('MET Norway')).toBe(false);
    expect(isMeteoalarmSource('DIN 33466')).toBe(false);
  });
});
