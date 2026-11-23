import { z } from 'zod';
import type {
  CollaborativeKitItem,
  CollaborativeRoutePoint,
  CollaborativeRouteSection,
  CollaborativeStage,
  OvernightPlace,
  RouteComment,
  RouteMemberAccess,
  RouteOperationInput,
  RouteProposal,
  RouteSourceOrigin,
  RouteVariant,
} from '@/features/route-collab/types';

/**
 * Schémas zod partagés des routes `/api/routes/*` (CLAUDE.md §2 : toute entrée est validée à la réception).
 *
 * - Coordonnées bornées (lat ±90, lon ±180), longueurs et nombres d'éléments bornés, enums fermés.
 * - Les objets d'entité et d'opération sont STRICTS (`z.strictObject`) : une clé inconnue est REFUSÉE (400),
 *   jamais supprimée en silence. Si un champ est ajouté à `CollaborativeRoutePoint` / `Section` / `Stage` /
 *   `KitItem` / `RouteComment` / `RouteProposal` ou à une opération de `RouteOperationInput`, l'ajouter ici
 *   aussi : les assertions de type en bas de fichier cassent `tsc` tant que ce n'est pas fait.
 *   Deux exceptions volontaires, qui SUPPRIMENT les clés inconnues : (1) la racine de `InitialWorkspaceSchema` :
 *   le client envoie l'état complet de l'espace (id, title, status, headSeq, shareLink, révisions…, voir
 *   `startPersist.persistBody`) et le serveur réinitialise ces clés ; (2) `GeometrySchema` : `RouteGeometry`
 *   porte une signature d'index (`[key: string]: unknown`, champs d'un fournisseur de routage).
 * - Plafonds alignés sur la base (`route_snapshot_within_caps`, refus `snapshot_too_large`) : 2 000 points,
 *   2 000 tronçons, 60 étapes, 80 000 coordonnées au total.
 * - `RouteOperationSchema` est l'union discriminée (`type`) de toutes les opérations de `types.ts`.
 */

/** Plafonds du tracé (miroir de route_snapshot_within_caps en base). */
export const MAX_POINTS = 2000;
export const MAX_SECTIONS = 2000;
export const MAX_STAGES = 60;
export const MAX_TOTAL_COORDINATES = 80_000;

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

export const RoutingOptionsSchema = z.strictObject({
  ebike: z.boolean().optional(),
  surfacePref: z.enum(['balanced', 'prefer_paved', 'prefer_unpaved', 'prefer_trails']).optional(),
  avoidSteps: z.boolean().optional(),
  avoidFerries: z.boolean().optional(),
});

const GeometrySchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([LonSchema, LatSchema])).max(20_000),
});

const SectionProvenanceSchema = z.strictObject({
  provider: ShortText.nullable(),
  providerVersion: ShortText.nullish(),
  calculatedAt: IsoText.nullable(),
  profile: ShortText.nullable(),
  confidence: z.enum(['verified', 'estimated', 'unknown']),
});

const SurfaceSegmentSchema = z.strictObject({
  fromRatio: z.number().min(0).max(1),
  toRatio: z.number().min(0).max(1),
  surface: z.enum(['paved', 'unpaved', 'trail', 'rock', 'unknown']),
  source: ShortText.nullish(),
});

const ElevationSamplesSchema = z.array(z.number().min(-1000).max(10_000).nullable()).max(20_000);

