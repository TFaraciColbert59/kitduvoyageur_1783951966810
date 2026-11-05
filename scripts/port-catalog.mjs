#!/usr/bin/env node
// Génère src/features/kit-studio/domain/catalog.ts et palette.ts depuis la maquette
// kit-studio-bundle/reference/Kit_Studio_actuel.html. Usage : node scripts/port-catalog.mjs
// Aucune recopie manuelle : les blocs JS sont extraits du HTML puis évalués dans node:vm.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'kit-studio-bundle/reference/Kit_Studio_actuel.html');
const DOMAIN = resolve(ROOT, 'src/features/kit-studio/domain');
const OUT_CATALOG = resolve(DOMAIN, 'catalog.ts');
const OUT_PALETTE = resolve(DOMAIN, 'palette.ts');
const MARK_START = '// <generated>';
const MARK_END = '// </generated>';
const HEX = /^#[0-9a-fA-F]{6}$/;

const lines = readFileSync(SRC, 'utf8').split(/\r?\n/);
const fail = (msg) => {
  throw new Error(`port-catalog: ${msg}`);
};

// 1. Extraction : à partir de la ligne commençant par `prefix`, on accumule jusqu'à une instruction JS complète.
function grab(prefix) {
  const idx = lines.findIndex((l) => l.startsWith(prefix));
  if (idx < 0) fail(`ancre introuvable : ${prefix}`);
  let text = '';
  for (let i = idx; i < lines.length; i++) {
    text += (i > idx ? '\n' : '') + lines[i];
    try {
      new vm.Script(text);
      return { text, line: idx + 1, prefix };
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
    }
  }
  return fail(`instruction non terminée : ${prefix}`);
}

// Constantes de la maquette à porter : [nom de variable, ancre de la ligne d'origine].
const WANTED = [
  ['BAGS', 'const BAGS='],
  ['CW', 'const CW='],
  ['PART_W', 'const PART_W='],
  ['PNAME', 'const PNAME='],
  ['MATS', 'const MATS='],
  ['FIN', 'const FIN='],
  ['FIND', 'const FIND='],
  ['COLS', 'const COLS='],
  ['SHAPES', 'const SHAPES='],
  ['ACC', 'const ACC='],
  ['ONE', 'const ONE='],
  ['MODS', 'const MODS='],
  ['VS', 'const VS='],
  ['CATN', 'const CATN='],
  ['preset', 'function preset('],
  ['CFG', 'const CFG='],
  ['INV', 'const INV=['],
  ['KITS', 'const KITS=['],
  ['ZONES', 'const ZONES=['],
  ['ZIDS', 'const ZIDS='],
  ['ZNAME', 'const ZNAME='],
  ['ANCH', 'const ANCH='],
  ['ALT', 'const ALT='],
];

// Vérifie que la définition de I( n'a pas dérivé : le script la réimplémente à l'identique.
const I_SIG = "state:'stock',loc:'Lille',trips:0},o||{})";
if (!lines.some((l) => l.includes(I_SIG))) fail('définition de I( modifiée dans la maquette : mettre à jour le script');
const I = (id, n, fam, fn, sh, gl, g, L, c, z, o) =>
  Object.assign({ id, n, fam, fn, sh, gl, g, L, c, z, state: 'stock', loc: 'Lille', trips: 0 }, o || {});

const segs = WANTED.map(([name, prefix]) => ({ name, ...grab(prefix) })).sort((a, b) => a.line - b.line);
const seg = Object.fromEntries(segs.map((s) => [s.name, s]));
const code = segs.map((s) => s.text).join('\n') + `\n;({${WANTED.map(([n]) => n).join(',')}});`;
const evaluated = new vm.Script(code, { filename: SRC }).runInNewContext({ I });
const presetFn = evaluated.preset;
const raw = JSON.parse(JSON.stringify(evaluated, (_k, v) => (typeof v === 'function' ? undefined : v)));
const PRESET_RAW = Object.fromEntries(Object.keys(raw.CW).map((k) => [k, JSON.parse(JSON.stringify(presetFn(k)))]));

