import type { RouteGeometry, WaypointSemanticKind } from '@/features/adventure-prep/routeRevision';
import type { RouteRoutingOptions, RouteSport } from '@/features/adventure-prep/routeProfiles';

/* ---------- Permissions & Rôles ---------- */

export type RouteRole =
  | 'owner'
  | 'co_organizer'
  | 'editor'
  | 'contributor'
  | 'participant'
  | 'external_viewer';

export type RoutePermission =
  | 'route.read'
  | 'route.edit_geometry'
  | 'route.edit_stages'
  | 'route.edit_waypoints'
  | 'route.comment'
  | 'route.propose'
  | 'route.review'
  | 'route.publish'
  | 'route.manage_members'
  | 'route.manage_privacy'
  | 'route.download_pack';

export interface RouteMemberAccess {
  readonly userId: string;
  readonly displayName: string;
  readonly role: RouteRole;
  readonly delegatedPublish?: boolean;
  readonly stageScopeIds?: readonly string[];
  readonly revokedAt?: string | null;
}

/* ---------- Provenance, Confiance & Terrain ---------- */

export type DataConfidence = 'verified' | 'estimated' | 'unknown';

export interface RouteSourceOrigin {
  readonly kind: 'blank' | 'explorer_route' | 'gpx_import' | 'activity_replay';
  readonly sourceId?: string | null;
  readonly sourceTitle?: string | null;
  readonly sourceUrl?: string | null;
  readonly importedAt?: string | null;
  readonly originalGpxXml?: string | null;
  readonly attribution?: string | null;
}

export interface SectionProvenance {
  readonly provider: string | null;
  readonly providerVersion?: string | null;
  readonly calculatedAt: string | null;
  readonly profile: string | null;
  readonly confidence: DataConfidence;
}

export interface SurfaceSegment {
  readonly fromRatio: number;
  readonly toRatio: number;
  readonly surface: 'paved' | 'unpaved' | 'trail' | 'rock' | 'unknown';
  readonly source?: string | null;
}

export interface ElevationSample {
  readonly distanceM: number;
  readonly elevationM: number | null;
}

export interface ElevationProfile {
  readonly samples: readonly ElevationSample[];
  readonly source: string;
  readonly computedAt: string;
  readonly missingRatio: number;
}

export interface WaterObservation {
  readonly id: string;
  readonly pointId?: string | null;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly status: 'flowing' | 'dry' | 'unknown';
  readonly potableClaim: 'yes' | 'no' | 'unknown';
  readonly observedAt: string | null;
  readonly source: 'user' | 'official' | 'external' | 'osm';
}

export interface WeatherSlice {
  readonly pointId: string;
  readonly locationLabel: string;
  readonly forecastFor: string;
  readonly fetchedAt: string | null;
  readonly provider: string | null;
  readonly temperatureC: number | null;
  readonly precipitationProbability: number | null;
  readonly windKph: number | null;
  readonly status: 'fresh' | 'stale' | 'unavailable';
}

export interface RouteHazard {
  readonly id: string;
  readonly title: string;
  readonly type: 'closure' | 'weather_alert' | 'terrain' | 'access';
  readonly severitySource: string;
  readonly observedAt: string;
  readonly expiresAt: string | null;
  readonly source: string;
}

export interface OvernightPlace {
  readonly id: string;
  readonly name: string;
  readonly type: 'refuge' | 'hut' | 'bivouac' | 'camp' | 'gite' | 'hotel';
  readonly lat: number;
  readonly lon: number;
  readonly bookingStatus: 'planned' | 'confirmed' | 'unknown';
  readonly openingInfo?: string | null;
  readonly provenance: string;
  readonly lastVerifiedAt: string | null;
}

/* ---------- Entités Topologiques Stables ---------- */

export type CollaborativePointKind = 'start' | 'via' | 'stop' | 'stage_boundary' | 'finish';

