/**
 * Entrée de /compas/itineraire : lecture validée des paramètres d'URL (`?trip=`, `?jour=`, `?point=`,
 * `?troncon=`), contexte du voyage (activité, jours, tracé du Compas) et provenance du tracé affichée en badge.
 * Pur : la lecture en base se fait dans `server/loadTripEntry.ts`, sous RLS.
 */
import { z } from 'zod';
import { readRouteDraft, type RouteRevision } from '@/features/adventure-prep/routeRevision';
import { routeSportForActivity, type RouteSport } from '@/features/adventure-prep/routeProfiles';
import { tripContextFromRow } from '@/features/compas/engine/tripContext';
import { parseItineraryDeepLink, type ItineraryDeepLink } from './insights/deepLinks';
import { sectionDayMap } from './mapGeometry';
import { activePointsOf } from './pointOrder';
import { COMPAS_DRAFT_ORIGIN_TITLE_PREFIX } from './startWorkspace';
import type { RouteWorkspaceState } from './types';

/* ---------- Paramètres d'URL ---------- */

const tripIdSchema = z.string().uuid();

export interface EntryParams {
  /** UUID du voyage, validé ; absent ou invalide → `undefined`. */
  readonly tripId?: string;
  /** Vrai si `?trip=` était présent mais n'est pas un identifiant de voyage (annoncé, jamais corrigé). */
  readonly tripInvalid: boolean;
  readonly deepLink: Omit<ItineraryDeepLink, 'tripId'>;
}

type Raw = Readonly<Record<string, string | readonly string[] | undefined>>;

export function parseEntryParams(raw: Raw): EntryParams {
  const first = (k: string): string | undefined => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : typeof v === 'string' ? v : undefined;
  };
  const tripRaw = first('trip')?.trim();
  const parsed = tripRaw ? tripIdSchema.safeParse(tripRaw) : null;
  const { day, pointId, sectionId } = parseItineraryDeepLink(raw);
  return {
    tripId: parsed?.success ? parsed.data : undefined,
    tripInvalid: Boolean(tripRaw) && !parsed?.success,
    deepLink: {
      ...(day != null ? { day } : {}),
      ...(pointId ? { pointId } : {}),
      ...(sectionId ? { sectionId } : {}),
    },
  };
}

/* ---------- Contexte du voyage ---------- */

export interface TripRow {
  readonly id: string;
  readonly title: string | null;
  readonly start_date: string | null;
  readonly end_date: string | null;
  readonly destination_name: string | null;
  readonly destination_country_code: string | null;
  readonly party_size: number | null;
  readonly metadata: Record<string, unknown> | null;
  readonly primary_activity?: string | null;
}

/** Ce que la page transmet à l'atelier : sérialisable, sans donnée privée du voyage. */
export interface TripEntry {
  readonly tripId: string;
  readonly title: string | null;
  readonly destinationName: string | null;
  readonly countryCode: string | null;
  /** Lieu retenu sur la carte du Compas (`metadata.compas.anchor`) : sert à centrer la carte vide. */
  readonly anchor: { readonly name: string; readonly lat: number; readonly lon: number } | null;
  readonly days: number | null;
  readonly activity: string | null;
  /** Profil de routage : celui du tracé du Compas s'il existe, sinon déduit de l'activité (proposition). */
  readonly sport: RouteSport;
  readonly sportFrom: 'draft' | 'activity' | 'default';
  readonly routeDraft: RouteRevision | null;
}

export function buildTripEntry(row: TripRow): TripEntry {
  const activity = row.primary_activity ?? null;
  const ctx = tripContextFromRow(row, { activity });
  const draft = readRouteDraft(row.metadata);
  const sport = draft ? draft.sport : routeSportForActivity(activity);
  return {
    tripId: row.id,
    title: row.title?.trim() || ctx.destination.name,
    destinationName: ctx.destination.name,
    countryCode: ctx.destination.countryCode,
    anchor: ctx.destination.anchor,
    days: ctx.days,
    activity,
    sport,
    sportFrom: draft ? 'draft' : activity ? 'activity' : 'default',
    routeDraft: draft,
  };
}

export type TripEntryResult =
  | { readonly status: 'none' }
  | { readonly status: 'ok'; readonly entry: TripEntry }
  | { readonly status: 'not_found' }
  | { readonly status: 'error' };

/* ---------- Liens profonds ---------- */

export type DeepLinkTarget =
  | { readonly kind: 'point'; readonly pointId: string; readonly stageId: string | null }
  | { readonly kind: 'section'; readonly sectionId: string; readonly stageId: string | null }
  | { readonly kind: 'stage'; readonly stageId: string; readonly day: number };

