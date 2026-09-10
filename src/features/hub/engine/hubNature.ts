/**
 * H0.2/H3.3 — Dérivation pure de la nature du hub (chantier H).
 *
 * Fonction PURE : zéro import React, aucun accès `window`/`localStorage`
 * au top-level ni dans `deriveHubNature`/`deriveDefaultNature`.
 * La préférence est INJECTÉE en paramètre ; les helpers `readNaturePref`
 * / `writeNaturePref` / `resetHubPrefs` sont les seuls à toucher le storage,
 * toujours gardés (`typeof window === 'undefined'` → no-op, SSR-safe).
 */

export type Nature = 'possession' | 'sortie' | 'collectif';

export interface HubCtxInput {
  activeVoyage: { id: string; endsAt: string } | null;
  activeGroup: { id: string; memberIds: string[] } | null;
  userInventoryItems: number;
  loadedAt: number;
}

export interface FeatureFlags {
  hub_all_enabled: boolean;
  hub_possession_enabled: boolean;
  hub_sortie_enabled: boolean;
  hub_collectif_enabled: boolean;
  updatedAt: number;
  source: 'rpc' | 'cache' | 'fallback';
}

export type HubNaturePref = Nature | null;

const NATURES: readonly Nature[] = ['possession', 'sortie', 'collectif'];

const PREF_KEY = 'hub_nature_pref';

function isValidNature(value: unknown): value is Nature {
  return typeof value === 'string' && (NATURES as readonly string[]).includes(value);
}

/** Première gagnante : kill switch → pref → voyage → groupe → défaut. */
export function deriveHubNature(
  ctx: HubCtxInput,
  features: FeatureFlags,
  prefs: { naturePref: HubNaturePref | unknown },
): Nature {
  if (features.hub_all_enabled === false) return 'possession';
  const pref = prefs.naturePref;
  if (isValidNature(pref) && features[`hub_${pref}_enabled`]) return pref;
  return deriveDefaultNature(ctx, features);
}

export function deriveDefaultNature(ctx: HubCtxInput, features: FeatureFlags): Nature {
  if (features.hub_all_enabled === false) return 'possession';
  if (ctx.activeVoyage && features.hub_sortie_enabled) return 'sortie';
  if ((ctx.activeGroup?.memberIds.length ?? 0) > 1 && features.hub_collectif_enabled) {
    return 'collectif';
  }
  return 'possession';
}

/** Lecture gardée SSR : null hors navigateur ou pref absente/invalide. */
export function readNaturePref(): HubNaturePref {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    return isValidNature(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Écriture gardée SSR : no-op hors navigateur ou valeur invalide. */
export function writeNaturePref(nature: Nature): void {
  if (typeof window === 'undefined') return;
  if (!isValidNature(nature)) return;
  try {
    window.localStorage.setItem(PREF_KEY, nature);
  } catch {
    // Stockage indisponible : no-op silencieux.
  }
}

/** Réinitialisation gardée SSR : efface la pref, défaut possession. */
export function resetHubPrefs(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PREF_KEY);
  } catch {
    // Stockage indisponible (navigation privée verrouillée…) : no-op silencieux.
  }
}