export interface CollaborativeRoutePoint {
  readonly id: string;
  readonly workspaceId: string;
  readonly kind: CollaborativePointKind;
  readonly orderKey: string;
  readonly lat: number;
  readonly lon: number;
  readonly eleM?: number | null;
  readonly name?: string | null;
  readonly semanticKind?: WaypointSemanticKind;
  readonly note?: string | null;
  readonly entityVersion: number;
  readonly deletedAt?: string | null;
}

export type CollaborativeSectionMode = 'routed' | 'manual' | 'imported_preserved';

export interface CollaborativeRouteSection {
  readonly id: string;
  readonly workspaceId: string;
  readonly fromPointId: string;
  readonly toPointId: string;
  readonly mode: CollaborativeSectionMode;
  readonly geometry: RouteGeometry;
  readonly distanceKm: number;
  readonly durationMin: number | null;
  readonly ascentM: number | null;
  readonly descentM: number | null;
  readonly surfaceSegments: readonly SurfaceSegment[];
  readonly routingInputHash: string | null;
  readonly pendingFingerprint?: string | null;
  readonly provenance: SectionProvenance;
  readonly warnings: readonly string[];
  readonly entityVersion: number;
}

export interface CollaborativeStage {
  readonly id: string;
  readonly workspaceId: string;
  readonly orderKey: string;
  readonly dayNumber: number;
  readonly title: string;
  readonly dateIso: string | null;
  readonly departureTimeLocal: string;
  readonly timezone: string;
  readonly startPointId: string;
  readonly endPointId: string;
  readonly overnightPlace: OvernightPlace | null;
  readonly notes: string;
  readonly waterObservations: readonly WaterObservation[];
  readonly weatherSlice: WeatherSlice | null;
  readonly hazards: readonly RouteHazard[];
  readonly entityVersion: number;
}

/* ---------- Variantes, Propositions & Commentaires ---------- */

export interface VariantReplacement {
  readonly sectionId: string;
  readonly geometry: RouteGeometry;
  readonly distanceKm: number;
  readonly durationMin: number | null;
  readonly ascentM: number | null;
  readonly descentM: number | null;
  readonly surfaceKnownRatio: number;
  readonly provenance: SectionProvenance;
}