export interface DeepLinkResolution {
  readonly target: DeepLinkTarget | null;
  /** Éléments demandés mais absents de cet itinéraire : annoncés, jamais remplacés par un autre. */
  readonly missing: ReadonlyArray<'jour' | 'point' | 'troncon'>;
}

function stageOfPoint(ws: RouteWorkspaceState, pointId: string): string | null {
  const ordered = activePointsOf(ws);
  const idx = ordered.findIndex((p) => p.id === pointId);
  if (idx < 0) return null;
  const found = ws.stages
    .slice()
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .find((s) => {
      const from = ordered.findIndex((p) => p.id === s.startPointId);
      const to = ordered.findIndex((p) => p.id === s.endPointId);
      return from >= 0 && to >= from && idx >= from && idx <= to;
    });
  return found?.id ?? null;
}

/** Le plus précis gagne : point, puis tronçon, puis jour. */
export function resolveDeepLinkTarget(ws: RouteWorkspaceState, link: Omit<ItineraryDeepLink, 'tripId'>): DeepLinkResolution {
  const missing: Array<'jour' | 'point' | 'troncon'> = [];
  let point: DeepLinkTarget | null = null;
  let section: DeepLinkTarget | null = null;
  let stage: DeepLinkTarget | null = null;
  if (link.pointId) {
    if (ws.points.some((p) => p.id === link.pointId && !p.deletedAt)) {
      point = { kind: 'point', pointId: link.pointId, stageId: stageOfPoint(ws, link.pointId) };
    } else missing.push('point');
  }
  if (link.sectionId) {
    const s = ws.sections.find((x) => x.id === link.sectionId);
    if (s) {
      const day = sectionDayMap(activePointsOf(ws), ws.sections, ws.stages).get(s.id);
      const st = day != null ? ws.stages.find((x) => x.dayNumber === day) : undefined;
      section = { kind: 'section', sectionId: s.id, stageId: st?.id ?? null };
    }
    else missing.push('troncon');
  }
  if (link.day != null) {
    const s = ws.stages.find((x) => x.dayNumber === link.day);
    if (s) stage = { kind: 'stage', stageId: s.id, day: s.dayNumber };
    else missing.push('jour');
  }
  return { target: point ?? section ?? stage, missing };
}

/* ---------- Provenance (1.8) ---------- */

export type ProvenanceKind = 'gpx' | 'explorer' | 'activity' | 'compas' | 'drawn' | 'empty';

export interface Provenance {
  readonly kind: ProvenanceKind;
  readonly label: string;
  /** Vrai si des tronçons ont été retouchés après l'import. */
  readonly edited: boolean;
}

const IMPORT_PROVIDERS = new Set(['gpx-import', 'import-gpx']);

function importKindOfProvider(provider: string | null | undefined): ProvenanceKind | null {
  if (!provider) return null;
  if (IMPORT_PROVIDERS.has(provider)) return 'gpx';
  if (provider === 'explorer-catalog') return 'explorer';
  if (provider.startsWith('import-')) return 'activity';
  return null;
}

const LABELS: Record<ProvenanceKind, string> = {
  gpx: 'Mon GPX',
  explorer: 'Trace Explorer',
  activity: 'Sortie passée',
  compas: 'Tracé du Compas',
  drawn: 'Dessiné',
  empty: 'Carte vide',
};

export function provenanceOf(ws: Pick<RouteWorkspaceState, 'sourceOrigin' | 'sections' | 'points'>): Provenance {
  const origin = ws.sourceOrigin;
  const fromSections = ws.sections.map((s) => importKindOfProvider(s.provenance.provider));
  const imported = fromSections.filter((k): k is ProvenanceKind => k != null);
  let kind: ProvenanceKind;
  if (origin.kind === 'gpx_import') kind = 'gpx';
  else if (origin.kind === 'explorer_route') kind = 'explorer';
  else if (origin.kind === 'activity_replay') kind = 'activity';
  else if (origin.kind === 'blank' && origin.sourceTitle?.startsWith(COMPAS_DRAFT_ORIGIN_TITLE_PREFIX)) kind = 'compas';
  else if (imported.length > 0) kind = imported[0];
  else if (ws.sections.length === 0 && ws.points.length === 0) kind = 'empty';
  else kind = 'drawn';
  const importLike = kind === 'gpx' || kind === 'explorer' || kind === 'activity';
  const edited = importLike && ws.sections.some((s) => s.mode !== 'imported_preserved') ;
  return { kind, label: LABELS[kind], edited };
}
