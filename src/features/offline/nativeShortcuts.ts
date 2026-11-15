/**
 * Lot N02 — Raccourcis Android (App Shortcuts) et recherche Spotlight iOS
 * hors ligne (K4.19).
 *
 * Invariants :
 * - Ouvrir planifier, enregistrer ou les parcours/régions téléchargés via des
 *   raccourcis natifs système ou Spotlight iOS, y compris en mode avion.
 * - Pas d'entrée dans la navigation principale LKDV (`addsMainNavigationEntry: false`).
 * - Aucune requête d'écriture lors de l'ouverture ou du changement d'affichage
 *   (`performsServerWrite: false`).
 * - Seuls les paquets vérifiés (`available` ou `degraded`) sont indexés comme
 *   disponibles hors ligne ; la suppression d'un paquet retire immédiatement
 *   ses entrées dynamiques.
 */

import type { OfflinePackManager } from './packManager';
import type {
  AndroidAppShortcutDescriptor,
  IosSpotlightSearchableItem,
  NativeShortcutResolutionResult,
  OfflineInstalledPackRecord,
} from './types';

export const STATIC_ANDROID_SHORTCUTS: readonly AndroidAppShortcutDescriptor[] = [
  {
    shortcutId: 'lkdv_shortcut_plan',
    actionKind: 'plan_route',
    shortLabel: 'Planifier',
    longLabel: 'Planifier un parcours',
    disabledMessage: 'Planificateur indisponible',
    deepLinkUri: 'lkdv://shortcut/plan',
    iconName: 'ic_shortcut_plan',
    rank: 0,
    offlineCapable: true,
  },
  {
    shortcutId: 'lkdv_shortcut_record',
    actionKind: 'record_activity',
    shortLabel: 'Enregistrer',
    longLabel: 'Démarrer un enregistrement GPS',
    disabledMessage: 'Enregistreur indisponible',
    deepLinkUri: 'lkdv://shortcut/record',
    iconName: 'ic_shortcut_record',
    rank: 1,
    offlineCapable: true,
  },
  {
    shortcutId: 'lkdv_shortcut_offline',
    actionKind: 'open_offline_downloads',
    shortLabel: 'Hors ligne',
    longLabel: 'Parcours et cartes téléchargés',
    disabledMessage: 'Aucun paquet hors ligne',
    deepLinkUri: 'lkdv://shortcut/offline',
    iconName: 'ic_shortcut_offline',
    rank: 2,
    offlineCapable: true,
  },
];

/**
 * Construit la liste complète des raccourcis Android (raccourcis statiques +
 * raccourcis dynamiques vers les parcours/régions téléchargés et vérifiés).
 */
export function buildAndroidOfflineShortcuts(
  installedPacks: readonly OfflineInstalledPackRecord[],
  maxDynamicShortcuts = 4,
): AndroidAppShortcutDescriptor[] {
  const shortcuts: AndroidAppShortcutDescriptor[] = [...STATIC_ANDROID_SHORTCUTS];

  const verifiedPacks = installedPacks
    .filter((p) => p.status === 'available' || p.status === 'degraded')
    .sort((a, b) => b.lastAccessedAtMs - a.lastAccessedAtMs)
    .slice(0, maxDynamicShortcuts);

  verifiedPacks.forEach((pack, idx) => {
    const isRoute = Boolean(pack.manifest.routeId);
    const targetUri = isRoute
      ? `lkdv://shortcut/route/${encodeURIComponent(pack.manifest.routeId!)}`
      : `lkdv://shortcut/region/${encodeURIComponent(pack.manifest.regionId ?? pack.manifest.packId)}`;

    shortcuts.push({
      shortcutId: `lkdv_dynamic_${pack.manifest.packId}`,
      actionKind: isRoute ? 'open_downloaded_route' : 'open_downloaded_region',
      shortLabel: pack.manifest.title.slice(0, 24),
      longLabel: `Hors ligne : ${pack.manifest.title}`,
      disabledMessage: 'Ce paquet hors ligne a été supprimé',
      deepLinkUri: targetUri,
      iconName: isRoute ? 'ic_shortcut_route' : 'ic_shortcut_offline',
      rank: STATIC_ANDROID_SHORTCUTS.length + idx,
      offlineCapable: true,
      requiresInstalledPackId: pack.manifest.packId,
    });
  });

  return shortcuts;
}

/**
 * Construit les entrées d'indexation locale Spotlight iOS (`CoreSpotlight`)
 * pour les actions rapides et les parcours/régions téléchargés hors ligne.
 */
