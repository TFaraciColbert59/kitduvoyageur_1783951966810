/**
 * CHANTIER ATLAS — Phase 7
 * Résolution pure de l'activation du moteur unifié (testable sans réseau).
 *
 * Priorité :
 *   1. switch interne `?atlas=1` (tests, équipe, vérifications visuelles) ;
 *   2. flag global `explorer_unified_map_enabled` (rollout par paliers).
 * Fail-safe : tout ce qui n'est pas exactement `true` garde le moteur legacy.
 */

export interface UnifiedMapGateInput {
  flagEnabled: boolean;
  atlasParam: string | null | undefined;
}

export function resolveUnifiedMapEnabled({
  flagEnabled,
  atlasParam,
}: UnifiedMapGateInput): boolean {
  if (atlasParam === '1') return true;
  return flagEnabled === true;
}
