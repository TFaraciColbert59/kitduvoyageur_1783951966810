/**
 * Contrat TypeScript complet pour le lot P02 — Live Tracking & Beacon (K7.01, K7.02, K7.03, S6.11).
 *
 * Invariants :
 * - Fail-closed strict : un lien révoqué, expiré ou d'une séance terminée ne retourne aucune position ni historique.
 * - Aucune coordonnée exposée sans token valide ; aucun secret en clair persisté (SHA-256 uniquement).
 */

export type LiveSessionStatus = 'active' | 'paused' | 'ended';

export type ShareLinkStatus = 'active' | 'revoked' | 'expired' | 'session_ended';

export type PositionFreshness = 'live' | 'stale' | 'offline';

export type SafetyContactChannel = 'sms' | 'email' | 'push' | 'in_app';

export type SafetyContactConsentStatus = 'pending' | 'accepted' | 'revoked';

export type WatchPlatform = 'apple_watch' | 'wear_os';

export interface GeoCoordinates {
  lat: number;
  lng: number;
  accuracyM?: number | null;
  altitudeM?: number | null;
  headingDeg?: number | null;
  speedMps?: number | null;
}

export interface LivePositionPoint extends GeoCoordinates {
  sessionId: string;
  recordedAtMs: number;
  /** Horloge monotone optionnelle (recherche 01) pour éviter les sauts d'horloge UTC. */
  monotonicMs?: number;
}

export interface GuestPositionView {
  lat: number;
  lng: number;
  accuracyM: number | null;
  recordedAtIso: string;
  ageSeconds: number;
  freshness: PositionFreshness;
  isStale: boolean;
}

/**
 * Enregistrement persisté côté serveur pour un lien de partage.
 * Ne contient JAMAIS le token brut en clair, uniquement son empreinte SHA-256.
 */
export interface PersistedShareTokenRecord {
  id: string;
  sessionId: string;
  ownerUserId: string;
  /** Empreinte hexadécimale SHA-256 du jeton brut. */
  tokenHash: string;
  label?: string;
  createdAtMs: number;
  expiresAtMs: number;
  revokedAtMs: number | null;
  lastAccessedAtMs: number | null;
  includeTrail: boolean;
}

export interface CreateShareLinkInput {
  sessionId: string;
  ownerUserId: string;
  /** Durée de validité en minutes (bornée entre 5 min et 4320 min / 72h). */
  durationMinutes: number;
  label?: string;
  /** Autorise l'affichage d'un court historique récent tant que le lien est actif. */
  includeTrail?: boolean;
}

export interface CreatedShareLink {
  record: PersistedShareTokenRecord;
  /**
   * Jeton brut retourné UNE SEULE FOIS à la création pour construire l'URL invité.
   * Ne doit jamais être persisté côté serveur ni journalisé.
   */
  rawToken: string;
  expiresAtIso: string;
}

export interface LiveSessionState {
  sessionId: string;
  ownerUserId: string;
  status: LiveSessionStatus;
  startedAtMs: number;
  endedAtMs: number | null;
  /** Règle P01 : identifiants de tiers bloqués ou exclus de la diffusion. */
  blockedViewerIds?: string[];
  /** Règle P01 : masquage éventuel d'une zone de confidentialité (ex. domicile). */
  privacyMaskRadiusM?: number;
}

export interface P01PrivacyContext {
  viewerId?: string | null;
  /** Indique si la règle de confidentialité P01 autorise la diffusion live pour cette séance. */
  liveSharingAllowed: boolean;
  /** Rayon d'arrondi/floutage éventuel imposé par P01 (0 = position exacte). */
  obfuscationRadiusM?: number;
}

export type GuestTrackingReadResult =
  | {
      ok: true;
      sessionId: string;
      status: 'active' | 'paused';
      expiresAtIso: string;
      latestPosition: GuestPositionView | null;
      trail: GuestPositionView[];
    }
  | {
      ok: false;
      reason: 'invalid_token' | 'revoked' | 'expired' | 'session_ended' | 'privacy_denied';
    };

export interface SafetyContact {
  id: string;
  ownerUserId: string;
  displayName: string;
  channel: SafetyContactChannel;
  /** Adresse email, numéro E.164 ou identifiant push/in-app. */
  destination: string;
  consentStatus: SafetyContactConsentStatus;
  consentedAtMs: number | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface AddSafetyContactInput {
  ownerUserId: string;
  displayName: string;
  channel: SafetyContactChannel;
  destination: string;
}

export type SafetyNotificationEvent =
  | 'live_share_started'
  | 'live_share_stopped'
  | 'safety_ping';

export interface SafetyNotificationPayload {
  contactId: string;
  channel: SafetyContactChannel;
  destination: string;
  event: SafetyNotificationEvent;
  sessionId: string;
  /** URL de suivi construite à la volée ; jamais persistée avec le secret côté store. */
  shareUrl?: string;
  sentAtMs: number;
}

export interface SafetyBroadcastResult {
  notifiedContactIds: string[];
  skippedUnconsentedIds: string[];
  failedContactIds: string[];
}

export interface WatchDeviceInfo {
  deviceId: string;
  platform: WatchPlatform;
  osVersion: string;
  appVersion: string;
  isPaired: boolean;
  hasLocationPermission: boolean;
  hasBackgroundPermission: boolean;
}

export type WatchCommand =
  | {
      type: 'start_live_share';
      sessionId: string;
      ownerUserId: string;
      durationMinutes: number;
      notifySafetyContacts?: boolean;
    }
  | {
      type: 'stop_live_share';
      sessionId: string;
      ownerUserId: string;
      tokenId?: string;
    }
  | {
      type: 'sync_status';
      sessionId: string;
      ownerUserId: string;
    };

export interface WatchSnapshot {
  platform: WatchPlatform;
  sessionId: string;
  isSharingActive: boolean;
  activeLinkCount: number;
  expiresAtIso: string | null;
  lastPositionAgeSeconds: number | null;
}

export type WatchCommandResult =
  | {
      ok: true;
      snapshot: WatchSnapshot;
      /** Présent uniquement lors d'un démarrage réussi, sans jamais être persisté sur la montre. */
      shareCreated?: boolean;
    }
  | {
      ok: false;
      error:
        | 'watch_not_paired'
        | 'unsupported_os_version'
        | 'missing_location_permission'
        | 'missing_background_permission'
        | 'session_not_active'
        | 'privacy_denied'
        | 'unauthorized';
      message: string;
    };

export interface LiveTrackingClock {
  nowMs(): number;
}

export interface LiveTrackingStore {
  getSession(sessionId: string): Promise<LiveSessionState | null>;
  saveSession(session: LiveSessionState): Promise<void>;
  saveToken(record: PersistedShareTokenRecord): Promise<void>;
  findTokenByHash(tokenHash: string): Promise<PersistedShareTokenRecord | null>;
  listTokensBySession(sessionId: string): Promise<PersistedShareTokenRecord[]>;
  updateToken(record: PersistedShareTokenRecord): Promise<void>;
  appendPosition(point: LivePositionPoint): Promise<void>;
  getPositions(sessionId: string): Promise<LivePositionPoint[]>;
  purgePositions(sessionId: string): Promise<void>;
}

export interface SafetyContactStore {
  listByOwner(ownerUserId: string): Promise<SafetyContact[]>;
  getById(contactId: string): Promise<SafetyContact | null>;
  save(contact: SafetyContact): Promise<void>;
  delete(contactId: string): Promise<void>;
}

export interface SafetyNotifier {
  send(payload: SafetyNotificationPayload): Promise<{ ok: boolean }>;
}
