// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  listPredefinedRegions,
  type OfflineCoverageFeatureCollection,
  type OfflinePackSizeEstimate,
  type OfflineRouteNavigationData,
  type PredefinedRegionCatalogItem,
} from '@/features/offline';
import { OfflineRegionCatalog } from '../OfflineRegionCatalog';
import { OfflineCustomZoneForm } from '../OfflineCustomZoneForm';
import { OfflineCoveragePanel } from '../OfflineCoveragePanel';
import { OfflineIntegrityPanel } from '../OfflineIntegrityPanel';
import { OfflineUpcomingPoiPanel } from '../OfflineUpcomingPoiPanel';
import { OfflineRouteNavigationPanel } from '../OfflineRouteNavigationPanel';
import { OfflineShortcutsPanel } from '../OfflineShortcutsPanel';
import { OfflinePacksScreen } from '../OfflinePacksScreen';
import {
  CALANQUES_BOUNDS,
  makeInstalledPack,
  makeManifest,
  makeMedia,
  makePoi,
  makeUpcomingPoi,
} from './fixtures';

afterEach(cleanup);

const RETURN_CONTEXT = {
  parentSheet: 'offline',
  parentDetent: 'mid' as const,
  parentTab: 2,
  selectedRegionId: 'fr-calanques-marseille',
};

describe('Lot N02-UI · Régions prédéfinies (K4.14)', () => {
  it('affiche les régions réelles et déclenche le téléchargement avec l’estimation du contrat', () => {
    const onDownload = vi.fn();
    const regions = listPredefinedRegions('FR');

    render(<OfflineRegionCatalog regions={regions} onDownload={onDownload} />);

    expect(screen.getByText('Vallée de Chamonix & Massif du Mont-Blanc')).toBeTruthy();
    expect(screen.getByText('Parc national des Calanques')).toBeTruthy();

    const download = screen.getByRole('button', {
      name: 'Télécharger Parc national des Calanques',
    });
    fireEvent.click(download);

    expect(onDownload).toHaveBeenCalledOnce();
    const [region, estimate] = onDownload.mock.calls[0] as [
      PredefinedRegionCatalogItem,
      OfflinePackSizeEstimate,
    ];
    expect(region.regionId).toBe('fr-calanques-marseille');
    expect(estimate.totalTileCount).toBeGreaterThan(0);
    expect(estimate.totalEstimatedBytes).toBeGreaterThan(0);
  });

  it('remplace le téléchargement par les actions du paquet déjà installé', () => {
    const manifest = makeManifest({
      packId: 'pack-calanques',
      title: 'Parc national des Calanques',
      bounds: CALANQUES_BOUNDS,
    });
    const installed = makeInstalledPack(manifest);
    const onDelete = vi.fn();

    render(
      <OfflineRegionCatalog
        regions={listPredefinedRegions('FR')}
        installedPacks={[installed]}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText('Disponible hors ligne')).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: 'Télécharger Parc national des Calanques',
      })
    ).toBeNull();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Supprimer le paquet Parc national des Calanques',
      })
    );
    expect(onDelete).toHaveBeenCalledWith('pack-calanques');
  });
});

describe('Lot N02-UI · Emprise libre et zones multiples (K4.15)', () => {
  it('refuse une emprise inversée et affiche la raison exacte', () => {
    render(<OfflineCustomZoneForm />);

    fireEvent.change(screen.getByLabelText('Longitude ouest'), {
      target: { value: '7' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ajouter cette emprise aux zones sélectionnées',
      })
    );

    expect(
      screen.getByText('Emprise invalide : l’ouest doit être inférieur à l’est et le sud au nord.')
    ).toBeTruthy();
  });

  it('ajoute une zone valide, déduplique les limites et expose le GeoJSON', () => {
    const onZonesChange = vi.fn();
    const onShowLimits = vi.fn<(geoJson: OfflineCoverageFeatureCollection) => void>();
    const onDownload = vi.fn();

    render(
      <OfflineCustomZoneForm
        onZonesChange={onZonesChange}
        onShowLimits={onShowLimits}
        onDownload={onDownload}
      />
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ajouter cette emprise aux zones sélectionnées',
      })
    );

    expect(onZonesChange).toHaveBeenCalledOnce();
    expect(screen.getByText('Zone libre 1')).toBeTruthy();
    expect(screen.getByText(/limite\(s\) visible\(s\) sur la carte/)).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Afficher les limites des zones sur la carte',
      })
    );
    expect(onShowLimits).toHaveBeenCalledOnce();
    const geoJson = onShowLimits.mock.calls[0][0];
    expect(geoJson.type).toBe('FeatureCollection');
    expect(geoJson.features).toHaveLength(1);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Télécharger les zones sélectionnées',
      })
    );
    expect(onDownload).toHaveBeenCalledOnce();
    expect(onDownload.mock.calls[0][0].combinedNetTileCount).toBeGreaterThan(0);
  });
});

