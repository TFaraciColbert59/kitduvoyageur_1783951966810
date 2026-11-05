// généré par scripts/port-catalog.mjs, ne pas éditer
// Domaine pur : aucun import React, three ou DOM. Aucune couleur hexadécimale : chaque couleur est une MaterialKey (voir palette.ts).
import type { MaterialKey } from './palette';
export type { MaterialKey };

export type BagId = 'b42' | 'b28';
export type ColorwayId = 'foret' | 'sauge' | 'pierre' | 'nuit';
export type ModuleId = 'lid' | 'front' | 'sides' | 'tool' | 'hipp' | 'flask';
export type ZoneId = 'worn' | 'bag' | 'lid' | 'main' | 'front' | 'sides' | 'hip' | 'back';
export type PackZoneId = 'worn' | 'lid' | 'main' | 'front' | 'sides' | 'hip' | 'back';
export type ItemId = 'sleep0' | 'sleep-5' | 'quilt5' | 'tent1' | 'tent2' | 'mat-air' | 'mat-foam' | 'shoe-mid' | 'shoe-trail' | 'hat' | 'merino' | 'down' | 'fleece' | 'clothes' | 'rain3l' | 'rainul' | 'rainpants' | 'gloves' | 'stove' | 'gas' | 'food' | 'bars' | 'bladder' | 'bottle' | 'filter' | 'headlamp' | 'battery' | 'phone' | 'laptop' | 'watch' | 'map' | 'poles-alu' | 'poles-carbon' | 'knife' | 'glasses' | 'firstaid' | 'blanket' | 'toilet' | 'sunscreen';
export type KitId = 'tmb' | 'vercors' | 'cabine';
export type FamilyId = 'abri-et-couchage' | 'vetements' | 'eau-et-cuisine' | 'lumiere-et-energie' | 'orientation-et-outils' | 'securite-et-soin';
export type PartId = 'body' | 'lid' | 'front' | 'sides' | 'hip' | 'harness';
export type PartNameId = 'all' | 'body' | 'lid' | 'front' | 'sides' | 'hip' | 'harness' | 'webbing';
export type MaterialId = 'ripstop' | 'cordura' | 'dcf' | 'xpac' | 'waxed';
export type FinishId = 'mat' | 'satin' | 'gloss' | 'heather';
export type ShapeSlot = 'body' | 'lid' | 'front' | 'sides' | 'hip' | 'harness';
export type AccessoryId = 'cover' | 'reflect' | 'daisy' | 'axe' | 'compress' | 'spocket' | 'sbottle' | 'biner';
export type OptionCategoryId = 'shape' | 'mod' | 'col' | 'mat' | 'fin' | 'acc';
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

// Maquette Kit_Studio_actuel.html, l.535 : const BAGS=
export const BAGS: Readonly<Record<BagId, Bag>> = {
  b42: {
    id: 'b42',
    n: 'Corps 42 L',
    g: 1180,
    L: 42,
    cap: {
      lid: 4,
      main: 30,
      front: 5,
      sides: 2,
      hip: 1,
      back: 2.5,
    },
    sc: [1, 0.96, 0.97],
  },
  b28: {
    id: 'b28',
    n: 'Corps 28 L',
    g: 900,
    L: 28,
    cap: {
      lid: 3,
      main: 18.5,
      front: 3,
      sides: 1.5,
      hip: 0.8,
      back: 2,
    },
    sc: [0.95, 0.72, 0.86],
  },
};

// Maquette Kit_Studio_actuel.html, l.539 : const CW=
export const COLORWAYS: Readonly<Record<ColorwayId, Colorway>> = {
  foret: {
    id: 'foret',
    n: 'Forêt',
    body: 'm-2d482a',
    pocket: 'm-3d6038',
    trim: 'm-1e301c',
    accent: 'm-9bbda7',
  },
  sauge: {
    id: 'sauge',
    n: 'Sauge',
    body: 'm-789972',
    pocket: 'm-96b391',
    trim: 'm-3d6038',
    accent: 'm-f0f5ee',
  },
  pierre: {
    id: 'pierre',
    n: 'Pierre',
    body: 'm-b5aba0',
    pocket: 'm-d4ccc0',
    trim: 'm-5b554a',
    accent: 'm-2d482a',
  },
  nuit: {
    id: 'nuit',
    n: 'Nuit',
    body: 'm-1f4251',
    pocket: 'm-2a5a6e',
    trim: 'm-10222b',
    accent: 'm-a8c8d4',
  },
};

// Maquette Kit_Studio_actuel.html, l.548 : const PNAME=
export const PART_NAMES: Readonly<Record<PartNameId, string>> = {
  all: 'LKDV ONE',
  body: 'Corps',
  lid: 'Couvercle',
  front: 'Poche avant',
  sides: 'Poches latérales',
  hip: 'Ceinture',
  harness: 'Châssis ONE',
  webbing: 'Sangles',
};

// Maquette Kit_Studio_actuel.html, l.546 : const PART_W=
export const PART_WEIGHTS: Readonly<Record<PartId, number>> = {
  body: 0.42,
  lid: 0.11,
  front: 0.06,
  sides: 0.03,
  hip: 0.15,
  harness: 0.23,
};

// Maquette Kit_Studio_actuel.html, l.549 : const MATS=
export const MATERIALS: Readonly<Record<MaterialId, Material>> = {
  ripstop: {
    n: 'Ripstop 210D',
    short: 'Ripstop',
    f: 1,
    rough: 0.82,
    tex: 'ripstop',
    d: 'Léger, déperlant, polyvalent.',
  },
  cordura: {
    n: 'Cordura 500D',
    short: 'Cordura',
    f: 1.18,
    rough: 0.9,
    tex: 'cordura',
    d: 'Plus lourd, très résistant aux frottements.',
  },
  dcf: {
    n: 'Dyneema composite',
    short: 'Dyneema',
    f: 0.62,
    rough: 0.42,
    tex: 'dcf',
    d: 'Très léger et imperméable, moins résistant à l’abrasion.',
  },
  xpac: {
    n: 'X-Pac',
    short: 'X-Pac',
    f: 0.88,
    rough: 0.6,
    tex: 'xpac',
    d: 'Laminé imperméable, bon compromis entre poids et solidité.',
  },
  waxed: {
    n: 'Toile cirée',
    short: 'Toile cirée',
    f: 1.45,
    rough: 0.7,
    tex: 'waxed',
    d: 'Lourde et très robuste, se patine avec le temps.',
  },
};

