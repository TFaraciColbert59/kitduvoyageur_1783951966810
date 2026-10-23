// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompteMapHud } from '../CompteMapHud';
import { mapModeConfig } from '@/features/compte/map/modes';

const stats = { outings: 12, km: 351, dplus: 20200, massifs: 4, countries: 2 };

function renderHud(mode: 'overview' | 'compte' = 'overview') {
  return render(
    <CompteMapHud
      config={mapModeConfig(mode)}
      stats={stats}
      scale="globe"
      onScale={vi.fn()}
      onRecenter={vi.fn()}
      onLayers={vi.fn()}
      onExpand={vi.fn()}
      onLocate={vi.fn()}
    />
  );
}

describe('CompteMapHud', () => {
  it('affiche la capsule, la synthèse et les contrôles', () => {
    renderHud();
    expect(screen.getByText('Ta carte')).toBeTruthy();
    expect(screen.getByText('12 sorties · 351 km · 4 massifs')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Recentrer la carte' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Vue globe' })).toBeTruthy();
  });

  it('masque le HUD pour le mode Compte', () => {
    const { container } = renderHud('compte');
    expect(container.querySelector('.lkdv-map-hud')).toBeNull();
  });
});
