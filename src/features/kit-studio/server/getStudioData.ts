// Lecture serveur des données du Kit Studio (P1 — couche de données réelle).
//
// Produit EXACTEMENT les formes des constantes de démonstration de `domain/catalog.ts`
// (spec : kit-studio-bundle/spec/data-model.md), pour que l'interface ne bouge pas d'un pixel.
// Ce module est serveur : il ne doit jamais être importé par un Client Component. La page
// `src/app/kit-studio/page.tsx` l'appelle, puis injecte le résultat au client qui remplace
// le registre runtime (`domain/studioData.ts`).
//
// Défauts explicitement documentés quand la donnée manque (spec/data-model.md) :
// - `Item.L` : volume absent → 0,6 L (valeur de la référence pour un objet inconnu) ;
// - `Kit.days` / `start` / `ctx` / `cabin` / `ghosts` / `food` : aucun lien voyage→kit n'existe
//   dans le schéma actuel, donc jours = 1, lieu de départ = '', contexte = description du kit,
//   cabine/objets fantômes/plan food = absents ;
// - `Item.trips` : aucun compteur de sorties par objet en base → 0 ;
// - `Kit.bag` / `cfg` : absent → préréglage Forêt avec couvercle, poche avant, poches latérales ;
// - `user.bodyKg` : aucune colonne de poids dans `user_profiles` → 72 kg (valeur de la référence) ;
// - `Item.zones` : une seule `gear_functions.default_zone` en base (les zones « compatibles »
//   ne sont pas modélisées) ; absent → ['main'] ;
// - `Item.fam` : libellé de `gear_functions.family` mappé sur les familles de la référence,
//   sinon famille « autre » (jamais silencieusement rangé dans une famille existante) ;
// - `ONE.chassis.gl` / `mods[*].gl` / `mods[*].acc` : pas de colonne glyphe/accessoire en base ;
//   correspondance fixe par pièce (documentée dans ONE_GL / ONE_ACC ci-dessous).
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RAW_MATERIALS } from '../domain/palette';
import { MODULE_IDS } from '../domain/catalog';
import type {
  AccessoryId, BagId, Colorway, ColorwayId, ConfigSet, Family, Item, Kit, MaterialKey, ModuleId, OneSpec,
  PackZoneId, PartId, ZoneId,
} from '../domain/catalog';
import type { StudioData, StudioSyncContext } from '../domain/studioData';

/** Colonnes minimales lues (aucune donnée hors périmètre). */
export interface ColorwayRow {
  id: string; label_fr: string; body_hex: string; pocket_hex: string; trim_hex: string; accent_hex: string; sort: number;
}
export interface PieceRow {
  id: string; kind: 'chassis' | 'corps' | 'module'; label_fr: string; description_fr: string | null;
  price_cents: number; attach_points: number; host: 'chassis' | 'corps' | null; part: string | null;
  volume_l: number | string | null; weight_g: number | null; material_fr: string | null; sort: number;
}
export interface GearFunctionRow {
  id: string; family: string; label_fr: string; default_zone: string | null;
  access_priority: number; is_vital_default: boolean; shape_kind: string;
}
export interface OwnershipRow {
  id: string; name: string; category: string | null; weight_g: number | null; price_cents: number | null;
  is_lent: boolean; maintenance_due_at: string | null; expiry_date: string | null;
  function_id: string | null; volume_ml: number | null; location: string | null;
}
export interface KitRow {
  id: string; name: string; description: string | null; forked_from: string | null;
  generation: number; field_proven_count: number;
}
export interface KitItemRow {
  id: string; kit_id: string; product_ownership_id: string | null; name: string | null;
  category: string | null; quantity: number; weight_g: number | null; function_id: string | null;
  zone: string | null; slot: string | null; load_order: number | null;
}
export interface BagConfigRow {
  kit_id: string | null; corps_id: string; modules: string[] | null; colors: Record<string, string> | null;
}
export interface OwnedPieceRow { piece_id: string; colorway_id: string; state: 'owned' | 'preordered' }

type Db = Pick<SupabaseClient, 'from'>;

