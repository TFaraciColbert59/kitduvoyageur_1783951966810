// Tests de la couche de données P1 : mapping Supabase → formes du studio (aucun réseau).
import { describe, expect, it } from 'vitest';
import {
  configFromRows,
  colorwaysFromRows,
  familiesFromFunctions,
  getStudioData,
  itemsFromRows,
  kitsFromRows,
  materialKey,
  oneFromPieces,
  ownershipFromRows,
  presetFromColorway,
  DEFAULT_VOLUME_L,
  type BagConfigRow,
  type ColorwayRow,
  type GearFunctionRow,
  type KitItemRow,
  type KitRow,
  type OwnershipRow,
  type PieceRow,
} from '../server/getStudioData';
import type { Db } from '../server/studioService';
import { createFakeDb } from './helpers/fakeDb';

const USER = 'u-1';
const KIT_A = 'kit-a';
const KIT_B = 'kit-b';

const colorwayRows: ColorwayRow[] = [
  { id: 'foret', label_fr: 'Forêt', body_hex: '#2D482A', pocket_hex: '#3D6038', trim_hex: '#1E301C', accent_hex: '#9BBDA7', sort: 1 },
  { id: 'sauge', label_fr: 'Sauge', body_hex: '#789972', pocket_hex: '#96B391', trim_hex: '#3D6038', accent_hex: '#F0F5EE', sort: 2 },
  { id: 'pierre', label_fr: 'Pierre', body_hex: '#B5ABA0', pocket_hex: '#D4CCC0', trim_hex: '#5B554A', accent_hex: '#2D482A', sort: 3 },
  { id: 'nuit', label_fr: 'Nuit', body_hex: '#1F4251', pocket_hex: '#2A5A6E', trim_hex: '#10222B', accent_hex: '#A8C8D4', sort: 4 },
].map((r) => ({ ...r, active: true })) as unknown as ColorwayRow[];

const pieceRows: (PieceRow & { active: boolean })[] = [
  { id: 'chassis', kind: 'chassis', label_fr: 'Châssis ONE', description_fr: 'Bretelles.', price_cents: 18900, attach_points: 4, host: null, part: 'harness', volume_l: null, weight_g: null, material_fr: 'Mesh 3D', sort: 1, active: true },
  { id: 'corps:b28', kind: 'corps', label_fr: 'Corps 28 L', description_fr: 'Journée.', price_cents: 11900, attach_points: 6, host: null, part: 'body', volume_l: '28.0', weight_g: null, material_fr: 'X-Pac', sort: 2, active: true },
  { id: 'corps:b42', kind: 'corps', label_fr: 'Corps 42 L', description_fr: 'Trek.', price_cents: 14900, attach_points: 8, host: null, part: 'body', volume_l: '42.0', weight_g: null, material_fr: 'X-Pac', sort: 3, active: true },
  { id: 'mod:lid', kind: 'module', label_fr: 'Couvercle', description_fr: 'Poche haute.', price_cents: 4900, attach_points: 2, host: 'corps', part: 'lid', volume_l: '4.0', weight_g: null, material_fr: 'X-Pac', sort: 4, active: true },
  { id: 'mod:front', kind: 'module', label_fr: 'Poche avant', description_fr: 'Zip.', price_cents: 3900, attach_points: 2, host: 'corps', part: 'front', volume_l: '3.0', weight_g: null, material_fr: 'X-Pac', sort: 5, active: true },
  { id: 'mod:sides', kind: 'module', label_fr: 'Poches latérales', description_fr: 'Gourde.', price_cents: 3500, attach_points: 2, host: 'corps', part: 'sides', volume_l: '2.0', weight_g: null, material_fr: 'Cordura', sort: 6, active: true },
  { id: 'mod:tool', kind: 'module', label_fr: 'Porte-piolet', description_fr: 'Boucle.', price_cents: 1500, attach_points: 1, host: 'corps', part: 'front', volume_l: null, weight_g: null, material_fr: 'Hypalon', sort: 7, active: true },
  { id: 'mod:hipp', kind: 'module', label_fr: 'Poches de ceinture', description_fr: 'Deux poches.', price_cents: 2900, attach_points: 2, host: 'chassis', part: 'hip', volume_l: '0.8', weight_g: null, material_fr: 'X-Pac', sort: 8, active: true },
  { id: 'mod:flask', kind: 'module', label_fr: 'Porte-gourde', description_fr: 'Flasque.', price_cents: 1900, attach_points: 1, host: 'chassis', part: 'harness', volume_l: '0.5', weight_g: null, material_fr: 'Mesh', sort: 9, active: true },
];

