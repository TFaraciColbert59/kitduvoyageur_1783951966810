import type { TrailMessageMeta } from '@/features/messaging/types/messaging.types';
import { legsStats, stageLegs } from './insights/shared';
import type { RouteWorkspaceState } from './types';

/**
 * 8.10 — Partager une étape dans la messagerie : une carte d'étape cliquable qui ouvre ce jour.
 * Le lien ne donne aucun droit par lui-même : `/compas/itineraire?workspaceId=…&jour=N` est lu côté serveur
 * (`getWorkspaceForActor`), donc la carte n'ouvre l'itinéraire que pour qui a le droit de le voir. Le jeton d'un lien de
 * lecture n'est joint que sur demande explicite (il donne accès à toute personne qui lit la conversation).
 */

const ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;
const TOKEN_RE = /^[A-Za-z0-9._:-]{1,200}$/;

export interface StageMessageOptions {
  /** Joint le jeton d'un lien de lecture actif ; faux par défaut. */
  readonly includeShareToken?: boolean;
  /** Jeton à joindre (il n'est relisible nulle part ailleurs que juste après sa création). */
  readonly shareToken?: string | null;
}

/** Métadonnées d'un message « étape » : la carte sait quel jour ouvrir, et à quelle version. */
export function toStageMessageMeta(
  workspace: RouteWorkspaceState,
  stageId: string,
  options: StageMessageOptions = {},
): TrailMessageMeta | null {
  const stage = workspace.stages.find((s) => s.id === stageId);
  if (!stage) return null;
  const stats = legsStats(stageLegs(workspace, stage));
  const known = stats.distanceKm > 0 && stats.missingSections === 0;
  const token =
    options.includeShareToken && options.shareToken && workspace.shareLink && !workspace.shareLink.revokedAt
      ? options.shareToken
      : null;
  return {
    kind: 'trail',
    id: workspace.id,
    name: `${workspace.title} · Jour ${stage.dayNumber}`,
    distance_km: known ? Number(stats.distanceKm.toFixed(1)) : null,
    elevation_gain_m: known ? stats.ascentM : null,
    workspace_id: workspace.id,
    revision_no: workspace.publishedRevisionNo,
    share_token: token,
    stage_id: stage.id,
    stage_day: stage.dayNumber,
  };
}

/**
 * Lien ouvert par la carte. Sans `workspace_id`, c'est une randonnée de l'Explorer (comportement d'origine). Toute
 * valeur invalide est ignorée plutôt que corrigée.
 */
export function trailMessageHref(
  meta: Pick<TrailMessageMeta, 'id' | 'workspace_id' | 'stage_day' | 'share_token'>,
): string {
  const ws = meta.workspace_id;
  if (!ws || !ID_RE.test(ws)) return `/explorer?trail=${meta.id}`;
  const q = new URLSearchParams();
  q.set('workspaceId', ws);
  const day = meta.stage_day;
  if (day != null && Number.isInteger(day) && day >= 1 && day <= 366) q.set('jour', String(day));
  if (meta.share_token && TOKEN_RE.test(meta.share_token)) q.set('token', meta.share_token);
  return `/compas/itineraire?${q.toString()}`;
}
