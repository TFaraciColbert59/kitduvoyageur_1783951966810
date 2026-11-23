/**
 * État de chaque participant, vu par l'organisateur (9.5) : « v1 téléchargée · v2 disponible », « prêt »,
 * « pas encore ouvert ». Pur. Un participant sans ligne d'état n'a jamais ouvert la copie : c'est dit ainsi, pas
 * deviné « prêt ».
 */
import { hasRoutePermission } from '../permissions';
import type { RouteWorkspaceState } from '../types';

export type ParticipantStatusKind = 'ready' | 'outdated' | 'downloading' | 'failed' | 'not_opened' | 'not_downloaded' | 'no_version';

export interface ParticipantRow {
  readonly userId: string;
  readonly displayName: string;
  readonly kind: ParticipantStatusKind;
  readonly label: string;
  readonly verifiedLocalAt: string | null;
}

/** Les organisateurs (qui gèrent les membres) voient l'état de tous ; les autres ne voient rien des autres. */
export function canSeeParticipants(ws: RouteWorkspaceState, currentUserId: string): boolean {
  const me = ws.members.find((m) => m.userId === currentUserId);
  return hasRoutePermission(me, 'route.manage_members') || me?.role === 'co_organizer';
}

export function participantRows(ws: RouteWorkspaceState): ParticipantRow[] {
  const published = ws.publishedRevisionNo;
  return ws.members
    .filter((m) => !m.revokedAt)
    .map((m) => {
      const st = ws.participantPacks.find((p) => p.userId === m.userId);
      const row = (kind: ParticipantStatusKind, label: string): ParticipantRow => ({ userId: m.userId, displayName: m.displayName, kind, label, verifiedLocalAt: st?.verifiedLocalAt ?? null });
      if (published == null) return row('no_version', 'Aucune version publiée');
      if (!st) return row('not_opened', 'Pas encore ouvert');
      if (st.status === 'failed') return row('failed', 'Téléchargement échoué');
      if (st.status === 'downloading') return row('downloading', 'Téléchargement en cours');
      if (st.downloadedRevisionNo == null || st.status === 'not_downloaded') return row('not_downloaded', `Ouvert, rien téléchargé · v${published} disponible`);
      if (st.downloadedRevisionNo < published || st.status === 'outdated') return row('outdated', `v${st.downloadedRevisionNo} téléchargée · v${published} disponible`);
      return row('ready', `Prêt · v${st.downloadedRevisionNo}`);
    });
}

export function participantsSummary(rows: readonly ParticipantRow[]): { ready: number; total: number } {
  return { ready: rows.filter((r) => r.kind === 'ready').length, total: rows.length };
}