// Maquette Kit_Studio_actuel.html, l.556 : const FIN=
export const FINISHES: Readonly<Record<FinishId, Finish>> = {
  mat: {
    n: 'Mat',
    r: 0.92,
    m: 0,
  },
  satin: {
    n: 'Satiné',
    r: 0.62,
    m: 0.02,
  },
  gloss: {
    n: 'Enduit',
    r: 0.34,
    m: 0.04,
  },
  heather: {
    n: 'Chiné',
    r: 0.86,
    m: 0,
    noise: true,
  },
};

// Maquette Kit_Studio_actuel.html, l.557 : const FIND=
export const FINISH_HINTS: Readonly<Record<FinishId, string>> = {
  mat: 'Aspect textile, sans reflet.',
  satin: 'Léger lustre qui accroche la lumière.',
  gloss: 'Enduction brillante qui perle l’eau.',
  heather: 'Fil chiné, aspect laineux.',
};

// Maquette Kit_Studio_actuel.html, l.558 : const COLS=
export const SWATCHES: readonly Swatch[] = [
  ['Forêt', 'm-2d482a'],
  ['Mousse', 'm-3d6038'],
  ['Sapin', 'm-1e301c'],
  ['Sauge', 'm-789972'],
  ['Lichen', 'm-96b391'],
  ['Menthe', 'm-9bbda7'],
  ['Pierre', 'm-b5aba0'],
  ['Craie', 'm-d4ccc0'],
  ['Sable', 'm-c9c0a3'],
  ['Taupe', 'm-5b554a'],
  ['Ocre', 'm-b08a4e'],
  ['Brique', 'm-a8443a'],
  ['Glacier', 'm-a8c8d4'],
  ['Lac', 'm-2a5a6e'],
  ['Nuit', 'm-1f4251'],
  ['Abysse', 'm-10222b'],
  ['Ardoise', 'm-2c3530'],
  ['Encre', 'm-141916'],
  ['Écru', 'm-e8e6df'],
  ['Givre', 'm-f0f5ee'],
];

// Maquette Kit_Studio_actuel.html, l.560 : const SHAPES=
export const SHAPE_OPTIONS: Readonly<Record<ShapeSlot, readonly ShapeOption[]>> = {
  body: [
    {
      id: 'classic',
      n: 'Classique',
    },
    {
      id: 'slim',
      n: 'Fuselé',
      g: -40,
      cap: {
        main: -3,
      },
    },
    {
      id: 'roll',
      n: 'Roll-top',
      g: 40,
      cap: {
        main: 2,
      },
    },
  ],
  lid: [
    {
      id: 'std',
      n: 'Standard',
    },
    {
      id: 'xl',
      n: 'Extensible',
      g: 40,
      cap: {
        lid: 2,
      },
    },
    {
      id: 'none',
      n: 'Sans couvercle',
      g: '-',
      capSet: {
        lid: 0,
      },
    },
  ],
  front: [
    {
      id: 'stretch',
      n: 'Filet stretch',
    },
    {
      id: 'zip',
      n: 'Zippée',
      g: 30,
      capSet: {
        front: 3,
      },
    },
    {
      id: 'shove',
      n: 'Kangourou',
      g: 20,
      capSet: {
        front: 6,
      },
    },
    {
      id: 'none',
      n: 'Aucune',
      g: '-',
      capSet: {
        front: 1,
      },
    },
  ],
  sides: [
    {
      id: 'std',
      n: 'Ouvertes',
    },
    {
      id: 'tall',
      n: 'Hautes',
      g: 15,
      capMul: {
        sides: 1.5,
      },
    },
    {
      id: 'none',
      n: 'Aucune',
      g: '-',
      capSet: {
        sides: 0,
      },
    },
  ],
  hip: [
    {
      id: 'padded',
      n: 'Rembourrée',
    },
    {
      id: 'wide',
      n: 'Large à poches',
      g: 60,
      capSet: {
        hip: 2,
      },
    },
    {
      id: 'web',
      n: 'Sangle simple',
      g: -150,
      capSet: {
        hip: 0,
      },
    },
  ],
  harness: [
    {
      id: 'std',
      n: 'Bretelles',
    },
    {
      id: 'vest',
      n: 'Gilet',
      g: 80,
    },
    {
      id: 'mesh',
      n: 'Dos ventilé',
      g: 60,
    },
  ],
};

// Maquette Kit_Studio_actuel.html, l.568 : const ACC=
export const ACCESSORIES: Readonly<Record<AccessoryId, Accessory>> = {
  cover: {
    n: 'Housse de pluie',
    g: 110,
    part: 'body',
    slot: 'cover',
    gl: 'cover',
  },
  reflect: {
    n: 'Bandes réfléchissantes',
    g: 8,
    part: 'body',
    slot: 'reflect',
    gl: 'reflect',
  },
  daisy: {
    n: 'Daisy chain',
    g: 25,
    part: 'front',
    slot: 'daisy',
    gl: 'daisy',
  },
  axe: {
    n: 'Porte-piolet',
    g: 15,
    part: 'front',
    slot: 'axe',
    gl: 'axe',
  },
  compress: {
    n: 'Sangles de compression',
    g: 30,
    part: 'sides',
    slot: 'compress',
    gl: 'compress',
  },
  spocket: {
    n: 'Poche de bretelle',
    g: 45,
    part: 'harness',
    slot: 'shoulder',
    gl: 'spocket',
  },
  sbottle: {
    n: 'Porte-gourde de bretelle',
    g: 38,
    part: 'harness',
    slot: 'shoulder',
    gl: 'bottle',
  },
  biner: {
    n: 'Mousqueton',
    g: 12,
    part: 'hip',
    slot: 'biner',
    gl: 'biner',
  },
};

