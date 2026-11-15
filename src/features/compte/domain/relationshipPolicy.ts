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
 *
 * Deux sourdines distinctes coexistent :
 *   - la sourdine de contenu masque les publications de fil et les stories ;
 *   - la sourdine de conversation coupe les notifications d'une conversation
 *     directe.
 * Aucune des deux ne remplace le blocage, et aucune ne supprime le suivi.
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
  | 'mute_content'
  | 'unmute_content'
  | 'mute_conversation'
  | 'unmute_conversation'
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
  /** Ligne `user_content_mutes` : le lecteur masque les contenus de la cible. */
  mutedContent?: boolean;
  /** Une conversation directe existe-t-elle ? Faux si l'action est impossible. */
  hasDirectConversation?: boolean;
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
  /** Vrai si au moins une des deux sourdines est active. */
  muted: boolean;
  mutedContent: boolean;
  mutedConversation: boolean;
  /** État de suivi observé, exposé pour l'UI de sourdine de contenu. */
  followState: RelationshipFollowState;
  canFollow: boolean;
  canUnfollow: boolean;
  canMessage: boolean;
  canReport: boolean;
  canBlock: boolean;
  canUnblock: boolean;
  /** Alias historique de `canMuteConversation`. */
  canMute: boolean;
  /** Alias historique de `canUnmuteConversation`. */
  canUnmute: boolean;
  canMuteContent: boolean;
  canUnmuteContent: boolean;
  canMuteConversation: boolean;
  canUnmuteConversation: boolean;
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
 * - `mutedContent` ne masque que les publications de fil et les stories ;
 *   `mutedConversation` ne coupe que les notifications de la conversation
 *   directe. Les deux sont indépendantes et ne bloquent ni le suivi ni le
 *   signalement.
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
  const mutedContent = facts.mutedContent === true;
  const mutedConversation = facts.mutedConversation === true;
  const muted = mutedContent || mutedConversation;
  // Une conversation absente ne rend pas la sourdine de contenu indisponible.
  const hasDirectConversation = facts.hasDirectConversation !== false;
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
  // La sourdine de contenu sert à rester abonné : elle n'est posable que si le
  // suivi est réellement actif. La révocation reste possible après un
  // désabonnement, pour ne pas laisser une préférence impossible à retirer.
  const canMuteContent =
    authenticated && !isSelf && !blocked && followState === 'following' && !mutedContent;
  const canUnmuteContent = authenticated && mutedContent;
  const canMuteConversation =
    authenticated && !isSelf && !blocked && hasDirectConversation && !mutedConversation;
  const canUnmuteConversation = authenticated && mutedConversation;

  return {
    isSelf,
    blocked,
    blockedByViewer,
    blockedByTarget,
    muted,
    mutedContent,
    mutedConversation,
    followState,
    canFollow,
    canUnfollow,
    canMessage,
    // Le signalement reste possible même après un blocage : la modération doit
    // pouvoir recevoir un abus déjà survenu. Seul son propre profil est exclu.
    canReport: authenticated && !isSelf,
    canBlock: authenticated && !isSelf && !blockedByViewer,
    canUnblock: authenticated && blockedByViewer,
    canMute: canMuteConversation,
    canUnmute: canUnmuteConversation,
    canMuteContent,
    canUnmuteContent,
    canMuteConversation,
    canUnmuteConversation,
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
      return policy.canMuteConversation;
    case 'unmute':
      return policy.canUnmuteConversation;
    case 'mute_content':
      return policy.canMuteContent;
    case 'unmute_content':
      return policy.canUnmuteContent;
    case 'mute_conversation':
      return policy.canMuteConversation;
    case 'unmute_conversation':
      return policy.canUnmuteConversation;
    case 'report':
      return policy.canReport;
    case 'message':
      return policy.canMessage;
    default:
      return false;
  }
}