describe('Lot N02-UI · Couverture et plafond de zoom (K4.16)', () => {
  it('signale un zoom au-delà du paquet et rend le FeatureCollection exact', () => {
    const manifest = makeManifest({ packId: 'pack-calanques', bounds: CALANQUES_BOUNDS });
    const installed = makeInstalledPack(manifest);
    const onShowOnMap = vi.fn();

    render(
      <OfflineCoveragePanel
        installedPacks={[installed]}
        viewportBounds={{ west: 5.36, south: 43.19, east: 5.4, north: 43.21 }}
        requestedZoom={14}
        onShowOnMap={onShowOnMap}
      />
    );

    expect(screen.getByText('Zoom au-delà du paquet')).toBeTruthy();
    expect(
      screen.getByText(/Zoom 14 au-delà de la limite téléchargée \(zoom max hors ligne : 12\)/)
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Afficher la couverture téléchargée sur la carte',
      })
    );

    expect(onShowOnMap).toHaveBeenCalledOnce();
    const coverage = onShowOnMap.mock.calls[0][0];
    expect(coverage.type).toBe('FeatureCollection');
    expect(coverage.features).toHaveLength(1);
    expect(coverage.features[0].geometry.coordinates[0][0]).toEqual([
      CALANQUES_BOUNDS.west,
      CALANQUES_BOUNDS.south,
    ]);
  });

  it('déclare une emprise entièrement couverte quand le paquet contient la vue', () => {
    const manifest = makeManifest({ packId: 'pack-calanques', bounds: CALANQUES_BOUNDS });
    const installed = makeInstalledPack(manifest);

    render(
      <OfflineCoveragePanel
        installedPacks={[installed]}
        viewportBounds={{ west: 5.36, south: 43.19, east: 5.4, north: 43.21 }}
        requestedZoom={11}
      />
    );

    expect(screen.getByText('Emprise entièrement couverte')).toBeTruthy();
  });
});

describe('Lot N02-UI · Intégrité et capacités', () => {
  it('affiche le manifeste intègre et la matrice de capacités réelle', () => {
    const manifest = makeManifest({ packId: 'pack-calanques', title: 'Calanques vérifiées' });
    const installed = makeInstalledPack(manifest, {
      capabilities: {
        ...makeInstalledPack(manifest).capabilities,
        viewMapAround: {
          status: 'degraded',
          reason: 'Police/glyphes manquants (libellés dégradés).',
        },
      },
    });

    render(<OfflineIntegrityPanel record={installed} />);

    expect(screen.getByText('Calanques vérifiées')).toBeTruthy();
    expect(screen.getByText(/Manifeste intègre/)).toBeTruthy();
    expect(screen.getByText('Voir la carte alentour')).toBeTruthy();
    expect(screen.getByText('Dégradé')).toBeTruthy();
    expect(screen.getByText(/Police\/glyphes manquants/)).toBeTruthy();
    expect(screen.getByText(/^© OpenFreeMap/)).toBeTruthy();
  });

  it('refuse un manifeste dont la somme de contrôle a été altérée', () => {
    const manifest = makeManifest({
      packId: 'pack-altéré',
      manifestSha256: '0'.repeat(64),
    });

    render(<OfflineIntegrityPanel manifest={manifest} status="corrupted" />);

    expect(screen.getByText(/Manifeste refusé/)).toBeTruthy();
    expect(
      screen.getByText(/somme de contrôle SHA-256 du manifeste ne correspond pas/)
    ).toBeTruthy();
  });
});

