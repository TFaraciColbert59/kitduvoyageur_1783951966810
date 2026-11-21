export interface GroupMemberProgress {
  id: string;
  name: string | null;
  role: string;
  avatar?: string | null;
  handle?: string | null;
  confirmed?: boolean;
  /** Progression signée en mètres le long de la même révision du tracé (si consentie et fraîche) */
  alongMeters?: number | null;
  routeRevision?: number | null;
  positionUpdatedAt?: string | null;
}

export interface RelativePosition {
  relation: 'ahead' | 'behind' | 'same' | 'unknown';
  deltaMeters: number | null;
  stale: boolean;
}

const STALE_MS = 15 * 60_000; // 15 minutes

/**
 * Calcule la position relative devant/derrière uniquement lorsque les deux membres
 * partagent la même révision de tracé et disposent d'une progression signée valide.
 * Jamais de distance euclidienne ni d'inférence incertaine.
 */
export function compareMemberProgress(
  viewer: Pick<GroupMemberProgress, 'alongMeters' | 'routeRevision'>,
  other: Pick<GroupMemberProgress, 'alongMeters' | 'routeRevision' | 'positionUpdatedAt'>,
  nowMs = Date.now(),
): RelativePosition {
  const updatedMs = other.positionUpdatedAt ? Date.parse(other.positionUpdatedAt) : NaN;
  const stale = !Number.isFinite(updatedMs) || (nowMs - updatedMs) > STALE_MS;

  if (
    viewer.alongMeters == null ||
    other.alongMeters == null ||
    !Number.isFinite(viewer.alongMeters) ||
    !Number.isFinite(other.alongMeters) ||
    viewer.routeRevision == null ||
    other.routeRevision == null ||
    viewer.routeRevision !== other.routeRevision
  ) {
    return { relation: 'unknown', deltaMeters: null, stale };
  }

  const delta = Math.round(other.alongMeters - viewer.alongMeters);
  if (Math.abs(delta) < 15) return { relation: 'same', deltaMeters: 0, stale };
  return {
    relation: delta > 0 ? 'ahead' : 'behind',
    deltaMeters: Math.abs(delta),
    stale,
  };
}

/**
 * Découpe la liste des membres en blocs glissants de 3 (P07-48),
 * adaptés aux petits groupes (1–3) comme aux grands collectifs (50+).
 */
export function chunkMembersByThree<T>(members: T[]): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < members.length; i += 3) {
    chunks.push(members.slice(i, i + 3));
  }
  return chunks;
}

export function formatRelativeDelta(pos: RelativePosition): string {
  if (pos.relation === 'unknown' || pos.deltaMeters == null) return 'Position non partagée';
  if (pos.relation === 'same') return pos.stale ? 'Même niveau (donnée ancienne)' : 'Même niveau';
  const dist = pos.deltaMeters >= 1000
    ? `${(Math.round(pos.deltaMeters / 100) / 10).toFixed(1).replace('.', ',')} km`
    : `${pos.deltaMeters} m`;
  const dir = pos.relation === 'ahead' ? 'devant' : 'derrière';
  return pos.stale ? `${dist} ${dir} (donnée ancienne)` : `${dist} ${dir}`;
}