export function buildIosSpotlightSearchableItems(
  installedPacks: readonly OfflineInstalledPackRecord[],
): IosSpotlightSearchableItem[] {
  const items: IosSpotlightSearchableItem[] = [
    {
      uniqueIdentifier: 'com.lkdv.action.plan',
      domainIdentifier: 'com.lkdv.actions',
      title: 'Planifier un parcours LKDV',
      contentDescription: 'Ouvrir le planificateur et les cartes Explorer',
      keywords: ['planifier', 'itinéraire', 'parcours', 'carte', 'lkdv'],
      deepLinkUri: 'lkdv://shortcut/plan',
      actionKind: 'plan_route',
      packId: null,
      routeId: null,
      regionId: null,
      bounds: null,
      offlineAvailable: true,
      expirationDateMs: null,
    },
    {
      uniqueIdentifier: 'com.lkdv.action.record',
      domainIdentifier: 'com.lkdv.actions',
      title: 'Enregistrer une sortie LKDV',
      contentDescription: 'Démarrer le suivi GPS et l’enregistrement hors ligne',
      keywords: ['enregistrer', 'gps', 'sortie', 'trace', 'activité', 'lkdv'],
      deepLinkUri: 'lkdv://shortcut/record',
      actionKind: 'record_activity',
      packId: null,
      routeId: null,
      regionId: null,
      bounds: null,
      offlineAvailable: true,
      expirationDateMs: null,
    },
    {
      uniqueIdentifier: 'com.lkdv.action.offline',
      domainIdentifier: 'com.lkdv.actions',
      title: 'Cartes et parcours téléchargés',
      contentDescription: 'Accéder aux régions et itinéraires disponibles en mode avion',
      keywords: ['hors ligne', 'offline', 'cartes', 'téléchargés', 'avion'],
      deepLinkUri: 'lkdv://shortcut/offline',
      actionKind: 'open_offline_downloads',
      packId: null,
      routeId: null,
      regionId: null,
      bounds: null,
      offlineAvailable: true,
      expirationDateMs: null,
    },
  ];

  for (const pack of installedPacks) {
    if (pack.status !== 'available' && pack.status !== 'degraded') continue;

    const isRoute = Boolean(pack.manifest.routeId);
    const deepLinkUri = isRoute
      ? `lkdv://shortcut/route/${encodeURIComponent(pack.manifest.routeId!)}`
      : `lkdv://shortcut/region/${encodeURIComponent(pack.manifest.regionId ?? pack.manifest.packId)}`;

    const titleTokens = pack.manifest.title
      .toLowerCase()
      .split(/[\s,;&-]+/)
      .filter((t) => t.length >= 2);

    items.push({
      uniqueIdentifier: `com.lkdv.offline.pack.${pack.manifest.packId}`,
      domainIdentifier: isRoute ? 'com.lkdv.offline.routes' : 'com.lkdv.offline.regions',
      title: pack.manifest.title,
      contentDescription: isRoute
        ? `Parcours hors ligne vérifié (${Math.round(pack.actualStoredBytes / 1024)} Ko)`
        : `Région cartographique hors ligne (zooms ${pack.manifest.minZoom}–${pack.manifest.maxZoom})`,
      keywords: Array.from(
        new Set(['hors ligne', 'offline', isRoute ? 'parcours' : 'région', ...titleTokens]),
      ),
      deepLinkUri,
      actionKind: isRoute ? 'open_downloaded_route' : 'open_downloaded_region',
      packId: pack.manifest.packId,
      routeId: pack.manifest.routeId,
      regionId: pack.manifest.regionId,
      bounds: pack.manifest.bounds,
      offlineAvailable: true,
      expirationDateMs: pack.manifest.expiresAtMs,
    });
  }

  return items;
}

/**
 * Recherche locale hors ligne dans l'index Spotlight iOS par requête texte.
 */
export function queryIosSpotlightOfflineIndex(
  query: string,
  installedPacks: readonly OfflineInstalledPackRecord[],
): IosSpotlightSearchableItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  const allItems = buildIosSpotlightSearchableItems(installedPacks);
  if (!normalizedQuery) return allItems;

  return allItems.filter((item) => {
    if (item.title.toLowerCase().includes(normalizedQuery)) return true;
    if (item.contentDescription.toLowerCase().includes(normalizedQuery)) return true;
    return item.keywords.some((kw) => kw.toLowerCase().includes(normalizedQuery));
  });
}

/**
 * Résout l'ouverture d'un raccourci natif Android ou d'un résultat Spotlight iOS.
 * Vérifie les droits, la compatibilité de la surface cible et la disponibilité
 * effective du paquet hors ligne sans effectuer aucune écriture serveur.
 */