/** Volume par défaut d'un objet inconnu (valeur de la référence). */
export const DEFAULT_VOLUME_L = 0.6;
/** Poids du corps par défaut (valeur de la référence, aucune colonne profil). */
export const DEFAULT_BODY_KG = 72;
/** Famille de repli pour une fonction non classée. */
export const UNCLASSIFIED_FAMILY: FamilyIdLike = 'autre';

/** Slug de famille de la référence (union élargie aux familles du référentiel réel). */
export type FamilyIdLike =
  | 'abri-et-couchage' | 'vetements' | 'eau-et-cuisine' | 'lumiere-et-energie'
  | 'orientation-et-outils' | 'securite-et-soin' | 'portage' | 'voyage' | 'autre';

/** Libellé `gear_functions.family` → slug de la référence. */
export const FAMILY_SLUG: Readonly<Record<string, FamilyIdLike>> = {
  'Abri & couchage': 'abri-et-couchage',
  Vêtements: 'vetements',
  'Eau & cuisine': 'eau-et-cuisine',
  'Lumière & énergie': 'lumiere-et-energie',
  'Orientation & outils': 'orientation-et-outils',
  'Sécurité & soin': 'securite-et-soin',
  Portage: 'portage',
  Voyage: 'voyage',
};

/** Couleur de scène par famille (clés de `RAW_MATERIALS` ; aucune couleur nouvelle). */
const FAMILY_COLOR: Readonly<Record<FamilyIdLike, MaterialKey>> = {
  'abri-et-couchage': 'm-365233',
  vetements: 'm-1f4251',
  'eau-et-cuisine': 'm-5b7f55',
  'lumiere-et-energie': 'm-3e6b7a',
  'orientation-et-outils': 'm-b8ad8a',
  'securite-et-soin': 'm-a8443a',
  portage: 'm-998f70',
  voyage: 'm-141916',
  autre: 'm-3f3b34',
};

/** Glyphe 3D d'une pièce ONE : pas de colonne en base, correspondance fixe par pièce. */
const ONE_GL: Readonly<Record<string, string>> = {
  chassis: 'v_harness_mesh',
  'mod:lid': 'v_lid_std',
  'mod:front': 'v_front_zip',
  'mod:sides': 'v_sides_std',
  'mod:tool': 'axe',
  'mod:hipp': 'v_hip_wide',
  'mod:flask': 'bottle',
};

/** Accessoire d'une pièce ONE : pas de colonne en base, correspondance fixe par pièce. */
const ONE_ACC: Readonly<Partial<Record<string, 'axe' | 'sbottle'>>> = {
  'mod:tool': 'axe',
  'mod:flask': 'sbottle',
};

const ZONE_IDS: Readonly<Record<string, ZoneId>> = {
  worn: 'worn', lid: 'lid', main: 'main', front: 'front', sides: 'sides', hip: 'hip', back: 'back',
};
const PACK_ZONES: Readonly<Record<string, PackZoneId>> = {
  worn: 'worn', lid: 'lid', main: 'main', front: 'front', sides: 'sides', hip: 'hip', back: 'back',
};
const SLOT_IDS = ['bottom', 'bottomF', 'midBack', 'midFront', 'top'] as const;

/** Hexadécimal → clé de matière de la maquette (inverse de RAW_MATERIALS). */
const HEX_TO_MATERIAL: Readonly<Record<string, MaterialKey>> = Object.fromEntries(
  Object.entries(RAW_MATERIALS).map(([key, hex]) => [hex.toUpperCase(), key as MaterialKey]),
);

export function materialKey(hex: string | null | undefined, fallback: MaterialKey): MaterialKey {
  if (!hex) return fallback;
  return HEX_TO_MATERIAL[hex.toUpperCase()] ?? fallback;
}

/** Corps de sac d'une pièce : `corps:b28` → 'b28', `corps:lkdv-one-45` → 'lkdv-one-45'. */
export function bagFromCorps(corpsId: string | null | undefined): BagId | null {
  if (corpsId === 'corps:b28') return 'b28';
  if (corpsId === 'corps:b42') return 'b42';
  if (corpsId === 'corps:lkdv-one-15') return 'lkdv-one-15';
  if (corpsId === 'corps:lkdv-one-25') return 'lkdv-one-25';
  if (corpsId === 'corps:lkdv-one-45') return 'lkdv-one-45';
  if (corpsId === 'corps:lkdv-one-60') return 'lkdv-one-60';
  if (corpsId === 'corps:lkdv-one-80') return 'lkdv-one-80';
  return null;
}

