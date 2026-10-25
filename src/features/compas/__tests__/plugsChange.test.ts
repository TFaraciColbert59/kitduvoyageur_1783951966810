import { describe, expect, it } from 'vitest';
import {
  cellsOf,
  frequencies,
  householdVolts,
  parseTable,
  plugLetters,
  rareLetters,
  stripMarkup,
} from '../../../../scripts/compas/build-mains-electricity.mjs';
import CURRENCIES from '../data/countryCurrencies.json';
import DATA from '../data/mainsElectricity.json';
import META from '../data/mainsElectricity.meta.json';
import { changeLineFor, readerCurrency } from '../engine/change';
import {
  describeCurrent,
  devicesOf,
  mainsOf,
  plugFact,
  plugLineFor,
  plugVerdict,
  sharedPlugs,
  usualPlugs,
  currentLineFor,
  type MainsRow,
} from '../engine/plugs';
import {
  isCurrentNote,
  isMoneyNote,
  isPlugsNote,
  notesForReader,
  readerCurrentNotes,
  readerMoneyNotes,
  sharedNotes,
  travelPapers,
  type PapersFacts,
} from '../engine/papers';
import { isCountryCode, UNKNOWN_TRAVELLER, type TravellerContext } from '../engine/traveller';

/**
 * Prises, tension, fréquence et change pour tous les pays (PLAN-100 4.2, lot AC).
 *  - la table (`mainsElectricity.json`) et son script de construction ;
 *  - « adaptateur à prévoir » calculé à partir du pays de résidence de n'importe quel lecteur ;
 *  - les lignes « Courant » et « Change », rendues à la lecture seulement ;
 *  - vie privée : rien de ce qui dépend de la résidence ou de la devise ne se range sur le voyage.
 */

const who = (over: Partial<TravellerContext>): TravellerContext => ({ ...UNKNOWN_TRAVELLER, ...over });
const ROWS = DATA as unknown as Record<string, MainsRow>;
const find = () => null;