export function resolveNativeShortcutLaunch(
  deepLinkUri: string,
  packManager: OfflinePackManager,
  options: {
    platform?: 'ios' | 'android' | 'web';
    shortcutsPermissionGranted?: boolean;
  } = {},
): NativeShortcutResolutionResult {
  const platform = options.platform ?? 'ios';
  const permissionGranted = options.shortcutsPermissionGranted ?? true;

  if (!permissionGranted) {
    return {
      status: 'denied_or_incompatible',
      reason: 'permission_denied',
      actionKind: null,
      targetRouteId: null,
      targetRegionId: null,
      targetPackId: null,
      addsMainNavigationEntry: false,
      performsServerWrite: false,
    };
  }

  if (platform !== 'ios' && platform !== 'android' && platform !== 'web') {
    return {
      status: 'denied_or_incompatible',
      reason: 'platform_unsupported',
      actionKind: null,
      targetRouteId: null,
      targetRegionId: null,
      targetPackId: null,
      addsMainNavigationEntry: false,
      performsServerWrite: false,
    };
  }

  const trimmed = deepLinkUri.trim();
  if (trimmed === 'lkdv://shortcut/plan') {
    return {
      status: 'resolved',
      reason: null,
      actionKind: 'plan_route',
      targetRouteId: null,
      targetRegionId: null,
      targetPackId: null,
      addsMainNavigationEntry: false,
      performsServerWrite: false,
    };
  }

  if (trimmed === 'lkdv://shortcut/record') {
    return {
      status: 'resolved',
      reason: null,
      actionKind: 'record_activity',
      targetRouteId: null,
      targetRegionId: null,
      targetPackId: null,
      addsMainNavigationEntry: false,
      performsServerWrite: false,
    };
  }

  if (trimmed === 'lkdv://shortcut/offline') {
    return {
      status: 'resolved',
      reason: null,
      actionKind: 'open_offline_downloads',
      targetRouteId: null,
      targetRegionId: null,
      targetPackId: null,
      addsMainNavigationEntry: false,
      performsServerWrite: false,
    };
  }

  const routePrefix = 'lkdv://shortcut/route/';
  if (trimmed.startsWith(routePrefix)) {
    const routeId = decodeURIComponent(trimmed.slice(routePrefix.length));
    const matchingPack = packManager
      .listInstalledPacks()
      .find(
        (p) =>
          p.manifest.routeId === routeId &&
          (p.status === 'available' || p.status === 'degraded'),
      );

    if (!matchingPack) {
      return {
        status: 'unavailable',
        reason: 'pack_not_available_offline',
        actionKind: 'open_downloaded_route',
        targetRouteId: routeId,
        targetRegionId: null,
        targetPackId: null,
        addsMainNavigationEntry: false,
        performsServerWrite: false,
      };
    }

    return {
      status: 'resolved',
      reason: null,
      actionKind: 'open_downloaded_route',
      targetRouteId: routeId,
      targetRegionId: matchingPack.manifest.regionId,
      targetPackId: matchingPack.manifest.packId,
      addsMainNavigationEntry: false,
      performsServerWrite: false,
    };
  }

  const regionPrefix = 'lkdv://shortcut/region/';
  if (trimmed.startsWith(regionPrefix)) {
    const regionOrPackId = decodeURIComponent(trimmed.slice(regionPrefix.length));
    const matchingPack = packManager
      .listInstalledPacks()
      .find(
        (p) =>
          (p.manifest.regionId === regionOrPackId || p.manifest.packId === regionOrPackId) &&
          (p.status === 'available' || p.status === 'degraded'),
      );

    if (!matchingPack) {
      return {
        status: 'unavailable',
        reason: 'pack_not_available_offline',
        actionKind: 'open_downloaded_region',
        targetRouteId: null,
        targetRegionId: regionOrPackId,
        targetPackId: null,
        addsMainNavigationEntry: false,
        performsServerWrite: false,
      };
    }

    return {
      status: 'resolved',
      reason: null,
      actionKind: 'open_downloaded_region',
      targetRouteId: null,
      targetRegionId: matchingPack.manifest.regionId ?? matchingPack.manifest.packId,
      targetPackId: matchingPack.manifest.packId,
      addsMainNavigationEntry: false,
      performsServerWrite: false,
    };
  }

  return {
    status: 'unavailable',
    reason: 'unknown_shortcut_uri',
    actionKind: null,
    targetRouteId: null,
    targetRegionId: null,
    targetPackId: null,
    addsMainNavigationEntry: false,
    performsServerWrite: false,
  };
}
