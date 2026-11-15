/**
 * G01 — politique de lecture vidéo du fil (S6.28).
 *
 * Défauts sûrs : pas de lecture automatique, son coupé, pas de boucle, contrôles
 * visibles, préchargement minimal. L'autoplay n'est ouvert que si l'utilisateur
 * l'a explicitement demandé, que la carte est visible, que l'onglet est actif,
 * que l'audience autorise le média et que l'appareil ne demande pas d'économie
 * de données. `prefers-reduced-motion` désactive autoplay et boucle.
 */

import { finiteNumber, fold, strictBoolean } from './contracts';

export interface VideoPreferences {
  autoplay: boolean;
  sound: boolean;
  loop: boolean;
  data_saver: boolean;
}

export const DEFAULT_VIDEO_PREFERENCES: VideoPreferences = Object.freeze({
  autoplay: false,
  sound: false,
  loop: false,
  data_saver: true,
});

export function normalizeVideoPreferences(raw: unknown): VideoPreferences {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_VIDEO_PREFERENCES };
  }
  const row = raw as Record<string, unknown>;
  return {
    autoplay: strictBoolean(row.autoplay) === true,
    sound: strictBoolean(row.sound) === true,
    loop: strictBoolean(row.loop) === true,
    // Une préférence absente reste en économie de données : le réseau mobile
    // ne doit pas payer une vidéo que l'utilisateur n'a pas demandée.
    data_saver: strictBoolean(row.data_saver) !== false,
  };
}

export type VideoPlaybackReason =
  | 'audience_denied'
  | 'hidden'
  | 'reduced_motion'
  | 'data_saver'
  | 'slow_network'
  | 'offscreen'
  | 'autoplay'
  | 'user'
  | 'manual';

export interface VideoPlaybackInput {
  preferences?: unknown;
  /** La carte est-elle autorisée par la politique de visibilité ? */
  audienceAllowed?: boolean | null;
  documentVisible?: boolean;
  /** Fraction visible de la carte, 0 à 1. */
  visibleFraction?: number | null;
  reducedMotion?: boolean | null;
  /** `navigator.connection.saveData`. */
  saveData?: boolean | null;
  /** `navigator.connection.effectiveType`. */
  connectionType?: string | null;
  /** L'utilisateur a appuyé sur « lire » : la lecture devient explicite. */
  userInitiated?: boolean | null;
}

export interface VideoPlaybackDecision {
  /** Le média peut être monté. */
  allowed: boolean;
  shouldPlay: boolean;
  shouldPause: boolean;
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
  controls: boolean;
  preload: 'none' | 'metadata' | 'auto';
  reason: VideoPlaybackReason;
}

const SLOW_NETWORKS = new Set(['slow-2g', '2g']);

export function resolveVideoPlayback(input: VideoPlaybackInput = {}): VideoPlaybackDecision {
  const preferences = normalizeVideoPreferences(input.preferences);
  const audienceAllowed = input.audienceAllowed === true;
  const documentVisible = input.documentVisible !== false;
  const visibleFraction = finiteNumber(input.visibleFraction, { min: 0, max: 1 }) ?? 0;
  const reducedMotion = input.reducedMotion === true;
  const connectionType = fold(input.connectionType);
  const slowNetwork = SLOW_NETWORKS.has(connectionType);
  const saveData = input.saveData === true || preferences.data_saver || slowNetwork;
  const userInitiated = input.userInitiated === true;

  if (!audienceAllowed) {
    return {
      allowed: false,
      shouldPlay: false,
      shouldPause: true,
      autoplay: false,
      muted: true,
      loop: false,
      controls: true,
      preload: 'none',
      reason: 'audience_denied',
    };
  }

  if (!documentVisible) {
    return {
      allowed: true,
      shouldPlay: false,
      shouldPause: true,
      autoplay: false,
      muted: true,
      loop: false,
      controls: true,
      preload: 'none',
      reason: 'hidden',
    };
  }

  const reducedReason: VideoPlaybackReason | null = reducedMotion ? 'reduced_motion' : null;
  const networkReason: VideoPlaybackReason | null = saveData
    ? slowNetwork
      ? 'slow_network'
      : 'data_saver'
    : null;

  const autoplayAllowed =
    preferences.autoplay &&
    !reducedMotion &&
    !saveData &&
    visibleFraction >= 0.65;

  const shouldPlay = userInitiated || autoplayAllowed;
  const reason: VideoPlaybackReason = userInitiated
    ? 'user'
    : autoplayAllowed
      ? 'autoplay'
      : visibleFraction < 0.65
        ? 'offscreen'
        : reducedReason ?? networkReason ?? 'manual';

  return {
    allowed: true,
    shouldPlay,
    shouldPause: !shouldPlay,
    autoplay: autoplayAllowed,
    // L'autoplay reste muet ; le son n'est possible qu'après un geste explicite.
    muted: !(preferences.sound && userInitiated),
    loop: preferences.loop && !reducedMotion,
    controls: true,
    preload: saveData ? 'none' : visibleFraction > 0 ? 'metadata' : 'none',
    reason,
  };
}

/** Libellé lisible pour l'écran de préférences (aucun jargon technique). */
export function videoPlaybackReasonLabel(reason: VideoPlaybackReason): string {
  switch (reason) {
    case 'audience_denied':
      return 'Média non autorisé pour cette audience.';
    case 'hidden':
      return 'Lecture en pause quand l’onglet est masqué.';
    case 'reduced_motion':
      return 'Mouvement réduit : pas de lecture automatique.';
    case 'data_saver':
      return 'Économie de données active.';
    case 'slow_network':
      return 'Réseau lent : lecture manuelle.';
    case 'offscreen':
      return 'La vidéo se lance seulement quand elle est visible.';
    case 'autoplay':
      return 'Lecture automatique, sans son.';
    case 'user':
      return 'Lecture demandée.';
    case 'manual':
      return 'Lecture manuelle.';
    default:
      return 'Lecture manuelle.';
  }
}