// Maquette Kit_Studio_actuel.html, l.581 : const ONE=
export const ONE: OneSpec = {
  chassis: {
    n: 'Châssis ONE',
    eur: 189,
    pts: 4,
    gl: 'v_harness_mesh',
    d: 'Bretelles, dos ventilé et ceinture. Il porte tous les corps.',
    mat: 'Mesh 3D, mousse EVA, montants alu',
  },
  corps: {
    b28: {
      eur: 119,
      pts: 6,
      d: 'Pour la journée, le vélo et la cabine.',
    },
    b42: {
      eur: 149,
      pts: 8,
      d: 'Pour les treks de plusieurs jours.',
    },
  },
  corpsMat: 'X-Pac VX21, fond Cordura 500D',
  mods: {
    lid: {
      n: 'Couvercle',
      eur: 49,
      host: 'corps',
      pts: 2,
      part: 'lid',
      gl: 'v_lid_std',
      d: 'Poche haute de 4 L.',
    },
    front: {
      n: 'Poche avant',
      eur: 39,
      host: 'corps',
      pts: 2,
      part: 'front',
      gl: 'v_front_zip',
      d: 'Poche zippée de 3 L pour la pluie et la carte.',
    },
    sides: {
      n: 'Poches latérales',
      eur: 35,
      host: 'corps',
      pts: 2,
      part: 'sides',
      gl: 'v_sides_std',
      d: 'Paire de poches à gourde.',
    },
    tool: {
      n: 'Porte-piolet et bâtons',
      eur: 15,
      host: 'corps',
      pts: 1,
      part: 'front',
      acc: 'axe',
      gl: 'axe',
      d: 'Boucle basse et élastique haut.',
    },
    hipp: {
      n: 'Poches de ceinture',
      eur: 29,
      host: 'chassis',
      pts: 2,
      part: 'hip',
      gl: 'v_hip_wide',
      d: 'Deux poches zippées sur la ceinture.',
    },
    flask: {
      n: 'Porte-gourde de bretelle',
      eur: 19,
      host: 'chassis',
      pts: 1,
      part: 'harness',
      acc: 'sbottle',
      gl: 'bottle',
      d: 'Flasque de 500 mL à portée de main.',
    },
  },
};

// Maquette Kit_Studio_actuel.html, l.593 : const MODS=
export const MODULE_IDS: readonly ModuleId[] = ['lid', 'front', 'sides', 'tool', 'hipp', 'flask'];

// Maquette Kit_Studio_actuel.html, l.611 : const VS=
export const VISUAL_PATHS: Readonly<Record<string, string>> = {
  v_body_classic: '<rect x="7" y="4" width="10" height="16" rx="3.5"/>',
  v_body_slim: '<path d="M7 7.5A3.5 3.5 0 0 1 10.5 4h3A3.5 3.5 0 0 1 17 7.5V17l-1.5 3h-7L7 17z"/>',
  v_body_roll: '<rect x="7" y="7" width="10" height="13" rx="3"/><rect x="6" y="3.5" width="12" height="3.5" rx="1.75"/>',
  v_lid_std: '<rect x="5" y="7" width="14" height="5" rx="2.5"/><path d="M7 12v8h10v-8"/>',
  v_lid_xl: '<rect x="5" y="4.5" width="14" height="7.5" rx="3"/><path d="M7 12v8h10v-8"/>',
  v_lid_none: '<path d="M7 9v11h10V9"/><path d="M6 9h12" stroke-dasharray="2 2"/>',
  v_front_stretch: '<rect x="6" y="6" width="12" height="13" rx="3"/><path d="M9 9.5h.01M12 9.5h.01M15 9.5h.01M9 12.5h.01M12 12.5h.01M15 12.5h.01M9 15.5h.01M12 15.5h.01M15 15.5h.01"/>',
  v_front_zip: '<rect x="6" y="6" width="12" height="13" rx="3"/><path d="M14.5 8v9"/>',
  v_front_shove: '<rect x="5.5" y="4" width="13" height="16" rx="3.5"/><path d="M8 7h8"/>',
  v_front_none: '<rect x="6" y="6" width="12" height="13" rx="3" stroke-dasharray="2.5 2.5"/>',
  v_sides_std: '<rect x="9" y="3.5" width="6" height="17" rx="2"/><rect x="5" y="12.5" width="4" height="7" rx="1.5"/><rect x="15" y="12.5" width="4" height="7" rx="1.5"/>',
  v_sides_tall: '<rect x="9" y="3.5" width="6" height="17" rx="2"/><rect x="5" y="8" width="4" height="11.5" rx="1.5"/><rect x="15" y="8" width="4" height="11.5" rx="1.5"/>',
  v_sides_none: '<rect x="9" y="3.5" width="6" height="17" rx="2"/><path d="M5 13v6M19 13v6" stroke-dasharray="2 2"/>',
  v_hip_padded: '<path d="M3 12.5c4-2.5 14-2.5 18 0v3.5c-4-2.5-14-2.5-18 0z"/>',
  v_hip_wide: '<path d="M3 11c4-3 14-3 18 0v6c-4-3-14-3-18 0z"/><path d="M6 14h3M15 14h3"/>',
  v_hip_web: '<path d="M3 14c4-2 14-2 18 0"/>',
  v_harness_std: '<path d="M8 3.5c-2 4-2 11 0 17M16 3.5c2 4 2 11 0 17"/><path d="M8 9h8"/>',
  v_harness_vest: '<path d="M7 3.5c-2.5 4-2.5 11 0 17h3c-1.5-6-1.5-11 0-17zM17 3.5c2.5 4 2.5 11 0 17h-3c1.5-6 1.5-11 0-17z"/>',
  v_harness_mesh: '<rect x="6" y="4" width="12" height="16" rx="3"/><path d="M8 7c3 2 5 2 8 0M8 12c3 2 5 2 8 0M8 17c3 2 5 2 8 0"/>',
  v_web: '<path d="M3 8h18M3 12h18M3 16h18"/>',
  v_bag: '<path d="M7 8a5 5 0 0 1 10 0v11.5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"/><path d="M9 13.5h6M10 4.5V3h4v1.5"/>',
};

// Maquette Kit_Studio_actuel.html, l.647 : const CATN=
export const OPTION_CATEGORIES: Readonly<Record<OptionCategoryId, string>> = {
  shape: 'Corps',
  mod: 'Modules',
  col: 'Coloris',
  mat: 'Matière',
  fin: 'Finition',
  acc: 'Accessoires',
};

