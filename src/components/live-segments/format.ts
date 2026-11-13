/**
 * Lot S03-UI — formatage et libellés français des surfaces Live Segments.
 *
 * Aucun calcul métier : les valeurs viennent du snapshot du contrat. Les
 * fonctions sont pures et déterministes pour être testées sans navigateur.
 */

import type {
  EffortInvalidationReason,
  GhostTargetKind,
  LiveSegmentAlert,
  LiveSegmentSnapshot,
  LiveSegmentState,
  SegmentDirection,
  SignalQuality,
  SportType,
} from '@/features/live-segments';

export type LiveSegmentTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface AlertPresentation {
  title: string;
  description: string;
  tone: LiveSegmentTone;
  icon: string;
}

export interface StatePresentation {
  label: string;
  tone: LiveSegmentTone;
  icon: string;
}

const SPORT_LABELS: Record<SportType, string> = {
  cycling: 'Vélo',
  running: 'Course',
  hiking: 'Randonnée',
  trail: 'Trail',
  gravel: 'Gravel',
};

const DIRECTION_LABELS: Record<SegmentDirection, string> = {
  forward: 'Sens direct',
  reverse: 'Sens inverse',
  bidirectional: 'Double sens',
};

const GHOST_LABELS: Record<GhostTargetKind, string> = {
  pr: 'Mon record',
  kom: 'Record du segment',
  qom: 'Record du segment',
  target: 'Objectif',
  friend: 'Ami',
};

const STATE_LABELS: Record<LiveSegmentState, StatePresentation> = {
  idle: { label: 'Prêt', tone: 'neutral', icon: 'route' },
  approaching: { label: 'Approche', tone: 'info', icon: 'loc' },
  active: { label: 'En course', tone: 'success', icon: 'play' },
  off_route: { label: 'Hors tracé', tone: 'warning', icon: 'alert' },
  gps_lost: { label: 'GPS perdu', tone: 'danger', icon: 'offline' },
  completed: { label: 'Terminé', tone: 'success', icon: 'check' },
  aborted: { label: 'Interrompu', tone: 'danger', icon: 'stop' },
};

const SIGNAL_LABELS: Record<SignalQuality, { label: string; tone: LiveSegmentTone }> = {
  good: { label: 'GPS précis', tone: 'success' },
  degraded: { label: 'GPS dégradé', tone: 'warning' },
  lost: { label: 'GPS perdu', tone: 'danger' },
};

const INVALIDATION_LABELS: Record<EffortInvalidationReason, string> = {
  gps_lost_during_effort: 'Perte GPS pendant l’effort',
  gps_teleport_detected: 'Saut GPS détecté',
  insufficient_coverage: 'Couverture du tracé insuffisante',
  off_route_aborted: 'Sortie de tracé',
  paused_during_effort: 'Pause pendant l’effort',
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Chrono compact : `04:32` ou `1:04:32`. */
export function formatClock(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** Durée lisible : `12 s`, `1 min 04 s`, `1 h 02 min`. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return seconds > 0 ? `${hours} h ${pad(minutes)} min` : `${hours} h ${pad(minutes)}`;
  }
  return seconds > 0 ? `${minutes} min ${pad(seconds)} s` : `${minutes} min`;
}

/** Écart absolu au fantôme : `12 s`, `1 min 04 s`. */
export function formatDelta(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '—';
  return formatDuration(Math.abs(ms));
}

/** Écart signé : `− 12 s` (avance), `+ 12 s` (retard), `Au niveau`. */
export function formatSignedDelta(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '—';
  if (Math.abs(ms) < 500) return 'Au niveau';
  return `${ms < 0 ? '−' : '+'} ${formatDelta(ms)}`;
}

export type DeltaDirection = 'ahead' | 'behind' | 'level' | 'none';

export function deltaDirection(ms: number | null): DeltaDirection {
  if (ms === null || !Number.isFinite(ms)) return 'none';
  if (Math.abs(ms) < 500) return 'level';
  return ms < 0 ? 'ahead' : 'behind';
}

export function formatDeltaLabel(ms: number | null): string {
  switch (deltaDirection(ms)) {
    case 'ahead':
      return 'En avance';
    case 'behind':
      return 'En retard';
    case 'level':
      return 'Au niveau';
    default:
      return 'Sans fantôme';
  }
}

export function formatDistance(m: number | null | undefined): string {
  if (m === null || m === undefined || !Number.isFinite(m)) return '—';
  const meters = Math.max(0, m);
  if (meters < 1000) return `${Math.round(meters)} m`;
  if (meters < 10_000) return `${(meters / 1000).toFixed(2).replace('.', ',')} km`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function formatElevation(m: number | null | undefined): string {
  if (m === null || m === undefined || !Number.isFinite(m)) return '—';
  return `${Math.round(m)} m D+`;
}

export function formatPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return '—';
  return `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)} %`;
}

