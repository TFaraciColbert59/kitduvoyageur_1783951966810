import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  ACTIVITIES,
  EXPECT_KEYS,
  loadSet,
  normalizeSet,
  plain,
  validateExpect,
  validateSet,
} from '../../scripts/compas/validation/sets.mjs';

const DIR = path.resolve(__dirname, '../../scripts/compas/validation');
const reels = loadSet(path.join(DIR, 'reels-20.json'));
const nouvelles = loadSet(path.join(DIR, 'nouvelles-50.json'));
const monde = loadSet(path.join(DIR, 'monde-50.json'));
const phrases = (items: Array<{ phrase: string }>) => items.map((i) => i.phrase);
const count = (items: Array<{ phrase: string }>, re: RegExp) =>
  items.filter((i) => re.test(i.phrase)).length;

describe('jeux de validation du Compas (PLAN-100 phase 7)', () => {
  it('compte 20 parcours réels, 50 demandes nouvelles, 50 demandes monde', () => {
    expect(reels).toHaveLength(20);
    expect(nouvelles).toHaveLength(50);
    expect(monde).toHaveLength(50);
  });

  it('chaque jeu est bien formé, et les identifiants sont uniques d’un jeu à l’autre', () => {
    for (const set of [reels, nouvelles, monde]) expect(validateSet(set)).toEqual([]);
    const ids = [...reels, ...nouvelles, ...monde].map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(reels.every((i) => /^r\d{2}$/.test(i.id))).toBe(true);
    expect(nouvelles.every((i) => /^n\d{2}$/.test(i.id))).toBe(true);
    expect(monde.every((i) => /^m\d{2}$/.test(i.id))).toBe(true);
    const all = [...reels, ...nouvelles, ...monde].map((i) => plain(i.phrase));
    expect(new Set(all).size).toBe(all.length);
  });

  it('la liste des activités est celle de trip_activity_type dans les migrations', () => {
    const migrations = path.resolve(__dirname, '../../supabase/migrations');
    const values = new Set<string>();
    for (const file of fs.readdirSync(migrations)) {
      if (!file.endsWith('.sql')) continue;
      const sql = fs.readFileSync(path.join(migrations, file), 'utf8');
      const created = /CREATE TYPE public\.trip_activity_type AS ENUM \(([^)]*)\)/i.exec(sql);
      if (created) for (const m of created[1].matchAll(/'([a-z_]+)'/g)) values.add(m[1]);
      for (const m of sql.matchAll(
        /alter type public\.trip_activity_type add value if not exists '([a-z_]+)'/gi
      ))
        values.add(m[1]);
    }
    expect([...values].sort()).toEqual([...ACTIVITIES].sort());
  });

  it('les 20 parcours réels reprennent les parcours déjà joués (ETAT.md, audit du 7 octobre)', () => {
    const text = plain(phrases(reels).join(' | '));
    for (const place of [
      'bauges',
      'vercors',
      'dordogne',
      'sardaigne',
      'mercantour',
      'jura',
      'dolomites',
      'cevennes',
      'tarn',
      'ardeche',
      'bruges',
      'malaga',
      'west clare',
      'beaufortain',
      'mont blanc',
      'kalymnos',
      'patagonie',
    ])
      expect(text, place).toContain(place);
    expect(count(reels, /canoë/)).toBe(3); // Dordogne, Tarn, Ardèche
  });

  it('les 50 demandes nouvelles ne reprennent aucun des 20 parcours réels', () => {
    const taken = [
      'bauges',
      'vercors',
      'dordogne',
      'sardaigne',
      'mercantour',
      'jura',
      'dolomites',
      'cevennes',
      'tarn',
      'ardeche',
      'bruges',
      'malaga',
      'west clare',
      'beaufortain',
      'mont blanc',
      'kalymnos',
      'patagonie',
      'ardennes',
      'rome',
      'pyrenees catalanes',
    ];
    for (const item of nouvelles) {
      const text = ` ${plain(item.phrase)} `;
      for (const place of taken)
        expect(text.includes(` ${place} `), `${item.id} : ${place}`).toBe(false);
    }
  });

  it('les demandes nouvelles couvrent les dix activités, cinq fois chacune', () => {
    const byActivity: Array<[string, RegExp]> = [
      ['rando', /\brando(?! et bivouac)|randonnée/i],
      ['vélo', /vélo/i],
      ['canoë', /canoë|kayak/i],
      ['alpinisme', /alpinisme|ascension/i],
      ['ski de rando', /ski de rando/i],
      ['raquettes', /raquettes/i],
      ['road trip', /road trip/i],
      ['city break', /city break/i],
      ['escalade', /escalade/i],
      ['bivouac', /bivouac/i],
    ];
    for (const [name, re] of byActivity)
      expect(count(nouvelles, re), name).toBeGreaterThanOrEqual(5);
  });

  it('les demandes nouvelles varient durée, groupe, budget, départ et contraintes', () => {
    const all = phrases(nouvelles).join('\n');
    for (const marker of [
      'un week-end',
      '5 jours',
      'quelques jours',
      'du 12/11 au 15/11',
      'dans 3 semaines',
      'en famille de 5',
      ' à 4',
      '2 adultes 2 enfants',
      '500 €',
      '50 USD par personne',
      'depuis Lyon',
      'au départ de Bourg en Bresse',
      'sans voiture',
      'chien',
      'en refuge',
      'La Roche sur Yon',
      'Neuilly sur Seine',
      'Corse',
    ])
      expect(all, marker).toContain(marker);
    expect(all).toMatch(/Ouessant|Belle-Île|Glénan|Groix|Bréhat|Molène|Houat|Hoëdic|île d'Yeu/);
    // Quelques-unes sans départ dit, pour que « sans origine » soit éprouvé aussi.
    expect(nouvelles.filter((i) => i.expect.origin === null).length).toBeGreaterThanOrEqual(25);
  });

  it('les demandes monde couvrent hémisphère sud, écritures non latines, voyageurs non français, antiméridien et altitude', () => {
    const all = phrases(monde).join('\n');
    for (const marker of [
      'Patagonie',
      'Nouvelle-Zélande',
      'Afrique du Sud',
      'Fidji',
      'Népal',
      'Bolivie',
      'depuis Montréal',
      'depuis Genève',
      'depuis Bruxelles',
      'depuis Québec',
      'désert',
      'Bali',
      'Yosemite',
      'Yellowstone',
      '富士山',
      'Μετέωρα',
      'თბილისი',
    ])
      expect(all, marker).toContain(marker);
    const scripts: Array<[string, RegExp]> = [
      ['japonais/chinois', /[぀-ヿ㐀-鿿]/u],
      ['grec', /\p{Script=Greek}/u],
      ['géorgien', /\p{Script=Georgian}/u],
      ['arabe', /\p{Script=Arabic}/u],
      ['thaï', /\p{Script=Thai}/u],
      ['coréen', /\p{Script=Hangul}/u],
      ['devanagari', /\p{Script=Devanagari}/u],
    ];
    for (const [name, re] of scripts) expect(count(monde, re), name).toBeGreaterThanOrEqual(1);
    // L’hémisphère sud est vérifié sur les coordonnées des étapes.
    expect(monde.filter((i) => i.expect.hemisphere === 'S').length).toBeGreaterThanOrEqual(20);
  });

  it('hors Europe : le seul pays européen des demandes monde est la Grèce (Μετέωρα), retenue pour son écriture', () => {
    const europe = new Set([
      'FR',
      'IT',
      'ES',
      'PT',
      'GR',
      'CH',
      'DE',
      'AT',
      'BE',
      'NL',
      'GB',
      'IE',
      'NO',
      'IS',
      'SE',
      'FI',
    ]);
    const inEurope = monde.filter((i) =>
      [i.expect.country].flat().every((c: string) => europe.has(c))
    );
    expect(inEurope.map((i) => i.id)).toEqual(['m28']);
  });

  it('ne met dans expect que des clés connues, et jamais un nom de ville absent de la phrase', () => {
    for (const item of [...reels, ...nouvelles, ...monde]) {
      for (const key of Object.keys(item.expect))
        expect(key in EXPECT_KEYS, `${item.id} : ${key}`).toBe(true);
      const origin = item.expect.origin;
      if (typeof origin === 'string') expect(plain(item.phrase), item.id).toContain(plain(origin));
    }
  });
});

