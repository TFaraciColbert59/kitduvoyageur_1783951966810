// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouteSwapPicker } from '../RouteSwapPicker';
import { CustomFieldsEditor } from '../CustomFieldsEditor';
import { DISPLAY_PREFERENCES, RECORDING, ROUTES } from './fixtures';

afterEach(cleanup);

describe('RouteSwapPicker (K4.10)', () => {
  it('montre les cumuls conservés et le parcours actuel', () => {
    render(
      <RouteSwapPicker
        recording={RECORDING}
        routes={ROUTES}
        currentRouteId="route-lac"
        onSwap={vi.fn()}
      />,
    );

    expect(screen.getByText('4.32 km')).toBeTruthy();
    expect(screen.getByText('1:00:00')).toBeTruthy();
    expect(screen.getByText('+312 m')).toBeTruthy();
    expect(screen.getByText('Séance conservée')).toBeTruthy();

    const current = screen.getByRole('radio', { name: /Tour du lac/ });
    expect(current.getAttribute('aria-checked')).toBe('true');
    expect(current).toHaveProperty('disabled', true);

    const loading = screen.getByRole('radio', { name: /Variante en chargement/ });
    expect(loading).toHaveProperty('disabled', true);
  });

  it('demande une confirmation avant de changer de parcours', () => {
    const onSwap = vi.fn();
    render(
      <RouteSwapPicker
        recording={RECORDING}
        routes={ROUTES}
        currentRouteId="route-lac"
        onSwap={onSwap}
      />,
    );

    const swapButton = screen.getByRole('button', { name: /Changer de parcours/ });
    expect(swapButton).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('radio', { name: /Crête des Aiguilles/ }));
    expect(swapButton).toHaveProperty('disabled', false);

    fireEvent.click(swapButton);
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(onSwap).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(onSwap).toHaveBeenCalledWith(ROUTES[1]);
  });

  it('annule la confirmation sans changer de parcours', () => {
    const onSwap = vi.fn();
    render(
      <RouteSwapPicker
        recording={RECORDING}
        routes={ROUTES}
        currentRouteId="route-lac"
        onSwap={onSwap}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /Crête des Aiguilles/ }));
    fireEvent.click(screen.getByRole('button', { name: /Changer de parcours/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onSwap).not.toHaveBeenCalled();
  });

  it('affiche un état vide sans parcours alternatif', () => {
    render(<RouteSwapPicker recording={RECORDING} routes={[]} onSwap={vi.fn()} />);
    expect(screen.getByText('Aucun autre parcours disponible pour le moment.')).toBeTruthy();
  });
});

function FieldsHarness({ wakeLock }: { wakeLock?: React.ComponentProps<typeof CustomFieldsEditor>['wakeLock'] }) {
  const [preferences, setPreferences] = React.useState(DISPLAY_PREFERENCES);
  return (
    <CustomFieldsEditor
      preferences={preferences}
      metrics={{
        distanceM: 4321,
        movingS: 3600,
        elevGainM: 312,
        currentSpeedMs: 2.2,
        currentAltitudeM: 1430,
        remainingRouteDistanceM: 1200,
        completedLapsCount: 1,
        units: 'metric',
      }}
      wakeLock={wakeLock}
      onChange={setPreferences}
    />
  );
}

describe('CustomFieldsEditor (K4.11)', () => {
  it('affiche les champs par défaut et leurs valeurs réelles', () => {
    render(<FieldsHarness />);

    expect(screen.getByText('4/6')).toBeTruthy();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(rows[0].textContent).toContain('distance');
    expect(rows[0].textContent).toContain('4.32 km');
    expect(rows[1].textContent).toContain('1:00:00');
    expect(rows[2].textContent).toContain('+312 m');
    expect(rows[3].textContent).toContain('1.20 km');
  });

  it('réordonne et retire un champ', () => {
    render(<FieldsHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Descendre distance' }));
    let rows = screen.getAllByRole('listitem');
    expect(rows[0].textContent).toContain('durée');
    expect(rows[1].textContent).toContain('distance');

    fireEvent.click(screen.getByRole('button', { name: 'Retirer durée' }));
    rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(screen.getByText('3/6')).toBeTruthy();
  });

  it('ajoute une métrique GPS disponible', () => {
    render(<FieldsHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'vitesse' }));
    expect(screen.getByText('5/6')).toBeTruthy();
    const rows = screen.getAllByRole('listitem');
    expect(rows[4].textContent).toContain('vitesse');
  });

  it('expose « — » et « capteur non branché » pour une métrique absente', () => {
    render(<FieldsHarness />);

    fireEvent.click(screen.getByRole('button', { name: /^fréquence cardiaque/ }));
    const rows = screen.getAllByRole('listitem');
    expect(rows[4].textContent).toContain('Capteur non branché');
    expect(rows[4].textContent).not.toMatch(/\d+\s*bpm/);
  });

  it('bascule le zoom et le maintien d’écran', () => {
    render(
      <FieldsHarness
        wakeLock={{ enabled: true, supported: true, active: true, reason: null }}
      />,
    );

    const zoom = screen.getByRole('switch', { name: /Zoom automatique/ });
    expect(zoom.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(zoom);
    expect(zoom.getAttribute('aria-checked')).toBe('false');

    const wake = screen.getByRole('switch', { name: /Garder l’écran allumé/ });
    expect(wake.textContent).toContain('Écran maintenu allumé');
    fireEvent.click(wake);
    expect(wake.getAttribute('aria-checked')).toBe('false');
  });

  it('empêche de retirer le dernier champ', () => {
    render(
      <CustomFieldsEditor
        preferences={{ ...DISPLAY_PREFERENCES, fields: ['distance'] }}
        onChange={vi.fn()}
      />,
    );

    const rows = screen.getAllByRole('listitem');
    const remove = within(rows[0]).getByRole('button', { name: 'Retirer distance' });
    expect(remove).toHaveProperty('disabled', true);
  });
});