export function clampRatio(ratio: number | null | undefined): number {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return 0;
  return Math.max(0, Math.min(1, ratio));
}

export function remainingDistanceM(snapshot: LiveSegmentSnapshot): number {
  return Math.max(0, snapshot.totalDistanceM - snapshot.distanceCoveredM);
}

/** `Temps final estimé 18 min 20 s` à partir d'une durée projetée. */
export function formatProjectedFinish(projectedMs: number | null): string | null {
  if (projectedMs === null || !Number.isFinite(projectedMs) || projectedMs <= 0) return null;
  return `Temps final estimé ${formatDuration(projectedMs)}`;
}

export function formatClockTime(timestampMs: number | null): string {
  if (timestampMs === null || !Number.isFinite(timestampMs)) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestampMs));
}

export function sportLabel(sport: SportType | null): string {
  return sport ? SPORT_LABELS[sport] : 'Sport';
}

export function directionLabel(direction: SegmentDirection | 'forward' | 'reverse' | null): string {
  if (!direction) return '—';
  return DIRECTION_LABELS[direction];
}

export function ghostKindLabel(kind: GhostTargetKind | null): string {
  return kind ? GHOST_LABELS[kind] : 'Fantôme';
}

export function statePresentation(state: LiveSegmentState): StatePresentation {
  return STATE_LABELS[state];
}

export function signalPresentation(quality: SignalQuality): {
  label: string;
  tone: LiveSegmentTone;
} {
  return SIGNAL_LABELS[quality];
}

export function invalidationLabel(reason: EffortInvalidationReason | undefined): string | null {
  if (!reason) return null;
  return INVALIDATION_LABELS[reason] ?? 'Effort invalidé';
}

function segmentSuffix(snapshot: LiveSegmentSnapshot | null | undefined): string {
  const name = snapshot?.segmentName?.trim();
  return name ? ` · ${name}` : '';
}

/**
 * Traduit une alerte du moteur en contenu prêt à rendre.
 * L'ordre de priorité visuelle est porté par `tone` et par le choix de la
 * dernière alerte faite dans l'écran.
 */
export function describeAlert(
  alert: LiveSegmentAlert,
  snapshot?: LiveSegmentSnapshot | null,
): AlertPresentation {
  switch (alert.type) {
    case 'approach': {
      const distance = snapshot?.distanceToStartM;
      return {
        title:
          distance !== null && distance !== undefined
            ? `Segment à ${formatDistance(distance)}`
            : 'Segment proche',
        description: `Préparez-vous${segmentSuffix(snapshot)}. Le chrono partira au passage de la ligne.`,
        tone: 'info',
        icon: 'loc',
      };
    }
    case 'start':
      return {
        title: 'Départ lancé',
        description: `Le chrono tourne${segmentSuffix(snapshot)}.`,
        tone: 'success',
        icon: 'play',
      };
    case 'off_route':
      return {
        title: 'Hors du tracé',
        description: 'Revenez sur le segment pour continuer à valider l’effort.',
        tone: 'warning',
        icon: 'alert',
      };
    case 'rejoined':
      return {
        title: 'De retour sur le tracé',
        description: 'La progression reprend.',
        tone: 'success',
        icon: 'check',
      };
    case 'gps_lost':
      return {
        title: 'GPS perdu',
        description: 'Le chrono continue, mais l’effort pourra être invalidé.',
        tone: 'danger',
        icon: 'offline',
      };
    case 'gps_restored':
      return {
        title: 'GPS retrouvé',
        description: 'La précision est revenue.',
        tone: 'success',
        icon: 'check',
      };
    case 'finish': {
      const delta = alert.deltaMs;
      let description = 'Effort terminé.';
      if (delta !== null && Number.isFinite(delta)) {
        if (Math.abs(delta) < 500) {
          description = 'Effort terminé, au niveau du fantôme.';
        } else if (delta < 0) {
          description = `Effort terminé avec ${formatDelta(delta)} d’avance sur le fantôme.`;
        } else {
          description = `Effort terminé avec ${formatDelta(delta)} de retard sur le fantôme.`;
        }
      }
      return { title: 'Arrivée', description, tone: 'success', icon: 'flag' };
    }
    case 'aborted':
      return {
        title: 'Effort interrompu',
        description:
          alert.reason === 'off_route_aborted'
            ? 'Trop longtemps hors du tracé : l’effort n’est pas validé.'
            : 'L’effort a été interrompu.',
        tone: 'danger',
        icon: 'stop',
      };
    default:
      return {
        title: 'Live Segment',
        description: 'Mise à jour du segment.',
        tone: 'neutral',
        icon: 'route',
      };
  }
}