export interface RouteVariant {
  readonly id: string;
  readonly baseRevisionNo: number;
  readonly scope: 'section' | 'stage' | 'route';
  readonly title: string;
  readonly replacements: readonly VariantReplacement[];
  readonly deltaDistanceKm: number;
  readonly deltaAscentM: number | null;
  readonly deltaDurationMin: number | null;
  readonly status: 'draft' | 'proposed' | 'accepted' | 'rejected';
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface GeometryAnchor {
  readonly anchorType: 'point' | 'section' | 'stage' | 'position';
  readonly entityId: string;
  readonly entityVersion: number;
  readonly fraction?: number;
  readonly originalLat: number;
  readonly originalLon: number;
  readonly maxRelocateMeters: number;
}

export interface RouteComment {
  readonly id: string;
  readonly workspaceId: string;
  readonly createdBy: string;
  readonly authorName: string;
  readonly body: string;
  readonly anchor: GeometryAnchor;
  readonly baseRevisionNo: number;
  readonly status: 'open' | 'resolved' | 'needs_relocation';
  readonly createdAt: string;
}

export interface RouteProposal {
  readonly id: string;
  readonly workspaceId: string;
  readonly baseSeq: number;
  readonly createdBy: string;
  readonly authorName: string;
  readonly title: string;
  readonly rationale: string;
  readonly scopeEntityIds: readonly string[];
  readonly operations: readonly RouteOperationInput[];
  readonly impactPreview: RouteImpactSummary | null;
  readonly status: 'open' | 'accepted' | 'rejected' | 'superseded';
  readonly votes: Readonly<Record<string, 'up' | 'down'>>;
  readonly reviewedBy?: string | null;
  readonly reviewedAt?: string | null;
  readonly createdAt: string;
}

/* ---------- Kit & Impact Graph ---------- */

export interface CollaborativeKitItem {
  readonly id: string;
  readonly inventoryItemId?: string | null;
  readonly name: string;
  readonly category: string;
  readonly weightGrams: number | null;
  readonly quantity: number;
  readonly shared: boolean;
  readonly assigneeUserId: string | null;
  readonly assigneeName: string | null;
  readonly dependsOn: readonly ('overnight' | 'water' | 'weather' | 'duration' | 'distance')[];
  readonly status: 'confirmed' | 'needs_revalidation' | 'unassigned';
  readonly revalidationReason?: string | null;
}

export interface RouteImpactSummary {
  readonly deltaDistanceKm: number;
  readonly deltaAscentM: number | null;
  readonly deltaDurationMin: number | null;
  readonly affectedStageIds: readonly string[];
  readonly affectedDayNumbers: readonly number[];
  readonly arrivalShiftMin: number | null;
  readonly weatherRevalidationNeeded: boolean;
  readonly waterGapChanged: boolean;
  readonly overnightChanged: boolean;
  readonly kitItemsToRevalidate: readonly {
    readonly itemId: string;
    readonly itemName: string;
    readonly reason: string;
    readonly assigneeUserId: string | null;
  }[];
  readonly affectedMembers: readonly {
    readonly userId: string;
    readonly displayName: string;
    readonly reason: string;
  }[];
  readonly unknowns: readonly string[];
}

/* ---------- Journal d'Opérations & Concurrence ---------- */

export type RouteOperationInput =
  | {
      readonly type: 'move_point';
      readonly pointId: string;
      readonly lat: number;
      readonly lon: number;
      readonly eleM?: number | null;
    }
  | {
      readonly type: 'insert_point';
      readonly pointId: string;
      readonly afterPointId: string | null;
      readonly lat: number;
      readonly lon: number;
      readonly kind?: CollaborativePointKind;
      readonly name?: string | null;
      readonly semanticKind?: WaypointSemanticKind;
    }
  | {
      readonly type: 'delete_point';
      readonly pointId: string;
    }
  | {
      readonly type: 'reverse_route';
    }
  | {
      readonly type: 'set_section_mode';
      readonly sectionId: string;
      readonly mode: CollaborativeSectionMode;
      readonly geometry?: RouteGeometry;
    }
  | {
      readonly type: 'apply_routing_result';
      readonly sectionId: string;
      readonly routingInputHash: string;
      readonly geometry: RouteGeometry;
      readonly distanceKm: number;
      readonly durationMin: number | null;
      readonly ascentM: number | null;
      readonly descentM: number | null;
      readonly surfaceSegments?: readonly SurfaceSegment[];
      readonly provenance: SectionProvenance;
    }
  | {
      readonly type: 'split_days';
      readonly targetDays: number;
      readonly timezone?: string;
    }
  | {
      readonly type: 'move_day_boundary';
      readonly stageId: string;
      readonly newEndPointId: string;
    }
  | {
      readonly type: 'update_stage_note';
      readonly stageId: string;
      readonly notes: string;
    }
  | {
      readonly type: 'set_overnight';
      readonly stageId: string;
      readonly overnightPlace: OvernightPlace | null;
    }
  | {
      readonly type: 'set_sport_profile';
      readonly sport: RouteSport;
      readonly routingOptions: RouteRoutingOptions;
    }
  | {
      readonly type: 'revert_to_seq';
      readonly targetSeq: number;
      readonly reason: string;
    };

export interface RouteOperationRecord {
  readonly seq: number;
  readonly opId: string;
  readonly workspaceId: string;
  readonly actorId: string;
  readonly actorName: string;
  readonly baseSeq: number;
  readonly payloadHash: string;
  readonly operation: RouteOperationInput;
  readonly expectedVersions: Readonly<Record<string, number>>;
  readonly createdAt: string;
}

export interface DomainConflict {
  readonly entityId: string;
  readonly entityType: 'point' | 'section' | 'stage' | 'workspace';
  readonly entityLabel: string;
  readonly expectedVersion: number;
  readonly currentVersion: number;
  readonly currentActorName?: string | null;
  readonly message: string;
  readonly yourSummary: string;
  readonly currentSummary: string;
}

export type ApplyOperationResult =
  | {
      readonly status: 'accepted';
      readonly seq: number;
      readonly workspace: RouteWorkspaceState;
      readonly impact: RouteImpactSummary;
    }
  | {
      readonly status: 'already_applied';
      readonly seq: number;
      readonly workspace: RouteWorkspaceState;
    }
  | {
      readonly status: 'stale_routing_discarded';
      readonly seq: number;
      readonly reason: string;
    }
  | {
      readonly status: 'conflict';
      readonly currentSeq: number;
      readonly conflicts: readonly DomainConflict[];
      readonly currentWorkspace: RouteWorkspaceState;
    }
  | {
      readonly status: 'denied';
      readonly reason: string;
    };

/* ---------- Révisions Immuables & Packs ---------- */

export interface RouteRevisionSnapshot {
  readonly id: string;
  readonly workspaceId: string;
  readonly revisionNo: number;
  readonly parentRevisionId: string | null;
  readonly basedOnSeq: number;
  readonly createdBy: string;
  readonly createdByName: string;
  readonly createdAt: string;
  readonly kind: 'candidate' | 'published';
  readonly summary: string;
  readonly points: readonly CollaborativeRoutePoint[];
  readonly sections: readonly CollaborativeRouteSection[];
  readonly stages: readonly CollaborativeStage[];
  readonly kitSnapshot: readonly CollaborativeKitItem[];
  readonly acknowledgedUnknowns: readonly string[];
}

export interface DeparturePackManifest {
  readonly packId: string;
  readonly workspaceId: string;
  readonly revisionId: string;
  readonly revisionNo: number;
  readonly checksum: string;
  readonly estimatedBytes: number;
  readonly generatedAt: string;
  readonly includedItems: readonly ('geometry' | 'stages' | 'waypoints' | 'notes' | 'checklist' | 'elevation')[];
  readonly unavailableItems: readonly string[];
  readonly mapTileSource: {
    readonly provider: string;
    readonly offlineAuthorized: boolean;
    readonly licenseNote: string;
  };
}

export interface ParticipantPackState {
  readonly userId: string;
  readonly displayName: string;
  readonly preparedRevisionNo: number | null;
  readonly downloadedRevisionNo: number | null;
  readonly verifiedLocalAt: string | null;
  readonly status: 'not_downloaded' | 'downloading' | 'ready' | 'outdated' | 'failed';
}

/* ---------- Workspace Complet ---------- */

export interface RouteWorkspaceState {
  readonly id: string;
  readonly tripId: string;
  readonly title: string;
  readonly status: 'draft' | 'review' | 'published' | 'archived';
  readonly sport: RouteSport;
  readonly routingOptions: RouteRoutingOptions;
  readonly headSeq: number;
  readonly reviewedSeq: number | null;
  readonly publishedRevisionId: string | null;
  readonly publishedRevisionNo: number | null;
  readonly sourceOrigin: RouteSourceOrigin;
  readonly points: readonly CollaborativeRoutePoint[];
  readonly sections: readonly CollaborativeRouteSection[];
  readonly stages: readonly CollaborativeStage[];
  readonly variants: readonly RouteVariant[];
  readonly proposals: readonly RouteProposal[];
  readonly comments: readonly RouteComment[];
  readonly kitItems: readonly CollaborativeKitItem[];
  readonly members: readonly RouteMemberAccess[];
  readonly revisions: readonly RouteRevisionSnapshot[];
  readonly packs: readonly DeparturePackManifest[];
  readonly participantPacks: readonly ParticipantPackState[];
  readonly updatedAt: string;
}
