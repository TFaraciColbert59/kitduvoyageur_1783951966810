/**
 * Contrat de lecture audio pendant une sortie active.
 *
 * État vérifié au 2026-11-11 : **aucun SDK Spotify, aucun jeton et aucune
 * route OAuth** ne sont présents dans le dépôt. Le module ne fabrique donc
 * jamais de jeton : il expose une capacité explicite, et l'interface affiche
 * l'indisponibilité au lieu de simuler une lecture.
 *
 * Pour activer la fonction, il faudra fournir :
 * - un identifiant client Spotify public (`NEXT_PUBLIC_SPOTIFY_CLIENT_ID`) ;
 * - une route de retour OAuth côté serveur et le stockage chiffré du jeton de
 *   rafraîchissement (jamais dans le client) ;
 * - un adaptateur implémentant `AudioControlPort` (Web Playback SDK ou API
 *   Web) et les autorisations Premium requises par Spotify.
 *
 * Tant que ces trois éléments manquent, `available` reste `false` et l'état
 * est annoncé à l'utilisateur.
 */

export type AudioProvider = 'spotify' | 'none';

export type AudioUnavailableReason =
  | 'oauth_not_configured'
  | 'sdk_missing'
  | 'not_linked'
  | 'account_required'
  | 'provider_unsupported';

export interface AudioAvailability {
  provider: AudioProvider;
  available: boolean;
  /** `null` uniquement quand `available` vaut `true`. */
  reason: AudioUnavailableReason | null;
  /** La lecture peut-elle être pilotée à distance par l'application ? */
  canControlPlayback: boolean;
  /** Vrai uniquement si un jeton a été obtenu par un flux OAuth réel. */
  hasAuthorizedToken: boolean;
}

export interface SpotifyEnv {
  NEXT_PUBLIC_SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
  SPOTIFY_REDIRECT_URI?: string;
}

export interface AudioPlaybackState {
  /** Titre réel renvoyé par le fournisseur ; jamais une valeur inventée. */
  title: string | null;
  artist: string | null;
  playing: boolean;
  /** Position en millisecondes, `null` si le fournisseur ne la donne pas. */
  positionMs: number | null;
}

/**
 * Port d'adaptation. Aucune implémentation n'existe dans ce lot : la fonction
 * de création renvoie toujours `null`, ce qui interdit à l'UI de prétendre
 * qu'un lecteur est disponible.
 */
export interface AudioControlPort {
  provider: 'spotify';
  play(): Promise<void>;
  pause(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  getState(): Promise<AudioPlaybackState | null>;
}

function configuredClientId(env: SpotifyEnv): string {
  const value = env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Capacité réelle du fournisseur. Même avec un identifiant client, l'absence
 * d'adaptateur et de jeton OAuth interdit de déclarer le contrôle disponible.
 */
export function readSpotifyAvailability(env: SpotifyEnv, options: { linked?: boolean } = {}): AudioAvailability {
  const clientId = configuredClientId(env);
  if (!clientId) {
    return {
      provider: 'none',
      available: false,
      reason: 'oauth_not_configured',
      canControlPlayback: false,
      hasAuthorizedToken: false,
    };
  }

  if (options.linked !== true) {
    return {
      provider: 'spotify',
      available: false,
      reason: 'not_linked',
      canControlPlayback: false,
      hasAuthorizedToken: false,
    };
  }

  // Aucun adaptateur Spotify n'est livré : `createSpotifyAudioPort` renvoie
  // null. On ne peut donc pas exposer un contrôle, même avec un compte lié.
  return {
    provider: 'spotify',
    available: false,
    reason: 'sdk_missing',
    canControlPlayback: false,
    hasAuthorizedToken: false,
  };
}

/** Aucun adaptateur n'est installé dans ce lot : retour explicite `null`. */
export function createSpotifyAudioPort(): AudioControlPort | null {
  return null;
}

/** Message affiché à l'utilisateur, sans jargon ni promesse de fonction. */
export function spotifyUnavailableMessage(reason: AudioUnavailableReason | null): string {
  switch (reason) {
    case 'oauth_not_configured':
      return 'Spotify n’est pas configuré sur cette version. Aucun compte n’est connecté et la lecture ne peut pas être pilotée.';
    case 'sdk_missing':
      return 'Le lecteur Spotify n’est pas installé dans cette version. La connexion du compte ne suffit pas à piloter la lecture.';
    case 'not_linked':
      return 'Aucun compte Spotify n’est relié à ton profil. La lecture reste indisponible.';
    case 'account_required':
      return 'Un compte Spotify Premium relié est nécessaire pour piloter la lecture.';
    case 'provider_unsupported':
      return 'Ce fournisseur audio n’est pas pris en charge.';
    default:
      return 'Le contrôle audio est indisponible. L’enregistrement de la sortie continue normalement.';
  }
}

/** Libellé court du fournisseur, pour l'en-tête du panneau. */
export function audioProviderLabel(provider: AudioProvider): string {
  return provider === 'spotify' ? 'Spotify' : 'Aucun fournisseur';
}