// Maquette Kit_Studio_actuel.html, l.662 : const INV=[
export const ITEMS: readonly Item[] = [
  {
    id: 'sleep0',
    n: 'Duvet 0 °C',
    fn: 'sleep',
    sh: 'roll',
    gl: 'roll',
    g: 820,
    L: 6.5,
    state: 'stock',
    loc: 'Lille',
    trips: 22,
    vital: 1,
    temp: 'Confort 0 °C',
    bought: 'mars 2022',
    price: 289,
    fam: 'abri-et-couchage',
    color: 'm-365233',
    zones: ['main'],
  },
  {
    id: 'sleep-5',
    n: 'Duvet −5 °C',
    fn: 'sleep',
    sh: 'roll',
    gl: 'roll',
    g: 1150,
    L: 8,
    state: 'stock',
    loc: 'Lille',
    trips: 6,
    temp: 'Confort −5 °C',
    bought: 'déc. 2020',
    price: 219,
    fam: 'abri-et-couchage',
    color: 'm-1f4251',
    zones: ['main'],
  },
  {
    id: 'quilt5',
    n: 'Quilt +5 °C',
    fn: 'sleep',
    sh: 'roll',
    gl: 'roll',
    g: 560,
    L: 4,
    state: 'stock',
    loc: 'Lille',
    trips: 11,
    temp: 'Confort +5 °C',
    bought: 'juin 2024',
    price: 249,
    fam: 'abri-et-couchage',
    color: 'm-5b7f55',
    zones: ['main'],
  },
  {
    id: 'tent1',
    n: 'Tente 1 place',
    fn: 'shelter',
    sh: 'roll',
    gl: 'tent',
    g: 1050,
    L: 3.5,
    state: 'stock',
    loc: 'Lille',
    trips: 18,
    vital: 1,
    bought: 'avr. 2023',
    price: 349,
    fam: 'abri-et-couchage',
    color: 'm-4c7746',
    zones: ['main', 'front'],
  },
  {
    id: 'tent2',
    n: 'Tente 2 places',
    fn: 'shelter',
    sh: 'roll',
    gl: 'tent',
    g: 1650,
    L: 5,
    state: 'stock',
    loc: 'Annecy',
    trips: 9,
    bought: 'mai 2019',
    price: 279,
    fam: 'abri-et-couchage',
    color: 'm-5b554a',
    zones: ['main', 'front'],
  },
  {
    id: 'mat-air',
    n: 'Matelas gonflable',
    fn: 'sleeppad',
    sh: 'roll',
    gl: 'roll',
    g: 410,
    L: 1.2,
    state: 'stock',
    loc: 'Lille',
    trips: 20,
    temp: 'Isolation R 4,2',
    bought: 'avr. 2023',
    price: 179,
    fam: 'abri-et-couchage',
    color: 'm-3e6b7a',
    zones: ['main'],
  },
  {
    id: 'mat-foam',
    n: 'Matelas mousse',
    fn: 'sleeppad',
    sh: 'roll',
    gl: 'roll',
    g: 300,
    L: 9,
    state: 'stock',
    loc: 'Lille',
    trips: 35,
    temp: 'Isolation R 2,0',
    fam: 'abri-et-couchage',
    color: 'm-b8ad8a',
    zones: ['front'],
  },
  {
    id: 'shoe-mid',
    n: 'Chaussures mi-montantes',
    fn: 'footwear',
    sh: 'shoe',
    gl: 'shoe',
    g: 980,
    L: 4,
    state: 'stock',
    loc: 'Lille',
    trips: 31,
    bought: 'sept. 2022',
    price: 189,
    fam: 'vetements',
    color: 'm-5b554a',
    zones: ['worn'],
  },
  {
    id: 'shoe-trail',
    n: 'Chaussures de trail',
    fn: 'footwear',
    sh: 'shoe',
    gl: 'shoe',
    g: 620,
    L: 3.2,
    state: 'stock',
    loc: 'Lille',
    trips: 12,
    bought: 'févr. 2025',
    price: 149,
    fam: 'vetements',
    color: 'm-2a5a6e',
    zones: ['worn'],
  },
  {
    id: 'hat',
    n: 'Casquette',
    fn: 'sunhead',
    sh: 'hat',
    gl: 'hat',
    g: 70,
    L: 0.4,
    state: 'stock',
    loc: 'Lille',
    trips: 40,
    fam: 'vetements',
    color: 'm-c9c0a3',
    zones: ['worn', 'lid'],
  },
  {
    id: 'merino',
    n: 'T-shirt mérinos',
    fn: 'baselayer',
    sh: 'jacket',
    gl: 'jacket',
    g: 150,
    L: 0.6,
    state: 'stock',
    loc: 'Lille',
    trips: 38,
    fam: 'vetements',
    color: 'm-3d6038',
    zones: ['worn', 'main'],
  },
  {
    id: 'down',
    n: 'Doudoune',
    fn: 'insulation',
    sh: 'jacket',
    gl: 'jacket',
    g: 340,
    L: 3,
    state: 'stock',
    loc: 'Lille',
    trips: 24,
    vital: 1,
    temp: 'Garnissage 90 g',
    fam: 'vetements',
    color: 'm-17402c',
    zones: ['main', 'lid'],
  },
  {
    id: 'fleece',
    n: 'Polaire',
    fn: 'midlayer',
    sh: 'jacket',
    gl: 'jacket',
    g: 280,
    L: 2,
    state: 'stock',
    loc: 'Lille',
    trips: 0,
    fam: 'vetements',
    color: 'm-789972',
    zones: ['main'],
  },
  {
    id: 'clothes',
    n: 'Rechange',
    fn: 'clothes',
    sh: 'sack',
    gl: 'sack',
    g: 450,
    L: 3,
    state: 'stock',
    loc: 'Lille',
    trips: 0,
    fam: 'vetements',
    color: 'm-968c81',
    zones: ['main'],
  },
  {
    id: 'rain3l',
    n: 'Veste imperméable 3 couches',
    fn: 'rainshell',
    sh: 'jacket',
    gl: 'jacket',
    g: 395,
    L: 1.5,
    state: 'stock',
    loc: 'Chamonix',
    trips: 16,
    temp: 'Colonne d’eau 20 000 mm',
    bought: 'oct. 2021',
    price: 329,
    care: 'Réimperméabilisation conseillée (dernière : 2024)',
    fam: 'vetements',
    color: 'm-2a5a6e',
    zones: ['front', 'lid', 'main'],
  },
  {
    id: 'rainul',
    n: 'Veste pluie ultralight',
    fn: 'rainshell',
    sh: 'jacket',
    gl: 'jacket',
    g: 230,
    L: 0.7,
    state: 'lent',
    loc: 'Lille',
    trips: 5,
    lentTo: 'Léa',
    until: '12 nov.',
    fam: 'vetements',
    color: 'm-5b7f55',
    zones: ['front', 'lid', 'main'],
  },
  {
    id: 'rainpants',
    n: 'Surpantalon',
    fn: 'rainpants',
    sh: 'jacket',
    gl: 'jacket',
    g: 210,
    L: 0.8,
    state: 'stock',
    loc: 'Lille',
    trips: 0,
    fam: 'vetements',
    color: 'm-2c3530',
    zones: ['front', 'main'],
  },
  {
    id: 'gloves',
    n: 'Gants',
    fn: 'gloves',
    sh: 'sack',
    gl: 'gloves',
    g: 60,
    L: 0.3,
    state: 'stock',
    loc: 'Lille',
    trips: 0,
    fam: 'vetements',
    color: 'm-2c3530',
    zones: ['lid', 'hip', 'main'],
  },
  {
    id: 'stove',
    n: 'Réchaud et popote',
    fn: 'cook',
    sh: 'stove',
    gl: 'stove',
    g: 310,
    L: 1.2,
    state: 'stock',
    loc: 'Lille',
    trips: 21,
    fam: 'eau-et-cuisine',
    color: 'm-7a7365',
    zones: ['main'],
  },
  {
    id: 'gas',
    n: 'Cartouche de gaz',
    fn: 'fuel',
    sh: 'bottle',
    gl: 'bottle',
    g: 370,
    L: 0.5,
    state: 'stock',
    loc: 'Lille',
    trips: 0,
    cons: 'gas',
    fam: 'eau-et-cuisine',
    color: 'm-2a5a6e',
    zones: ['main'],
  },
  {
    id: 'food',
    n: 'Repas lyophilisés',
    fn: 'food',
    sh: 'sack',
    gl: 'sack',
    g: 1300,
    L: 3,
    state: 'stock',
    loc: 'Lille',
    trips: 0,
    cons: 'food',
    fam: 'eau-et-cuisine',
    color: 'm-b08a4e',
    zones: ['main'],
  },
  {
    id: 'bars',
    n: 'Barres et fruits secs',
    fn: 'snack',
    sh: 'sack',
    gl: 'sack',
    g: 240,
    L: 0.5,
    state: 'stock',
    loc: 'Lille',
    trips: 0,
    cons: 'snack',
    fam: 'eau-et-cuisine',
    color: 'm-998f70',
    zones: ['lid', 'hip'],
  },
  {
    id: 'bladder',
    n: 'Poche à eau 2 L',
    fn: 'water',
    sh: 'bladder',
    gl: 'bladder',
    g: 2080,
    L: 2.1,
    state: 'stock',
    loc: 'Lille',
    trips: 0,
    cons: 'water',
    dry: 80,
    fam: 'eau-et-cuisine',
    color: 'm-7aaab8',
    zones: ['back'],
  },
  {
    id: 'bottle',
    n: 'Gourde souple 0,5 L',
    fn: 'water',
    sh: 'bottle',
    gl: 'bottle',
    g: 530,
    L: 0.55,
    state: 'stock',
    loc: 'Lille',
    trips: 0,
    cons: 'water',
    dry: 30,
    fam: 'eau-et-cuisine',
    color: 'm-a8c8d4',
    zones: ['sides'],
  },
  {
    id: 'filter',
    n: 'Filtre à eau',
    fn: 'watertreat',
    sh: 'bottle',
    gl: 'filter',
    g: 85,
    L: 0.15,
    state: 'stock',
    loc: 'Lille',
    trips: 0,
    fam: 'eau-et-cuisine',
    color: 'm-3e6b7a',
    zones: ['sides', 'lid'],
  },
  {
    id: 'headlamp',
    n: 'Frontale 450 lm',
    fn: 'light',
    sh: 'lamp',
    gl: 'lamp',
    g: 78,
    L: 0.2,
    state: 'stock',
    loc: 'Lille',
    trips: 27,
    vital: 1,
    fam: 'lumiere-et-energie',
    color: 'm-1e301c',
    zones: ['lid', 'hip'],
  },
  {
    id: 'battery',
    n: 'Batterie 10 000 mAh',
    fn: 'power',
    sh: 'box',
    gl: 'battery',
    g: 190,
    L: 0.15,
    state: 'stock',
    loc: 'Lille',
    trips: 0,
    fam: 'lumiere-et-energie',
    color: 'm-2c3530',
    zones: ['lid', 'main', 'back'],
  },
  {
    id: 'phone',
    n: 'Téléphone',
    fn: 'comm',
    sh: 'phone',
    gl: 'phone',
    g: 190,
    L: 0.1,
    state: 'stock',
    loc: 'Lille',
    trips: 0,
    fam: 'lumiere-et-energie',
    color: 'm-141916',
    zones: ['hip', 'worn'],
  },
  {
    id: 'laptop',
    n: 'Ordinateur 13 pouces',
    fn: 'laptop',
    sh: 'laptop',
    gl: 'laptop',
    g: 1240,
    L: 1.4,
    state: 'stock',
    loc: 'Lille',
    trips: 0,
    fam: 'lumiere-et-energie',
    color: 'm-3f3b34',
    zones: ['back', 'main'],
  },
  {
    id: 'watch',
    n: 'Montre GPS',
    fn: 'nav',
    sh: 'watch',
    gl: 'watch',
    g: 52,
    L: 0.05,
    state: 'stock',
    loc: 'Lille',
    trips: 0,
    fam: 'lumiere-et-energie',
    color: 'm-1e301c',
    zones: ['worn'],
  },
  {
    id: 'map',
    n: 'Carte IGN',
    fn: 'map',
    sh: 'map',
    gl: 'map',
    g: 95,
    L: 0.3,
    state: 'stock',
    loc: 'Lille',
    trips: 0,
    fam: 'orientation-et-outils',
    color: 'm-e8e2d9',
    zones: ['lid', 'front'],
  },
  {
    id: 'poles-alu',
    n: 'Bâtons alu',
    fn: 'poles',
    sh: 'poles',
    gl: 'poles',
    g: 480,
    L: 1.2,
    state: 'stock',
    loc: 'Lille',
    trips: 29,
    fam: 'orientation-et-outils',
    color: 'm-7a7365',
    zones: ['front', 'worn'],
  },
  {
    id: 'poles-carbon',
    n: 'Bâtons carbone',
    fn: 'poles',
    sh: 'poles',
    gl: 'poles',
    g: 340,
    L: 1.1,
    state: 'stock',
    loc: 'Lille',
    trips: 8,
    fam: 'orientation-et-outils',
    color: 'm-2c3530',
    zones: ['front', 'worn'],
  },
  {
    id: 'knife',
    n: 'Couteau',
    fn: 'tool',
    sh: 'knife',
    gl: 'knife',
    g: 60,
    L: 0.05,
    state: 'stock',
    loc: 'Lille',
    trips: 0,
    cabinBan: 1,
    fam: 'orientation-et-outils',
    color: 'm-5b554a',
    zones: ['hip', 'lid'],
  },
  {
    id: 'glasses',
    n: 'Lunettes cat. 3',
    fn: 'sun',
    sh: 'glasses',
    gl: 'glasses',
    g: 30,
    L: 0.1,
    state: 'stock',
    loc: 'Lille',
    trips: 0,
    fam: 'orientation-et-outils',
    color: 'm-141916',
    zones: ['hip', 'worn', 'lid'],
  },
  {
    id: 'firstaid',
    n: 'Trousse de secours',
    fn: 'firstaid',
    sh: 'box',
    gl: 'aid',
    g: 210,
    L: 0.8,
    state: 'stock',
    loc: 'Lille',
    trips: 0,
    vital: 1,
    expired: 'sept. 2026',
    fam: 'securite-et-soin',
    color: 'm-a8443a',
    zones: ['main', 'lid'],
  },
  {
    id: 'blanket',
    n: 'Couverture de survie',
    fn: 'emergency',
    sh: 'blanket',
    gl: 'blanket',
    g: 60,
    L: 0.1,
    state: 'stock',
    loc: 'Lille',
    trips: 0,
    fam: 'securite-et-soin',
    color: 'm-c9a86a',
    zones: ['lid', 'main'],
  },
  {
    id: 'toilet',
    n: 'Trousse de toilette',
    fn: 'hygiene',
    sh: 'box',
    gl: 'box',
    g: 180,
    L: 0.6,
    state: 'stock',
    loc: 'Lille',
    trips: 0,
    fam: 'securite-et-soin',
    color: 'm-5a8a9a',
    zones: ['main'],
  },
  {
    id: 'sunscreen',
    n: 'Crème solaire 50 ml',
    fn: 'sunscreen',
    sh: 'tube',
    gl: 'tube',
    g: 60,
    L: 0.06,
    state: 'stock',
    loc: 'Lille',
    trips: 0,
    fam: 'securite-et-soin',
    color: 'm-e4c695',
    zones: ['lid', 'hip'],
  },
];