/** Module d'une pièce : `mod:lid` → 'lid'. */
export function moduleFromPiece(pieceId: string): ModuleId | null {
  if (!pieceId.startsWith('mod:')) return null;
  const m = pieceId.slice(4) as ModuleId;
  return (MODULE_IDS as readonly string[]).includes(m) ? m : null;
}

export function colorwaysFromRows(rows: ColorwayRow[]): Readonly<Record<ColorwayId, Colorway>> {
  const out: Record<string, Colorway> = {};
  for (const r of [...rows].sort((a, b) => a.sort - b.sort)) {
    const id = r.id as ColorwayId;
    out[id] = {
      id,
      n: r.label_fr,
      body: materialKey(r.body_hex, 'm-2d482a'),
      pocket: materialKey(r.pocket_hex, 'm-3d6038'),
      trim: materialKey(r.trim_hex, 'm-1e301c'),
      accent: materialKey(r.accent_hex, 'm-9bbda7'),
    };
  }
  return out as unknown as Record<ColorwayId, Colorway>;
}

function firstColorway(colorways: Readonly<Record<ColorwayId, Colorway>>): Colorway | null {
  const ids = Object.keys(colorways) as ColorwayId[];
  return ids.length > 0 ? colorways[ids[0]] : null;
}

/** Coloris dont une couleur est celle d'un corps (pour `Kit.cw`). */
function colorwayOf(
  colorways: Readonly<Record<ColorwayId, Colorway>>,
  col: MaterialKey | undefined,
): ColorwayId {
  const ids = Object.keys(colorways) as ColorwayId[];
  const found = ids.find((id) => {
    const w = colorways[id];
    return w.body === col || w.pocket === col || w.trim === col || w.accent === col;
  });
  return found ?? ids[0] ?? 'foret';
}

/** Préréglage d'apparence à partir d'un coloris (identique au preset Forêt de la référence). */
export function presetFromColorway(cw: Colorway): ConfigSet {
  return {
    body: { shape: 'classic', mat: 'xpac', col: cw.body, fin: 'mat' },
    lid: { shape: 'std', mat: 'xpac', col: cw.body, fin: 'mat' },
    front: { shape: 'zip', mat: 'xpac', col: cw.pocket, fin: 'satin' },
    sides: { shape: 'std', mat: 'cordura', col: cw.pocket, fin: 'satin' },
    hip: { shape: 'padded', col: cw.trim, fin: 'mat' },
    harness: { shape: 'std', col: cw.trim, fin: 'mat' },
    webbing: { col: cw.trim, fin: 'satin' },
    accent: cw.accent,
    acc: [],
  };
}

/** Brouillon mutable d'une configuration (le ConfigSet du domaine est en lecture seule). */
interface DraftPart {
  shape?: string;
  mat?: ConfigSet['body']['mat'];
  col?: MaterialKey;
  fin?: ConfigSet['body']['fin'];
}
interface DraftConfig {
  body: DraftPart; lid: DraftPart; front: DraftPart; sides: DraftPart;
  hip: DraftPart; harness: DraftPart; webbing: DraftPart;
  accent: MaterialKey;
  acc: AccessoryId[];
}

/**
 * Configuration d'apparence par corps de sac : préréglage Forêt par défaut (couvercle, poche
 * avant, poches latérales), puis application des couleurs et modules réellement enregistrés
 * dans `one_bag_configs`. Absent = préréglage.
 */
