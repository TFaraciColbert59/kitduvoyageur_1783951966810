import { isIOS, isNative } from "./platform";

/**
 * Pont Capacitor `NativeLiquidGlass` — primitives iOS 27 Liquid Glass v8.
 *
 * Expose les composants système Apple du Design System unique LKDV :
 * - Feuilles linéaires à 3 hauteurs (`closed`, `peek`, `medium`, `large`)
 *   synchronisées avec le repli de la `UITabBar` et de la `UITabAccessory` ;
 * - Menus morphing (`presentNativeMorphingMenu`) ancrés sur la pilule touchée ;
 * - Capsule Dynamic Island / Undo (`presentNativeUndoBanner`) avec bouton `Annuler` ;
 * - Mode Plein Soleil (`setNativeOutdoorMode`) et retours haptiques (`triggerNativeGlassHaptic`).
 *
 * Toutes les fonctions sont 100 % sans effet (no-op sûr) sur Web, PWA et Android.
 */

export type LiquidGlassDetent = "closed" | "peek" | "medium" | "large";

export const LIQUID_GLASS_DETENTS: readonly LiquidGlassDetent[] = [
  "closed",
  "peek",
  "medium",
  "large",
] as const;

export function isAllowedSheetDetent(value: unknown): value is LiquidGlassDetent {
  return (
    typeof value === "string" &&
    (LIQUID_GLASS_DETENTS as readonly string[]).includes(value)
  );
}

export interface MorphingMenuOption {
  id: string;
  label: string;
  subtitle?: string;
  symbol?: string;
}

