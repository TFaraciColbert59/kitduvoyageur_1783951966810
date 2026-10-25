// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PRESET_TRAILS } from '@/features/carte-3d/data/presetTrails';
import { ElevationTimelineScrubber } from '@/features/carte-3d/components/ElevationTimelineScrubber';
import { FloatingGlassControls } from '@/features/carte-3d/components/FloatingGlassControls';
import type { ScrubberState } from '@/features/carte-3d/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/carte-3d',
}));

describe('Carte 3D — UI Component Specifications', () => {
  afterEach(() => {
    cleanup();
  });

  const mockTrail = PRESET_TRAILS[0]; // Tour du Mont-Blanc
  const mockScrubberState: ScrubberState = {
    progress: 0.25,
    currentDistanceKm: 42.5,
    currentElevationM: 2150,
    currentSlopePercent: 12,
    currentCoordinate: [6.85, 45.85],
    currentBearingDeg: 45,
    isPlaying: false,
    playbackSpeed: 1,
    chaseCamera: true,
    activeNearbyWaypoint: null,
  };

  it('ElevationTimelineScrubber : affiche les métriques instantanées et déclenche la lecture', () => {
    const onSeek = vi.fn();
    const onTogglePlay = vi.fn();
    const onSpeedChange = vi.fn();
    const onToggleCameraChase = vi.fn();

    render(
      <ElevationTimelineScrubber
        trail={mockTrail}
        scrubberState={mockScrubberState}
        onSeek={onSeek}
        onTogglePlay={onTogglePlay}
        onSpeedChange={onSpeedChange}
        onToggleCameraChase={onToggleCameraChase}
      />
    );

    // Vérification des métriques dans le header
    expect(screen.getByText('42.5')).toBeDefined();
    expect(screen.getByText('2150')).toBeDefined();
    expect(screen.getByText('+12%')).toBeDefined();

    // Bouton Play / Pause
    const playBtn = screen.getByLabelText(/Lancer la simulation 3D/i);
    expect(playBtn).toBeDefined();
    fireEvent.click(playBtn);
    expect(onTogglePlay).toHaveBeenCalledTimes(1);

    // Bouton de vitesse
    const speed2x = screen.getByText('2x');
    fireEvent.click(speed2x);
    expect(onSpeedChange).toHaveBeenCalledWith(2);

    // Bouton Suivi Caméra
    const chaseBtn = screen.getByTitle(/suivi caméra/i);
    fireEvent.click(chaseBtn);
    expect(onToggleCameraChase).toHaveBeenCalledTimes(1);
  });

  it('FloatingGlassControls : permet de basculer 3D/2D, réorienter le nord et changer de sentier', () => {
    const onSelectTrail = vi.fn();
    const onToggle3D = vi.fn();
    const onResetNorth = vi.fn();
    const onChangeBasemap = vi.fn();
    const onToggleCategory = vi.fn();
    const onDownloadOffline = vi.fn();
    const onDeleteOffline = vi.fn();

    render(
      <FloatingGlassControls
        currentTrail={mockTrail}
        onSelectTrail={onSelectTrail}
        is3D={true}
        onToggle3D={onToggle3D}
        bearing={45}
        onResetNorth={onResetNorth}
        basemap="satellite-esri"
        onChangeBasemap={onChangeBasemap}
        activeCategories={new Set(['summit', 'refuge', 'water'])}
        onToggleCategory={onToggleCategory}
        offlinePack={null}
        isDownloadingOffline={false}
        downloadProgress={0}
        onDownloadOffline={onDownloadOffline}
        onDeleteOffline={onDeleteOffline}
      />
    );

    // Affichage du nom du sentier et massif
    expect(screen.getByText(mockTrail.name)).toBeDefined();
    expect(screen.getByText(mockTrail.massif)).toBeDefined();

    // Bouton 3D / 2D
    const toggle3DBtn = screen.getByTitle(/Passer en vue 2D plate/i);
    expect(toggle3DBtn).toBeDefined();
    fireEvent.click(toggle3DBtn);
    expect(onToggle3D).toHaveBeenCalledTimes(1);

    // Bouton boussole
    const compassBtn = screen.getByTitle(/Réorienter vers le Nord/i);
    expect(compassBtn).toBeDefined();
    fireEvent.click(compassBtn);
    expect(onResetNorth).toHaveBeenCalledTimes(1);

    // Bouton téléchargement hors-ligne
    const offlineBtn = screen.getByTitle(/Télécharger cette zone pour un usage hors-ligne/i);
    expect(offlineBtn).toBeDefined();
    fireEvent.click(offlineBtn);
    expect(onDownloadOffline).toHaveBeenCalledTimes(1);
  });

  it('FloatingGlassControls : supporte le zoom in / zoom out et l onglet live PostGIS', () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();

    render(
      <FloatingGlassControls
        currentTrail={mockTrail}
        onSelectTrail={vi.fn()}
        is3D={true}
        onToggle3D={vi.fn()}
        bearing={0}
        onResetNorth={vi.fn()}
        basemap="satellite-esri"
        onChangeBasemap={vi.fn()}
        activeCategories={new Set(['summit', 'refuge'])}
        onToggleCategory={vi.fn()}
        offlinePack={null}
        isDownloadingOffline={false}
        downloadProgress={0}
        onDownloadOffline={vi.fn()}
        onDeleteOffline={vi.fn()}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
      />
    );

    const zoomInBtn = screen.getByTitle(/Zoomer sur le relief/i);
    expect(zoomInBtn).toBeDefined();
    fireEvent.click(zoomInBtn);
    expect(onZoomIn).toHaveBeenCalledTimes(1);

    const zoomOutBtn = screen.getByTitle(/Dézoomer/i);
    expect(zoomOutBtn).toBeDefined();
    fireEvent.click(zoomOutBtn);
    expect(onZoomOut).toHaveBeenCalledTimes(1);
  });
});
