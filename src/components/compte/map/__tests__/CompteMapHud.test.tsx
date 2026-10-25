// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompteMapHud } from '../CompteMapHud';
import { mapModeConfig } from '@/features/compte/map/modes';

function renderHud(mode: 'overview' | 'compte' = 'overview') {
  return render(
    <CompteMapHud
      config={mapModeConfig(mode)}
      scale="globe"
      onScale={vi.fn()}
      onRecenter={vi.fn()}
      onLayers={vi.fn()}
      onZoomIn={vi.fn()}
      onZoomOut={vi.fn()}
    />
  );
}

describe('CompteMapHud', () => {
  it('affiche uniquement les contrôles historiques de la carte', () => {
    renderHud();
    expect(screen.queryByText('Ta carte')).toBeNull();
    expect(screen.queryByText(/sorties · .* massifs/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Vue globe' })).toBeTruthy();
    expect(screen.getByRole('button', { name: "Personnaliser la carte d'empreinte" })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Recentrer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zoom avant' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zoom arrière' })).toBeTruthy();
  });

  it('masque le HUD pour le mode Compte', () => {
    const { container } = renderHud('compte');
    expect(container.querySelector('.lkdv-map-hud')).toBeNull();
  });
});
