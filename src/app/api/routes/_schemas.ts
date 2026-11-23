import { z } from 'zod';
import type { RouteOperationInput } from '@/features/route-collab/types';

/**
 * Schémas zod partagés des routes `/api/routes/*` (CLAUDE.md §2 : toute entrée est validée à la réception).
 *
 * - Coordonnées bornées (lat ±90, lon ±180), longueurs et nombres d'éléments bornés, enums fermés.
 * - Les objets d'entité ignorent (suppriment) les clés inconnues : rien d'inattendu n'atteint la base.
 *   Si un champ est ajouté à `CollaborativeRoutePoint` / `Section` / `Stage` / `KitItem` ou à une
 *   opération de `RouteOperationInput`, l'ajouter ici aussi, sinon il est retiré à la réception.
 * - `RouteOperationSchema` est l'union discriminée (`type`) de toutes les opérations de `types.ts`.
 */

export const IdSchema = z.string().min(1).max(80);
const LatSchema = z.number().min(-90).max(90);
const LonSchema = z.number().min(-180).max(180);
const ShortText = z.string().max(200);
const IsoText = z.string().max(40);

/** Corps JSON maximal accepté avant analyse (la base plafonne l'instantané à 5 Mo). */
export const MAX_BODY_CHARS = 2_500_000;
/** Taille maximale (JSON) de l'état initial d'un itinéraire. */
export const MAX_INITIAL_WORKSPACE_CHARS = 2_000_000;
/** Taille maximale (JSON) d'une opération ou d'une proposition (la base plafonne le payload à 200 Ko). */
export const MAX_OPERATION_CHARS = 190_000;
export const MAX_IMPORT_OPERATION_CHARS = 1_900_000;

export const SportSchema = z.enum(['marche', 'route', 'gravel', 'vtt', 'enduro']);
export const ShapeModeSchema = z.enum(['one_way', 'loop', 'out_and_back']);
const PointKindSchema = z.enum(['start', 'via', 'stop', 'stage_boundary', 'finish']);
const SectionModeSchema = z.enum(['routed', 'manual', 'imported_preserved']);
const SemanticKindSchema = z.enum([
  'waypoint',
  'water',
  'bivouac',
  'viewpoint',
  'danger',
  'access',
  'summit',
  'refuge',
  'custom',
]);

export const RoutingOptionsSchema = z.object({
  ebike: z.boolean().optional(),
  surfacePref: z.enum(['balanced', 'prefer_paved', 'prefer_unpaved', 'prefer_trails']).optional(),
  avoidSteps: z.boolean().optional(),
  avoidFerries: z.boolean().optional(),
});

const GeometrySchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([LonSchema, LatSchema])).max(20_000),
});

const SectionProvenanceSchema = z.object({
  provider: ShortText.nullable(),
  providerVersion: ShortText.nullish(),
  calculatedAt: IsoText.nullable(),
  profile: ShortText.nullable(),
  confidence: z.enum(['verified', 'estimated', 'unknown']),
});

const SurfaceSegmentSchema = z.object({
  fromRatio: z.number().min(0).max(1),
  toRatio: z.number().min(0).max(1),
  surface: z.enum(['paved', 'unpaved', 'trail', 'rock', 'unknown']),
  source: ShortText.nullish(),
});

const ElevationSamplesSchema = z.array(z.number().min(-1000).max(10_000).nullable()).max(20_000);

export const PointSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema.optional(),
  kind: PointKindSchema,
  orderKey: z.string().min(1).max(40),
  lat: LatSchema,
  lon: LonSchema,
  eleM: z.number().min(-1000).max(10_000).nullish(),
  name: ShortText.nullish(),
  semanticKind: SemanticKindSchema.optional(),
  note: z.string().max(2000).nullish(),
  entityVersion: z.number().int().min(1).max(1_000_000_000),
  deletedAt: IsoText.nullish(),
});

export const SectionSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema.optional(),
  fromPointId: IdSchema,
  toPointId: IdSchema,
  mode: SectionModeSchema,
  geometry: GeometrySchema,
  distanceKm: z.number().min(0).max(100_000),
  durationMin: z.number().min(0).max(10_000_000).nullable(),
  ascentM: z.number().min(0).max(1_000_000).nullable(),
  descentM: z.number().min(0).max(1_000_000).nullable(),
  elevationSamples: ElevationSamplesSchema.optional(),
  surfaceSegments: z.array(SurfaceSegmentSchema).max(2000),
  routingInputHash: z.string().max(200).nullable(),
  pendingFingerprint: z.string().max(200).nullish(),
  provenance: SectionProvenanceSchema,
  warnings: z.array(z.string().max(300)).max(50),
  entityVersion: z.number().int().min(1).max(1_000_000_000),
});

