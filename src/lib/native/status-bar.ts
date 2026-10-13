import { isNative } from './platform';

/**
 * Configuration de la Status Bar native
 */
export async function setStatusBarStyle(style: 'dark' | 'light' = 'dark'): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({
      style: style === 'dark' ? Style.Dark : Style.Light,
    });
  } catch {
    /* plugin absent ou étape non gérée : la barre garde son réglage */
  }
}

export async function setStatusBarColor(colorHex: string = '#17402C'): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar } = await import('@capacitor/status-bar');
    await StatusBar.setBackgroundColor({ color: colorHex });
  } catch {
    /* plugin absent ou étape non gérée : la barre garde son réglage */
  }
}

export async function setStatusBarOverlay(overlay: boolean = true): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay });
  } catch {
    /* plugin absent ou étape non gérée : la barre garde son réglage */
  }
}

/**
 * Thèmes de la barre d'état native (plan 5.4).
 *
 * - `default` : vert forêt #17402C, texte clair (`Style.Dark`), la page passe
 *   dessous. C'est le thème de toute l'app (aussi posé au démarrage par
 *   `capacitor.config.ts`).
 * - `compas` : le Compas force le thème clair et peint un paysage éclairci
 *   jusque sous la barre. Texte sombre (`Style.Light`, « dark text for light
 *   backgrounds ») ; fond crème #FBFAF6 là où une couleur de fond est posable.
 *
 * Ce que chaque plateforme fait réellement :
 * - iOS : la page passe sous la barre (aucun fond à poser) ; seul le style
 *   compte ;
 * - Android 15 et plus (cible 36 ici) : bord à bord imposé, `backgroundColor` et
 *   `overlaysWebView` sont sans effet (README du plugin) ; seul le style compte ;
 * - Android 14 et moins : le fond posé est celui de la barre.
 * Le rendu natif lui-même n'est pas vérifiable hors d'un appareil réel.
 */
export type StatusBarTheme = 'default' | 'compas';

const STATUS_BAR_THEMES: Record<StatusBarTheme, { dark: boolean; color: string }> = {
  default: { dark: true, color: '#17402C' },
  compas: { dark: false, color: '#FBFAF6' },
};

/** Le thème de la page : le Compas (et ses sous-pages) a le sien, rien d'autre. */
export function statusBarThemeForPath(pathname: string | null | undefined): StatusBarTheme {
  if (!pathname) return 'default';
  return pathname === '/compas' || pathname.startsWith('/compas/') ? 'compas' : 'default';
}

/** Un échec d'une étape (fond sur iOS, plugin absent) ne bloque ni les autres ni la suite. */
async function attempt(step: () => Promise<unknown>): Promise<void> {
  try {
    await step();
  } catch {
    /* étape non gérée par la plateforme : on passe à la suivante */
  }
}

async function paintStatusBar(theme: StatusBarTheme): Promise<void> {
  const { dark, color } = STATUS_BAR_THEMES[theme];
  let plugin: typeof import('@capacitor/status-bar');
  try {
    plugin = await import('@capacitor/status-bar');
  } catch {
    return;
  }
  const { StatusBar, Style } = plugin;
  // Le style d'abord : c'est lui qui rend le texte lisible sur toutes les plateformes.
  await attempt(() => StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }));
  await attempt(() => StatusBar.setBackgroundColor({ color }));
  await attempt(() => StatusBar.setOverlaysWebView({ overlay: true }));
}

/** Les appels natifs partent dans l'ordre des demandes (entrée puis sortie rapides du Compas). */
let paintQueue: Promise<void> = Promise.resolve();

/** Applique un thème de barre d'état ; sans effet dans un navigateur. */
export function applyStatusBarTheme(theme: StatusBarTheme): Promise<void> {
  if (!isNative()) return Promise.resolve();
  const painted = paintQueue.then(() => paintStatusBar(theme));
  paintQueue = painted;
  return painted;
}

/**
 * Y7.5 — Applique le thème de barre d'état natif LKDV (vert forêt #17402C, style dark, overlay)
 */
export function applyLKDVStatusBarTheme(): Promise<void> {
  return applyStatusBarTheme('default');
}
