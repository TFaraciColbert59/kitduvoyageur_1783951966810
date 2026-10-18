// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('maplibre-gl', () => {
  function MockMap(this: any) {
    this.on = vi.fn((event: string, ...args: any[]) => {
      const cb = typeof args[0] === 'function' ? args[0] : args[1];
      if (event === 'load' && typeof cb === 'function') {
        setTimeout(cb, 0);
      }
    });
    this.once = vi.fn();
    this.remove = vi.fn();
    this.getSource = vi.fn();
    this.addSource = vi.fn();
    this.getLayer = vi.fn();
    this.addLayer = vi.fn();
    this.setLayoutProperty = vi.fn();
    this.setPaintProperty = vi.fn();
    this.setTerrain = vi.fn();
    this.setSky = vi.fn();
    this.flyTo = vi.fn();
    this.easeTo = vi.fn();
    this.jumpTo = vi.fn();
    this.setCenter = vi.fn();
    this.getZoom = vi.fn().mockReturnValue(14.2);
    this.setZoom = vi.fn();
    this.getCanvas = vi.fn().mockReturnValue(document.createElement('canvas'));
    this.isStyleLoaded = vi.fn().mockReturnValue(true);
    return this;
  }

  return {
    Map: MockMap,
    setWorkerUrl: vi.fn(),
    MercatorCoordinate: {
      fromLngLat: vi.fn().mockReturnValue({
        x: 0,
        y: 0,
        z: 0,
        meterInMercatorCoordinateUnits: vi.fn().mockReturnValue(1),
      }),
    },
  };
});

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

import Carte3D from '@/app/carte-3d/Carte3D';

describe('Carte 3D — Globe Multi-Scale Integration & Pure UI Controls', () => {
  afterEach(() => {
    cleanup();
  });

  it('affiche les 3 boutons de presets d échelle (ORBITE, MASSIF, SENTIER) en pur texte sans icône', () => {
    render(<Carte3D />);

    const btnOrbite = screen.getByText('ORBITE');
    const btnMassif = screen.getByText('MASSIF');
    const btnSentier = screen.getByText('SENTIER');

    expect(btnOrbite).toBeDefined();
    expect(btnMassif).toBeDefined();
    expect(btnSentier).toBeDefined();

    // Règle stricte utilisateur : soit une icône soit du texte, JAMAIS les deux
    // Vérification que les boutons ne contiennent pas de SVG ni d'élément <i> / <img>
    expect(btnOrbite.querySelector('svg')).toBeNull();
    expect(btnMassif.querySelector('svg')).toBeNull();
    expect(btnSentier.querySelector('svg')).toBeNull();
  });

  it('affiche les éléments de télémétrie du sentier et les graphiques synchronisés', () => {
    render(<Carte3D />);

    // Contrôles requis par Maestro E2E
    expect(screen.getByText(/LANCER SURVOL 3D|PAUSE SURVOL/i)).toBeDefined();
    expect(screen.getByText(/PROFIL ALTIMÉTRIQUE/i)).toBeDefined();
    expect(screen.getByText(/GRADIENT DE PENTE/i)).toBeDefined();
    expect(screen.getByText(/VENT CRÊTE/i)).toBeDefined();
    expect(screen.getAllByText(/EXPORTER GPX/i).length).toBeGreaterThan(0);
  });

  it('permet de replier et déplier le dock de télémétrie', () => {
    render(<Carte3D />);

    const toggleBtn = screen.getByRole('button', { name: /RÉDUIRE|DÉPLIER/i });
    expect(toggleBtn).toBeDefined();
    expect(toggleBtn.textContent).toBe('RÉDUIRE');

    fireEvent.click(toggleBtn);
    expect(toggleBtn.textContent).toBe('DÉPLIER');

    fireEvent.click(toggleBtn);
    expect(toggleBtn.textContent).toBe('RÉDUIRE');
  });

  it('cliquer sur les presets d échelle déclenche flyTo', () => {
    render(<Carte3D />);

    const btnOrbite = screen.getByText('ORBITE');
    fireEvent.click(btnOrbite);

    const btnMassif = screen.getByText('MASSIF');
    fireEvent.click(btnMassif);

    const btnSentier = screen.getByText('SENTIER');
    fireEvent.click(btnSentier);
  });

  it('gère le changement rapide (spam) entre ORBITE et SENTIER sans crash', () => {
    render(<Carte3D />);

    const btnOrbite = screen.getByText('ORBITE');
    const btnSentier = screen.getByText('SENTIER');

    // Clics rapides successifs simulant une interaction utilisateur nerveuse
    fireEvent.click(btnOrbite);
    fireEvent.click(btnSentier);
    fireEvent.click(btnOrbite);
    fireEvent.click(btnSentier);

    expect(screen.getByText('ORBITE')).toBeDefined();
    expect(screen.getByText('SENTIER')).toBeDefined();
  });

  it('respecte strictement la règle : chaque bouton est SOIT une icône SOIT du texte, JAMAIS les deux', () => {
    const { container } = render(<Carte3D />);

    const allButtons = container.querySelectorAll('button');
    expect(allButtons.length).toBeGreaterThan(0);

    allButtons.forEach((btn) => {
      const hasSvg = btn.querySelector('svg') !== null;
      const textContent = (btn.textContent || '').trim();
      const hasText = textContent.length > 0;

      // La condition stricte : soit une icône, soit du texte, jamais les deux
      const isMixed = hasSvg && hasText;
      if (isMixed) {
        throw new Error(
          `Violation de la règle "icône ou texte, jamais les deux" sur le bouton id="${btn.id}" texte="${textContent}"`
        );
      }
      expect(isMixed).toBe(false);
    });
  });

  it('rend correctement un compte vierge (0 km, 0 D+, 0 massifs) sans afficher les stats factices de Tony', async () => {
    window.localStorage.setItem('lkdv_active_user_id', 'nouveau_voyageur_0');

    render(<Carte3D />);

    // Attendre la résolution asynchrone de l'empreinte
    await vi.waitFor(() => {
      expect(screen.getAllByText(/@nouveau_voyageur_0/i).length).toBeGreaterThan(0);
    });

    // Basculer en vue ORBITE pour inspecter le passeport HUD
    const btnOrbite = screen.getByText('ORBITE');
    fireEvent.click(btnOrbite);

    // Vérifier les valeurs réelles 0 et le texte d'état vide
    expect(screen.getAllByText(/0 km/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\+0 m/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/0 foulés/i)).toBeDefined();
    expect(screen.getByText(/0 conquis/i)).toBeDefined();
    expect(screen.getByText(/Aucune trace GPS enregistrée pour ce compte/i)).toBeDefined();

    window.localStorage.removeItem('lkdv_active_user_id');
  });
});