const functionRows: GearFunctionRow[] = [
  { id: 'sleep', family: 'Abri & couchage', label_fr: 'Sac de couchage', default_zone: 'main', access_priority: 0, is_vital_default: true, shape_kind: 'roll' },
  { id: 'water', family: 'Eau & cuisine', label_fr: 'Contenant d’eau', default_zone: 'sides', access_priority: 2, is_vital_default: true, shape_kind: 'bottle' },
  { id: 'organizer', family: 'Portage', label_fr: 'Rangement', default_zone: 'main', access_priority: 0, is_vital_default: false, shape_kind: 'sack' },
  { id: 'laptop', family: 'Voyage', label_fr: 'Ordinateur', default_zone: 'back', access_priority: 0, is_vital_default: false, shape_kind: 'laptop' },
];

const ownershipRows: (OwnershipRow & { user_id: string })[] = [
  {
    id: 'own-1', user_id: USER, name: 'Duvet 0 °C', category: 'couchage', weight_g: 820, price_cents: 28900,
    is_lent: false, maintenance_due_at: null, expiry_date: null, function_id: 'sleep', volume_ml: 6500, location: 'Lille',
  },
  {
    id: 'own-2', user_id: USER, name: 'Objet mystère', category: null, weight_g: null, price_cents: null,
    is_lent: true, maintenance_due_at: null, expiry_date: null, function_id: null, volume_ml: null, location: null,
  },
];

const kitRows: (KitRow & { user_id: string; is_trashed: boolean; updated_at: number })[] = [
  { id: KIT_A, user_id: USER, name: 'Mon kit 28', description: 'Week-end', forked_from: null, generation: 1, field_proven_count: 3, is_trashed: false, updated_at: 2 },
  { id: KIT_B, user_id: USER, name: 'Mon kit 42', description: null, forked_from: 'ancêtre', generation: 2, field_proven_count: 7, is_trashed: false, updated_at: 1 },
];

const kitItemRows: (KitItemRow & { user_id: string })[] = [
  { id: 'ki-1', user_id: USER, kit_id: KIT_A, product_ownership_id: 'own-1', name: 'Duvet', category: 'couchage', quantity: 1, weight_g: 820, function_id: 'sleep', zone: 'main', slot: 'bottomF', load_order: 0 },
  { id: 'ki-2', user_id: USER, kit_id: KIT_A, product_ownership_id: null, name: 'Pochette ranger', category: null, quantity: 1, weight_g: 30, function_id: 'organizer', zone: 'lid', slot: null, load_order: 0 },
  { id: 'ki-3', user_id: USER, kit_id: KIT_A, product_ownership_id: 'own-2', name: 'Objet mystère', category: null, quantity: 1, weight_g: null, function_id: null, zone: null, slot: null, load_order: null },
];

const configRows: (BagConfigRow & { id: string; user_id: string })[] = [
  { id: 'cfg-1', user_id: USER, kit_id: KIT_A, corps_id: 'corps:b28', modules: ['lid', 'front', 'sides', 'hipp'], colors: { body: '#789972', trim: '#3D6038' } },
];

const ownedRows = [
  { user_id: USER, piece_id: 'chassis', colorway_id: 'foret', state: 'owned' as const },
  { user_id: USER, piece_id: 'mod:lid', colorway_id: 'sauge', state: 'preordered' as const },
];

function fakeWith(over?: Parameters<typeof createFakeDb>[0]) {
  const fake = createFakeDb(
    over ?? {
      tables: {
        one_colorways: [...colorwayRows],
        one_pieces: [...pieceRows],
        gear_functions: [...functionRows],
        product_ownership: [...ownershipRows],
        materiel_kits: [...kitRows],
        materiel_kit_items: [...kitItemRows],
        one_bag_configs: [...configRows],
        one_owned_pieces: [...ownedRows],
      },
    },
  );
  return fake;
}