export function configFromRows(
  rows: BagConfigRow[],
  colorways: Readonly<Record<ColorwayId, Colorway>>,
  fallbackColorway: Colorway | null,
): Readonly<Record<BagId, ConfigSet>> {
  const fallback = fallbackColorway ?? firstColorway(colorways);
  const draft = (): DraftConfig =>
    (fallback
      ? presetFromColorway(fallback)
      : {
          body: { shape: 'classic', col: 'm-2d482a' },
          lid: { shape: 'std', col: 'm-2d482a' },
          front: { shape: 'zip', col: 'm-3d6038' },
          sides: { shape: 'std', col: 'm-3d6038' },
          hip: { shape: 'padded', col: 'm-1e301c' },
          harness: { shape: 'std', col: 'm-1e301c' },
          webbing: { col: 'm-1e301c' },
          accent: 'm-9bbda7',
          acc: [],
        }) as unknown as DraftConfig;
  const out: Record<BagId, ConfigSet> = {
    'lkdv-one-15': draft() as unknown as ConfigSet,
    'lkdv-one-25': draft() as unknown as ConfigSet,
    'lkdv-one-45': draft() as unknown as ConfigSet,
    'lkdv-one-60': draft() as unknown as ConfigSet,
    'lkdv-one-80': draft() as unknown as ConfigSet,
    b42: draft() as unknown as ConfigSet,
    b28: draft() as unknown as ConfigSet,
  };
  for (const row of rows) {
    const bag = bagFromCorps(row.corps_id);
    if (!bag) continue;
    const cfg = draft();
    const colors = row.colors ?? {};
    const mods = new Set(row.modules ?? []);
    cfg.body.col = materialKey(colors.body, cfg.body.col ?? 'm-2d482a');
    cfg.lid.col = materialKey(colors.lid, cfg.body.col ?? 'm-2d482a');
    cfg.front.col = materialKey(colors.front, cfg.front.col ?? 'm-3d6038');
    cfg.sides.col = materialKey(colors.sides, cfg.sides.col ?? 'm-3d6038');
    cfg.hip.col = materialKey(colors.hip ?? colors.harness, cfg.hip.col ?? 'm-1e301c');
    cfg.harness.col = materialKey(colors.harness, cfg.harness.col ?? 'm-1e301c');
    cfg.webbing.col = materialKey(colors.webbing, cfg.webbing.col ?? 'm-1e301c');
    cfg.accent = materialKey(colors.accent, cfg.accent);
    cfg.lid.shape = mods.has('lid') ? 'std' : 'none';
    cfg.front.shape = mods.has('front') ? 'zip' : 'none';
    cfg.sides.shape = mods.has('sides') ? 'std' : 'none';
    cfg.hip.shape = mods.has('hipp') ? 'wide' : 'padded';
    const acc = new Set<AccessoryId>(cfg.acc);
    if (mods.has('tool')) acc.add('axe');
    if (mods.has('flask')) acc.add('sbottle');
    cfg.acc = [...acc];
    out[bag] = cfg as unknown as ConfigSet;
  }
  return out;
}

/** Objets du studio : inventaire possédé + lignes de kit orphelines (sans product_ownership). */
export function itemsFromRows(
  ownership: OwnershipRow[],
  kitItems: KitItemRow[],
  functions: ReadonlyMap<string, GearFunctionRow>,
  colorways: Readonly<Record<ColorwayId, Colorway>>,
): readonly Item[] {
  const fallbackColor = firstColorway(colorways)?.body ?? 'm-2d482a';
  const byId = new Map<string, Item>();

  const build = (id: string, name: string, fnId: string | null, weightG: number | null, volumeMl: number | null,
    volumeL: number | null, isLent: boolean, loc: string, care: string | null, expired: string | null,
    priceCents: number | null): Item => {
    const gf = fnId ? functions.get(fnId) : undefined;
    const fam = (gf ? FAMILY_SLUG[gf.family] : undefined) ?? UNCLASSIFIED_FAMILY;
    const shape = gf?.shape_kind ?? 'box';
    const zone = gf?.default_zone ? ZONE_IDS[gf.default_zone] : undefined;
    const L = volumeMl != null ? volumeMl / 1000 : volumeL != null ? volumeL : DEFAULT_VOLUME_L;
    return {
      id: id as unknown as Item['id'],
      n: name,
      fam: fam as unknown as Item['fam'],
      fn: fnId ?? 'other',
      sh: shape,
      gl: shape,
      g: weightG, // règle C-03 : poids inconnu = null, jamais 0
      L,
      color: FAMILY_COLOR[fam] ?? fallbackColor,
      zones: zone ? [zone] : ['main'],
      state: isLent ? 'lent' : 'stock',
      loc,
      trips: 0,
      ...(gf?.is_vital_default ? { vital: 1 } : {}),
      ...(care ? { care } : {}),
      ...(expired ? { expired } : {}),
      ...(priceCents != null ? { price: priceCents / 100 } : {}),
    };
  };

  for (const row of ownership) {
    byId.set(row.id, build(row.id, row.name, row.function_id, row.weight_g, row.volume_ml, null,
      row.is_lent, row.location ?? '', row.maintenance_due_at, row.expiry_date, row.price_cents));
  }
  for (const row of kitItems) {
    if (row.product_ownership_id) continue; // l'objet est déjà couvert par l'inventaire possédé
    if (!row.name) continue;
    byId.set(row.id, build(row.id, row.name, row.function_id, row.weight_g, null, null,
      false, '', null, null, null));
  }
  return [...byId.values()];
}

