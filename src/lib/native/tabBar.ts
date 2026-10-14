import { isIOS, isNative } from "./platform";
import { getActiveDestinationId } from "@/components/mobile-nav/destinationRegistry";

/**
 * Pont Capacitor `NativeTabBar` — POC iOS Liquid Glass.
 *
 * Contrat fermé (jamais d'URL arbitraire) :
 * - exactement 5 identifiants, miroir de `destinationRegistry.ts` ;
 * - tap natif → `router.push(href)` décidé côté Next (pas de window.location) ;
 * - route React → `setSelectedTab(id)` (deep link + retour couverts).
 *
 * Impact web/PWA/Android : nul. Toutes les méthodes sont no-op hors
 * `isNativeTabBarSupported()` (iOS natif + flag de test ON).
 */

export type NativeTabId = "adventures" | "community" | "explorer" | "messages" | "me";

export const NATIVE_TAB_IDS: readonly NativeTabId[] = [
  "adventures",
  "community",
  "explorer",
  "messages",
  "me",
] as const;

/** Hrefs canoniques — ordre et valeurs du registre, jamais modifiés ici. */
export const NATIVE_TAB_HREFS: Record<NativeTabId, string> = {
  adventures: "/hub",
  community: "/communaute",
  explorer: "/explorer",
  messages: "/messagerie",
  me: "/compte",
};

const HREF_TO_TAB_ID: Record<string, NativeTabId> = {
  "/hub": "adventures",
  "/communaute": "community",
  "/explorer": "explorer",
  "/messagerie": "messages",
  "/compte": "me",
};

export function isAllowedTabId(value: unknown): value is NativeTabId {
  return (
    typeof value === "string" &&
    (NATIVE_TAB_IDS as readonly string[]).includes(value)
  );
}

/** Href canonique d'un onglet (tap natif → router.push). Rejette hors allowlist. */
export function hrefForTabId(tabId: NativeTabId): string | null {
  if (!isAllowedTabId(tabId)) return null;
  return NATIVE_TAB_HREFS[tabId] ?? null;
}

/** Onglet exact d'un href (état pressé). Les préfixes sont résolus par le registre. */
export function tabIdForHref(href: string): NativeTabId | null {
  return HREF_TO_TAB_ID[href] ?? null;
}

/**
 * Onglet actif d'un pathname — délégation stricte au registre (exact puis
 * préfixe le plus long). Retourne null si aucune destination (ex. /connexion).
 */
export function tabIdForPathname(pathname: string | null | undefined): NativeTabId | null {
  const resolved = getActiveDestinationId(pathname);
  if (resolved === null) return null;
  return isAllowedTabId(resolved) ? resolved : null;
}

/**
 * Routes sans navigation — miroir exact de `MobileNavWrapper.tsx`.
 * La barre native s'y masque comme la barre web (auth, checkout, publication).
 */
export function isNativeTabBarHiddenRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith("/connexion") ||
    pathname.startsWith("/inscription") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/communaute/publier")
  );
}

/**
 * Flag de test iOS natif — OFF par défaut, rollback instantané.
 *
 * Activation (iOS natif uniquement) : `localStorage["lkdv:native-tabbar"] = "1"`
 * ou `?native-tabbar=1`. Désactivation : supprimer la clé / le paramètre.
 * `NATIVE_TABBAR_ENABLED` (NavigationBar) reste `false` : ce flag runtime ne
 * change aucun défaut de build, il autorise seulement le POC sur appareil.
 */
export function isNativeTabBarTestEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage?.getItem("lkdv:native-tabbar") === "1") return true;
    const search = window.location?.search ?? "";
    if (search.includes("native-tabbar=1") || search.includes("native-tabbar=on")) return true;
  } catch {
    return false;
  }
  return false;
}

/** Vrai uniquement sur iOS natif avec flag de test ON (plugin Swift présent). */
export function isNativeTabBarSupported(): boolean {
  if (!isNative() || !isIOS()) return false;
  return isNativeTabBarTestEnabled();
}

// ---------------------------------------------------------------------------
// Enveloppe du plugin Capacitor (repli web no-op, jamais d'exception)
// ---------------------------------------------------------------------------

interface NativeTabBarPlugin {
  setEnabled(options: { enabled: boolean }): Promise<{ enabled: boolean }>;
  setSelectedTab(options: { tab: string }): Promise<{ selectedTab: string }>;
  setVisible(options: { visible: boolean }): Promise<{ visible: boolean }>;
  getState(): Promise<{
    available: boolean;
    enabled: boolean;
    visible: boolean;
    selectedTab: string;
    iosMajor?: number;
  }>;
  addListener(
    eventName: "tabSelected",
    listener: (event: { id: string }) => void
  ): Promise<{ remove: () => void }>;
}

let cachedPlugin: NativeTabBarPlugin | null = null;

async function loadPlugin(): Promise<NativeTabBarPlugin | null> {
  if (typeof window === "undefined") return null;
  if (cachedPlugin) return cachedPlugin;
  try {
    const core = require("@capacitor/core") as typeof import("@capacitor/core");
    if (!core.Capacitor?.isNativePlatform?.() || core.Capacitor?.getPlatform?.() !== "ios") {
      return null;
    }
    const plugin = core.registerPlugin<NativeTabBarPlugin>("NativeTabBar", {
      web: {
        setEnabled: async () => ({ enabled: false }),
        setSelectedTab: async () => ({ selectedTab: "adventures" }),
        setVisible: async () => ({ visible: false }),
        getState: async () => ({
          available: false,
          enabled: false,
          visible: false,
          selectedTab: "adventures",
        }),
        addListener: async () => ({ remove: () => {} }),
      } as unknown as NativeTabBarPlugin,
    });
    cachedPlugin = plugin as NativeTabBarPlugin;
    return cachedPlugin;
  } catch {
    return null;
  }
}

/** Active/désactive la barre native (sans effet hors iOS natif). */
export async function setNativeTabBarEnabled(enabled: boolean): Promise<void> {
  if (!isNativeTabBarSupported()) return;
  try {
    const plugin = await loadPlugin();
    await plugin?.setEnabled({ enabled });
  } catch {
    // POC : jamais de crash web si le pont est indisponible.
  }
}

/** Pousse la route active vers l'onglet iOS (allowlist stricte). */
export async function setNativeSelectedTab(tabId: NativeTabId): Promise<void> {
  if (!isAllowedTabId(tabId) || !isNativeTabBarSupported()) return;
  try {
    const plugin = await loadPlugin();
    await plugin?.setSelectedTab({ tab: tabId });
  } catch {
  }
}

/** Masque/affiche la barre native (no-nav routes, toggle events). */
export async function setNativeTabBarVisible(visible: boolean): Promise<void> {
  if (!isNativeTabBarSupported()) return;
  try {
    const plugin = await loadPlugin();
    await plugin?.setVisible({ visible });
  } catch {
  }
}

/**
 * Abonne le routeur aux taps natifs. Le callback ne reçoit que des ids de
 * l'allowlist ; les listeners sont retirés à la destruction (cleanup).
 */
export async function addNativeTabSelectedListener(
  onSelect: (tabId: NativeTabId) => void
): Promise<() => void> {
  if (!isNativeTabBarSupported()) return () => {};
  try {
    const plugin = await loadPlugin();
    if (!plugin) return () => {};
    const handle = await plugin.addListener("tabSelected", (event) => {
      if (isAllowedTabId(event?.id)) onSelect(event.id);
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
