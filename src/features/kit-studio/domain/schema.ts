// Schéma zod de KitState (version 1). Les ids énumérés viennent de catalog.ts / palette.ts.
// Toute donnée venant du disque passe par parseKitState : invalide → null, jamais d'exception.
import { z } from 'zod';
import { MODULE_IDS, ZONE_IDS, PACK_ZONE_IDS } from './catalog';
import type {
  AccessoryId, BagId, ColorwayId, FinishId, KitId, MaterialId, ModuleId, PackZoneId, ZoneId,
} from './catalog';
import { RAW_MATERIALS } from './palette';
import type { MaterialKey } from './palette';
import type { KitState, PieceKey } from './types';

const tuple = <T extends string>(xs: readonly T[]): [T, ...T[]] => xs as unknown as [T, ...T[]];

const KitIdS = z.enum(tuple<KitId>(['tmb', 'vercors', 'cabine']));
const BagIdS = z.enum(tuple<BagId>(['b42', 'b28', 'lkdv-one-15', 'lkdv-one-25', 'lkdv-one-45', 'lkdv-one-60', 'lkdv-one-80']));
const ColorwayS = z.enum(tuple<ColorwayId>(['foret', 'sauge', 'pierre', 'nuit']));
const MaterialKeyS = z.enum(tuple<MaterialKey>(Object.keys(RAW_MATERIALS) as MaterialKey[]));
const MaterialIdS = z.enum(tuple<MaterialId>(['ripstop', 'cordura', 'dcf', 'xpac', 'waxed']));
const FinishS = z.enum(tuple<FinishId>(['mat', 'satin', 'gloss', 'heather']));
const AccessoryS = z.enum(tuple<AccessoryId>(['cover', 'reflect', 'daisy', 'axe', 'compress', 'spocket', 'sbottle', 'biner']));
const ZoneS = z.enum(tuple<ZoneId>(ZONE_IDS));
const PackZoneS = z.enum(tuple<PackZoneId>(PACK_ZONE_IDS));
const PieceKeyS = z.enum(tuple<PieceKey>([
  'chassis',
  'corps:b42',
  'corps:b28',
  'corps:lkdv-one-15',
  'corps:lkdv-one-25',
  'corps:lkdv-one-45',
  'corps:lkdv-one-60',
  'corps:lkdv-one-80',
  ...MODULE_IDS.map((m: ModuleId): PieceKey => `mod:${m}`),
]));

const PartConfigS = z.object({
  shape: z.string().optional(),
  mat: MaterialIdS.optional(),
  col: MaterialKeyS.optional(),
  fin: FinishS.optional(),
});

const ConfigSetS = z.object({
  body: PartConfigS, lid: PartConfigS, front: PartConfigS, sides: PartConfigS,
  hip: PartConfigS, harness: PartConfigS, webbing: PartConfigS,
  accent: MaterialKeyS,
  acc: z.array(AccessoryS),
});

const LiveKitS = z.object({
  id: KitIdS,
  n: z.string(),
  days: z.number().int().min(1),
  bag: BagIdS,
  cw: ColorwayS,
  body: z.number(),
  start: z.string(),
  ctx: z.string(),
  cabin: z.object({ dims: z.array(z.number()), kg: z.number() }).optional(),
  packed: z.record(PackZoneS, z.array(z.string())),
  slots: z.record(z.string(), z.string()).nullable(),
  ghosts: z.array(z.object({ fn: z.string(), zone: ZoneS, gl: z.string(), sh: z.string(), n: z.string(), why: z.string() })),
  food: z.object({ perDay: z.number(), carry: z.number() }).nullable(),
  lineage: z.object({ from: z.string().nullable(), gen: z.number(), proven: z.number() }),
});

const ExtraItemS = z.object({
  id: z.string(), n: z.string(), fam: z.string(), fn: z.string(), sh: z.string(), gl: z.string(),
  g: z.number(), L: z.number(), color: MaterialKeyS, zones: z.array(ZoneS),
  state: z.string(), loc: z.string(), trips: z.number(),
  planned: z.enum(['shop', 'rent']).optional(),
  eur: z.number().optional(),
  day: z.number().optional(),
});

export const KitStateSchema = z.object({
  version: z.literal(1),
  kitId: KitIdS,
  kits: z.object({ tmb: LiveKitS, vercors: LiveKitS, cabine: LiveKitS }),
  config: z.record(BagIdS, ConfigSetS),
  day: z.number().int().min(1),
  own: z.partialRecord(PieceKeyS, ColorwayS),
  order: z.partialRecord(PieceKeyS, ColorwayS),
  extraItems: z.array(ExtraItemS),
}).refine((s) => s.day <= s.kits[s.kitId].days, { message: 'day hors du kit' });

/** Valide une donnée inconnue. Renvoie un KitState ou null (jamais d'exception). */
export function parseKitState(raw: unknown): KitState | null {
  try {
    const r = KitStateSchema.safeParse(raw);
    return r.success ? (r.data as unknown as KitState) : null;
  } catch {
    return null;
  }
}