export const OvernightPlaceSchema = z.object({
  id: IdSchema,
  name: ShortText,
  type: z.enum(['refuge', 'hut', 'bivouac', 'camp', 'gite', 'hotel']),
  lat: LatSchema,
  lon: LonSchema,
  bookingStatus: z.enum(['planned', 'confirmed', 'unknown']),
  openingInfo: z.string().max(500).nullish(),
  provenance: ShortText,
  lastVerifiedAt: IsoText.nullable(),
  priceHint: z
    .object({
      perPerson: z.number().min(0).max(100_000),
      currency: z.string().max(8),
      basis: z.enum(['bareme', 'partenaire']),
      asOf: IsoText,
    })
    .nullish(),
});

const WaterObservationSchema = z.object({
  id: IdSchema,
  pointId: IdSchema.nullish(),
  name: ShortText,
  lat: LatSchema,
  lon: LonSchema,
  status: z.enum(['flowing', 'dry', 'unknown']),
  potableClaim: z.enum(['yes', 'no', 'unknown']),
  observedAt: IsoText.nullable(),
  source: z.enum(['user', 'official', 'external', 'osm']),
});

const WeatherSliceSchema = z.object({
  pointId: IdSchema,
  locationLabel: ShortText,
  forecastFor: IsoText,
  fetchedAt: IsoText.nullable(),
  provider: ShortText.nullable(),
  temperatureC: z.number().min(-100).max(100).nullable(),
  precipitationProbability: z.number().min(0).max(100).nullable(),
  windKph: z.number().min(0).max(1000).nullable(),
  status: z.enum(['fresh', 'stale', 'unavailable']),
});

const HazardSchema = z.object({
  id: IdSchema,
  title: ShortText,
  type: z.enum(['closure', 'weather_alert', 'terrain', 'access']),
  severitySource: ShortText,
  observedAt: IsoText,
  expiresAt: IsoText.nullable(),
  source: ShortText,
});

export const StageSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema.optional(),
  orderKey: z.string().min(1).max(40),
  dayNumber: z.number().int().min(1).max(400),
  kind: z.enum(['walk', 'rest', 'short']).optional(),
  title: z.string().max(160),
  dateIso: z.string().max(32).nullable(),
  departureTimeLocal: z.string().max(16),
  timezone: z.string().max(64),
  startPointId: IdSchema,
  endPointId: IdSchema,
  overnightPlace: OvernightPlaceSchema.nullable(),
  notes: z.string().max(5000),
  waterObservations: z.array(WaterObservationSchema).max(100),
  weatherSlice: WeatherSliceSchema.nullable(),
  hazards: z.array(HazardSchema).max(100),
  entityVersion: z.number().int().min(1).max(1_000_000_000),
});

export const KitItemSchema = z.object({
  id: IdSchema,
  inventoryItemId: IdSchema.nullish(),
  name: ShortText,
  category: z.string().max(60),
  weightGrams: z.number().min(0).max(1_000_000).nullable(),
  quantity: z.number().int().min(0).max(1000),
  shared: z.boolean(),
  assigneeUserId: z.string().max(120).nullable(),
  assigneeName: z.string().max(120).nullable(),
  dependsOn: z.array(z.enum(['overnight', 'water', 'weather', 'duration', 'distance'])).max(5),
  status: z.enum(['confirmed', 'needs_revalidation', 'unassigned']),
  revalidationReason: z.string().max(500).nullish(),
});

export const SourceOriginSchema = z.object({
  kind: z.enum(['blank', 'explorer_route', 'gpx_import', 'activity_replay']),
  sourceId: z.string().max(200).nullish(),
  sourceTitle: z.string().max(200).nullish(),
  sourceUrl: z.string().max(2000).nullish(),
  importedAt: IsoText.nullish(),
  originalGpxXml: z.string().max(1_500_000).nullish(),
  attribution: z.string().max(500).nullish(),
});

const MemberSchema = z.object({
  userId: z.string().min(1).max(120),
  displayName: z.string().max(120),
  role: z.enum(['owner', 'co_organizer', 'editor', 'contributor', 'participant', 'external_viewer']),
  delegatedPublish: z.boolean().optional(),
  stageScopeIds: z.array(IdSchema).max(200).optional(),
  revokedAt: IsoText.nullish(),
});