export interface MorphingMenuRequest {
  title?: string;
  selectedId?: string;
  options: readonly MorphingMenuOption[];
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface UndoBannerRequest {
  title: string;
  subtitle?: string;
  undoable?: boolean;
  durationMs?: number;
}

export interface LiquidGlassCapabilities {
  available: boolean;
  iosMajor: number;
  supportsLiquidGlass: boolean;
  supportsThreeDetents: boolean;
  supportsTabAccessory: boolean;
  outdoorMode: boolean;
  activeDetent: LiquidGlassDetent;
}

export type LiquidGlassHapticStyle =
  | "light"
  | "medium"
  | "heavy"
  | "selection"
  | "success"
  | "warning";

interface NativeLiquidGlassPlugin {
  getCapabilities(): Promise<LiquidGlassCapabilities>;
  setSheetDetent(options: { detent: LiquidGlassDetent }): Promise<{ detent: LiquidGlassDetent }>;
  dismissSheet(): Promise<{ detent: "closed" }>;
  presentMorphingMenu(options: {
    title?: string;
    selectedId?: string;
    options: readonly MorphingMenuOption[];
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }): Promise<{ selectedId: string | null; cancelled: boolean }>;
  presentUndoBanner(options: {
    title: string;
    subtitle?: string;
    undoable?: boolean;
    durationMs?: number;
  }): Promise<{ presented: boolean }>;
  hideUndoBanner(): Promise<{ presented: boolean }>;
  setOutdoorMode(options: { outdoor: boolean }): Promise<{ outdoor: boolean }>;
  triggerHaptic(options: { style: LiquidGlassHapticStyle }): Promise<{ triggered: boolean }>;
  addListener(
    eventName: "undoRequested",
    listener: () => void
  ): Promise<{ remove: () => void }>;
  addListener(
    eventName: "sheetDetentChanged",
    listener: (event: { detent: string }) => void
  ): Promise<{ remove: () => void }>;
  addListener(
    eventName: "menuSelected",
    listener: (event: { id: string }) => void
  ): Promise<{ remove: () => void }>;
}

const DEFAULT_CAPABILITIES: LiquidGlassCapabilities = {
  available: false,
  iosMajor: 0,
  supportsLiquidGlass: false,
  supportsThreeDetents: false,
  supportsTabAccessory: false,
  outdoorMode: false,
  activeDetent: "closed",
};

let cachedPlugin: NativeLiquidGlassPlugin | null = null;

async function loadPlugin(): Promise<NativeLiquidGlassPlugin | null> {
  if (typeof window === "undefined") return null;
  if (cachedPlugin) return cachedPlugin;
  try {
    const core = require("@capacitor/core") as typeof import("@capacitor/core");
    if (!core.Capacitor?.isNativePlatform?.() || core.Capacitor?.getPlatform?.() !== "ios") {
      return null;
    }
    const plugin = core.registerPlugin<NativeLiquidGlassPlugin>("NativeLiquidGlass", {
      web: {
        getCapabilities: async () => DEFAULT_CAPABILITIES,
        setSheetDetent: async (opts: { detent: LiquidGlassDetent }) => ({ detent: opts.detent }),
        dismissSheet: async () => ({ detent: "closed" as const }),
        presentMorphingMenu: async () => ({ selectedId: null, cancelled: true }),
        presentUndoBanner: async () => ({ presented: false }),
        hideUndoBanner: async () => ({ presented: false }),
        setOutdoorMode: async (opts: { outdoor: boolean }) => ({ outdoor: opts.outdoor }),
        triggerHaptic: async () => ({ triggered: false }),
        addListener: async () => ({ remove: () => {} }),
      } as unknown as NativeLiquidGlassPlugin,
    });
    cachedPlugin = plugin as NativeLiquidGlassPlugin;
    return cachedPlugin;
  } catch {
    return null;
  }
}

/** Vrai uniquement sur iOS natif (Capacitor). */
export function isNativeLiquidGlassSupported(): boolean {
  return isNative() && isIOS();
}

/** Retourne les capacités iOS 27 Liquid Glass de l'appareil courant. */
export async function getNativeLiquidGlassCapabilities(): Promise<LiquidGlassCapabilities> {
  if (!isNativeLiquidGlassSupported()) return DEFAULT_CAPABILITIES;
  try {
    const plugin = await loadPlugin();
    if (!plugin) return DEFAULT_CAPABILITIES;
    return await plugin.getCapabilities();
  } catch {
    return DEFAULT_CAPABILITIES;
  }
}

/** Synchronise la hauteur de la feuille active (`closed`, `peek`, `medium`, `large`). */
export async function setNativeSheetDetent(detent: LiquidGlassDetent): Promise<void> {
  if (!isAllowedSheetDetent(detent) || !isNativeLiquidGlassSupported()) return;
  try {
    const plugin = await loadPlugin();
    await plugin?.setSheetDetent({ detent });
  } catch {
  }
}

/** Ferme la feuille active côté natif et restaure la barre d'onglets. */
export async function dismissNativeSheet(): Promise<void> {
  if (!isNativeLiquidGlassSupported()) return;
  try {
    const plugin = await loadPlugin();
    await plugin?.dismissSheet();
  } catch {
  }
}

/** Ouvre un menu morphing natif ancré sur la pilule touchée. */
export async function presentNativeMorphingMenu(
  request: MorphingMenuRequest
): Promise<string | null> {
  if (!isNativeLiquidGlassSupported() || !request.options.length) return null;
  try {
    const plugin = await loadPlugin();
    if (!plugin) return null;
    const res = await plugin.presentMorphingMenu({
      title: request.title,
      selectedId: request.selectedId,
      options: request.options,
      x: request.rect?.x,
      y: request.rect?.y,
      width: request.rect?.width,
      height: request.rect?.height,
    });
    return res && !res.cancelled ? res.selectedId : null;
  } catch {
    return null;
  }
}

/** Affiche la capsule haute Dynamic Island avec bouton `Annuler`. */
export async function presentNativeUndoBanner(request: UndoBannerRequest): Promise<void> {
  if (!isNativeLiquidGlassSupported() || !request.title.trim()) return;
  try {
    const plugin = await loadPlugin();
    await plugin?.presentUndoBanner({
      title: request.title.trim(),
      subtitle: request.subtitle ?? "",
      undoable: request.undoable ?? true,
      durationMs: request.durationMs ?? 3800,
    });
  } catch {
  }
}

/** Masque la capsule haute Dynamic Island. */
export async function hideNativeUndoBanner(): Promise<void> {
  if (!isNativeLiquidGlassSupported()) return;
  try {
    const plugin = await loadPlugin();
    await plugin?.hideUndoBanner();
  } catch {
  }
}

/** Bascule le mode Plein Soleil (`☀`) sur le conteneur natif iOS. */
export async function setNativeOutdoorMode(outdoor: boolean): Promise<void> {
  if (!isNativeLiquidGlassSupported()) return;
  try {
    const plugin = await loadPlugin();
    await plugin?.setOutdoorMode({ outdoor: Boolean(outdoor) });
  } catch {
  }
}

/** Déclenche un retour haptique iOS 27 (sélection de hauteur de feuille, validation, etc.). */
export async function triggerNativeGlassHaptic(
  style: LiquidGlassHapticStyle = "light"
): Promise<void> {
  if (!isNativeLiquidGlassSupported()) return;
  try {
    const plugin = await loadPlugin();
    await plugin?.triggerHaptic({ style });
  } catch {
  }
}

/** Abonne l'écran actif au bouton `Annuler` de la Dynamic Island native. */
export async function addNativeUndoListener(onUndo: () => void): Promise<() => void> {
  if (!isNativeLiquidGlassSupported()) return () => {};
  try {
    const plugin = await loadPlugin();
    if (!plugin) return () => {};
    const handle = await plugin.addListener("undoRequested", () => {
      onUndo();
    });
    return () => {
      try {
        handle?.remove();
      } catch {
      }
    };
  } catch {
    return () => {};
  }
}

/** Abonne l'écran actif aux changements de hauteur de feuille (`peek`/`medium`/`large`/`closed`). */
export async function addNativeSheetDetentListener(
  onChange: (detent: LiquidGlassDetent) => void
): Promise<() => void> {
  if (!isNativeLiquidGlassSupported()) return () => {};
  try {
    const plugin = await loadPlugin();
    if (!plugin) return () => {};
    const handle = await plugin.addListener("sheetDetentChanged", (event) => {
      if (isAllowedSheetDetent(event?.detent)) {
        onChange(event.detent);
      }
    });
    return () => {
      try {
        handle?.remove();
      } catch {
      }
    };
  } catch {
    return () => {};
  }
}