// 2. Couleurs : toute chaîne hexadécimale devient une clé de matériau 'm-' + hex minuscule.
const materials = new Map();
const keyOf = (hex) => {
  if (!HEX.test(hex)) fail(`couleur non hexadécimale : ${hex}`);
  const k = 'm-' + hex.slice(1).toLowerCase();
  if (!materials.has(k)) materials.set(k, hex.toUpperCase());
  return k;
};
const toKeys = (v) => {
  if (typeof v === 'string') return v.startsWith('#') ? keyOf(v) : v;
  if (Array.isArray(v)) return v.map(toKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toKeys(x)]));
  return v;
};
const famId = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// 3. Transformations des données.
const BAGS = toKeys(raw.BAGS);
const COLORWAYS = Object.fromEntries(Object.entries(raw.CW).map(([id, v]) => [id, { id, ...toKeys(v) }]));
const ITEMS = raw.INV.map(({ c, z, fam, ...rest }) => ({ ...rest, fam: famId(fam), color: keyOf(c), zones: z }));
const FAMILY_LIST = [...new Map(raw.INV.map((i) => [i.fam, famId(i.fam)])).entries()].map(([n, id]) => ({ id, n }));
const ALTERNATIVES = Object.fromEntries(
  Object.entries(raw.ALT).map(([fn, list]) => [fn, list.map(({ c, ...r }) => ({ ...r, color: keyOf(c) }))]),
);
const KITS = toKeys(raw.KITS);
const ZONES = toKeys(raw.ZONES);
const MATS = toKeys(raw.MATS);
const FIN = toKeys(raw.FIN);
const FIND = toKeys(raw.FIND);
const SWATCHES = toKeys(raw.COLS);
const SHAPES = toKeys(raw.SHAPES);
const ACC = toKeys(raw.ACC);
const ONE = toKeys(raw.ONE);
const VS = toKeys(raw.VS);
const CATN = toKeys(raw.CATN);
const CFG = toKeys(raw.CFG);
const PRESETS = toKeys(PRESET_RAW);
const ZNAME = toKeys(raw.ZNAME);
const ANCH = toKeys(raw.ANCH);
const PART_W = toKeys(raw.PART_W);
const PNAME = toKeys(raw.PNAME);
const MODS = raw.MODS;
const ZIDS = raw.ZIDS;

// 4. Vérifications de cohérence (échec explicite plutôt que catalogue faux).
const invBlock = lines.join('\n').slice(lines.join('\n').indexOf('const INV=['));
const htmlCount = (invBlock.slice(0, invBlock.indexOf('\n];')).match(/I\('/g) ?? []).length;
if (ITEMS.length !== htmlCount) fail(`comptage INV ${ITEMS.length} != regex ${htmlCount}`);
const itemIds = new Set(ITEMS.map((i) => i.id));
if (itemIds.size !== ITEMS.length) fail('ids d\'objets dupliqués');
const zoneIds = new Set(ZONES.map((z) => z.id));
for (const z of ZIDS) if (!zoneIds.has(z)) fail(`zone de rangement inconnue : ${z}`);
for (const i of ITEMS) for (const z of i.zones) if (!zoneIds.has(z)) fail(`zone inconnue sur ${i.id} : ${z}`);
for (const k of KITS) for (const list of Object.values(k.packed)) for (const id of list) if (!itemIds.has(id)) fail(`KITS.packed : ${id} absent`);
if (JSON.stringify(Object.keys(ONE.mods)) !== JSON.stringify(MODS)) fail('ONE.mods incohérent avec MODS');
const fns = new Set(ITEMS.map((i) => i.fn));
for (const fn of Object.keys(ALTERNATIVES)) if (!fns.has(fn)) fail(`ALT : clé ${fn} sans objet correspondant`);
for (const z of Object.keys(ANCH)) if (!zoneIds.has(z)) fail(`ANCH : zone inconnue ${z}`);

// 5. Génération TypeScript.
const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
const keyLit = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : q(k));
const union = (arr) => [...new Set(arr)].map(q).join(' | ');
function lit(v, ind = '') {
  if (v === null) return 'null';
  if (typeof v === 'string') return q(v);
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) fail('nombre non fini');
    return String(v);
  }
  if (typeof v === 'boolean') return String(v);
  const inner = ind + '  ';
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    if (v.every((x) => x === null || typeof x !== 'object')) return `[${v.map((x) => lit(x)).join(', ')}]`;
    return `[\n${v.map((x) => `${inner}${lit(x, inner)},`).join('\n')}\n${ind}]`;
  }
  const keys = Object.keys(v);
  if (keys.length === 0) return '{}';
  return `{\n${keys.map((k) => `${inner}${keyLit(k)}: ${lit(v[k], inner)},`).join('\n')}\n${ind}}`;
}
const origin = (name) => `// Maquette Kit_Studio_actuel.html, l.${seg[name].line} : ${seg[name].prefix}`;
const decl = (name, origName, type, value) =>
  `${origin(origName)}\nexport const ${name}: ${type} = ${lit(value)};\n`;