describe('Lot N02-UI · POI à venir et photos (K4.17)', () => {
  it('trie par distance, affiche la photo vérifiée et ouvre le repère', () => {
    const refuge = makePoi({ id: 'poi-refuge', name: 'Refuge d’En Vau' });
    const summit = makePoi({ id: 'poi-summit', name: 'Sommet du Bau Rouge', kind: 'summit' });
    const media = makeMedia({ mediaId: 'media-refuge', poiId: refuge.id });
    const onOpenPoi = vi.fn();

    render(
      <OfflineUpcomingPoiPanel
        routeName="Traversée d’En Vau"
        items={[
          makeUpcomingPoi(refuge, 900, {
            media: [
              {
                mediaId: media.mediaId,
                canonicalUri: media.canonicalUri,
                caption: media.caption ?? null,
                width: media.width,
                height: media.height,
                payload: 'https://cdn.lkdv.local/media/refuge.webp',
              },
            ],
          }),
          makeUpcomingPoi(summit, 200),
        ]}
        onOpenPoi={onOpenPoi}
      />
    );

    const listItems = screen.getAllByRole('listitem');
    expect(within(listItems[0]).getByText('Sommet du Bau Rouge')).toBeTruthy();
    expect(within(listItems[1]).getByText('Refuge d’En Vau')).toBeTruthy();
    expect(screen.getByAltText('Vue sur la calanque')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir Refuge d’En Vau' }));
    expect(onOpenPoi).toHaveBeenCalledWith(expect.objectContaining({ id: 'poi-refuge' }));
  });

  it('conserve l’incertitude d’une fermeture expirée sans affirmer la réouverture', () => {
    render(
      <OfflineUpcomingPoiPanel
        items={[]}
        closures={[
          {
            id: 'closure-fire',
            title: 'Massif fermé',
            position: [5.4, 43.2],
            recordedAtMs: Date.parse('2026-08-01T08:00:00Z'),
            expiresAtMs: Date.parse('2026-08-02T20:00:00Z'),
          },
        ]}
        nowMs={Date.parse('2026-08-05T12:00:00Z')}
      />
    );

    expect(screen.getByText(/réouverture non confirmée/)).toBeTruthy();
  });
});

describe('Lot N02-UI · Données de navigation embarquées (K4.17)', () => {
  it('affiche le profil, les manœuvres à venir et les fermetures datées', () => {
    const routeData: OfflineRouteNavigationData = {
      routeId: 'route-calanques',
      routeRevision: 'rev-2026',
      name: 'Traversée d’En Vau',
      sport: 'rando',
      geojson: {
        type: 'LineString',
        coordinates: [
          [5.485, 43.202],
          [5.505, 43.202],
        ],
      },
      elevationProfile: [
        { d: 0, ele: 1000 },
        { d: 1000, ele: 1200 },
        { d: 2000, ele: 1100 },
      ],
      maneuvers: [
        {
          id: 'm-1',
          index: 0,
          kind: 'depart',
          position: [5.485, 43.202],
          alongTrackM: 500,
          instruction: 'Prendre le sentier côtier',
        },
        {
          id: 'm-2',
          index: 1,
          kind: 'gauche',
          position: [5.495, 43.202],
          alongTrackM: 1800,
          instruction: 'Bifurquer vers la calanque',
        },
      ],
      pois: [makePoi({ id: 'poi-refuge', name: 'Refuge d’En Vau' })],
      closures: [
        {
          id: 'closure-fire',
          title: 'Massif fermé',
          position: [5.495, 43.202],
          recordedAtMs: Date.parse('2026-08-01T08:00:00Z'),
          expiresAtMs: Date.parse('2026-08-02T20:00:00Z'),
        },
      ],
    };

    render(
      <OfflineRouteNavigationPanel
        routeData={routeData}
        currentAlongTrackM={0}
        nowMs={Date.parse('2026-08-05T12:00:00Z')}
      />
    );

    expect(screen.getByText('Données de navigation hors ligne')).toBeTruthy();
    expect(screen.getByText('Traversée d’En Vau · Randonnée · révision rev-2026')).toBeTruthy();
    expect(screen.getByText('2,0 km')).toBeTruthy();
    expect(screen.getByText('200 m')).toBeTruthy();
    expect(screen.getByText('100 m')).toBeTruthy();
    expect(screen.getByText('Prendre le sentier côtier')).toBeTruthy();
    expect(screen.getByText(/À 1,8 km/)).toBeTruthy();
    expect(screen.getByText(/réouverture non confirmée/)).toBeTruthy();
  });
});

describe('Lot N02-UI · Raccourcis Android et Spotlight iOS (K4.19)', () => {
  it('liste les raccourcis statiques et dynamiques, filtre et résout sans écriture', () => {
    const manifest = makeManifest({
      packId: 'pack-tmb',
      title: 'Tour du Mont-Blanc Étape 1',
      kind: 'route_corridor',
      routeId: 'tmb-etape-1',
      regionId: 'fr-chamonix-mont-blanc',
      bounds: { west: 6.75, south: 45.82, east: 7.05, north: 46.02 },
    });
    const installed = makeInstalledPack(manifest);
    const onLaunch = vi.fn();
    const resolveLaunch = vi.fn(() => ({
      status: 'resolved' as const,
      reason: null,
      actionKind: 'open_downloaded_route' as const,
      targetRouteId: 'tmb-etape-1',
      targetRegionId: 'fr-chamonix-mont-blanc',
      targetPackId: 'pack-tmb',
      addsMainNavigationEntry: false as const,
      performsServerWrite: false as const,
    }));

    render(
      <OfflineShortcutsPanel
        installedPacks={[installed]}
        onLaunch={onLaunch}
        resolveLaunch={resolveLaunch}
      />
    );

    expect(screen.getByText('Planifier un parcours')).toBeTruthy();
    expect(screen.getAllByText('Tour du Mont-Blanc Étape 1').length).toBeGreaterThan(0);

    fireEvent.click(
      screen.getByRole('button', { name: 'Ouvrir le raccourci Démarrer un enregistrement GPS' })
    );
    expect(onLaunch).toHaveBeenCalledWith('lkdv://shortcut/record');
    expect(resolveLaunch).toHaveBeenCalledWith('lkdv://shortcut/record');
    expect(screen.getByText('Raccourci résolu hors ligne.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Rechercher un raccourci ou un parcours téléchargé'), {
      target: { value: 'mont-blanc' },
    });
    expect(screen.getAllByText('Tour du Mont-Blanc Étape 1').length).toBeGreaterThan(0);
    expect(screen.queryByText('Planifier un parcours')).toBeNull();
  });
});

describe('Lot N02-UI · Écran conteneur et retour au drawer parent', () => {
  it('navigue entre paquets, régions et couverture, puis restaure le contexte', () => {
    const manifest = makeManifest({
      packId: 'pack-calanques',
      title: 'Calanques hors ligne',
      bounds: CALANQUES_BOUNDS,
    });
    const installed = makeInstalledPack(manifest);
    const onReturn = vi.fn();

    render(
      <OfflinePacksScreen
        installedPacks={[installed]}
        returnContext={RETURN_CONTEXT}
        onReturn={onReturn}
      />
    );

    const installedPanel = screen.getByRole('region', { name: 'Paquets installés' });
    expect(within(installedPanel).getByText('Calanques hors ligne')).toBeTruthy();
    expect(screen.getByText('Protégées')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Régions' }));
    expect(screen.getByText('Régions prêtes à télécharger')).toBeTruthy();
    expect(screen.getByText(/drawer parent/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Retour aux paquets hors ligne' }));
    expect(
      within(screen.getByRole('region', { name: 'Paquets installés' })).getByText(
        'Calanques hors ligne'
      )
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Couverture' }));
    expect(screen.getByText('Zones téléchargées sur la carte')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Fermer les téléchargements hors ligne' }));
    expect(onReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        parentSheet: 'offline',
        parentDetent: 'mid',
        parentTab: 2,
      })
    );
  });

  it('affiche l’intégrité du paquet sélectionné', () => {
    const manifest = makeManifest({ packId: 'pack-calanques', title: 'Calanques hors ligne' });
    const installed = makeInstalledPack(manifest);

    render(<OfflinePacksScreen installedPacks={[installed]} returnContext={RETURN_CONTEXT} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Voir l’intégrité de Calanques hors ligne' })
    );
    expect(screen.getByText(/Manifeste intègre/)).toBeTruthy();
  });
});
