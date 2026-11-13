'use client';

/**
 * Lot N02-UI / K4.19 — Raccourcis Android et recherche Spotlight iOS.
 *
 * Les descripteurs sont produits par `buildAndroidOfflineShortcuts` et
 * `buildIosSpotlightSearchableItems`. L’ouverture ne crée aucune entrée dans la
 * navigation principale et ne déclenche aucune écriture serveur (invariants du
 * contrat `NativeShortcutResolutionResult`).
 */

import React from 'react';
import {
  buildAndroidOfflineShortcuts,
  buildIosSpotlightSearchableItems,
  queryIosSpotlightOfflineIndex,
  type AndroidAppShortcutDescriptor,
  type IosSpotlightSearchableItem,
  type NativeShortcutResolutionResult,
  type OfflineInstalledPackRecord,
} from '@/features/offline';
import { XpIcon } from '@/features/explorer-v2/ui/XpIcon';
import {
  OfflineBadge,
  OfflineButton,
  OfflineEmpty,
  OfflineNotice,
  OfflinePanel,
  OfflinePanelHeader,
  OfflineEyebrow,
} from './primitives';
import styles from './offlineUi.module.css';

export type OfflineShortcutPlatform = 'all' | 'android' | 'ios';

export interface OfflineShortcutsPanelProps {
  installedPacks: readonly OfflineInstalledPackRecord[];
  platform?: OfflineShortcutPlatform;
  query?: string;
  onQueryChange?: (query: string) => void;
  onLaunch?: (deepLinkUri: string) => void;
  resolveLaunch?: (deepLinkUri: string) => NativeShortcutResolutionResult;
  maxDynamicShortcuts?: number;
}

const RESOLUTION_LABEL: Readonly<
  Record<NonNullable<NativeShortcutResolutionResult['reason']>, string>
> = {
  unknown_shortcut_uri: 'Raccourci inconnu.',
  pack_not_available_offline: 'Ce paquet n’est plus disponible hors ligne.',
  platform_unsupported: 'Ce raccourci n’est pas pris en charge sur cette plateforme.',
  permission_denied: 'L’accès aux raccourcis système a été refusé.',
};

function matchesAndroidQuery(shortcut: AndroidAppShortcutDescriptor, normalized: string): boolean {
  if (!normalized) return true;
  return [shortcut.shortLabel, shortcut.longLabel, shortcut.actionKind, shortcut.deepLinkUri]
    .join(' ')
    .toLowerCase()
    .includes(normalized);
}

