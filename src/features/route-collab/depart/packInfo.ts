/**
 * Pack hors ligne fiable (9.6) : la taille est annoncée AVANT le téléchargement, et la mise à jour ne casse jamais
 * la copie précédente (le téléchargement se fait en zone d'attente, la copie vérifiée n'est remplacée qu'après
 * contrôle de l'empreinte : voir `offlinePackStore`). La taille est celle des DONNÉES de l'itinéraire (tracé,
 * étapes, notes, sac) ; les fonds de carte ne sont pas comptés et le disent.
 */
import type { DeparturePackManifest, RouteWorkspaceState } from '../types';

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'taille inconnue';
  if (bytes < 1024) return `${Math.round(bytes)} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

export interface PackAnnouncement {
  readonly bytes: number | null;
  readonly text: string;
  readonly basis: 'manifest' | 'estimate' | 'none';
  readonly mapNote: string;
}

const MAP_NOTE = 'Fonds de carte non inclus dans cette taille.';

/** Taille annoncée : celle du manifeste de la dernière version publiée ; sinon l'estimation de l'état courant. */
export function packAnnouncement(ws: RouteWorkspaceState, latest: DeparturePackManifest | null): PackAnnouncement {
  if (latest) {
    return { bytes: latest.estimatedBytes, text: `Pack v${latest.revisionNo} : environ ${formatBytes(latest.estimatedBytes)}`, basis: 'manifest', mapNote: MAP_NOTE };
  }
  if (ws.points.length < 2) return { bytes: null, text: 'Taille connue après la première publication', basis: 'none', mapNote: MAP_NOTE };
  const bytes = JSON.stringify({ points: ws.points, sections: ws.sections, stages: ws.stages, kitSnapshot: ws.kitItems }).length;
  return { bytes, text: `Estimation de la prochaine version : environ ${formatBytes(bytes)}`, basis: 'estimate', mapNote: MAP_NOTE };
}

