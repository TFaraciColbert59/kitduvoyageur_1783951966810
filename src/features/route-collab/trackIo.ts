/**
 * Import et export de traces (5.9) : fonctions pures. L'écran lit le fichier, ce module décide.
 *
 * Import : GPX, KML, TCX et GeoJSON passent par `parseTrackFile` ; FIT (binaire) est refusé avec un message
 * qui dit quoi faire. La trace garde sa géométrie (`imported_preserved`) : rien n'est recollé au réseau
 * sans que la personne le demande. L'import est une opération du moteur (`import_track`) : annulable,
 * journalisée et soumise aux mêmes droits que tout geste de tracé.
 *
 * Export : toujours relu par `validateGpx11` avant d'être proposé ; un GPX invalide n'est jamais téléchargé.
 */
import { activePoints, exportWorkspaceGpx } from './engine';
import { parseTrackFile, validateGpx11, type Gpx11Issue, type ParsedTrack } from './insights/formats';
import { MAX_IMPORT_GPX_CHARS, limitTrackPoints } from './startBuilders';
import { workspaceWithTrack } from './startWorkspace';
import type { RouteOperationInput, RouteWorkspaceState } from './types';

export const MAX_IMPORT_FILE_BYTES = 25 * 1024 * 1024;
export const TRACK_FILE_ACCEPT = '.gpx,.kml,.tcx,.geojson,.json,application/gpx+xml,application/vnd.google-earth.kml+xml,application/geo+json,application/json';

export const FORMAT_LABEL: Record<ParsedTrack['format'], string> = {
  gpx: 'GPX',
  kml: 'KML',
  tcx: 'TCX',
  geojson: 'GeoJSON',
};

export type ImportOperation = Extract<RouteOperationInput, { type: 'import_track' }>;

export type TrackImportPlan =
  | {
      readonly ok: true;
      readonly operation: ImportOperation;
      readonly format: ParsedTrack['format'];
      readonly title: string;
      readonly pointCount: number;
      /** Vrai si la trace a été allégée (plus de 20 000 points). */
      readonly reduced: boolean;
      readonly hasElevation: boolean;
      readonly distanceKm: number;
      /** Repères du fichier (<wpt>, placemarks) non repris : la trace seule est importée. */
      readonly waypointsIgnored: number;
      readonly message: string;
    }
  | { readonly ok: false; readonly error: string };

/** FIT se refuse avant même de lire le contenu (binaire) : même message que `parseTrackFile`. */
export function rejectByFileName(name: string): string | null {
  if (!/\.fit$/i.test(name)) return null;
  const r = parseTrackFile('', name);
  return r.ok ? null : r.error.message;
}