export function OfflineShortcutsPanel({
  installedPacks,
  platform = 'all',
  query,
  onQueryChange,
  onLaunch,
  resolveLaunch,
  maxDynamicShortcuts = 4,
}: OfflineShortcutsPanelProps) {
  const [internalQuery, setInternalQuery] = React.useState('');
  const [resolution, setResolution] = React.useState<{
    uri: string;
    result: NativeShortcutResolutionResult;
  } | null>(null);

  const currentQuery = query ?? internalQuery;
  const normalizedQuery = currentQuery.trim().toLowerCase();

  const setQuery = (next: string) => {
    if (query == null) setInternalQuery(next);
    onQueryChange?.(next);
  };

  const androidShortcuts = React.useMemo(
    () => buildAndroidOfflineShortcuts(installedPacks, maxDynamicShortcuts),
    [installedPacks, maxDynamicShortcuts]
  );
  const iosItems = React.useMemo(
    () => buildIosSpotlightSearchableItems(installedPacks),
    [installedPacks]
  );

  const visibleAndroid = androidShortcuts.filter((shortcut) =>
    matchesAndroidQuery(shortcut, normalizedQuery)
  );
  const visibleIos = normalizedQuery
    ? queryIosSpotlightOfflineIndex(currentQuery, installedPacks)
    : iosItems;

  const launch = (uri: string) => {
    if (resolveLaunch) {
      setResolution({ uri, result: resolveLaunch(uri) });
    }
    onLaunch?.(uri);
  };

  const showAndroid = platform === 'all' || platform === 'android';
  const showIos = platform === 'all' || platform === 'ios';

  return (
    <OfflinePanel ariaLabel="Raccourcis et recherche hors ligne">
      <OfflinePanelHeader
        eyebrow="K4.19 · Accès système"
        title="Raccourcis et Spotlight"
        subtitle="Planifier, enregistrer et ouvrir un parcours téléchargé, même en mode avion."
      />

      <label className={styles.field}>
        <span className={styles.label}>Rechercher</span>
        <input
          className={styles.input}
          type="search"
          value={currentQuery}
          placeholder="Parcours, région, action…"
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Rechercher un raccourci ou un parcours téléchargé"
        />
      </label>

      {resolution ? (
        <OfflineNotice
          tone={resolution.result.status === 'resolved' ? 'success' : 'warning'}
          icon={resolution.result.status === 'resolved' ? 'check' : 'alert'}
        >
          {resolution.result.status === 'resolved'
            ? 'Raccourci résolu hors ligne.'
            : resolution.result.reason
              ? RESOLUTION_LABEL[resolution.result.reason]
              : 'Raccourci indisponible.'}{' '}
          <span className={styles.mono}>{resolution.uri}</span>
        </OfflineNotice>
      ) : null}

      {showAndroid ? (
        <section className={styles.stack} aria-label="Raccourcis Android">
          <OfflineEyebrow>Android · app shortcuts</OfflineEyebrow>
          {visibleAndroid.length === 0 ? (
            <OfflineEmpty
              title="Aucun raccourci Android"
              hint="Les raccourcis dynamiques apparaissent après le téléchargement d’un paquet."
              icon="grid"
            />
          ) : (
            <ul className={styles.list}>
              {visibleAndroid.map((shortcut) => (
                <li key={shortcut.shortcutId} className={styles.listItem}>
                  <span className={styles.iconBubble}>
                    <XpIcon
                      name={
                        shortcut.actionKind === 'record_activity'
                          ? 'pulse'
                          : shortcut.actionKind === 'plan_route'
                            ? 'route'
                            : 'offline'
                      }
                      size={18}
                    />
                  </span>
                  <div className={styles.grow}>
                    <p className={styles.itemTitle}>{shortcut.longLabel}</p>
                    <p className={styles.itemMeta}>
                      {shortcut.shortLabel} · rang {shortcut.rank} ·{' '}
                      <span className={styles.mono}>{shortcut.deepLinkUri}</span>
                    </p>
                  </div>
                  <OfflineBadge tone={shortcut.requiresInstalledPackId ? 'success' : 'neutral'}>
                    {shortcut.requiresInstalledPackId ? 'Paquet vérifié' : 'Toujours disponible'}
                  </OfflineBadge>
                  <OfflineButton
                    variant="secondary"
                    aria-label={`Ouvrir le raccourci ${shortcut.longLabel}`}
                    onClick={() => launch(shortcut.deepLinkUri)}
                  >
                    <XpIcon name="chevr" size={16} />
                    Ouvrir
                  </OfflineButton>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {showIos ? (
        <section className={styles.stack} aria-label="Recherche Spotlight iOS">
          <OfflineEyebrow>iOS · CoreSpotlight</OfflineEyebrow>
          {visibleIos.length === 0 ? (
            <OfflineEmpty
              title="Aucun résultat Spotlight"
              hint="Essayez le nom d’un parcours ou d’une région téléchargée."
              icon="search"
            />
          ) : (
            <ul className={styles.list}>
              {visibleIos.map((item: IosSpotlightSearchableItem) => (
                <li key={item.uniqueIdentifier} className={styles.listItem}>
                  <span className={styles.iconBubble}>
                    <XpIcon
                      name={
                        item.domainIdentifier === 'com.lkdv.offline.routes'
                          ? 'route'
                          : item.domainIdentifier === 'com.lkdv.offline.regions'
                            ? 'map'
                            : 'spark'
                      }
                      size={18}
                    />
                  </span>
                  <div className={styles.grow}>
                    <p className={styles.itemTitle}>{item.title}</p>
                    <p className={styles.itemMeta}>{item.contentDescription}</p>
                    <p className={styles.itemMeta}>{item.keywords.slice(0, 5).join(' · ')}</p>
                  </div>
                  {item.offlineAvailable ? (
                    <OfflineBadge tone="success" icon="check">
                      Hors ligne
                    </OfflineBadge>
                  ) : null}
                  <OfflineButton
                    variant="secondary"
                    aria-label={`Ouvrir l’élément Spotlight ${item.title}`}
                    onClick={() => launch(item.deepLinkUri)}
                  >
                    <XpIcon name="chevr" size={16} />
                    Ouvrir
                  </OfflineButton>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <p className={styles.caption}>
        Ouvrir un raccourci n’ajoute aucune entrée à la navigation principale et n’écrit rien sur le
        serveur.
      </p>
    </OfflinePanel>
  );
}