describe('la table des prises, tensions et fréquences', () => {
  it('228 pays et territoires, chacun avec des lettres A à O, une tension de foyer et une fréquence', () => {
    const codes = Object.keys(ROWS);
    expect(codes.length).toBe(228);
    expect(META.countries).toBe(228);
    for (const code of codes) {
      const row = ROWS[code];
      expect(isCountryCode(code), code).toBe(true);
      expect(row.plugs.length, code).toBeGreaterThan(0);
      for (const p of row.plugs) expect(p, code).toMatch(/^[A-O]$/);
      for (const r of row.rare ?? []) expect(row.plugs, code).toContain(r);
      expect(row.volts.length, code).toBeGreaterThan(0);
      for (const v of row.volts) expect(v >= 90 && v <= 260, `${code} ${v} V`).toBe(true);
      expect(row.hz.length, code).toBeGreaterThan(0);
      for (const f of row.hz) expect([50, 60], code).toContain(f);
    }
  });

  it('les pays que le tableau ne donne pas sont « non renseignés » : aucune ligne, rien d’inventé', () => {
    const missing = Object.keys(CURRENCIES).filter((c) => !ROWS[c]);
    expect(missing.sort()).toEqual(
      'AX BL BV CC CX EH HM IO MH MP NF SJ SS TC TF TK UM VA WF YT'.split(' ')
    );
    for (const code of missing) {
      expect(mainsOf(code), code).toBeNull();
      expect(plugVerdict(code, code, 'FR').kind, code).toBe('rien');
      expect(currentLineFor(code, 'FR'), code).toBeNull();
    }
  });

  it('valeurs de contrôle lues sur la révision citée', () => {
    expect(ROWS.FR).toEqual({ plugs: ['C', 'E'], volts: [230], hz: [50] });
    expect(ROWS.GB).toEqual({ plugs: ['G', 'D', 'M'], rare: ['D', 'M'], volts: [230], hz: [50] });
    expect(ROWS.US).toEqual({ plugs: ['A', 'B'], volts: [120], hz: [60] });
    expect(ROWS.JP).toEqual({ plugs: ['A', 'B'], volts: [100, 200, 210], hz: [50, 60] });
    expect(ROWS.CH.plugs).toEqual(['C', 'J']);
    expect(ROWS.SG.rare).toEqual(['C', 'M']);
    expect(ROWS.MY.rare).toEqual(['C', 'M']);
    expect(ROWS.BR.volts).toEqual([127, 220]);
    // Canada : le 347/600 V des réseaux commerciaux n'est pas une tension de foyer.
    expect(ROWS.CA.volts).toEqual([120]);
  });

  it('la source est citée : révision fixée, licence, historique, date de lecture, empreinte', () => {
    expect(META.page).toBe('https://en.wikipedia.org/wiki/Mains_electricity_by_country');
    expect(META.revision).toBe(1379647853);
    expect(META.revisionUrl).toBe('https://en.wikipedia.org/w/index.php?title=Mains_electricity_by_country&oldid=1379647853');
    expect(META.historyUrl).toMatch(/^https:\/\/en\.wikipedia\.org\/w\/index\.php\?title=Mains_electricity_by_country&action=history$/);
    expect(META.licence).toBe('CC BY-SA 4.0');
    expect(META.licenceUrl).toBe('https://creativecommons.org/licenses/by-sa/4.0/');
    expect(META.readOn).toBe('2026-10-12');
    expect(META.revisionDate).toBe('2026-10-11');
    expect(META.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(META.credit).toContain('Wikipedia contributors');
    expect(META.credit).toContain('CC BY-SA 4.0');
    expect(META.credit).toContain('1379647853');
    // La source première (CEI) n'a pas été lue : le fichier le dit.
    expect(META.primarySourceUrl).toBe('https://www.iec.ch/world-plugs');
    expect(META.primarySourceNote).toMatch(/retiré ce site en septembre 2026/);
    expect(META.primarySourceNote).toMatch(/Non lisible/);
  });
});

describe('script de construction — la lecture du tableau est stricte', () => {
  const table = (rows: string[]) =>
    ['intro', '{| class="wikitable sortable"', '|-', '! Pays', ...rows.map((r) => `|-\n${r}`), '|}'].join('\n');
  const row = (name: string, plugs: string, volts: string, hz: string, notes = '') =>
    `| {{flag|${name}}}\n| ${plugs}\n|\n| ${volts}\n| ${hz}\n|${notes ? ` ${notes}` : ''}`;
  // Le premier `|-` après l'en-tête sépare l'en-tête (ignoré par `slice(2)`) : une ligne factice le tient.
  const parse = (rows: string[]) => parseTable(table([row('Portugal', 'C, F', '230/400&nbsp;V', '50&nbsp;Hz'), ...rows]));

  it('lit les lettres, les tensions de foyer et les fréquences ; renvois et modèles retirés', () => {
    const out = parse([
      row('Japan', 'A, B', '100&nbsp;V<br />200&nbsp;V', '50&nbsp;Hz<br />60&nbsp;Hz'),
      row(
        'Canada',
        'A, B{{efn|note}}<ref>{{cite web |title=x\n|url=https://exemple.test/}}</ref>',
        '120/240&nbsp;V<br />347/600&nbsp;V',
        '60&nbsp;[[Hertz|Hz]]'
      ),
    ]);
    expect(out.JP).toEqual({ plugs: ['A', 'B'], volts: [100, 200], hz: [50, 60] });
    expect(out.CA).toEqual({ plugs: ['A', 'B'], volts: [120], hz: [60] });
  });

  it('un « | » en début de ligne dans un renvoi ou un modèle n’ouvre pas de cellule', () => {
    const cells = cellsOf(
      '| {{flag|X}}\n| C<ref name="a">{{cite web\n|title=t\n|url=u}}</ref>\n|\n| 230&nbsp;V\n| 50&nbsp;Hz\n| note'
    );
    expect(cells.length).toBe(6);
    expect(stripMarkup(cells[1]).trim()).toBe('C');
  });

  it('signale les lettres que les notes disent historiques, très rares ou sans prise sur place', () => {
    expect(
      rareLetters('Type D mostly historical, nowadays used only for lighting.<br />Type M historically used.', ['G', 'D', 'M'])
    ).toEqual(['D', 'M']);
    expect(rareLetters('Type C appliances may be sold, but may require an adaptor.', ['C', 'G', 'M'])).toEqual(['C']);
    // Un point-virgule sépare deux affirmations : K n'est pas « rare ».
    expect(
      rareLetters('Type E and F sockets are legal but rare; Type E, F and 7/7 plugs fit the Type K sockets.', ['C', 'E', 'F', 'K'])
    ).toEqual(['E', 'F']);
    // Une lettre que la ligne ne liste pas n'est jamais retenue.
    expect(rareLetters('Type E is extremely rare.', ['C', 'F'])).toEqual([]);
    expect(rareLetters('Type G is most common.', ['G', 'D'])).toEqual([]);
  });

  it('échoue, sans rien écrire, sur un nom inconnu, un code en double, une lettre, une fréquence ou une ligne incomplète', () => {
    expect(() => parse([row('Atlantis', 'C', '230&nbsp;V', '50&nbsp;Hz')])).toThrow(/pays inconnu du script/);
    expect(() => parse([row('Portugal', 'C', '230&nbsp;V', '50&nbsp;Hz')])).toThrow(/en double/);
    expect(() => parse([row('Japan', 'Z', '100&nbsp;V', '50&nbsp;Hz')])).toThrow(/lettre de prise inattendue/);
    expect(() => parse([row('Japan', 'A, texte libre', '100&nbsp;V', '50&nbsp;Hz')])).toThrow(/texte inattendu/);
    expect(() => parse([row('Japan', 'A', '100&nbsp;V', '55&nbsp;Hz')])).toThrow(/fréquence inattendue/);
    expect(() => parse([row('Japan', 'A', '12&nbsp;V', '50&nbsp;Hz')])).toThrow(/tension du foyer trop basse/);
    expect(() => parse([row('Japan', 'A', '', '50&nbsp;Hz')])).toThrow(/manquante/);
    expect(() => parseTable('rien')).toThrow(/tableau introuvable/);
  });

  it('plugLetters, householdVolts, frequencies : les formes de la page', () => {
    expect(plugLetters('G, [105] D, M', 'GB')).toEqual(['G', 'D', 'M']);
    expect(plugLetters('A, B NEMA 14-30 NEMA 14-50', 'CA')).toEqual(['A', 'B']);
    expect(householdVolts('127/220&nbsp;V 220/380&#x20;V', 'BR')).toEqual([127, 220]);
    expect(householdVolts('277/480&nbsp;V<br />120/208&nbsp;V', 'US')).toEqual([120]);
    expect(frequencies('50&nbsp;Hz 60&nbsp;Hz [59]', 'JP')).toEqual([50, 60]);
  });
});

describe('plugVerdict — « adaptateur à prévoir » pour le pays de résidence de n’importe quel lecteur', () => {
  it('les lettres que les notes disent rares, et D et M, ne comptent pas', () => {
    expect(usualPlugs(ROWS.GB)).toEqual(['G']);
    expect(usualPlugs(ROWS.DK)).toEqual(['C', 'K']);
    expect(usualPlugs(ROWS.SG)).toEqual(['G']);
    // D et M ne sont jamais « en commun » (Inde et Hong Kong les listent aussi).
    expect(sharedPlugs(ROWS.IN, ROWS.HK)).toEqual([]);
    expect(sharedPlugs(ROWS.IN, ROWS.GB)).toEqual([]);
    expect(sharedPlugs(ROWS.FR, ROWS.DE)).toEqual(['C']);
  });

  it.each([
    ['FR', 'GB', 'G'],
    ['US', 'PT', 'C/F'],
    ['GB', 'DE', 'C/F'],
    ['IN', 'GB', 'G'],
    ['GB', 'IN', 'C/D/M'],
    ['FR', 'SG', 'G'],
    ['FR', 'MY', 'G'],
    ['JP', 'FR', 'C/E'],
    ['AU', 'US', 'A/B'],
    ['BR', 'US', 'A/B'],
    ['CH', 'AU', 'I'],
    ['NZ', 'JP', 'A/B'],
  ])('résidence %s, voyage en %s : adaptateur à prévoir (type %s)', (home, dest, types) => {
    const v = plugVerdict(dest, dest, home);
    expect(v.kind).toBe('adaptateur');
    expect(plugLineFor(dest, dest, home)).toBe(`Prises de type ${types} : adaptateur à prévoir.`);
  });

  it.each([
    ['FR', 'DE'],
    ['FR', 'PT'],
    ['FR', 'MA'],
    ['FR', 'TH'],
    ['FR', 'BR'],
    ['DE', 'FR'],
    ['GB', 'IE'],
    ['GB', 'MT'],
    ['US', 'JP'],
    ['US', 'TH'],
    ['AU', 'NZ'],
    ['AU', 'CN'],
    ['CH', 'FR'],
  ])('résidence %s, voyage en %s : une prise en commun, rien à dire', (home, dest) => {
    expect(plugVerdict(dest, dest, home).kind).toBe('commun');
    expect(plugLineFor(dest, dest, home)).toBeNull();
  });

  it('son propre pays : rien à dire', () => {
    expect(plugVerdict('GB', 'Royaume-Uni', 'GB').kind).toBe('commun');
    expect(plugLineFor('US', 'États-Unis', 'us')).toBeNull();
  });

  it('résidence inconnue ou absente de la table : seulement le fait du pays, là où la table ne donne pas le type C', () => {
    const gb = 'Prises de type G (Royaume-Uni) : vérifie que tes chargeurs s’y branchent.';
    expect(plugLineFor('GB', 'Royaume-Uni', null)).toBe(gb);
    expect(plugLineFor('GB', 'Royaume-Uni', undefined)).toBe(gb);
    expect(plugLineFor('GB', 'Royaume-Uni', 'SS')).toBe(gb); // Soudan du Sud : absent de la table
    expect(plugLineFor('JP', 'Japon', null)).toBe('Prises de type A/B (Japon) : vérifie que tes chargeurs s’y branchent.');
    expect(plugLineFor('SG', 'Singapour', null)).toBe('Prises de type G (Singapour) : vérifie que tes chargeurs s’y branchent.');
    // Avec C : rien (comme avant pour le Portugal).
    expect(plugLineFor('PT', 'Portugal', null)).toBeNull();
    expect(plugFact('DE', 'Allemagne')).toBeNull();
  });

  it('un territoire français que la table ne donne pas a des appareils de France', () => {
    expect(devicesOf('YT')).toEqual(ROWS.FR);
    expect(devicesOf('WF')).toEqual(ROWS.FR);
    expect(plugLineFor('GB', 'Royaume-Uni', 'YT')).toBe('Prises de type G : adaptateur à prévoir.');
    expect(plugLineFor('DE', 'Allemagne', 'YT')).toBeNull();
    // Un autre territoire absent de la table : rien n'est deviné.
    expect(devicesOf('SS')).toBeNull();
    expect(devicesOf('XX')).toBeNull();
  });

  it('pays visité absent de la table ou code faux : rien', () => {
    for (const bad of ['YT', 'SS', 'XX', '', 'A', null, undefined]) expect(plugVerdict(bad, 'x', 'FR').kind, String(bad)).toBe('rien');
  });

  it('la même comparaison dans les deux sens, pour chacun des 228 pays', () => {
    const codes = Object.keys(ROWS);
    for (const a of codes)
      for (const b of codes) {
        const ab = plugVerdict(b, b, a).kind;
        const ba = plugVerdict(a, a, b).kind;
        expect(ab === 'adaptateur', `${a}→${b}`).toBe(ba === 'adaptateur');
        // La ligne d'adaptateur ne dit rien du pays de résidence.
        const line = plugLineFor(b, b, a);
        if (line) expect(line, `${a}→${b}`).not.toContain(` ${a} `);
      }
  });
});

describe('currentLineFor — tension et fréquence', () => {
  it('Français aux États-Unis : 120 V · 60 Hz contre 230 V · 50 Hz', () => {
    expect(currentLineFor('US', 'FR')).toBe(
      'Courant : 120 V · 60 Hz sur place (chez toi : 230 V · 50 Hz) ; vérifie sur le bloc d’alimentation de chaque appareil qu’il l’accepte.'
    );
  });

  it('dans l’autre sens, et pour une résidence quelconque', () => {
    expect(currentLineFor('FR', 'US')).toContain('230 V · 50 Hz sur place (chez toi : 120 V · 60 Hz)');
    expect(currentLineFor('JP', 'DE')).toContain('100, 200 ou 210 V · 50 ou 60 Hz sur place (chez toi : 230 V · 50 Hz)');
    expect(currentLineFor('BR', 'FR')).toContain('127 ou 220 V · 60 Hz sur place');
  });

  it('un autre ordre de tension ou une autre fréquence seulement ; rien sinon', () => {
    expect(currentLineFor('DE', 'FR')).toBeNull();
    expect(currentLineFor('GB', 'FR')).toBeNull();
    expect(currentLineFor('GB', 'IE')).toBeNull();
    expect(currentLineFor('US', 'CA')).toBeNull();
    // 50 Hz contre 60 Hz à tension voisine (Corée du Sud 220 V 60 Hz) : la fréquence suffit.
    expect(currentLineFor('KR', 'FR')).toContain('220 V · 60 Hz sur place');
    // Le Japon (50 et 60 Hz) depuis les États-Unis (60 Hz, 120 V) : 50 Hz est absent de chez soi.
    expect(currentLineFor('JP', 'US')).toContain('(chez toi : 120 V · 60 Hz)');
  });

  it('résidence inconnue, même pays, pays absent : pas de ligne (le fait seul n’est pas un conseil)', () => {
    expect(currentLineFor('US', null)).toBeNull();
    expect(currentLineFor('US', 'US')).toBeNull();
    expect(currentLineFor('SS', 'FR')).toBeNull();
    expect(currentLineFor('US', 'SS')).toBeNull();
  });

  it('describeCurrent', () => {
    expect(describeCurrent(ROWS.JP)).toBe('100, 200 ou 210 V · 50 ou 60 Hz');
    expect(describeCurrent(ROWS.FR)).toBe('230 V · 50 Hz');
  });
});

describe('changeLineFor — la monnaie du pays n’est pas la tienne', () => {
  const CHF = { currency: 'CHF', residenceCountry: null };

  it('devise du profil', () => {
    expect(changeLineFor('MA', { currency: 'EUR', residenceCountry: null })).toBe(
      'Change : on paie en dirham marocain (MAD) sur place, pas en euro (EUR).'
    );
    expect(changeLineFor('FR', CHF)).toBe('Change : on paie en euro (EUR) sur place, pas en franc suisse (CHF).');
  });

  it('sans devise dite : celle du pays de résidence (liste ISO 4217 de SIX), pour n’importe quel pays', () => {
    expect(changeLineFor('FR', { currency: null, residenceCountry: 'CH' })).toBe(
      'Change : on paie en euro (EUR) sur place, pas en franc suisse (CHF).'
    );
    expect(changeLineFor('GB', { currency: null, residenceCountry: 'US' })).toBe(
      'Change : on paie en livre sterling (GBP) sur place, pas en dollar des États-Unis (USD).'
    );
    expect(readerCurrency({ currency: null, residenceCountry: 'JP' })).toBe('JPY');
  });

  it('la devise dite prime sur celle du pays de résidence', () => {
    expect(readerCurrency({ currency: 'EUR', residenceCountry: 'CH' })).toBe('EUR');
    expect(changeLineFor('DE', { currency: 'EUR', residenceCountry: 'CH' })).toBeNull();
  });

  it('même monnaie, monnaie inconnue de l’un ou de l’autre : pas de ligne, rien n’est deviné', () => {
    expect(changeLineFor('DE', { currency: null, residenceCountry: 'FR' })).toBeNull();
    expect(changeLineFor('DE', { currency: null, residenceCountry: null })).toBeNull();
    expect(changeLineFor('AQ', CHF)).toBeNull(); // pas de monnaie dans la liste
    expect(changeLineFor('XX', CHF)).toBeNull();
    expect(changeLineFor(null, CHF)).toBeNull();
    expect(changeLineFor('DE', { currency: null, residenceCountry: 'AQ' })).toBeNull();
  });
});

describe('lecture : les lignes de CHAQUE lecteur, rien de rangé', () => {
  const JP: PapersFacts = { countryCode: 'JP', country: 'Japon', abroad: true };
  const NEUTRAL_JP = 'Prises de type A/B (Japon) : vérifie que tes chargeurs s’y branchent.';
  const DE_HOME = who({ residenceCountry: 'DE', currency: 'EUR' });
  const US_HOME = who({ residenceCountry: 'US', currency: 'USD' });

  it('le voyage ne range que le fait du pays : jamais « Courant », « Change » ni « adaptateur », pour aucun des 228 pays', () => {
    for (const code of Object.keys(ROWS)) {
      const notes = sharedNotes(code, code, true);
      for (const n of notes) {
        expect(isCurrentNote(n), `${code} ${n}`).toBe(false);
        expect(isMoneyNote(n), `${code} ${n}`).toBe(false);
        expect(n, code).not.toContain('adaptateur');
      }
      // Une ligne « Prises » rangée est toujours la même pour tous, là où la table ne donne pas le type C.
      expect(notes.filter(isPlugsNote).length, code).toBe(plugFact(code, code) ? 1 : 0);
    }
  });

  it('même avec un profil complet, les règles de la personne ne rangent ni « Courant » ni « Change » (lecture seulement)', () => {
    const notes = travelPapers('JP', 'Japon', who({ nationality: 'DE', residenceCountry: 'DE', currency: 'EUR' }), true).notes;
    expect(notes.some(isCurrentNote)).toBe(false);
    expect(notes.some(isMoneyNote)).toBe(false);
  });

  it('un Allemand et une Américaine qui lisent le même voyage au Japon : chacun SES lignes, à la suite des papiers', () => {
    const stored = ['Papiers : à vérifier.', NEUTRAL_JP, 'Emporte de l’eau.'];
    expect(notesForReader(stored, JP, DE_HOME, find)).toEqual([
      'Papiers : conditions d’entrée (Japon) à vérifier auprès du service officiel de ton pays avant de partir.',
      'Prises de type A/B : adaptateur à prévoir.',
      'Courant : 100, 200 ou 210 V · 50 ou 60 Hz sur place (chez toi : 230 V · 50 Hz) ; vérifie sur le bloc d’alimentation de chaque appareil qu’il l’accepte.',
      'Change : on paie en yen japonais (JPY) sur place, pas en euro (EUR).',
      'Emporte de l’eau.',
    ]);
    const us = notesForReader(stored, JP, US_HOME, find);
    // Même prise : rien en prises ; courant : 50 Hz absent de chez elle ; change : yen contre dollar.
    expect(us.filter(isPlugsNote)).toEqual([]);
    expect(us.find(isCurrentNote)).toContain('(chez toi : 120 V · 60 Hz)');
    expect(us.find(isMoneyNote)).toBe('Change : on paie en yen japonais (JPY) sur place, pas en dollar des États-Unis (USD).');
    // Rien de l'une dans la lecture de l'autre.
    expect(notesForReader(stored, JP, DE_HOME, find).join(' ')).not.toContain('dollar');
    expect(us.join(' ')).not.toContain('chez toi : 230 V');
  });

  it('sans ligne rangée (voyage au Portugal : le fait n’est pas rangé), les lignes du lecteur sont ajoutées après les papiers', () => {
    const stored = ['Papiers : carte d’identité.', 'Emporte de l’eau.'];
    const pt: PapersFacts = { countryCode: 'PT', country: 'Portugal', abroad: true };
    const us = who({ residenceCountry: 'US', currency: 'USD' });
    expect(notesForReader(stored, pt, us, find)).toEqual([
      'Papiers : conditions d’entrée (Portugal) à vérifier auprès du service officiel de ton pays avant de partir.',
      'Prises de type C/F : adaptateur à prévoir.',
      'Courant : 230 V · 50 Hz sur place (chez toi : 120 V · 60 Hz) ; vérifie sur le bloc d’alimentation de chaque appareil qu’il l’accepte.',
      'Change : on paie en euro (EUR) sur place, pas en dollar des États-Unis (USD).',
      'Emporte de l’eau.',
    ]);
    // Un Français au Portugal : une prise en commun, même courant, même monnaie : aucune ligne de plus.
    const fr = who({ nationality: 'FR', residenceCountry: 'FR', currency: 'EUR' });
    const kept = notesForReader(['Emporte de l’eau.'], pt, fr, find);
    expect(kept).toEqual(['Emporte de l’eau.']);
    // Une personne dont on ne sait rien : le voyage tel quel.
    expect(notesForReader(stored, pt, UNKNOWN_TRAVELLER, find)).toEqual([
      'Papiers : conditions d’entrée (Portugal) à vérifier auprès du service officiel de ton pays avant de partir.',
      'Emporte de l’eau.',
    ]);
    expect(notesForReader(['Emporte de l’eau.'], pt, UNKNOWN_TRAVELLER, find)).toEqual(['Emporte de l’eau.']);
  });

  it('sans aucune ligne de papiers rangée, les lignes vont en tête', () => {
    const out = notesForReader(['Emporte de l’eau.'], JP, DE_HOME, find);
    expect(out[0]).toMatch(/^Prises de type/);
    expect(out[out.length - 1]).toBe('Emporte de l’eau.');
    expect(out.length).toBe(4);
  });

  it('une ligne « Courant » ou « Change » trouvée sur un voyage (jamais écrite par ce code) n’est rendue à personne telle quelle', () => {
    const planted = ['Courant : 120 V · 60 Hz sur place (chez toi : 230 V · 50 Hz) ; faux.', 'Change : planté.', 'Emporte de l’eau.'];
    // Inconnu : ni courant ni change ; le fait du pays (pas de C au Japon) est rendu, même s'il n'était pas rangé.
    expect(notesForReader(planted, JP, UNKNOWN_TRAVELLER, find)).toEqual([NEUTRAL_JP, 'Emporte de l’eau.']);
    expect(notesForReader(planted, null, DE_HOME, find)).toEqual(['Emporte de l’eau.']);
    const own = notesForReader(planted, JP, DE_HOME, find);
    expect(own.filter(isMoneyNote)).toEqual(['Change : on paie en yen japonais (JPY) sur place, pas en euro (EUR).']);
    expect(own.join(' ')).not.toContain('planté');
  });

  it('readerCurrentNotes et readerMoneyNotes : un code pays faux ne donne rien', () => {
    expect(readerCurrentNotes('XX', DE_HOME)).toEqual([]);
    expect(readerMoneyNotes('xx', DE_HOME)).toEqual([]);
    expect(readerMoneyNotes(null, DE_HOME)).toEqual([]);
    expect(readerMoneyNotes('jp', DE_HOME)).toEqual(['Change : on paie en yen japonais (JPY) sur place, pas en euro (EUR).']);
  });

  it('une nationalité française sans résidence dite : appareils de France (règle d’avant), pour les prises et le courant', () => {
    const fr = who({ nationality: 'FR' });
    expect(notesForReader([NEUTRAL_JP], JP, fr, find).filter(isPlugsNote)).toEqual(['Prises de type A/B : adaptateur à prévoir.']);
    expect(readerCurrentNotes('US', fr)).toHaveLength(1);
    // Sans résidence ni devise : pas de ligne de change.
    expect(readerMoneyNotes('US', fr)).toEqual([]);
  });
});