// Maquette Kit_Studio_actuel.html, l.662 : const INV=[
export const FAMILIES: readonly Family[] = [
  {
    id: 'abri-et-couchage',
    n: 'Abri & couchage',
  },
  {
    id: 'vetements',
    n: 'Vêtements',
  },
  {
    id: 'eau-et-cuisine',
    n: 'Eau & cuisine',
  },
  {
    id: 'lumiere-et-energie',
    n: 'Lumière & énergie',
  },
  {
    id: 'orientation-et-outils',
    n: 'Orientation & outils',
  },
  {
    id: 'securite-et-soin',
    n: 'Sécurité & soin',
  },
];

// Maquette Kit_Studio_actuel.html, l.718 : const KITS=[
export const KITS: readonly Kit[] = [
  {
    id: 'tmb',
    n: 'Tour du Mont-Blanc',
    days: 6,
    bag: 'b42',
    cw: 'foret',
    body: 72,
    start: 'Chamonix',
    ctx: '6 jours · 2 532 m · 2 °C au plus bas · pluie 40 %',
    packed: {
      worn: ['shoe-mid', 'merino', 'hat', 'watch'],
      lid: ['headlamp', 'map', 'sunscreen', 'bars'],
      main: ['food', 'gas', 'stove', 'sleep0', 'tent1', 'fleece', 'clothes', 'down', 'firstaid', 'toilet'],
      back: ['bladder'],
      sides: ['bottle'],
      hip: ['phone', 'knife', 'glasses'],
      front: ['poles-alu'],
    },
    slots: {
      food: 'bottomF',
      gas: 'bottomF',
      stove: 'bottom',
      sleep0: 'midBack',
      tent1: 'midFront',
      fleece: 'midFront',
      clothes: 'midFront',
      down: 'top',
      firstaid: 'top',
      toilet: 'top',
    },
    ghosts: [
      {
        fn: 'rainshell',
        zone: 'front',
        gl: 'jacket',
        sh: 'jacket',
        n: 'Veste imperméable',
        why: 'Pluie 40 % annoncée au col de la Seigne',
      },
      {
        fn: 'emergency',
        zone: 'lid',
        gl: 'blanket',
        sh: 'blanket',
        n: 'Couverture de survie',
        why: 'Trois passages au-dessus de 2 500 m',
      },
    ],
    food: {
      perDay: 650,
      carry: 2,
    },
    lineage: {
      from: 'TMB de Marion',
      gen: 3,
      proven: 12,
    },
  },
  {
    id: 'vercors',
    n: 'Week-end Vercors',
    days: 2,
    bag: 'b42',
    cw: 'foret',
    body: 72,
    start: 'Corrençon',
    ctx: '2 jours · 1 960 m · 6 °C au plus bas · sources rares',
    packed: {
      worn: ['shoe-trail', 'merino', 'hat', 'watch'],
      lid: ['headlamp', 'bars', 'sunscreen'],
      main: ['quilt5', 'mat-air', 'tent1', 'stove', 'gas', 'food', 'fleece', 'firstaid'],
      back: ['bladder'],
      sides: ['bottle'],
      hip: ['phone', 'glasses'],
      front: ['poles-carbon'],
    },
    slots: null,
    ghosts: [
      {
        fn: 'watertreat',
        zone: 'sides',
        gl: 'filter',
        sh: 'bottle',
        n: 'Filtre à eau',
        why: 'Aucune source sûre sur 14 km',
      },
    ],
    food: {
      perDay: 650,
      carry: 2,
    },
    lineage: {
      from: null,
      gen: 1,
      proven: 3,
    },
  },
  {
    id: 'cabine',
    n: 'Cabine 7 kg',
    days: 4,
    bag: 'b28',
    cw: 'foret',
    body: 72,
    start: 'Lille',
    cabin: {
      dims: [55, 40, 20],
      kg: 7,
    },
    ctx: '4 jours · Lille → Lisbonne · bagage cabine 55 × 40 × 20 cm',
    packed: {
      worn: ['shoe-trail', 'merino', 'watch', 'phone'],
      lid: ['sunscreen'],
      main: ['clothes', 'fleece', 'down', 'toilet', 'battery'],
      back: ['laptop'],
      sides: ['bottle'],
      hip: ['knife', 'glasses'],
      front: [],
    },
    slots: null,
    ghosts: [],
    food: null,
    lineage: {
      from: null,
      gen: 1,
      proven: 7,
    },
  },
];