const idsOf = (arr, key = 'id') => arr.map((x) => x[key]);
const TYPES = `// généré par scripts/port-catalog.mjs, ne pas éditer
// Domaine pur : aucun import React, three ou DOM. Aucune couleur hexadécimale : chaque couleur est une MaterialKey (voir palette.ts).
import type { MaterialKey } from './palette';
export type { MaterialKey };

export type BagId = ${union(Object.keys(BAGS))};
export type ColorwayId = ${union(Object.keys(COLORWAYS))};
export type ModuleId = ${union(MODS)};
export type ZoneId = ${union(idsOf(ZONES))};
export type PackZoneId = ${union(ZIDS)};
export type ItemId = ${union(idsOf(ITEMS))};
export type KitId = ${union(idsOf(KITS))};
export type FamilyId = ${union(idsOf(FAMILY_LIST))};
export type PartId = ${union(Object.keys(PART_W))};
export type PartNameId = ${union(Object.keys(PNAME))};
export type MaterialId = ${union(Object.keys(MATS))};
export type FinishId = ${union(Object.keys(FIN))};
export type ShapeSlot = ${union(Object.keys(SHAPES))};
export type AccessoryId = ${union(Object.keys(ACC))};
export type OptionCategoryId = ${union(Object.keys(CATN))};
export type CapacityZoneId = 'lid' | 'main' | 'front' | 'sides' | 'hip' | 'back';
export type Vec3 = readonly [number, number, number];

export interface Bag { readonly id: BagId; readonly n: string; readonly g: number; readonly L: number; readonly cap: Readonly<Record<CapacityZoneId, number>>; readonly sc: Vec3; }
export interface Colorway { readonly id: ColorwayId; readonly n: string; readonly body: MaterialKey; readonly pocket: MaterialKey; readonly trim: MaterialKey; readonly accent: MaterialKey; }
export interface Item {
  readonly id: ItemId; readonly n: string; readonly fam: FamilyId; readonly fn: string; readonly sh: string; readonly gl: string;
  readonly g: number; readonly L: number; readonly color: MaterialKey; readonly zones: readonly ZoneId[];
  readonly state: string; readonly loc: string; readonly trips: number;
  readonly vital?: number; readonly temp?: string; readonly bought?: string; readonly price?: number; readonly care?: string;
  readonly expired?: string; readonly cons?: string; readonly dry?: number; readonly cabinBan?: number; readonly lentTo?: string; readonly until?: string;
}
export interface Zone { readonly id: ZoneId; readonly n: string; readonly th: number; readonly ph: number; readonly d: number; }
export interface Family { readonly id: FamilyId; readonly n: string; }
export interface Ghost { readonly fn: string; readonly zone: ZoneId; readonly gl: string; readonly sh: string; readonly n: string; readonly why: string; }
export interface Kit {
  readonly id: KitId; readonly n: string; readonly days: number; readonly bag: BagId; readonly cw: ColorwayId; readonly body: number;
  readonly start: string; readonly ctx: string; readonly cabin?: { readonly dims: readonly number[]; readonly kg: number };
  readonly packed: Readonly<Partial<Record<PackZoneId, readonly ItemId[]>>>;
  readonly slots: Readonly<Record<string, string>> | null; readonly ghosts: readonly Ghost[];
  readonly food: { readonly perDay: number; readonly carry: number } | null;
  readonly lineage: { readonly from: string | null; readonly gen: number; readonly proven: number };
}
export interface ZoneDef { readonly id: string; readonly n: string; }
export interface ModuleSpec { readonly n: string; readonly eur: number; readonly host: 'corps' | 'chassis'; readonly pts: number; readonly part: PartId; readonly gl: string; readonly d: string; readonly acc?: AccessoryId; }
export interface OneSpec {
  readonly chassis: { readonly n: string; readonly eur: number; readonly pts: number; readonly gl: string; readonly d: string; readonly mat: string };
  readonly corps: Readonly<Record<BagId, { readonly eur: number; readonly pts: number; readonly d: string }>>;
  readonly corpsMat: string;
  readonly mods: Readonly<Record<ModuleId, ModuleSpec>>;
}
export interface Material { readonly n: string; readonly short: string; readonly f: number; readonly rough: number; readonly tex: string; readonly d: string; }
export interface Finish { readonly n: string; readonly r: number; readonly m: number; readonly noise?: boolean; }
export interface ShapeOption {
  readonly id: string; readonly n: string; readonly g?: number | '-';
  readonly cap?: Partial<Record<CapacityZoneId, number>>; readonly capSet?: Partial<Record<CapacityZoneId, number>>; readonly capMul?: Partial<Record<CapacityZoneId, number>>;
}
export interface Accessory { readonly n: string; readonly g: number; readonly part: PartId; readonly slot: string; readonly gl: string; }
export type Swatch = readonly [string, MaterialKey];
export interface Alternative {
  readonly id: string; readonly n: string; readonly src: 'shop' | 'rent'; readonly g: number | null;
  readonly eur?: number; readonly day?: number; readonly sh: string; readonly gl: string; readonly color: MaterialKey;
}
export interface PartConfig { readonly shape?: string; readonly mat?: MaterialId; readonly col?: MaterialKey; readonly fin?: FinishId; }
export interface ConfigSet {
  readonly body: PartConfig; readonly lid: PartConfig; readonly front: PartConfig; readonly sides: PartConfig;
  readonly hip: PartConfig; readonly harness: PartConfig; readonly webbing: PartConfig;
  readonly accent: MaterialKey; readonly acc: readonly AccessoryId[];
}
`;