/** Éléments de listes libres (variantes, propositions, commentaires) : objets avec identifiant, bornés. */
const FreeItemSchema = z.object({ id: z.string().min(1).max(120) }).passthrough();

/**
 * État initial fourni à la création d'un itinéraire. Les clés racine inconnues (status, headSeq,
 * shareLink, révisions…) sont ignorées : le serveur les réinitialise.
 */
export const InitialWorkspaceSchema = z.object({
  tripId: z.string().max(80).optional(),
  shapeMode: ShapeModeSchema.optional(),
  routingOptions: RoutingOptionsSchema.optional(),
  sourceOrigin: SourceOriginSchema.optional(),
  clubEventId: z.string().max(80).nullish(),
  points: z.array(PointSchema).max(5000).optional(),
  sections: z.array(SectionSchema).max(5000).optional(),
  stages: z.array(StageSchema).max(400).optional(),
  variants: z.array(FreeItemSchema).max(200).optional(),
  proposals: z.array(FreeItemSchema).max(200).optional(),
  comments: z.array(FreeItemSchema).max(500).optional(),
  kitItems: z.array(KitItemSchema).max(1000).optional(),
  members: z.array(MemberSchema).max(100).optional(),
});

/* ---------- Opérations (union discriminée de RouteOperationInput) ---------- */

const VariantReplacementSchema = z.object({
  sectionId: IdSchema,
  geometry: GeometrySchema,
  distanceKm: z.number().min(0).max(100_000),
  durationMin: z.number().min(0).max(10_000_000).nullable(),
  ascentM: z.number().min(0).max(1_000_000).nullable(),
  descentM: z.number().min(0).max(1_000_000).nullable(),
  surfaceKnownRatio: z.number().min(0).max(1),
  provenance: SectionProvenanceSchema,
});

const VariantSchema = z.object({
  id: IdSchema,
  baseRevisionNo: z.number().int().min(0),
  scope: z.enum(['section', 'stage', 'route']),
  title: z.string().max(160),
  replacements: z.array(VariantReplacementSchema).max(200),
  deltaDistanceKm: z.number().min(-100_000).max(100_000),
  deltaAscentM: z.number().min(-1_000_000).max(1_000_000).nullable(),
  deltaDurationMin: z.number().min(-10_000_000).max(10_000_000).nullable(),
  status: z.enum(['draft', 'proposed', 'accepted', 'rejected']),
  createdBy: z.string().max(120),
  createdAt: IsoText,
});

const NullableName = ShortText.nullish();

