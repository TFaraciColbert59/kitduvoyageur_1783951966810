import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ACCESSORIES,
  ALTERNATIVES,
  ANCHORS,
  BAGS,
  COLORWAYS,
  DEFAULT_CONFIG,
  FAMILIES,
  ITEMS,
  KITS,
  MODULE_IDS,
  ONE,
  PACK_ZONE_IDS,
  SHAPE_OPTIONS,
  SWATCHES,
  ZONE_IDS,
  ZONES,
  preset,
} from '../domain/catalog';
import { RAW_MATERIALS } from '../domain/palette';

const HTML = readFileSync(
  fileURLToPath(new URL('../../../../tests/fixtures/kit-studio/Kit_Studio_actuel.html', import.meta.url)),
  'utf8',
);
const invStart = HTML.indexOf('const INV=[');
const invBlock = HTML.slice(invStart, HTML.indexOf('\n];', invStart));
const HTML_ITEM_COUNT = (invBlock.match(/I\('/g) ?? []).length;

const hasMaterial = (key: string): boolean => Object.prototype.hasOwnProperty.call(RAW_MATERIALS, key);
const zoneSet = new Set<string>(ZONE_IDS);
const itemFns = new Set(ITEMS.map((i) => i.fn));
const unique = (xs: readonly string[]): boolean => new Set(xs).size === xs.length;

describe('catalogue kit-studio (généré depuis la maquette)', () => {
  it('compte les objets comme la regex I(\' de la maquette (39)', () => {
    expect(HTML_ITEM_COUNT).toBe(39);
    expect(ITEMS).toHaveLength(HTML_ITEM_COUNT);
  });

  it('7 sacs (5 LKDV ONE + 2 héritage), 4 coloris, 6 modules, 3 kits, 8 zones, 6 familles', () => {
    expect(Object.keys(BAGS)).toHaveLength(7);
    expect(Object.keys(COLORWAYS)).toHaveLength(4);
    expect(MODULE_IDS).toHaveLength(6);
    expect(Object.keys(ONE.mods)).toHaveLength(6);
    expect(KITS).toHaveLength(3);
    expect(ZONE_IDS).toHaveLength(8);
    expect(FAMILIES).toHaveLength(6);
  });

  it('chaque item.zones est un ZoneId', () => {
    for (const item of ITEMS) {
      expect(item.zones.every((z) => zoneSet.has(z))).toBe(true);
    }
    expect(PACK_ZONE_IDS.every((z) => zoneSet.has(z))).toBe(true);
    expect(ZONES.map((z) => z.id)).toEqual(ZONE_IDS);
  });

  it('chaque item.fam est une famille connue', () => {
    const famIds = new Set(FAMILIES.map((f) => f.id));
    for (const item of ITEMS) expect(famIds.has(item.fam)).toBe(true);
  });

  it('chaque clé de couleur existe dans RAW_MATERIALS', () => {
    for (const item of ITEMS) expect(hasMaterial(item.color)).toBe(true);
    for (const cw of Object.values(COLORWAYS)) {
      for (const key of [cw.body, cw.pocket, cw.trim, cw.accent]) expect(hasMaterial(key)).toBe(true);
    }
    for (const [, key] of SWATCHES) expect(hasMaterial(key)).toBe(true);
    for (const list of Object.values(ALTERNATIVES)) {
      for (const alt of list) expect(hasMaterial(alt.color)).toBe(true);
    }
  });

  it('ids uniques (objets, kits, familles, zones, accessoires)', () => {
    expect(unique(ITEMS.map((i) => i.id))).toBe(true);
    expect(unique(KITS.map((k) => k.id))).toBe(true);
    expect(unique(FAMILIES.map((f) => f.id))).toBe(true);
    expect(unique(ZONE_IDS)).toBe(true);
    expect(unique(Object.keys(ACCESSORIES))).toBe(true);
  });

  it('chaque objet de KITS.packed existe dans ITEMS', () => {
    const itemIds = new Set(ITEMS.map((i) => i.id));
    for (const kit of KITS) {
      for (const list of Object.values(kit.packed)) {
        for (const id of list ?? []) expect(itemIds.has(id)).toBe(true);
      }
    }
  });

  it('COLS (SWATCHES) non vide', () => {
    expect(SWATCHES.length).toBeGreaterThan(0);
  });

  it('chaque SHAPE_OPTIONS[p] non vide', () => {
    for (const options of Object.values(SHAPE_OPTIONS)) expect(options.length).toBeGreaterThan(0);
  });

  it('ALTERNATIVES : clés = fonctions d\'objets existants, alternatives valides', () => {
    for (const [fn, list] of Object.entries(ALTERNATIVES)) {
      expect(itemFns.has(fn)).toBe(true);
      for (const alt of list) {
        expect(alt.id.length).toBeGreaterThan(0);
        expect(alt.n.length).toBeGreaterThan(0);
        expect(['shop', 'rent']).toContain(alt.src);
        expect(alt.sh.length).toBeGreaterThan(0);
      }
    }
  });

  it('preset(cw) couvre chaque coloris et DEFAULT_CONFIG chaque sac', () => {
    for (const cw of Object.keys(COLORWAYS) as (keyof typeof COLORWAYS)[]) {
      expect(preset(cw).body.col).toBe(COLORWAYS[cw].body);
    }
    expect(Object.keys(DEFAULT_CONFIG).sort()).toEqual(Object.keys(BAGS).sort());
  });

  it('ANCHORS ne référence que des zones connues', () => {
    for (const z of Object.keys(ANCHORS)) expect(zoneSet.has(z)).toBe(true);
  });
});
