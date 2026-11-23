/**
 * Modération des traces publiques, commentaires d'itinéraire et liens partagés (10.10). Module pur, testé.
 *
 * Table existante : `admin_audit_log` (admin_id / action / cible_type / cible_id / avant / apres). `moderation_queue`
 * n'est PAS utilisée (c'est la file des annonces de la place de marché) : le statut d'un élément est la dernière
 * décision journalisée (`apres.statut`). Aucun contenu de tracé,
 * aucune coordonnée, aucun jeton de partage n'entre dans la file ni dans le journal : seulement un type, un
 * identifiant et un statut. Un aperçu de commentaire est borné à 120 caractères.
 */
export const ROUTE_MODERATION_TYPES = ['route_public_trace', 'route_comment', 'route_share_link'] as const;
export type RouteModerationType = (typeof ROUTE_MODERATION_TYPES)[number];

export type ModerationDecision = 'approve' | 'reject' | 'flag';

/**
 * Mise en œuvre d'un REJET (RPC `admin_apply_route_moderation`) : masquer ou supprimer un commentaire, révoquer un
 * lien partagé, retirer une trace publique. Valider ou signaler ne modifie aucun contenu.
 */
export type ModerationEnforcement = 'hide' | 'remove' | 'revoke';
const ALLOWED_ENFORCEMENT: Record<RouteModerationType, readonly ModerationEnforcement[]> = {
  route_comment: ['hide', 'remove'],
  route_share_link: ['revoke'],
  route_public_trace: ['remove'],
};
export function isEnforcementAllowed(type: RouteModerationType, action: ModerationEnforcement): boolean {
  return ALLOWED_ENFORCEMENT[type].includes(action);
}
/** Action par défaut d'un rejet : la moins destructive que le type permet (commentaire masqué plutôt que supprimé). */
export function defaultEnforcement(type: RouteModerationType): ModerationEnforcement {
  return ALLOWED_ENFORCEMENT[type][0];
}
export type ModerationStatus = 'en_attente' | 'approuve' | 'rejete' | 'signale';
export type AuditAction = 'APPROVE' | 'REJECT' | 'UPDATE';

export const TYPE_LABEL: Record<RouteModerationType, string> = {
  route_public_trace: 'Trace publiée',
  route_comment: 'Commentaire d’itinéraire',
  route_share_link: 'Lien partagé',
};

export function isRouteModerationType(value: unknown): value is RouteModerationType {
  return typeof value === 'string' && (ROUTE_MODERATION_TYPES as readonly string[]).includes(value);
}

const STATUS_OF: Record<ModerationDecision, ModerationStatus> = { approve: 'approuve', reject: 'rejete', flag: 'signale' };
const AUDIT_OF: Record<ModerationDecision, AuditAction> = { approve: 'APPROVE', reject: 'REJECT', flag: 'UPDATE' };

export const statusOfDecision = (d: ModerationDecision): ModerationStatus => STATUS_OF[d];
export const auditActionOfDecision = (d: ModerationDecision): AuditAction => AUDIT_OF[d];

export interface QueueRowInput {
  readonly type: RouteModerationType;
  readonly id: string;
  readonly moderatorId: string;
  readonly decision: ModerationDecision;
}

export function toAuditRow(input: QueueRowInput & { readonly before: ModerationStatus | null }) {
  return {
    admin_id: input.moderatorId,
    action: AUDIT_OF[input.decision],
    cible_type: input.type,
    cible_id: input.id.slice(0, 80),
    avant: input.before ? { statut: input.before } : null,
    apres: { statut: STATUS_OF[input.decision] },
  };
}

export function previewOf(text: unknown, max = 120): string | null {
  if (typeof text !== 'string') return null;
  // Retire les caractères de contrôle ; jamais de balisage interprété côté écran (rendu en texte).
  const clean = text.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export interface RouteModerationItem {
  readonly type: RouteModerationType;
  readonly id: string;
  readonly preview: string | null;
  readonly createdAt: string | null;
  readonly status: ModerationStatus;
}

const STATUSES: readonly ModerationStatus[] = ['en_attente', 'approuve', 'rejete', 'signale'];

/** Lignes brutes (posts publics, RPC admin) → éléments d'écran ; lignes invalides ignorées. */
export function toItems(
  type: RouteModerationType,
  rows: ReadonlyArray<{ id?: unknown; preview?: unknown; created_at?: unknown }>,
): RouteModerationItem[] {
  const out: RouteModerationItem[] = [];
  for (const r of rows) {
    if (typeof r.id !== 'string' || !r.id) continue;
    out.push({
      type,
      id: r.id,
      preview: previewOf(r.preview),
      createdAt: typeof r.created_at === 'string' ? r.created_at : null,
      status: 'en_attente',
    });
  }
  return out;
}

/**
 * Applique à chaque élément le dernier statut journalisé dans `admin_audit_log` (`apres.statut`). Les lignes doivent
 * arriver de la plus ancienne à la plus récente : la dernière gagne.
 */
export function withAuditStatus(
  items: readonly RouteModerationItem[],
  audit: ReadonlyArray<{ cible_type?: unknown; cible_id?: unknown; apres?: unknown }>,
): RouteModerationItem[] {
  const byKey = new Map<string, ModerationStatus>();
  for (const q of audit) {
    if (typeof q.cible_type !== 'string' || typeof q.cible_id !== 'string') continue;
    const statut = q.apres && typeof q.apres === 'object' ? (q.apres as { statut?: unknown }).statut : undefined;
    if (STATUSES.includes(statut as ModerationStatus)) byKey.set(`${q.cible_type}:${q.cible_id}`, statut as ModerationStatus);
  }
  return items.map((it) => ({ ...it, status: byKey.get(`${it.type}:${it.id}`) ?? it.status }));
}