// Maquette Kit_Studio_actuel.html, l.739 : const ZONES=[
export const ZONES: readonly Zone[] = [
  {
    id: 'worn',
    n: 'Sur toi',
    th: -1.42,
    ph: 1.36,
    d: 3,
  },
  {
    id: 'bag',
    n: 'Sac',
    th: -0.6,
    ph: 1.2,
    d: 5,
  },
  {
    id: 'lid',
    n: 'Couvercle',
    th: -0.2,
    ph: 0.86,
    d: 3.9,
  },
  {
    id: 'main',
    n: 'Principal',
    th: 0.1,
    ph: 0.98,
    d: 4.3,
  },
  {
    id: 'front',
    n: 'Extérieur',
    th: 0.55,
    ph: 1.28,
    d: 4.2,
  },
  {
    id: 'sides',
    n: 'Côtés',
    th: 1.5,
    ph: 1.3,
    d: 4,
  },
  {
    id: 'hip',
    n: 'Ceinture',
    th: 2.3,
    ph: 1.36,
    d: 3.9,
  },
  {
    id: 'back',
    n: 'Dos',
    th: 3.1,
    ph: 1.22,
    d: 4.3,
  },
];

// Maquette Kit_Studio_actuel.html, l.739 : const ZONES=[
export const ZONE_IDS: readonly ZoneId[] = ['worn', 'bag', 'lid', 'main', 'front', 'sides', 'hip', 'back'];

