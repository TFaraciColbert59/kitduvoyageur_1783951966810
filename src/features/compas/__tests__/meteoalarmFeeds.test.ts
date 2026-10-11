import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  METEOALARM_DISCLAIMER,
  METEOALARM_DISCLAIMER_FR,
  METEOALARM_FEEDS,
  METEOALARM_HOME,
  METEOALARM_TERMS,
  feedUrl,
  formatIssuedUtc,
  formatPeriodUtc,
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

describe('période de validité (Style Guide de Meteoalarm : début et fin avec leur fuseau)', () => {
  it('en UTC, début et fin', () => {
    expect(formatPeriodUtc('2026-10-12T06:00:00+02:00', '2026-10-12T21:00:00+02:00')).toBe(
      'du 12 oct. 2026, 4 h 00 UTC au 12 oct. 2026, 19 h 00 UTC'
    );
  });

  it('un début ou une fin sans heure, absent ou illisible : rien d’inventé', () => {
    expect(formatPeriodUtc('2026-10-12', '2026-10-13T10:00:00Z')).toBeNull();
    expect(formatPeriodUtc('2026-10-12T06:00:00Z', null)).toBeNull();
    expect(formatPeriodUtc(undefined, undefined)).toBeNull();
    expect(formatPeriodUtc('n’importe quoi', '2026-10-13T10:00:00Z')).toBeNull();
  });
});

/**
 * Noms des services nationaux, tels que la page « Our Warning Providers »
 * (https://meteoalarm.org/en/live/page/warning-providers) les donnait le 2026-10-11.
 * Le § 5 des conditions exige « the name of the relevant MeteoAlarm Participant ».
 */
const OFFICIAL_PROVIDERS: Record<string, string[]> = {
  ad: ['Servei Meteorològic Nacional (SMN)'],
  at: ['GeoSphere Austria'],
  be: ['Institut Royal Météorologique/Koninklijk Meteorologisch Instituut (IRM/KMI)'],
  ba: ['Federalni Hidrometeorološki Zavod BiH (FHMZ)', 'Republički Hidrometeorološki Zavod Republike Srpske (RHMZ RS)'],
  bg: ['National Institute of Meteorology and Hydrology (NIMH)'],
  hr: ['Državni Hidrometeorološki Zavod (DHMZ)'],
  cy: ['Cyprus Department of Meteorology (CYMET)'],
  cz: ['Czech Hydrometeorological Institute (CHMI)'],
  dk: ['Danmarks Meteorologiske Institut (DMI)'],
  ee: ['Estonian Environment Agency (ESTEA)'],
  fi: ['Finnish Meteorological Institute (FMI)'],
  fr: ['Météo-France'],
  de: ['Deutscher Wetterdienst (DWD)'],
  gr: ['Hellenic National Meteorological Service (HNMS)'],
  hu: ['HungaroMet'],
  is: ['Icelandic Meteorological Office (IMO)'],
  ie: ['Met Éireann'],
  il: ['Israel Meteorological Service (IMS)'],
  it: ['Servizio Meteorologico dell’Aeronautica Militare (MeteoAM)'],
  lv: ['Latvijas Vides, Ģeoloģijas un Meteoroloģijas Centrs (LVĢMC)'],
  lt: ['Lietuvos Hidrometeorologijos Tarnyba (LHMT)'],
  me: ['Zavod za Hidrometeorologiju i Seizmologiju (ZHMS)'],
  nl: ['Koninklijk Nederlands Meteorologisch Instituut (KNMI)'],
  no: ['Meteorologisk Institutt (MET Norway)', 'Norges Vassdrags- og Energidirektorat (NVE)'],
  pl: ['Instytut Meteorologii i Gospodarki Wodnej - Państwowy Instytut Badawczy (IMGW-PIB)'],
  pt: ['Instituto Português do Mar e da Atmosfera (IPMA)'],
  ro: ['Administrația Națională de Meteorologie (ANM)'],
  rs: ['Republički Hidrometeorološki Zavod Srbije (RHMZ)'],
  si: ['Agencija Republike Slovenije za Okolje (ARSO)'],
  es: ['Agencia Estatal de Meteorología (AEMET)'],
  se: ['Sveriges Meteorologiska och Hydrologiska Institut (SMHI)'],
  ch: ['Federal Office of Meteorology and Climatology MeteoSwiss'],
  ua: ['Ukrainian Hydrometeorological Center (UHMC)'],
};

describe('services nationaux nommés (conditions, § 5)', () => {
  it('chaque pays de la table nomme le service tel que la page officielle des fournisseurs le nomme', () => {
    expect(Object.keys(METEOALARM_FEEDS).sort()).toEqual(Object.keys(OFFICIAL_PROVIDERS).sort());
    for (const [code, names] of Object.entries(OFFICIAL_PROVIDERS))
      expect(METEOALARM_FEEDS[code].providers.map((p) => p.name), code).toEqual(names);
  });
});

describe('les conditions citées dans le code sont celles de la page officielle', () => {
  const source = readFileSync(path.resolve(__dirname, '../engine/meteoalarmFeeds.ts'), 'utf8');
  // Les commentaires coupent les citations en lignes : on compare sans la marge « * ».
  const flat = source.replace(/\n\s*\*\s?/g, ' ').replace(/\s+/g, ' ');

  it('cite le § 5 mot pour mot (relu le 11 octobre 2026), avec le lien et la date de mise à jour', () => {
    expect(flat).toContain(
      'All Information on the MeteoAlarm Website may be used and redistributed under terms equivalent to the Creative Commons Attribution 4.0 International License (CC BY 4.0), along with the following additional requirements'
    );
    expect(flat).toContain('https://meteoalarm.org/en/live/page/terms-and-conditions');
    expect(flat).toContain('Last Updated: 15/03/2024');
    expect(flat).toContain('relues mot pour mot le 2026-10-11');
  });

  it('cite les exigences supplémentaires telles que la page les écrit', () => {
    for (const quote of [
      'it must be redistributed along with the same Information without any material change or modification',
      'the name of the relevant MeteoAlarm Participant',
      'the time of issue',
      'in real-time',
      'on average less than five minutes and never longer than ten minutes',
    ])
      expect(flat, quote).toContain(quote);
  });

  it('ne prétend pas que la page parle d’usage commercial', () => {
    expect(flat).toContain('La page ne prononce pas le mot « commercial »');
  });

  it('dit que l’adresse JSON des flux n’est pas décrite par les pages lues, et que Meteoalarm ne chiffre aucune fréquence', () => {
    expect(flat).toContain('Les pages lues ne décrivent pas cette adresse');
    expect(flat).toContain('Aucune fréquence d\'appel n\'est chiffrée par Meteoalarm');
  });
});
