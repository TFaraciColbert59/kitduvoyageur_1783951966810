// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { KitSlot } from '../slots/KitSlot';

afterEach(cleanup);

const sac = {
  id: 'g1',
  realId: 'o1',
  n: 'Sac',
  b: 'LKDV',
  w: 900,
  c: 'Sac',
  paid: 120,
  so: 4,
  cond: 'Bon état',
  photo_url: 'https://img/sac.jpg',
};

describe('KitSlot — lentille Inventaire', () => {
  it('affiche l’image produit de chaque objet', () => {
    render(<KitSlot lens="inventory" gearItems={[sac]} />);

    const image = screen.getByRole('img', { name: /Sac/ }) as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('https://img/sac.jpg');
    expect(image.getAttribute('width')).toBe('44');
    expect(image.getAttribute('height')).toBe('44');
  });

  it('génère un visuel produit quand la photo manque', () => {
    render(
      <KitSlot
        lens="inventory"
        gearItems={[{ id: 'g2', n: 'Tente', b: 'MSR', w: 1200, c: 'Bivouac' }]}
      />
    );

    const image = screen.getByRole('img', { name: /Tente/ }) as HTMLImageElement;
    expect(image.getAttribute('src')?.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('trie par catégorie et lit les objets du payload', () => {
    render(
      <KitSlot
        lens="inventory"
        payload={{
          gearItems: [
            { id: 'g1', n: 'Sac', c: 'Sac' },
            { id: 'g2', n: 'Duvet', c: 'Couchage' },
          ],
        }}
      />
    );

    expect(screen.getByRole('heading', { name: 'Sac' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Couchage' })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Duvet/ })).toBeTruthy();
  });

  it('propriétaire : poids, état, prix, coût par sortie et badge prêt', () => {
    render(<KitSlot lens="inventory" gearItems={[sac]} viewer="owner" />);

    expect(screen.getByText(/900 g|0,9 kg/)).toBeTruthy();
    expect(screen.getByText(/Bon état/)).toBeTruthy();
    expect(screen.getByText(/120,00/)).toBeTruthy();
    expect(screen.getByText(/30,00/)).toBeTruthy();
    expect(screen.getByText('Prêt')).toBeTruthy();
  });

  it('visiteur : ni prix, ni prêt', () => {
    render(<KitSlot lens="inventory" gearItems={[{ ...sac, lent: 'Léa' }]} viewer="visitor" />);

    expect(screen.getByRole('img', { name: /Sac/ })).toBeTruthy();
    expect(screen.queryByText(/120,00/)).toBeNull();
    expect(screen.queryByText(/30,00/)).toBeNull();
    expect(screen.queryByText(/Prêt/)).toBeNull();
  });

  it('propriétaire : le badge dit à qui l’objet est prêté', () => {
    render(<KitSlot lens="inventory" gearItems={[{ ...sac, lent: 'Léa' }]} viewer="owner" />);

    expect(screen.getByText('Prêté à Léa')).toBeTruthy();
    expect(screen.queryByText('Prêt')).toBeNull();
  });

  it('affiche l’état vide explicitement', () => {
    render(<KitSlot lens="inventory" gearItems={[]} />);

    expect(screen.getByText('Aucun matériel enregistré.')).toBeTruthy();
  });
});