const body = [
  decl('BAGS', 'BAGS', 'Readonly<Record<BagId, Bag>>', BAGS),
  decl('COLORWAYS', 'CW', 'Readonly<Record<ColorwayId, Colorway>>', COLORWAYS),
  decl('PART_NAMES', 'PNAME', 'Readonly<Record<PartNameId, string>>', PNAME),
  decl('PART_WEIGHTS', 'PART_W', 'Readonly<Record<PartId, number>>', PART_W),
  decl('MATERIALS', 'MATS', 'Readonly<Record<MaterialId, Material>>', MATS),
  decl('FINISHES', 'FIN', 'Readonly<Record<FinishId, Finish>>', FIN),
  decl('FINISH_HINTS', 'FIND', 'Readonly<Record<FinishId, string>>', FIND),
  decl('SWATCHES', 'COLS', 'readonly Swatch[]', SWATCHES),
  decl('SHAPE_OPTIONS', 'SHAPES', 'Readonly<Record<ShapeSlot, readonly ShapeOption[]>>', SHAPES),
  decl('ACCESSORIES', 'ACC', 'Readonly<Record<AccessoryId, Accessory>>', ACC),
  decl('ONE', 'ONE', 'OneSpec', ONE),
  decl('MODULE_IDS', 'MODS', 'readonly ModuleId[]', MODS),
  decl('VISUAL_PATHS', 'VS', 'Readonly<Record<string, string>>', VS),
  decl('OPTION_CATEGORIES', 'CATN', 'Readonly<Record<OptionCategoryId, string>>', CATN),
  decl('ITEMS', 'INV', 'readonly Item[]', ITEMS),
  decl('FAMILIES', 'INV', 'readonly Family[]', FAMILY_LIST),
  decl('KITS', 'KITS', 'readonly Kit[]', KITS),
  decl('ZONES', 'ZONES', 'readonly Zone[]', ZONES),
  decl('ZONE_IDS', 'ZONES', 'readonly ZoneId[]', idsOf(ZONES)),
  decl('PACK_ZONE_IDS', 'ZIDS', 'readonly PackZoneId[]', ZIDS),
  decl('ZONE_NAMES', 'ZNAME', 'Readonly<Record<PackZoneId, string>>', ZNAME),
  decl('ANCHORS', 'ANCH', 'Readonly<Partial<Record<ZoneId, Vec3>>>', ANCH),
  decl('ALTERNATIVES', 'ALT', 'Readonly<Record<string, readonly Alternative[]>>', ALTERNATIVES),
  decl('PRESETS', 'preset', 'Readonly<Record<ColorwayId, ConfigSet>>', PRESETS),
  `${origin('preset')}\n/** Configuration par défaut d'un coloris (fonction pure, lecture seule). */\nexport function preset(cw: ColorwayId): ConfigSet {\n  return PRESETS[cw];\n}\n`,
  decl('DEFAULT_CONFIG', 'CFG', 'Readonly<Record<BagId, ConfigSet>>', CFG),
].join('\n');