/** Identifiant d'objet rangé dans une ligne de kit (inventaire possédé sinon ligne de kit). */
export function itemIdOf(kitItem: KitItemRow): string {
  return kitItem.product_ownership_id ?? kitItem.id;
}

export function oneFromPieces(pieces: PieceRow[]): OneSpec {
  const active = [...pieces].sort((a, b) => a.sort - b.sort);
  const chassisRow = active.find((p) => p.kind === 'chassis');
  const corpsRow = (bag: BagId): PieceRow | undefined =>
    active.find((p) => p.kind === 'corps' && bagFromCorps(p.id) === bag);
  const neutralCorps = { eur: 0, pts: 0, d: '' };
  const unknownCorps = { eur: null, pts: null, d: '' };
  const b42 = corpsRow('b42');
  const b28 = corpsRow('b28');
  const l15 = corpsRow('lkdv-one-15');
  const l25 = corpsRow('lkdv-one-25');
  const l45 = corpsRow('lkdv-one-45');
  const l60 = corpsRow('lkdv-one-60');
  const l80 = corpsRow('lkdv-one-80');
  const modules = active.filter((p) => p.kind === 'module');
  const mods = {} as Record<ModuleId, OneSpec['mods'][ModuleId]>;
  for (const m of MODULE_IDS) {
    const row = modules.find((p) => moduleFromPiece(p.id) === m);
    if (!row) {
      mods[m] = { n: m, eur: 0, host: 'corps', pts: 0, part: 'front' as PartId, gl: 'box', d: '' };
      continue;
    }
    mods[m] = {
      n: row.label_fr,
      eur: row.price_cents / 100,
      host: row.host ?? 'corps',
      pts: row.attach_points,
      part: (row.part ?? 'front') as PartId,
      gl: ONE_GL[row.id] ?? (row.part === 'lid' ? 'v_lid_std' : 'box'),
      d: row.description_fr ?? '',
      ...(ONE_ACC[row.id] ? { acc: ONE_ACC[row.id] } : {}),
    };
  }
  return {
    chassis: chassisRow
      ? {
          n: chassisRow.label_fr,
          eur: chassisRow.price_cents / 100,
          pts: chassisRow.attach_points,
          gl: ONE_GL['chassis'] ?? 'v_harness_mesh',
          d: chassisRow.description_fr ?? '',
          mat: chassisRow.material_fr ?? '',
        }
      : { n: 'Châssis ONE', eur: 0, pts: 0, gl: 'v_harness_mesh', d: '', mat: '' },
    corps: {
      'lkdv-one-15': l15 ? { eur: l15.price_cents / 100, pts: l15.attach_points, d: l15.description_fr ?? '' } : unknownCorps,
      'lkdv-one-25': l25 ? { eur: l25.price_cents / 100, pts: l25.attach_points, d: l25.description_fr ?? '' } : unknownCorps,
      'lkdv-one-45': l45 ? { eur: l45.price_cents / 100, pts: l45.attach_points, d: l45.description_fr ?? '' } : unknownCorps,
      'lkdv-one-60': l60 ? { eur: l60.price_cents / 100, pts: l60.attach_points, d: l60.description_fr ?? '' } : unknownCorps,
      'lkdv-one-80': l80 ? { eur: l80.price_cents / 100, pts: l80.attach_points, d: l80.description_fr ?? '' } : unknownCorps,
      b42: b42 ? { eur: b42.price_cents / 100, pts: b42.attach_points, d: b42.description_fr ?? '' } : neutralCorps,
      b28: b28 ? { eur: b28.price_cents / 100, pts: b28.attach_points, d: b28.description_fr ?? '' } : neutralCorps,
    },
    corpsMat: b42?.material_fr ?? b28?.material_fr ?? '',
    mods,
  };
}

