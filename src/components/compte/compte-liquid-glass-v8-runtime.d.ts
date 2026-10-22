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
 * Une mutation n'entre dans la pile d'annulation que si elle a changé l'état
 * et qu'elle est réversible localement. `profilevis` n'est jamais annulable.
 */
export declare function canUndoMutation(key: string, changed: boolean): boolean;

/** Résout une nationalité exacte ; null pour vide, inconnue ou non-chaîne. */
export declare function resolveNationality(value: unknown): string | null;

export interface NationalitySelectionPlan {
  value: string;
  changed: boolean;
  nats: string[];
  nationality: string;
  profileNationality: string;
}

/**
 * Plan pur de `setnat` : choix unique exact, aligné sur `traveller.nats`,
 * `traveller.nationality` et `profile.nationality`. `changed: false` signifie
 * que l'état est déjà exactement la cible (aucun pont à appeler).
 */
export declare function applySetNationality(
  current:
    | { nats?: unknown; nationality?: unknown; profileNationality?: unknown }
    | null
    | undefined,
  value: unknown
): NationalitySelectionPlan | null;

/**
 * Applique/retire la modalité du drawer : `aria-modal` sur `#sheet`, puis
 * `inert` + `aria-hidden` sur la page derrière, avec restauration exacte.
 */
export declare function applySheetModalState(sheet: HTMLElement | null, active: boolean): void;

/**
 * Cible du piège de focus aux bornes de `#sheet` ; null pour laisser le
 * comportement natif (milieu de liste) ou ne pas voler le focus d'une feuille
 * imbriquée. La feuille elle-même est renvoyée si rien n'est focusable.
 */
export declare function nextSheetFocus(
  sheet: HTMLElement | null,
  active: Element | null,
  shift: boolean
): HTMLElement | null;

/**
 * Action `setprofilevis` de `window.__lkdvCompteAct` : applique exactement
 * `'public'` ou `'prive'` à `S.profileVisibility`, de façon idempotente, puis
 * déclenche le pont `__lkdvOnMutate('profilevis', valeur)`.
 */
export type SetProfileVisAction = (value: 'public' | 'prive') => void;

/** Rétablit `S.vis` (0|1|2 ou `'public'`/`'prive'`) sans repasser par le pont. */
export type SetSignatureVisAction = (value: unknown) => void;

declare global {
  interface Window {
    /**
     * Rétablit `S.profileVisibility` sans repasser par le pont de mutation.
     * Exposé par le runtime pour les échecs de persistance.
     */
    __lkdvSetProfileVisibility?: SetProfileVisAction;
    /**
     * Rétablit `S.vis` sans repasser par le pont de mutation. Exposé par le
     * runtime pour les échecs de persistance de `signature_visibility`.
     */
    __lkdvSetSignatureVisibility?: SetSignatureVisAction;
  }
}