export const RouteOperationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('move_point'),
    pointId: IdSchema,
    lat: LatSchema,
    lon: LonSchema,
    eleM: z.number().min(-1000).max(10_000).nullish(),
  }),
  z.object({
    type: z.literal('insert_point'),
    pointId: IdSchema,
    afterPointId: IdSchema.nullable(),
    lat: LatSchema,
    lon: LonSchema,
    kind: PointKindSchema.optional(),
    name: NullableName,
    semanticKind: SemanticKindSchema.optional(),
  }),
  z.object({ type: z.literal('delete_point'), pointId: IdSchema }),
  z.object({ type: z.literal('reverse_route') }),
  z.object({ type: z.literal('set_shape_mode'), shapeMode: ShapeModeSchema }),
  z.object({
    type: z.literal('set_section_mode'),
    sectionId: IdSchema,
    mode: SectionModeSchema,
    geometry: GeometrySchema.optional(),
  }),
  z.object({
    type: z.literal('apply_routing_result'),
    sectionId: IdSchema,
    routingInputHash: z.string().min(1).max(200),
    geometry: GeometrySchema,
    distanceKm: z.number().min(0).max(100_000),
    durationMin: z.number().min(0).max(10_000_000).nullable(),
    ascentM: z.number().min(0).max(1_000_000).nullable(),
    descentM: z.number().min(0).max(1_000_000).nullable(),
    elevationSamples: ElevationSamplesSchema.optional(),
    surfaceSegments: z.array(SurfaceSegmentSchema).max(2000).optional(),
    provenance: SectionProvenanceSchema,
  }),
  z.object({
    type: z.literal('split_days'),
    targetDays: z.number().int().min(1).max(60),
    timezone: z.string().max(64).optional(),
  }),
  z.object({ type: z.literal('move_day_boundary'), stageId: IdSchema, newEndPointId: IdSchema }),
  z.object({ type: z.literal('update_stage_note'), stageId: IdSchema, notes: z.string().max(5000) }),
  z.object({
    type: z.literal('set_overnight'),
    stageId: IdSchema,
    overnightPlace: OvernightPlaceSchema.nullable(),
  }),
  z.object({
    type: z.literal('set_sport_profile'),
    sport: SportSchema,
    routingOptions: RoutingOptionsSchema,
  }),
  z.object({ type: z.literal('add_variant'), variant: VariantSchema }),
  z.object({ type: z.literal('apply_variant'), variantId: IdSchema }),
  z.object({
    type: z.literal('revert_to_seq'),
    targetSeq: z.number().int().min(0),
    reason: z.string().max(500),
    revisionId: z.string().max(200).optional(),
  }),
  z.object({
    type: z.literal('update_point'),
    pointId: IdSchema,
    name: NullableName,
    note: z.string().max(2000).nullish(),
  }),
  z.object({
    type: z.literal('split_section'),
    sectionId: IdSchema,
    pointId: IdSchema,
    lat: LatSchema,
    lon: LonSchema,
    name: NullableName,
  }),
  z.object({ type: z.literal('merge_sections'), sectionId: IdSchema, withSectionId: IdSchema }),
  z.object({
    type: z.literal('cut_stage_at'),
    stageId: IdSchema,
    pointId: IdSchema,
    lat: LatSchema,
    lon: LonSchema,
    name: NullableName,
  }),
  z.object({
    type: z.literal('apply_stage_split'),
    cuts: z
      .array(
        z.object({
          pointId: IdSchema,
          lat: LatSchema,
          lon: LonSchema,
          name: NullableName,
          overnightPlace: OvernightPlaceSchema.nullable(),
        }),
      )
      .max(120),
  }),
  z.object({
    type: z.literal('set_stage_schedule'),
    stageId: IdSchema,
    departureTimeLocal: z.string().max(16).optional(),
    dateIso: z.string().max(32).nullish(),
    timezone: z.string().max(64).optional(),
    chainFollowing: z.boolean().optional(),
  }),
  z.object({ type: z.literal('insert_rest_day'), afterStageId: IdSchema, stageId: IdSchema }),
  z.object({
    type: z.literal('insert_short_stage'),
    afterStageId: IdSchema,
    stageId: IdSchema,
    turnaroundPointId: IdSchema,
    returnPointId: IdSchema,
    lat: LatSchema,
    lon: LonSchema,
    name: NullableName,
  }),
  z.object({ type: z.literal('remove_stage'), stageId: IdSchema }),
  z.object({
    type: z.literal('import_track'),
    points: z.array(PointSchema).max(5000),
    sections: z.array(SectionSchema).max(5000),
    sourceOrigin: SourceOriginSchema,
  }),
]);

/** Type des opérations validées : vérifié à la compilation contre `RouteOperationInput`. */
type ParsedOperation = z.infer<typeof RouteOperationSchema>;
type OperationTypes = RouteOperationInput['type'];
// Chaque type d'opération du domaine doit exister dans le schéma, et réciproquement.
type _SchemaCoversDomain = Exclude<OperationTypes, ParsedOperation['type']> extends never ? true : never;
type _DomainCoversSchema = Exclude<ParsedOperation['type'], OperationTypes> extends never ? true : never;
export const OPERATION_SCHEMA_IS_EXHAUSTIVE: [_SchemaCoversDomain, _DomainCoversSchema] = [true, true];

/** Limite de taille (JSON) selon le type d'opération : `import_track` embarque toute la trace. */
export function operationSizeLimit(type: string): number {
  return type === 'import_track' ? MAX_IMPORT_OPERATION_CHARS : MAX_OPERATION_CHARS;
}

/** Lit un corps JSON de taille bornée ; `null` si trop gros ou invalide. */
export async function readBoundedJson(
  request: Request,
  maxChars: number = MAX_BODY_CHARS,
): Promise<{ ok: true; body: unknown } | { ok: false; status: 400 | 413; error: string }> {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { ok: false, status: 400, error: 'Corps de requête illisible.' };
  }
  if (raw.length > maxChars) return { ok: false, status: 413, error: 'Requête trop volumineuse.' };
  try {
    return { ok: true, body: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, status: 400, error: 'JSON invalide.' };
  }
}
