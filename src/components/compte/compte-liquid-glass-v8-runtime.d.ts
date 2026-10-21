export declare function initCompteLiquidGlassRuntime(rootContainer: HTMLElement | null): () => void;

/** `'public'` → 2, `'prive'` → 0 ; index historiques 0|1|2 acceptés ; inconnu → null. */
export declare function resolveSetVis(value: unknown): number | null;

/** Transition idempotente de `setvis` ; null si la valeur est inconnue. */
export declare function applySetVis(current: number, value: unknown): number | null;
