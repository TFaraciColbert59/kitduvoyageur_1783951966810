/**
 * Appel d'urgence après un SOS (04_CARTE §6).
 *
 * En production, le compte à rebours abouti ouvre le composeur avec le numéro
 * d'urgence du pays. En recette et en développement, l'appel est simulé : aucun
 * composeur ne s'ouvre, et l'interface affiche un bandeau avec le numéro.
 *
 * La décision est isolée ici pour être testable sans navigateur ni appareil.
 */

export interface SosCallPlan {
  action: 'dial' | 'simulate';
  /** Numéro composable (chiffres et +), ou chaîne vide si inconnu. */
  number: string;
}

/** Numéro de repli quand le pays n'a pas de donnée : 112 (Europe). */
export const FALLBACK_EMERGENCY = '112';

/** Normalise un numéro d'urgence en suite composable. */
export function normalizeEmergencyNumber(raw: string | null | undefined): string {
  if (!raw) return FALLBACK_EMERGENCY;
  const digits = String(raw).replace(/[^0-9+]/g, '');
  return digits.length >= 2 ? digits : FALLBACK_EMERGENCY;
}

/** Vrai si le compte est simulé (recette, dev, tests). */
export function sosSimulated(): boolean {
  if (typeof window !== 'undefined' && (window as unknown as { __xpSimulateSos?: boolean }).__xpSimulateSos) return true;
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) return true;
  // 1. drapeau explicite (recette, CI) ;
  if (process.env.NEXT_PUBLIC_EXPLORER_SOS_SIMULATE === '1') return true;
  if (process.env.NEXT_PUBLIC_EXPLORER_SOS_SIMULATE === '0') return false;
  // 2. build de recette (scènes activées) : jamais d'appel réel ;
  if (process.env.NEXT_PUBLIC_EXPLORER_SCENES === '1') return true;
  // 3. sinon : production compose, le reste simule.
  return process.env.NODE_ENV !== 'production';
}

export function planSosCall(
  emergency: string | null | undefined,
  options: { simulated: boolean },
): SosCallPlan {
  return {
    action: options.simulated ? 'simulate' : 'dial',
    number: normalizeEmergencyNumber(emergency),
  };
}

/** Ouvre le composeur. `navigate` est injectable pour les tests. */
export function performSosCall(
  plan: SosCallPlan,
  navigate: (url: string) => void = (url) => {
    window.location.href = url;
  },
): boolean {
  if (plan.action !== 'dial' || !plan.number) return false;
  navigate(`tel:${plan.number}`);
  return true;
}