export const PointSchema = z.strictObject({
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

export const SectionSchema = z.strictObject({
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

export const OvernightPlaceSchema = z.strictObject({
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

const WaterObservationSchema = z.strictObject({
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

const WeatherSliceSchema = z.strictObject({
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

const HazardSchema = z.strictObject({
  id: IdSchema,
  title: ShortText,
  type: z.enum(['closure', 'weather_alert', 'terrain', 'access']),
  severitySource: ShortText,
  observedAt: IsoText,
  expiresAt: IsoText.nullable(),
  source: ShortText,
});

export const StageSchema = z.strictObject({
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

export const KitItemSchema = z.strictObject({
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

export const SourceOriginSchema = z.strictObject({
  kind: z.enum(['blank', 'explorer_route', 'gpx_import', 'activity_replay']),
  sourceId: z.string().max(200).nullish(),
  sourceTitle: z.string().max(200).nullish(),
  sourceUrl: z.string().max(2000).nullish(),
  importedAt: IsoText.nullish(),
  originalGpxXml: z.string().max(1_500_000).nullish(),
  attribution: z.string().max(500).nullish(),
});

const MemberSchema = z.strictObject({
  userId: z.string().min(1).max(120),
  displayName: z.string().max(120),
  role: z.enum(['owner', 'co_organizer', 'editor', 'contributor', 'participant', 'external_viewer']),
  delegatedPublish: z.boolean().optional(),
  stageScopeIds: z.array(IdSchema).max(200).optional(),
  revokedAt: IsoText.nullish(),
});

/* ---------- Opérations (union discriminée de RouteOperationInput) ---------- */

const VariantReplacementSchema = z.strictObject({
  sectionId: IdSchema,
  geometry: GeometrySchema,
  distanceKm: z.number().min(0).max(100_000),
  durationMin: z.number().min(0).max(10_000_000).nullable(),
  ascentM: z.number().min(0).max(1_000_000).nullable(),
  descentM: z.number().min(0).max(1_000_000).nullable(),
  surfaceKnownRatio: z.number().min(0).max(1),
  provenance: SectionProvenanceSchema,
});

const VariantSchema = z.strictObject({
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

function totalCoordinates(sections: ReadonlyArray<{ geometry: { coordinates: unknown[] } }> | undefined): number {
  let n = 0;
  for (const sec of sections ?? []) n += sec.geometry.coordinates.length;
  return n;
}

export const RouteOperationSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('move_point'),
    pointId: IdSchema,
    lat: LatSchema,
    lon: LonSchema,
    eleM: z.number().min(-1000).max(10_000).nullish(),
  }),
  z.strictObject({
    type: z.literal('insert_point'),
    pointId: IdSchema,
    afterPointId: IdSchema.nullable(),
    lat: LatSchema,
    lon: LonSchema,
    kind: PointKindSchema.optional(),
    name: NullableName,
    semanticKind: SemanticKindSchema.optional(),
  }),
  z.strictObject({ type: z.literal('delete_point'), pointId: IdSchema }),
  z.strictObject({ type: z.literal('reverse_route') }),
  z.strictObject({ type: z.literal('set_shape_mode'), shapeMode: ShapeModeSchema }),
  z.strictObject({
    type: z.literal('set_section_mode'),
    sectionId: IdSchema,
    mode: SectionModeSchema,
    geometry: GeometrySchema.optional(),
  }),
  z.strictObject({
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
  z.strictObject({
    type: z.literal('split_days'),
    targetDays: z.number().int().min(1).max(60),
    timezone: z.string().max(64).optional(),
  }),
  z.strictObject({ type: z.literal('move_day_boundary'), stageId: IdSchema, newEndPointId: IdSchema }),
  z.strictObject({ type: z.literal('update_stage_note'), stageId: IdSchema, notes: z.string().max(5000) }),
  z.strictObject({
    type: z.literal('set_overnight'),
    stageId: IdSchema,
    overnightPlace: OvernightPlaceSchema.nullable(),
  }),
  z.strictObject({
    type: z.literal('set_sport_profile'),
    sport: SportSchema,
    routingOptions: RoutingOptionsSchema,
  }),
  z.strictObject({ type: z.literal('add_variant'), variant: VariantSchema }),
  z.strictObject({ type: z.literal('apply_variant'), variantId: IdSchema }),
  z.strictObject({
    type: z.literal('revert_to_seq'),
    targetSeq: z.number().int().min(0),
    reason: z.string().max(500),
    revisionId: z.string().max(200).optional(),
  }),
  z.strictObject({
    type: z.literal('update_point'),
    pointId: IdSchema,
    name: NullableName,
    note: z.string().max(2000).nullish(),
  }),
  z.strictObject({
    type: z.literal('split_section'),
    sectionId: IdSchema,
    pointId: IdSchema,
    lat: LatSchema,
    lon: LonSchema,
    name: NullableName,
  }),
  z.strictObject({ type: z.literal('merge_sections'), sectionId: IdSchema, withSectionId: IdSchema }),
  z.strictObject({
    type: z.literal('cut_stage_at'),
    stageId: IdSchema,
    pointId: IdSchema,
    lat: LatSchema,
    lon: LonSchema,
    name: NullableName,
  }),
  z.strictObject({
    type: z.literal('apply_stage_split'),
    cuts: z
      .array(
        z.strictObject({
          pointId: IdSchema,
          lat: LatSchema,
          lon: LonSchema,
          name: NullableName,
          overnightPlace: OvernightPlaceSchema.nullable(),
        }),
      )
      .max(120),
  }),
  z.strictObject({
    type: z.literal('set_stage_schedule'),
    stageId: IdSchema,
    departureTimeLocal: z.string().max(16).optional(),
    dateIso: z.string().max(32).nullish(),
    timezone: z.string().max(64).optional(),
    chainFollowing: z.boolean().optional(),
  }),
  z.strictObject({ type: z.literal('insert_rest_day'), afterStageId: IdSchema, stageId: IdSchema }),
  z.strictObject({
    type: z.literal('insert_short_stage'),
    afterStageId: IdSchema,
    stageId: IdSchema,
    turnaroundPointId: IdSchema,
    returnPointId: IdSchema,
    lat: LatSchema,
    lon: LonSchema,
    name: NullableName,
  }),
  z.strictObject({ type: z.literal('remove_stage'), stageId: IdSchema }),
  z
    .strictObject({
      type: z.literal('import_track'),
      points: z.array(PointSchema).max(MAX_POINTS),
      sections: z.array(SectionSchema).max(MAX_SECTIONS),
      sourceOrigin: SourceOriginSchema,
    })
    .refine((op) => totalCoordinates(op.sections) <= MAX_TOTAL_COORDINATES, {
      message: 'Trop de coordonnées au total.',
      path: ['sections'],
    }),
]);

/* ---------- Commentaires, propositions, état initial ---------- */

const GeometryAnchorSchema = z.strictObject({
  anchorType: z.enum(['point', 'section', 'stage', 'position']),
  entityId: IdSchema,
  entityVersion: z.number().int().min(0).max(1_000_000_000),
  fraction: z.number().min(0).max(1).optional(),
  originalLat: LatSchema,
  originalLon: LonSchema,
  maxRelocateMeters: z.number().min(0).max(1_000_000),
});

const CommentSchema = z.strictObject({
  id: z.string().min(1).max(120),
  workspaceId: IdSchema,
  createdBy: z.string().max(120),
  authorName: z.string().max(120),
  body: z.string().max(5000),
  anchor: GeometryAnchorSchema,
  baseRevisionNo: z.number().int().min(0),
  status: z.enum(['open', 'resolved', 'needs_relocation']),
  createdAt: IsoText,
});

const ImpactSummarySchema = z.strictObject({
  deltaDistanceKm: z.number().min(-100_000).max(100_000),
  deltaAscentM: z.number().min(-1_000_000).max(1_000_000).nullable(),
  deltaDurationMin: z.number().min(-10_000_000).max(10_000_000).nullable(),
  affectedStageIds: z.array(IdSchema).max(MAX_STAGES),
  affectedDayNumbers: z.array(z.number().int().min(1).max(400)).max(400),
  arrivalShiftMin: z.number().min(-10_000_000).max(10_000_000).nullable(),
  weatherRevalidationNeeded: z.boolean(),
  waterGapChanged: z.boolean(),
  overnightChanged: z.boolean(),
  kitItemsToRevalidate: z
    .array(
      z.strictObject({
        itemId: IdSchema,
        itemName: ShortText,
        reason: z.string().max(500),
        assigneeUserId: z.string().max(120).nullable(),
      }),
    )
    .max(1000),
  affectedMembers: z
    .array(z.strictObject({ userId: z.string().max(120), displayName: z.string().max(120), reason: z.string().max(500) }))
    .max(100),
  unknowns: z.array(z.string().max(300)).max(100),
});

const ProposalSchema = z.strictObject({
  id: z.string().min(1).max(120),
  workspaceId: IdSchema,
  baseSeq: z.number().int().min(0),
  createdBy: z.string().max(120),
  authorName: z.string().max(120),
  title: z.string().max(160),
  rationale: z.string().max(5000),
  scopeEntityIds: z.array(IdSchema).max(500),
  operations: z.array(RouteOperationSchema).max(50),
  impactPreview: ImpactSummarySchema.nullable(),
  status: z.enum(['open', 'accepted', 'rejected', 'superseded']),
  votes: z.record(z.string().max(120), z.enum(['up', 'down'])),
  reviewedBy: z.string().max(120).nullish(),
  reviewedAt: IsoText.nullish(),
  createdAt: IsoText,
});

/**
 * État initial fourni à la création d'un itinéraire. Les clés racine inconnues (id, title, status, headSeq,
 * shareLink, révisions…) sont IGNORÉES (le client envoie l'état complet, le serveur les réinitialise) ; tout
 * ce qui est retenu (points, tronçons, étapes, kit, membres, variantes, propositions, commentaires) est strict.
 */
export const InitialWorkspaceSchema = z
  .object({
    tripId: z.string().max(80).optional(),
    shapeMode: ShapeModeSchema.optional(),
    routingOptions: RoutingOptionsSchema.optional(),
    sourceOrigin: SourceOriginSchema.optional(),
    clubEventId: z.string().max(80).nullish(),
    points: z.array(PointSchema).max(MAX_POINTS).optional(),
    sections: z.array(SectionSchema).max(MAX_SECTIONS).optional(),
    stages: z.array(StageSchema).max(MAX_STAGES).optional(),
    variants: z.array(VariantSchema).max(200).optional(),
    proposals: z.array(ProposalSchema).max(200).optional(),
    comments: z.array(CommentSchema).max(500).optional(),
    kitItems: z.array(KitItemSchema).max(1000).optional(),
    members: z.array(MemberSchema).max(100).optional(),
  })
  .refine((ws) => totalCoordinates(ws.sections) <= MAX_TOTAL_COORDINATES, {
    message: 'Trop de coordonnées au total.',
    path: ['sections'],
  });

/** Type des opérations validées : vérifié à la compilation contre `RouteOperationInput`. */
type ParsedOperation = z.infer<typeof RouteOperationSchema>;
type OperationTypes = RouteOperationInput['type'];
// Chaque type d'opération du domaine doit exister dans le schéma, et réciproquement.
type _SchemaCoversDomain = Exclude<OperationTypes, ParsedOperation['type']> extends never ? true : never;
type _DomainCoversSchema = Exclude<ParsedOperation['type'], OperationTypes> extends never ? true : never;
export const OPERATION_SCHEMA_IS_EXHAUSTIVE: [_SchemaCoversDomain, _DomainCoversSchema] = [true, true];

/**
 * Couverture des champs : chaque clé d'un type du domaine doit exister dans son schéma STRICT (sinon le champ
 * serait refusé à la réception). Une clé ajoutée au domaine sans schéma casse `tsc` ici.
 */
type KeysCovered<Domain, Schema> = Exclude<keyof Domain, keyof Schema> extends never ? true : never;
export const SCHEMA_KEYS_COVER_DOMAIN: [
  KeysCovered<CollaborativeRoutePoint, z.infer<typeof PointSchema>>,
  KeysCovered<CollaborativeRouteSection, z.infer<typeof SectionSchema>>,
  KeysCovered<CollaborativeStage, z.infer<typeof StageSchema>>,
  KeysCovered<CollaborativeKitItem, z.infer<typeof KitItemSchema>>,
  KeysCovered<RouteMemberAccess, z.infer<typeof MemberSchema>>,
  KeysCovered<RouteSourceOrigin, z.infer<typeof SourceOriginSchema>>,
  KeysCovered<RouteComment, z.infer<typeof CommentSchema>>,
  KeysCovered<RouteProposal, z.infer<typeof ProposalSchema>>,
  KeysCovered<RouteVariant, z.infer<typeof VariantSchema>>,
  KeysCovered<OvernightPlace, z.infer<typeof OvernightPlaceSchema>>,
] = [true, true, true, true, true, true, true, true, true, true];

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
