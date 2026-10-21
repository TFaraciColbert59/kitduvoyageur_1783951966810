export declare function initCompteLiquidGlassRuntime(rootContainer: HTMLElement | null): () => void;

/** `'public'` → 2, `'prive'` → 0 ; index historiques 0|1|2 acceptés ; inconnu → null. */
export declare function resolveSetVis(value: unknown): number | null;

/** Transition idempotente de `setvis` ; null si la valeur est inconnue. */
export declare function applySetVis(current: number, value: unknown): number | null;

/** Résout la confidentialité du compte (`profile_visibility`) : `'public'` | `'prive'`. */
export declare function resolveProfileVis(value: unknown): 'public' | 'prive' | null;

/** Transition idempotente de `setprofilevis` ; null si la valeur est inconnue. */
export declare function applyProfileVis(current: unknown, value: unknown): 'public' | 'prive' | null;

/**
 * Action `setprofilevis` de `window.__lkdvCompteAct` : applique exactement
 * `'public'` ou `'prive'` à `S.profileVisibility`, de façon idempotente, puis
 * déclenche le pont `__lkdvOnMutate('profilevis', valeur)`.
 */
export type SetProfileVisAction = (value: 'public' | 'prive') => void;

declare global {
  interface Window {
    /**
     * Rétablit `S.profileVisibility` sans repasser par le pont de mutation.
     * Exposé par le runtime pour les échecs de persistance.
     */
    __lkdvSetProfileVisibility?: SetProfileVisAction;
  }
}