describe('mapping Supabase → formes du studio', () => {
  it('convertit les hexadécimaux du catalogue en clés de matière', () => {
    expect(materialKey('#2D482A', 'm-3f3b34')).toBe('m-2d482a');
    expect(materialKey('#000000', 'm-3f3b34')).toBe('m-3f3b34');
    expect(materialKey(null, 'm-3f3b34')).toBe('m-3f3b34');
  });

  it('colorways : 4 coloris, noms et clés de matière identiques à la référence', () => {
    const cw = colorwaysFromRows(colorwayRows);
    expect(Object.keys(cw)).toEqual(['foret', 'sauge', 'pierre', 'nuit']);
    expect(cw.foret).toMatchObject({ n: 'Forêt', body: 'm-2d482a', pocket: 'm-3d6038', trim: 'm-1e301c', accent: 'm-9bbda7' });
  });

  it('objets : fonction, forme/glyphe, famille, zones, poids et volume depuis la base', () => {
    const items = itemsFromRows(ownershipRows, kitItemRows, new Map(functionRows.map((f) => [f.id, f])), colorwaysFromRows(colorwayRows));
    const duvet = items.find((i) => String(i.id) === 'own-1')!;
    expect(duvet).toMatchObject({
      n: 'Duvet 0 °C', fn: 'sleep', sh: 'roll', gl: 'roll', fam: 'abri-et-couchage',
      g: 820, L: 6.5, zones: ['main'], vital: 1, state: 'stock', loc: 'Lille', price: 289,
    });
    // Objet non classé (function_id null) : fn 'other', box, famille « autre », volume 0,6 L.
    const nobody = items.find((i) => String(i.id) === 'own-2')!;
    expect(nobody).toMatchObject({ fn: 'other', sh: 'box', gl: 'box', fam: 'autre', g: 0, L: DEFAULT_VOLUME_L, state: 'lent', trips: 0 });
    // Ligne de kit sans product_ownership : devient un objet affichable.
    const kitOnly = items.find((i) => String(i.id) === 'ki-2')!;
    expect(kitOnly).toMatchObject({ n: 'Pochette ranger', fn: 'organizer', fam: 'portage', zones: ['main'] });
  });

  it('catalogue ONE : prix en centimes ÷ 100, points, glyphes et accessoires par pièce', () => {
    const one = oneFromPieces(pieceRows);
    expect(one.chassis).toMatchObject({ n: 'Châssis ONE', eur: 189, pts: 4, gl: 'v_harness_mesh', mat: 'Mesh 3D' });
    expect(one.corps.b28).toMatchObject({ eur: 119, pts: 6 });
    expect(one.corps.b42).toMatchObject({ eur: 149, pts: 8 });
    expect(one.mods.lid).toMatchObject({ n: 'Couvercle', eur: 49, pts: 2, host: 'corps', part: 'lid', gl: 'v_lid_std' });
    expect(one.mods.tool).toMatchObject({ eur: 15, acc: 'axe', gl: 'axe' });
    expect(one.mods.flask).toMatchObject({ acc: 'sbottle', gl: 'bottle' });
    expect(one.corpsMat).toBe('X-Pac');
  });

  it('configuration absente = préréglage Forêt (couvercle, poche avant, poches latérales)', () => {
    const config = configFromRows([], colorwaysFromRows(colorwayRows), colorwaysFromRows(colorwayRows).foret);
    expect(config.b42).toEqual(presetFromColorway(colorwaysFromRows(colorwayRows).foret));
    expect(config.b42.lid.shape).toBe('std');
    expect(config.b42.front.shape).toBe('zip');
    expect(config.b42.sides.shape).toBe('std');
    expect(config.b28.acc).toEqual([]);
  });

  it('configuration enregistrée : couleurs hex → matières et modules → formes', () => {
    const config = configFromRows(configRows, colorwaysFromRows(colorwayRows), colorwaysFromRows(colorwayRows).foret);
    expect(config.b28.body.col).toBe('m-789972');
    expect(config.b28.harness.col).toBe('m-1e301c'); // non fourni → défaut du préréglage
    expect(config.b28.lid.shape).toBe('std');
    expect(config.b28.front.shape).toBe('zip');
    expect(config.b28.sides.shape).toBe('std');
    expect(config.b28.hip.shape).toBe('wide');
  });

  it('kits : zone/slot/ordre, identifiants résolus, lignée, apparence', () => {
    const colorways = colorwaysFromRows(colorwayRows);
    const config = configFromRows(configRows, colorways, colorways.foret);
    const kits = kitsFromRows(kitRows, kitItemRows, config, colorways, configRows, 72);
    const a = kits.find((k) => String(k.id) === KIT_A)!;
    expect(a).toMatchObject({ n: 'Mon kit 28', days: 1, bag: 'b28', cw: 'sauge', body: 72, ctx: 'Week-end' });
    expect(a.packed.main).toEqual(['own-1']);
    expect(a.packed.lid).toEqual(['ki-2']);
    expect(a.slots).toEqual({ 'own-1': 'bottomF' });
    expect(a.lineage).toEqual({ from: null, gen: 1, proven: 3 });
    expect(a.ghosts).toEqual([]);
    expect(a.food).toBeNull();
    const b = kits.find((k) => String(k.id) === KIT_B)!;
    expect(b.bag).toBe('b42');
    expect(b.cw).toBe('foret');
    expect(b.lineage).toEqual({ from: 'ancêtre', gen: 2, proven: 7 });
  });

  it('pièces possédées / précommandées et familles affichables', () => {
    const { own, order } = ownershipFromRows(ownedRows, colorwaysFromRows(colorwayRows));
    expect(own).toEqual({ chassis: 'foret' });
    expect(order).toEqual({ 'mod:lid': 'sauge' });
    const families = familiesFromFunctions(functionRows);
    expect(families.map((f) => f.id)).toContain('portage');
    expect(families.map((f) => f.id)).toContain('autre');
  });
});