// Maquette Kit_Studio_actuel.html, l.750 : const ZIDS=
export const PACK_ZONE_IDS: readonly PackZoneId[] = ['worn', 'lid', 'main', 'front', 'sides', 'hip', 'back'];

// Maquette Kit_Studio_actuel.html, l.751 : const ZNAME=
export const ZONE_NAMES: Readonly<Record<PackZoneId, string>> = {
  worn: 'Sur toi',
  lid: 'Couvercle',
  main: 'Principal',
  front: 'Extérieur',
  sides: 'Côtés',
  hip: 'Ceinture',
  back: 'Dos',
};

// Maquette Kit_Studio_actuel.html, l.752 : const ANCH=
export const ANCHORS: Readonly<Partial<Record<ZoneId, Vec3>>> = {
  bag: [0, 0, 0],
  lid: [0, 0.86, 0.04],
  main: [0, 0.32, 0.04],
  front: [0, -0.15, 0.34],
  sides: [0.45, -0.42, 0.02],
  hip: [0.5, -0.6, -0.12],
  back: [0, 0.1, -0.36],
};

// Maquette Kit_Studio_actuel.html, l.704 : const ALT=
export const ALTERNATIVES: Readonly<Record<string, readonly Alternative[]>> = {
  rainshell: [
    {
      id: 's-poncho',
      n: 'Poncho imperméable',
      src: 'shop',
      g: 150,
      eur: 12,
      sh: 'jacket',
      gl: 'jacket',
      color: 'm-4b6b7c',
    },
    {
      id: 'r-gtx',
      n: 'Veste Gore-Tex · Annecy',
      src: 'rent',
      g: 420,
      day: 4,
      sh: 'jacket',
      gl: 'jacket',
      color: 'm-1f4251',
    },
  ],
  light: [
    {
      id: 's-spot',
      n: 'Black Diamond Spot 400',
      src: 'shop',
      g: 90,
      eur: 75,
      sh: 'lamp',
      gl: 'lamp',
      color: 'm-141916',
    },
  ],
  tool: [
    {
      id: 's-opinel',
      n: 'Opinel n°8',
      src: 'shop',
      g: 100,
      eur: 18,
      sh: 'knife',
      gl: 'knife',
      color: 'm-7a7365',
    },
  ],
  poles: [
    {
      id: 's-aktive',
      n: 'Bâton télescopique alu',
      src: 'shop',
      g: 250,
      eur: 28,
      sh: 'poles',
      gl: 'poles',
      color: 'm-968c81',
    },
  ],
  firstaid: [
    {
      id: 's-aid44',
      n: 'Trousse 44 pièces',
      src: 'shop',
      g: null,
      eur: 22,
      sh: 'box',
      gl: 'aid',
      color: 'm-a8443a',
    },
  ],
  water: [
    {
      id: 's-gourde',
      n: 'Gourde acier 750 ml',
      src: 'shop',
      g: 200,
      eur: 14,
      sh: 'bottle',
      gl: 'bottle',
      color: 'm-b5aba0',
    },
  ],
  power: [
    {
      id: 's-pb',
      n: 'Batterie externe',
      src: 'shop',
      g: 200,
      eur: 35,
      sh: 'box',
      gl: 'battery',
      color: 'm-2c3530',
    },
  ],
  sunscreen: [
    {
      id: 's-nivea',
      n: 'Écran SPF 50 · 50 ml',
      src: 'shop',
      g: 60,
      eur: 12,
      sh: 'tube',
      gl: 'tube',
      color: 'm-e4c695',
    },
  ],
  shelter: [
    {
      id: 'r-ul',
      n: 'Tente UL 1 place · Annecy',
      src: 'rent',
      g: 980,
      day: 6,
      sh: 'roll',
      gl: 'tent',
      color: 'm-3d6038',
    },
  ],
  sleep: [
    {
      id: 'r-10',
      n: 'Duvet −10 °C · Grenoble',
      src: 'rent',
      g: 1300,
      day: 5,
      sh: 'roll',
      gl: 'roll',
      color: 'm-10222b',
    },
  ],
  emergency: [],
  watertreat: [],
};