/** Kits du compte : zone/slot/ordre lus dans `materiel_kit_items`, apparence dans `one_bag_configs`. */
export function kitsFromRows(
  kits: KitRow[],
  kitItems: KitItemRow[],
  configs: Readonly<Record<BagId, ConfigSet>>,
  colorways: Readonly<Record<ColorwayId, Colorway>>,
  configRows: BagConfigRow[],
  bodyKg: number,
): readonly Kit[] {
  const preset = (bag: BagId): ConfigSet => configs[bag];
  return kits.map((row): Kit => {
    const cfgRow = configRows.find((c) => c.kit_id === row.id) ?? configRows.find((c) => c.kit_id === null);
    const bag = bagFromCorps(cfgRow?.corps_id) ?? 'b42';
    const cfg = preset(bag);
    const cw = colorwayOf(colorways, cfg.body.col);
    const items = kitItems.filter((i) => i.kit_id === row.id);
    const packed: Record<string, string[]> = {};
    const slots: Record<string, string> = {};
    for (const item of items) {
      if (!item.zone) continue;
      const zone = PACK_ZONES[item.zone];
      if (!zone) continue;
      const id = itemIdOf(item);
      (packed[zone] ??= []).push(id);
      if (item.slot && (SLOT_IDS as readonly string[]).includes(item.slot)) slots[id] = item.slot;
    }
    const ordered: Record<string, string[]> = {};
    for (const zone of ['worn', 'lid', 'main', 'front', 'sides', 'hip', 'back'] as const) {
      if (packed[zone]) ordered[zone] = packed[zone];
    }
    return {
      id: row.id as unknown as Kit['id'],
      n: row.name,
      days: 1,
      bag,
      cw,
      body: bodyKg,
      start: '',
      ctx: row.description ?? '',
      packed: ordered as unknown as Kit['packed'],
      slots: Object.keys(slots).length > 0 ? slots : null,
      ghosts: [],
      food: null,
      lineage: {
        from: row.forked_from,
        gen: row.generation,
        proven: row.field_proven_count,
      },
    };
  });
}

/** Pièces possédées / précommandées (`one_owned_pieces.state`). */
export function ownershipFromRows(
  rows: OwnedPieceRow[],
  colorways: Readonly<Record<ColorwayId, Colorway>>,
): { own: StudioData['own']; order: StudioData['order'] } {
  const own: Record<string, ColorwayId> = {};
  const order: Record<string, ColorwayId> = {};
  const known = new Set(Object.keys(colorways));
  for (const row of rows) {
    if (!known.has(row.colorway_id)) continue;
    const target = row.state === 'owned' ? own : order;
    target[row.piece_id] = row.colorway_id as ColorwayId;
  }
  return { own: own as unknown as StudioData['own'], order: order as unknown as StudioData['order'] };
}

/** Familles affichables (libellés du référentiel réel + « autre »). */
export function familiesFromFunctions(functions: GearFunctionRow[]): readonly Family[] {
  const seen = new Map<FamilyIdLike, string>();
  for (const fn of functions) {
    const slug = FAMILY_SLUG[fn.family];
    if (slug && !seen.has(slug)) seen.set(slug, fn.family);
  }
  seen.set('autre', 'Autre');
  return [...seen].map(([id, n]) => ({ id: id as Family['id'], n }));
}

/** Contexte d'écriture serveur (résolution objet → ligne de kit, par kit du compte). */
export function syncContextFor(
  userId: string,
  kitId: string,
  kitRows: readonly KitRow[],
  kitItems: KitItemRow[],
): StudioSyncContext {
  const kits: Record<string, { kitItemByItemId: Record<string, string> }> = {};
  for (const kit of kitRows) {
    const kitItemByItemId: Record<string, string> = {};
    for (const item of kitItems) {
      if (item.kit_id === kit.id) kitItemByItemId[itemIdOf(item)] = item.id;
    }
    kits[kit.id] = { kitItemByItemId };
  }
  return { userId, kitId, kitItemByItemId: kits[kitId]?.kitItemByItemId ?? {}, kits };
}

