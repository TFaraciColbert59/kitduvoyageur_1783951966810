/**
 * Choix du palier de maillage à l'exécution.
 *
 * Le Studio dispose de deux versions de chaque sac : `web`, moins de 900 Ko, qui part avec le
 * déploiement, et `hd`, le master Meshy texturé, qui peut peser quarante fois plus et vit dans un
 * dépôt distant.
 *
 * La règle tient en une phrase : **on ne sert `hd` que sur preuve.** Un maillage de 40 Mo n'est pas
 * seulement une question de carte graphique — c'est une minute d'attente sur un réseau mobile, sur
 * le meilleur téléphone du marché comme sur le plus modeste. Devant un signal manquant, on sert
 * `web` : un sac un peu moins fin vaut mieux qu'un sac qui n'arrive pas.
 *
 * Fonction pure, sans accès au navigateur : l'appelant lit les signaux et les passe ici, ce qui
 * rend la décision testable sans simuler un appareil.
 */

import type { BagManifest, BagTier } from './parts';

export interface DeviceProfile {
  /** `navigator.deviceMemory`, en Go. Absent sur Safari et Firefox : c'est le cas courant. */
  deviceMemoryGb: number | null;
  /** `navigator.hardwareConcurrency`. */
  hardwareConcurrency: number | null;
  /** `navigator.connection.saveData` : l'utilisateur a demandé d'économiser ses données. */
  saveData: boolean;
  /** `navigator.connection.effectiveType` : 'slow-2g' | '2g' | '3g' | '4g', ou null. */
  effectiveType: string | null;
  /** Media query `prefers-reduced-data`. */
  prefersReducedData: boolean;
  /** Préférence explicite de la personne, qui l'emporte sur tout le reste. */
  override?: BagTier | null;
}

export interface TierDecision {
  tier: BagTier;
  /** Pourquoi, en une phrase affichable telle quelle. */
  reason: string;
}

/** Appareil pour lequel on n'a aucun signal : le profil le plus prudent possible. */
export const UNKNOWN_DEVICE: DeviceProfile = {
  deviceMemoryGb: null,
  hardwareConcurrency: null,
  saveData: false,
  effectiveType: null,
  prefersReducedData: false,
  override: null,
};

const SLOW_CONNECTIONS = new Set(['slow-2g', '2g', '3g']);

/** Seuils : 8 Go de mémoire et 6 cœurs, soit un appareil haut de gamme des dernières années. */
const HD_MIN_MEMORY_GB = 8;
const HD_MIN_CORES = 6;

/**
 * Lit les signaux du navigateur. Isolé ici pour que `chooseBagTier` reste pure et testable.
 * Tout accès est protégé : ces API sont absentes ou lèvent selon le navigateur et le contexte.
 */
export function readDeviceProfile(): DeviceProfile {
  if (typeof navigator === 'undefined') return UNKNOWN_DEVICE;
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  let prefersReducedData = false;
  try {
    prefersReducedData = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-data: reduce)').matches;
  } catch {
    prefersReducedData = false;
  }
  return {
    deviceMemoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    hardwareConcurrency: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    saveData: nav.connection?.saveData === true,
    effectiveType: typeof nav.connection?.effectiveType === 'string' ? nav.connection.effectiveType : null,
    prefersReducedData,
    override: null,
  };
}

/**
 * Décide du palier à charger pour un manifeste donné.
 *
 * L'ordre compte : une demande explicite d'économiser les données passe avant la préférence de la
 * personne pour la haute définition, parce qu'elle porte sur ce qu'on lui facture, pas sur son goût.
 */
export function chooseBagTier(manifest: BagManifest, profile: DeviceProfile): TierDecision {
  const assets = manifest.assets;
  const hasHd = Boolean(assets?.hd);
  const hasWeb = Boolean(assets?.web);

  if (!hasHd) {
    return { tier: 'web', reason: 'Un seul maillage disponible pour ce sac.' };
  }
  if (!hasWeb) {
    return { tier: 'hd', reason: 'Seul le maillage haute définition existe pour ce sac.' };
  }

  if (profile.saveData || profile.prefersReducedData) {
    return { tier: 'web', reason: 'Économie de données demandée par l’appareil.' };
  }
  if (profile.override === 'hd') {
    return { tier: 'hd', reason: 'Haute définition choisie dans les réglages.' };
  }
  if (profile.override === 'web') {
    return { tier: 'web', reason: 'Qualité standard choisie dans les réglages.' };
  }
  if (profile.effectiveType && SLOW_CONNECTIONS.has(profile.effectiveType)) {
    return { tier: 'web', reason: 'Connexion lente détectée.' };
  }
  // Pas de preuve de mémoire : c'est le cas de Safari, qui n'expose pas `deviceMemory`. On ne
  // devine pas à partir du seul nombre de cœurs — un appareil modeste en annonce autant qu'un
  // haut de gamme. La haute définition reste accessible, mais par un choix explicite.
  if (profile.deviceMemoryGb == null) {
    return { tier: 'web', reason: 'Capacité de l’appareil inconnue : qualité standard par sécurité.' };
  }
  if (profile.deviceMemoryGb < HD_MIN_MEMORY_GB) {
    return { tier: 'web', reason: 'Mémoire de l’appareil insuffisante pour le master.' };
  }
  if (profile.hardwareConcurrency != null && profile.hardwareConcurrency < HD_MIN_CORES) {
    return { tier: 'web', reason: 'Processeur de l’appareil insuffisant pour le master.' };
  }
  return { tier: 'hd', reason: 'Appareil capable : maillage haute définition.' };
}

/** Résout l'adresse du fichier à charger, ou `null` si le manifeste n'en déclare aucune. */
export function resolveBagAssetUrl(manifest: BagManifest, tier: BagTier): string | null {
  return manifest.assets?.[tier]?.url ?? null;
}