// Maquette Kit_Studio_actuel.html, l.649 : function preset(
export const PRESETS: Readonly<Record<ColorwayId, ConfigSet>> = {
  foret: {
    body: {
      shape: 'classic',
      mat: 'xpac',
      col: 'm-2d482a',
      fin: 'mat',
    },
    lid: {
      shape: 'std',
      mat: 'xpac',
      col: 'm-2d482a',
      fin: 'mat',
    },
    front: {
      shape: 'zip',
      mat: 'xpac',
      col: 'm-3d6038',
      fin: 'satin',
    },
    sides: {
      shape: 'std',
      mat: 'cordura',
      col: 'm-3d6038',
      fin: 'satin',
    },
    hip: {
      shape: 'padded',
      col: 'm-1e301c',
      fin: 'mat',
    },
    harness: {
      shape: 'std',
      col: 'm-1e301c',
      fin: 'mat',
    },
    webbing: {
      col: 'm-1e301c',
      fin: 'satin',
    },
    accent: 'm-9bbda7',
    acc: [],
  },
  sauge: {
    body: {
      shape: 'classic',
      mat: 'xpac',
      col: 'm-789972',
      fin: 'mat',
    },
    lid: {
      shape: 'std',
      mat: 'xpac',
      col: 'm-789972',
      fin: 'mat',
    },
    front: {
      shape: 'zip',
      mat: 'xpac',
      col: 'm-96b391',
      fin: 'satin',
    },
    sides: {
      shape: 'std',
      mat: 'cordura',
      col: 'm-96b391',
      fin: 'satin',
    },
    hip: {
      shape: 'padded',
      col: 'm-3d6038',
      fin: 'mat',
    },
    harness: {
      shape: 'std',
      col: 'm-3d6038',
      fin: 'mat',
    },
    webbing: {
      col: 'm-3d6038',
      fin: 'satin',
    },
    accent: 'm-f0f5ee',
    acc: [],
  },
  pierre: {
    body: {
      shape: 'classic',
      mat: 'xpac',
      col: 'm-b5aba0',
      fin: 'mat',
    },
    lid: {
      shape: 'std',
      mat: 'xpac',
      col: 'm-b5aba0',
      fin: 'mat',
    },
    front: {
      shape: 'zip',
      mat: 'xpac',
      col: 'm-d4ccc0',
      fin: 'satin',
    },
    sides: {
      shape: 'std',
      mat: 'cordura',
      col: 'm-d4ccc0',
      fin: 'satin',
    },
    hip: {
      shape: 'padded',
      col: 'm-5b554a',
      fin: 'mat',
    },
    harness: {
      shape: 'std',
      col: 'm-5b554a',
      fin: 'mat',
    },
    webbing: {
      col: 'm-5b554a',
      fin: 'satin',
    },
    accent: 'm-2d482a',
    acc: [],
  },
  nuit: {
    body: {
      shape: 'classic',
      mat: 'xpac',
      col: 'm-1f4251',
      fin: 'mat',
    },
    lid: {
      shape: 'std',
      mat: 'xpac',
      col: 'm-1f4251',
      fin: 'mat',
    },
    front: {
      shape: 'zip',
      mat: 'xpac',
      col: 'm-2a5a6e',
      fin: 'satin',
    },
    sides: {
      shape: 'std',
      mat: 'cordura',
      col: 'm-2a5a6e',
      fin: 'satin',
    },
    hip: {
      shape: 'padded',
      col: 'm-10222b',
      fin: 'mat',
    },
    harness: {
      shape: 'std',
      col: 'm-10222b',
      fin: 'mat',
    },
    webbing: {
      col: 'm-10222b',
      fin: 'satin',
    },
    accent: 'm-a8c8d4',
    acc: [],
  },
};

// Maquette Kit_Studio_actuel.html, l.649 : function preset(
/** Configuration par défaut d'un coloris (fonction pure, lecture seule). */
export function preset(cw: ColorwayId): ConfigSet {
  return PRESETS[cw];
}

// Maquette Kit_Studio_actuel.html, l.650 : const CFG=
export const DEFAULT_CONFIG: Readonly<Record<BagId, ConfigSet>> = {
  b42: {
    body: {
      shape: 'classic',
      mat: 'xpac',
      col: 'm-2d482a',
      fin: 'mat',
    },
    lid: {
      shape: 'std',
      mat: 'xpac',
      col: 'm-2d482a',
      fin: 'mat',
    },
    front: {
      shape: 'zip',
      mat: 'xpac',
      col: 'm-3d6038',
      fin: 'satin',
    },
    sides: {
      shape: 'std',
      mat: 'cordura',
      col: 'm-3d6038',
      fin: 'satin',
    },
    hip: {
      shape: 'padded',
      col: 'm-1e301c',
      fin: 'mat',
    },
    harness: {
      shape: 'std',
      col: 'm-1e301c',
      fin: 'mat',
    },
    webbing: {
      col: 'm-1e301c',
      fin: 'satin',
    },
    accent: 'm-9bbda7',
    acc: [],
  },
  b28: {
    body: {
      shape: 'classic',
      mat: 'xpac',
      col: 'm-2d482a',
      fin: 'mat',
    },
    lid: {
      shape: 'std',
      mat: 'xpac',
      col: 'm-2d482a',
      fin: 'mat',
    },
    front: {
      shape: 'zip',
      mat: 'xpac',
      col: 'm-3d6038',
      fin: 'satin',
    },
    sides: {
      shape: 'std',
      mat: 'cordura',
      col: 'm-3d6038',
      fin: 'satin',
    },
    hip: {
      shape: 'padded',
      col: 'm-1e301c',
      fin: 'mat',
    },
    harness: {
      shape: 'std',
      col: 'm-1e301c',
      fin: 'mat',
    },
    webbing: {
      col: 'm-1e301c',
      fin: 'satin',
    },
    accent: 'm-9bbda7',
    acc: [],
  },
};