export function planTrackImport(
  workspace: RouteWorkspaceState,
  file: { name: string; size?: number; text: string },
  nowIso: string,
): TrackImportPlan {
  const byName = rejectByFileName(file.name);
  if (byName) return { ok: false, error: byName };
  if (file.size != null && file.size > MAX_IMPORT_FILE_BYTES) {
    return { ok: false, error: 'Ce fichier dépasse 25 Mo : exportez une version allégée de la trace.' };
  }
  const parsed = parseTrackFile(file.text, file.name);
  if (!parsed.ok) return { ok: false, error: parsed.error.message };
  if (parsed.points.length < 2) return { ok: false, error: 'Le fichier contient moins de deux points exploitables.' };
  const limited = limitTrackPoints(parsed.points);
  const coords = limited.items.map((p) => [p.lon, p.lat] as [number, number]);
  const withEle = limited.items.filter((p) => typeof p.ele === 'number').length;
  const title = (parsed.name?.trim() || file.name.replace(/\.[a-z0-9]+$/i, '')).slice(0, 120);
  // L'atelier sert seulement de gabarit (identifiant, profil) : son tracé n'entre pas dans le résultat.
  const template: RouteWorkspaceState = { ...workspace, points: [], sections: [], stages: [] };
  const built = workspaceWithTrack(
    template,
    {
      coords,
      elevations: withEle >= 2 ? limited.items.map((p) => (typeof p.ele === 'number' ? p.ele : null)) : null,
      title,
      origin: {
        kind: 'gpx_import',
        sourceTitle: file.name.slice(0, 160),
        importedAt: nowIso,
        attribution: `Import ${FORMAT_LABEL[parsed.format]}`,
        originalGpxXml: parsed.format === 'gpx' && file.text.length <= MAX_IMPORT_GPX_CHARS ? file.text : null,
      },
      provider: `import-${parsed.format}`,
      keepGeometry: true,
    },
    nowIso,
  );
  if (!built) return { ok: false, error: 'Tracé illisible.' };
  const distanceKm = built.sections.reduce((acc, s) => acc + s.distanceKm, 0);
  const hasElevation = built.sections.some((s) => s.ascentM != null);
  const notes: string[] = [`${FORMAT_LABEL[parsed.format]} « ${title} » : ${coords.length.toLocaleString('fr-FR')} points, ${Math.round(distanceKm * 10) / 10} km`];
  if (!hasElevation) notes.push('altitude absente : D+ et D− restent inconnus');
  if (limited.reduced) notes.push('trace allégée à 20 000 points');
  if (parsed.waypoints.length > 0) notes.push(`${parsed.waypoints.length} repère${parsed.waypoints.length > 1 ? 's' : ''} du fichier non repris`);
  return {
    ok: true,
    operation: { type: 'import_track', points: built.points, sections: built.sections, sourceOrigin: built.sourceOrigin },
    format: parsed.format,
    title,
    pointCount: coords.length,
    reduced: limited.reduced,
    hasElevation,
    distanceKm: Math.round(distanceKm * 100) / 100,
    waypointsIgnored: parsed.waypoints.length,
    message: `${notes.join(' · ')}.`,
  };
}

export type TrackExport =
  | { readonly ok: true; readonly xml: string; readonly filename: string; readonly scope: 'route' | 'stage'; readonly trackpoints: number }
  | { readonly ok: false; readonly reason: string; readonly issues: readonly Gpx11Issue[] };

function slug(input: string): string {
  const s = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'itineraire';
}

/** Export complet ou d'une étape, relu contre les règles de GPX 1.1 avant d'être proposé. */
export function buildValidatedGpx(workspace: RouteWorkspaceState, stageId?: string): TrackExport {
  if (activePoints(workspace).length < 2 || workspace.sections.length === 0) {
    return { ok: false, reason: 'Aucun tracé à exporter : ajoutez au moins deux points.', issues: [] };
  }
  const stage = stageId ? workspace.stages.find((s) => s.id === stageId) : undefined;
  if (stageId && !stage) return { ok: false, reason: 'Étape introuvable.', issues: [] };
  if (stage?.kind === 'rest') {
    return { ok: false, reason: `Le jour ${stage.dayNumber} est une journée de repos : il n’a pas de tracé à exporter.`, issues: [] };
  }
  if (stage) {
    // Un début et une fin qui ne se suivent plus ne doivent jamais exporter tout le tracé à leur place.
    const pts = activePoints(workspace);
    const a = pts.findIndex((p) => p.id === stage.startPointId);
    const b = pts.findIndex((p) => p.id === stage.endPointId);
    if (a < 0 || b <= a) {
      return { ok: false, reason: `Le tracé du jour ${stage.dayNumber} est incohérent : corrigez ses points de départ et d’arrivée.`, issues: [] };
    }
  }
  const xml = exportWorkspaceGpx(workspace, stageId);
  const verdict = validateGpx11(xml);
  if (!verdict.valid) {
    return {
      ok: false,
      reason: `Export bloqué : le fichier ne respecte pas GPX 1.1 (${verdict.errors[0]?.message ?? 'erreur'}).`,
      issues: verdict.errors,
    };
  }
  const trackpoints = (xml.match(/<trkpt\b/g) ?? []).length;
  const name = slug(workspace.title);
  return {
    ok: true,
    xml,
    scope: stage ? 'stage' : 'route',
    trackpoints,
    filename: stage ? `${name}-jour-${stage.dayNumber}.gpx` : `${name}.gpx`,
  };
}