const catalogText = `${TYPES}\n${body}`;
if (/#[0-9a-fA-F]{3,8}\b/.test(catalogText)) fail('hexadécimal détecté dans catalog.ts');
if (/\bany\b/.test(catalogText)) fail('type any détecté dans catalog.ts');

// 6. Palette : bloc délimité, le reste du fichier existant est conservé.
const paletteBlock = [
  MARK_START,
  '// généré par scripts/port-catalog.mjs : ne pas éditer ce bloc',
  `export type MaterialKey = ${union([...materials.keys()])};`,
  'export const RAW_MATERIALS: Readonly<Record<MaterialKey, string>> = {',
  ...[...materials].map(([k, hex]) => `  ${q(k)}: ${q(hex)},`),
  '};',
  MARK_END,
].join('\n');
let palette;
if (existsSync(OUT_PALETTE)) {
  const cur = readFileSync(OUT_PALETTE, 'utf8');
  const a = cur.indexOf(MARK_START);
  const b = cur.indexOf(MARK_END);
  palette = a >= 0 && b > a ? cur.slice(0, a) + paletteBlock + cur.slice(b + MARK_END.length) : `${cur.trimEnd()}\n\n${paletteBlock}\n`;
} else {
  palette = `// Couleurs brutes de la maquette : seul fichier du domaine autorisé à contenir de l'hexadécimal.\n${paletteBlock}\n`;
}

mkdirSync(DOMAIN, { recursive: true });
writeFileSync(OUT_CATALOG, catalogText);
writeFileSync(OUT_PALETTE, palette);
process.stdout.write(
  `catalog.ts et palette.ts générés : ${ITEMS.length} objets, ${Object.keys(BAGS).length} sacs, ${Object.keys(COLORWAYS).length} coloris, ${MODS.length} modules, ${KITS.length} kits, ${ZONES.length} zones, ${FAMILY_LIST.length} familles, ${materials.size} matières.\n`,
);
