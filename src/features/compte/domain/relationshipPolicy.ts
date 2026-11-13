/**
 * Politique de relation entre deux comptes du réseau LKDV.
 *
 * Cette fonction pure ne lit ni n'écrit rien : elle reçoit les faits déjà
 * observés (blocage dans un sens ou l'autre, sourdine, état de suivi) et
 * décide ce qui est réellement proposable à l'écran. Elle sert de garde
 * commune aux services réseau et aux feuilles de sécurité, afin qu'un bouton
 * ne promette jamais une action que la base refusera.
 *
 * Précédence : un blocage neutralise le suivi et la messagerie ; la sourdine
 * ne bloque ni le suivi ni le signalement. Un refus de demande de suivi garde
 * un délai de retenue avant de pouvoir être redemandé.
 */

export type RelationshipFollowState = 'none' | 'following' | 'requested';

export type RelationshipDenial =
  | 'self'
  | 'blocked'
  | 'not_authenticated'
  | 'cooldown';

export type RelationshipAction =
  | 'follow'
  | 'unfollow'
  | 'block'
  | 'unblock'
  | 'mute'
  | 'unmute'
  | 'report'
  | 'message';

export interface RelationshipFacts {
  viewerId?: string | null;
  targetId?: string | null;
  /** Ligne `user_blocks` où le lecteur est `blocker_id`. */
  blockedByViewer?: boolean;
  /** Ligne `user_blocks` où la cible est `blocker_id`. */
  blockedByTarget?: boolean;
  /** Ligne `conversation_members.is_muted` pour une conversation directe. */
  mutedConversation?: boolean;
  followState?: RelationshipFollowState;
  /** Dernière demande de suivi, utilisée pour la retenue après un refus. */
  lastFollowRequestAt?: string | null;
  lastFollowRequestStatus?: 'pending' | 'accepted' | 'declined' | null;
}

export interface RelationshipPolicy {
  isSelf: boolean;
  blocked: boolean;
  blockedByViewer: boolean;
  blockedByTarget: boolean;
  muted: boolean;
  mutedConversation: boolean;
  canFollow: boolean;
  canUnfollow: boolean;
  canMessage: boolean;
  canReport: boolean;
  canBlock: boolean;
  canUnblock: boolean;
  canMute: boolean;
  canUnmute: boolean;
  followAction: 'follow' | 'unfollow' | 'none';
  denial: RelationshipDenial | null;
  /** Fin ISO de la retenue, si elle est active ; sinon `null`. */
  cooldownEndsAt: string | null;
}

export interface RelationshipPolicyOptions {
  /** Horodatage de référence, injectable pour les tests. */
  now?: Date | number;
  /** Durée de retenue après un refus. 24 h par défaut. */
  followRequestCooldownMs?: number;
}

export const FOLLOW_REQUEST_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function timestamp(value: Date | number | undefined): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return Date.now();
}

function parseDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export interface FollowCooldown {
  active: boolean;
  endsAt: string | null;
}

/**
 * Indique si une nouvelle demande de suivi est encore retenue après un refus.
 * Une date illisible n'active jamais la retenue : on ne bloque pas l'écran sur
 * une donnée douteuse, la RPC restant l'autorité finale.
 */
export function readFollowCooldown(
  lastRequestAt: string | null | undefined,
  status: RelationshipFacts['lastFollowRequestStatus'],
  options: RelationshipPolicyOptions = {}
): FollowCooldown {
  if (status !== 'declined') return { active: false, endsAt: null };
  const at = parseDate(lastRequestAt);
  if (at == null) return { active: false, endsAt: null };
  const now = timestamp(options.now);
  const duration = Math.max(0, options.followRequestCooldownMs ?? FOLLOW_REQUEST_COOLDOWN_MS);
  const endsAtMs = at + duration;
  if (now >= endsAtMs) return { active: false, endsAt: null };
  return { active: true, endsAt: new Date(endsAtMs).toISOString() };
}

/**
 * Résout les actions autorisées à partir des faits observés.
 *
 * - `blocked` est symétrique : la cible m'a bloqué ou je l'ai bloquée.
 * - `muted` ne bloque que les contenus concernés (stories, conversation).
 * - `canReport` reste vrai hors de son propre profil, y compris après un
 *   blocage : un abus déjà survenu doit rester signalable à la modération.
 */
export function resolveRelationship(
  facts: RelationshipFacts,
  options: RelationshipPolicyOptions = {}
): RelationshipPolicy {
  const viewerId = String(facts.viewerId ?? '').trim();
  const targetId = String(facts.targetId ?? '').trim();
  const isSelf = Boolean(viewerId && targetId && viewerId === targetId);
  const blockedByViewer = facts.blockedByViewer === true;
  const blockedByTarget = facts.blockedByTarget === true;
  const blocked = blockedByViewer || blockedByTarget;
  const mutedConversation = facts.mutedConversation === true;
  const muted = mutedConversation;
  const followState = facts.followState ?? 'none';
  const authenticated = Boolean(viewerId);

  const cooldown = readFollowCooldown(
    facts.lastFollowRequestAt,
    facts.lastFollowRequestStatus,
    options
  );

  let denial: RelationshipDenial | null = null;
  if (!authenticated) denial = 'not_authenticated';
  else if (isSelf) denial = 'self';
  else if (blocked) denial = 'blocked';
  else if (cooldown.active) denial = 'cooldown';

  const canUnfollow =
    authenticated && !isSelf && !blocked && (followState === 'following' || followState === 'requested');
  const canFollow =
    authenticated &&
    !isSelf &&
    !blocked &&
    followState === 'none' &&
    !cooldown.active;
  const canMessage = authenticated && !isSelf && !blocked;

  return {
    isSelf,
    blocked,
    blockedByViewer,
    blockedByTarget,
    muted,
    mutedConversation,
    canFollow,
    canUnfollow,
    canMessage,
    // Le signalement reste possible même après un blocage : la modération doit
    // pouvoir recevoir un abus déjà survenu. Seul son propre profil est exclu.
    canReport: authenticated && !isSelf,
    canBlock: authenticated && !isSelf && !blockedByViewer,
    canUnblock: authenticated && blockedByViewer,
    canMute: authenticated && !isSelf && !blocked && !muted,
    canUnmute: authenticated && muted,
    followAction: canUnfollow ? 'unfollow' : canFollow ? 'follow' : 'none',
    denial,
    cooldownEndsAt: cooldown.endsAt,
  };
}

/** Vérifie une action nommée contre une politique déjà résolue. */
export function canPerformRelationshipAction(
  policy: RelationshipPolicy,
  action: RelationshipAction
): boolean {
  switch (action) {
    case 'follow':
      return policy.canFollow;
    case 'unfollow':
      return policy.canUnfollow;
    case 'block':
      return policy.canBlock;
    case 'unblock':
      return policy.canUnblock;
    case 'mute':
      return policy.canMute;
    case 'unmute':
      return policy.canUnmute;
    case 'report':
      return policy.canReport;
    case 'message':
      return policy.canMessage;
    default:
      return false;
  }
}
