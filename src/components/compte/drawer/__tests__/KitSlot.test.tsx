// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { KitSlot } from '../slots/KitSlot';

afterEach(() => cleanup());

const KIT_ID = '11111111-1111-4111-8111-111111111111';

describe('KitSlot — lentille Kits', () => {
  it('affiche la fiche du kit et son usure, sans actions inventées', () => {
    render(
      <KitSlot
        lens="kits"
        kits={[{ id: KIT_ID, n: 'Kit 3 saisons', w: 4200, items: 10 }]}
      />
    );

    expect(screen.getByText('Kit 3 saisons')).toBeTruthy();
    expect(screen.getByLabelText(/Usure du kit Kit 3 saisons/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Partager/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Récupérer/ })).toBeNull();
  });

  it('lit les kits du payload de bootstrap', () => {
    render(
      <KitSlot
        lens="kits"
        payload={{ kits: [{ id: 'k3', n: 'Kit payload', image: null }] }}
      />
    );

    expect(screen.getByText('Kit payload')).toBeTruthy();
    expect(screen.queryByText('Aucun kit enregistré.')).toBeNull();
  });

  it('affiche l’état vide explicitement', () => {
    render(<KitSlot lens="kits" kits={[]} gearItems={[]} />);
    expect(screen.getByText('Aucun kit enregistré.')).toBeTruthy();
  });

  it('transmet le viewer au slot', () => {
    render(
      <KitSlot
        lens="kits"
        viewer="visitor"
        kits={[{ id: 'k4', n: 'Kit visiteur' }]}
      />
    );

    expect(screen.getByTestId('slot-content').getAttribute('data-viewer')).toBe('visitor');
  });

  it('affiche l’inventaire vide sans données inventées', () => {
    render(<KitSlot lens="inventory" gearItems={[]} />);
    expect(screen.getByText('Aucun matériel enregistré.')).toBeTruthy();
  });
});
