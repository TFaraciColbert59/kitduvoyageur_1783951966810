import type {
  LiveSessionState,
  SafetyContact,
  SafetyNotificationPayload,
  ShareLinkStatus,
  WatchSnapshot,
} from '@/features/live-tracking';

/**
 * Vue propriétaire d'un lien de partage.
 *
 * `tokenHash` et `ownerUserId` ne sortent JAMAIS de la couche serveur : le
 * navigateur n'a besoin que de l'état du lien, pas de l'empreinte qui permet
 * de retrouver le jeton. Le jeton brut n'existe que dans la réponse de
 * création, une seule fois.
 */
export interface ShareLinkView {
  id: string;
  sessionId: string;
  label?: string;
  createdAtIso: string;
  expiresAtIso: string;
  revokedAtIso: string | null;
  lastAccessedAtIso: string | null;
  includeTrail: boolean;
  status: ShareLinkStatus;
}

export interface OwnerLiveTrackingStatus {
  sessions: LiveSessionState[];
  links: ShareLinkView[];
  contacts: SafetyContact[];
  activeSessionId: string | null;
  shareBaseUrl: string;
  watch: WatchSnapshot | null;
  notifications: SafetyNotificationPayload[];
  /** Horloge serveur, pour que l'UI n'invente pas une échéance locale. */
  nowMs: number;
}

export interface CreatedShareLinkView {
  link: ShareLinkView;
  /**
   * URL complète à transmettre. Elle contient le jeton brut et n'est donc
   * affichée qu'une seule fois, juste après la création.
   */
  shareUrl: string;
  expiresAtIso: string;
}

export interface StartSessionResponse {
  session: LiveSessionState;
}

export interface GuestApiError {
  ok: false;
  reason: 'invalid_token' | 'revoked' | 'expired' | 'session_ended' | 'privacy_denied';
}