describe('getStudioData', () => {
  it('lit la base, met le kit demandé en tête et expose le contexte d’écriture', async () => {
    const fake = fakeWith();
    const data = await getStudioData(USER, KIT_B, fake as unknown as Db);
    expect(data.items).toHaveLength(3);
    expect(data.kits.map((k) => k.id)).toEqual([KIT_B, KIT_A]);
    expect(data.own).toEqual({ chassis: 'foret' });
    expect(data.order).toEqual({ 'mod:lid': 'sauge' });
    expect(data.bodyKg).toBe(72);
    expect(data.sync).toMatchObject({ userId: USER, kitId: KIT_B });
    // Kit A : objet possédé 'own-1' résolu vers sa ligne de kit ; 'ki-2' est sa propre ligne.
    const fakeA = fakeWith();
    const dataA = await getStudioData(USER, KIT_A, fakeA as unknown as Db);
    expect(dataA.kits[0]!.id).toBe(KIT_A);
    expect(dataA.sync?.kitItemByItemId).toEqual({ 'own-1': 'ki-1', 'ki-2': 'ki-2', 'own-2': 'ki-3' });
  });

  it('sans kit demandé, prend le kit le plus récemment mis à jour', async () => {
    const data = await getStudioData(USER, undefined, fakeWith() as unknown as Db);
    expect(data.kits[0]!.id).toBe(KIT_A);
  });

  it('refuse de fabriquer une donnée partielle : erreur de lecture explicite', async () => {
    const fake = fakeWith({ tables: { one_colorways: [...colorwayRows] }, errorTables: ['one_pieces'] });
    await expect(getStudioData(USER, undefined, fake as unknown as Db)).rejects.toThrow('getStudioData(one_pieces)');
  });

  it('produit exactement les formes attendues par le domaine (kit ouvrable)', async () => {
    const data = await getStudioData(USER, KIT_A, fakeWith() as unknown as Db);
    expect(data.one.mods.lid.part).toBe('lid');
    expect(data.config.b28.body.col).toBe('m-789972');
    expect(data.kits[0]!.packed).toBeTypeOf('object');
    expect(Array.isArray(data.kits)).toBe(true);
    expect(Object.keys(data.colorways)).toHaveLength(4);
  });
});