describe('sets.mjs', () => {
  it('lit l’ancien format (liste de phrases) comme un jeu sans attente', () => {
    expect(normalizeSet(['rando 5 jours en Sardaigne', 'week-end à Rome'])).toEqual([
      { id: 'p01', phrase: 'rando 5 jours en Sardaigne', expect: {} },
      { id: 'p02', phrase: 'week-end à Rome', expect: {} },
    ]);
    expect(() => normalizeSet({} as never)).toThrow(/tableau/);
    expect(() => normalizeSet([42 as never])).toThrow(/Entrée 1/);
  });

  it('signale doublons, phrases vides et trop longues', () => {
    const errors = validateSet([
      { id: 'a', phrase: 'week-end à Rome', expect: {} },
      { id: 'a', phrase: 'week-end à Rome ', expect: {} },
      { id: 'b', phrase: ' ', expect: {} },
      { id: 'c', phrase: 'x'.repeat(241), expect: {} },
    ]);
    expect(errors.join('\n')).toMatch(/a : identifiant en double/);
    expect(errors.join('\n')).toMatch(/a : phrase en double/);
    expect(errors.join('\n')).toMatch(/b : phrase vide/);
    expect(errors.join('\n')).toMatch(/c : phrase de plus de 240/);
  });

  it('refuse un expect mal formé', () => {
    expect(validateExpect({ country: 'fr' })).toHaveLength(1);
    expect(validateExpect({ activity: 'citybreak' })).toHaveLength(1);
    expect(validateExpect({ days: [5, 2] })).toHaveLength(1);
    expect(validateExpect({ party: 1 })).toHaveLength(1);
    expect(validateExpect({ nights: 'tente' })).toHaveLength(1);
    expect(validateExpect({ budget: { amount: 0, currency: 'EUR' } })).toHaveLength(1);
    expect(validateExpect({ perPersonBudget: true })).toHaveLength(1);
    expect(validateExpect({ startMonthDay: '13-01' })).toHaveLength(1);
    expect(validateExpect({ hemisphere: 'N' })).toHaveLength(1);
    expect(validateExpect({ inconnu: 1 })).toEqual(['clé inconnue « inconnu »']);
    expect(
      validateExpect({
        country: ['FR', 'CH'],
        activity: ['hiking', 'trekking'],
        days: [2, 10],
        party: 4,
        origin: null,
        carFree: true,
        nights: 'refuge',
        budget: { amount: 50, currency: 'USD' },
        perPersonBudget: true,
        startMonthDay: '11-12',
        startOffsetDays: [19, 23],
        hemisphere: 'S',
        linearRoute: true,
      })
    ).toEqual([]);
  });

  it('plain() ramène « Bourg-en-Bresse » et « Québec » à une forme comparable', () => {
    expect(plain('Bourg-en-Bresse')).toBe('bourg en bresse');
    expect(plain('  Québec, Canada ')).toBe('quebec canada');
    expect(plain(null)).toBe('');
  });
});