interface ReadResult<T> { data: T[] | null; error: { message: string } | null }

async function rows<T>(query: PromiseLike<ReadResult<unknown>>, label: string): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(`getStudioData(${label}) : ${error.message}`);
  return (data ?? []) as T[];
}

/**
 * Lit la donnée réelle d'un utilisateur et renvoie les formes du studio.
 * `kitId` : kit demandé (défaut : le plus récemment mis à jour). Le kit choisi est placé
 * en tête de `kits` pour que le client ouvre le bon.
 */
export async function getStudioData(
  userId: string,
  kitId?: string,
  db?: Db,
): Promise<StudioData> {
  const supabase = db ?? (await createClient());

  const [colorwayRows, pieceRows, functionRows, ownershipRows, kitRows, kitItemRows, configRows, ownedRows] =
    await Promise.all([
      rows<ColorwayRow>(
        supabase.from('one_colorways').select('id, label_fr, body_hex, pocket_hex, trim_hex, accent_hex, sort')
          .eq('active', true).order('sort', { ascending: true }),
        'one_colorways',
      ),
      rows<PieceRow>(
        supabase.from('one_pieces')
          .select('id, kind, label_fr, description_fr, price_cents, attach_points, host, part, volume_l, weight_g, material_fr, sort')
          .eq('active', true).order('sort', { ascending: true }),
        'one_pieces',
      ),
      rows<GearFunctionRow>(
        supabase.from('gear_functions')
          .select('id, family, label_fr, default_zone, access_priority, is_vital_default, shape_kind'),
        'gear_functions',
      ),
      rows<OwnershipRow>(
        supabase.from('product_ownership')
          .select('id, name, category, weight_g, price_cents, is_lent, maintenance_due_at, expiry_date, function_id, volume_ml, location')
          .eq('user_id', userId),
        'product_ownership',
      ),
      rows<KitRow>(
        supabase.from('materiel_kits')
          .select('id, name, description, forked_from, generation, field_proven_count')
          .eq('user_id', userId).eq('is_trashed', false).order('updated_at', { ascending: false }),
        'materiel_kits',
      ),
      rows<KitItemRow>(
        supabase.from('materiel_kit_items')
          .select('id, kit_id, product_ownership_id, name, category, quantity, weight_g, function_id, zone, slot, load_order')
          .eq('user_id', userId),
        'materiel_kit_items',
      ),
      rows<BagConfigRow>(
        supabase.from('one_bag_configs').select('kit_id, corps_id, modules, colors').eq('user_id', userId),
        'one_bag_configs',
      ),
      rows<OwnedPieceRow>(
        supabase.from('one_owned_pieces').select('piece_id, colorway_id, state').eq('user_id', userId),
        'one_owned_pieces',
      ),
    ]);

  const functions = new Map(functionRows.map((f) => [f.id, f]));
  const colorways = colorwaysFromRows(colorwayRows);
  const fallbackColorway = firstColorway(colorways);

  const selected = kitId ? kitRows.find((k) => k.id === kitId) : undefined;
  const orderedKits = selected ? [selected, ...kitRows.filter((k) => k.id !== selected.id)] : kitRows;
  const selectedKitId = orderedKits[0]?.id;

  const config = configFromRows(configRows, colorways, fallbackColorway);
  const items = itemsFromRows(ownershipRows, kitItemRows, functions, colorways);
  const kits = kitsFromRows(orderedKits, kitItemRows, config, colorways, configRows, DEFAULT_BODY_KG);
  const { own, order } = ownershipFromRows(ownedRows, colorways);

  return {
    items,
    kits,
    one: oneFromPieces(pieceRows),
    colorways,
    config,
    own,
    order,
    bodyKg: DEFAULT_BODY_KG,
    families: familiesFromFunctions(functionRows),
    ...(selectedKitId ? { sync: syncContextFor(userId, selectedKitId, orderedKits, kitItemRows) } : {}),
  };
}
