// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CreateDrawer } from '../CreateDrawer';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-test' } }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}));

afterEach(() => cleanup());

const openDrawer = (initialType?: string) =>
  render(<CreateDrawer initialType={initialType} onClose={() => {}} onCreated={() => {}} />);

const catalog = () => screen.getByRole('group', { name: 'Types de création' });

describe('CreateDrawer — catalogue allégé', () => {
  it('affiche les 6 types, sans sous-titre ni titre de drawer visible', () => {
    openDrawer();
    const tiles = within(catalog()).getAllByRole('button');
    expect(tiles).toHaveLength(6);
    expect(tiles.map((tile) => tile.getAttribute('aria-label'))).toEqual([
      'Publication',
      'Story',
      'Carnet',
      'Kit',
      'Club',
      'Voyage',
    ]);
    // Aucun sous-titre de tuile, aucun titre ni sous-titre d'en-tête visible.
    expect(screen.queryByText('Photo, texte ou question')).toBeNull();
    expect(screen.queryByText('Choisis ce que tu veux créer.')).toBeNull();
    expect(screen.queryByText('Tout se passe ici, sans quitter ton compte.')).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
    // Le titre reste disponible pour les lecteurs d'écran.
    expect(screen.getByText('Créer', { selector: '.sr-only' })).toBeTruthy();
  });

  it('marque le dernier type choisi au retour', () => {
    openDrawer();
    fireEvent.click(within(catalog()).getByRole('button', { name: 'Carnet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tous les types de création' }));
    expect(within(catalog()).getByRole('button', { name: 'Carnet' }).getAttribute('aria-current')).toBe('true');
    expect(within(catalog()).getByRole('button', { name: 'Story' }).getAttribute('aria-current')).toBeNull();
  });
});

describe('CreateDrawer — formulaires sans étiquette visible', () => {
  it('nomme les champs par aria-label et non par un libellé affiché', () => {
    openDrawer('post');
    expect(screen.getByLabelText('Texte')).toBeTruthy();
    expect(screen.getByLabelText('Audience')).toBeTruthy();
    expect(screen.getByLabelText('Ajouter une photo')).toBeTruthy();
    expect(screen.queryByText('Texte')).toBeNull();
    expect(screen.queryByText('Audience')).toBeNull();
    expect(screen.queryByText('Photo')).toBeNull();
  });

  it('n’affiche pas de compteur au repos, puis un seul compteur au focus', () => {
    openDrawer('post');
    expect(document.querySelectorAll('.lkdv-cd-count')).toHaveLength(0);
    const zone = screen.getByLabelText('Texte');
    fireEvent.focus(zone);
    fireEvent.change(zone, { target: { value: 'Bivouac au col' } });
    const counters = document.querySelectorAll('.lkdv-cd-count');
    expect(counters).toHaveLength(1);
    expect(counters[0].textContent).toBe('14');
  });

  it('active le bouton primaire dès le minimum requis saisi', () => {
    openDrawer('kit');
    const primary = screen.getByRole('button', { name: 'Créer le kit' });
    expect((primary as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Ultralight' } });
    expect((screen.getByRole('button', { name: 'Créer le kit' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('affiche l’erreur de champ sous le champ, sans modale', () => {
    openDrawer('carnet');
    const titre = screen.getByLabelText('Titre');
    fireEvent.change(titre, { target: { value: 'x' } });
    fireEvent.change(titre, { target: { value: '' } });
    fireEvent.blur(titre);
    const error = screen.getByText('Titre requis');
    expect(error.className).toContain('lkdv-cd-field-error');
    expect(screen.queryByRole('dialog', { name: /erreur/i })).toBeNull();
  });
});

describe('CreateDrawer — parcours Carnet en 3 étapes', () => {
  it('remplace le catalogue dans le même drawer, avec un seul indicateur à 3 segments', () => {
    openDrawer();
    fireEvent.click(within(catalog()).getByRole('button', { name: 'Carnet' }));
    expect(screen.queryByRole('group', { name: 'Types de création' })).toBeNull();
    const progress = screen.getAllByRole('progressbar');
    expect(progress).toHaveLength(1);
    expect(progress[0].getAttribute('aria-valuenow')).toBe('1');
    expect(progress[0].getAttribute('aria-valuemax')).toBe('3');
    expect(progress[0].querySelectorAll('span')).toHaveLength(3);
  });

  it('avance et revient en conservant les valeurs saisies', () => {
    openDrawer();
    fireEvent.click(within(catalog()).getByRole('button', { name: 'Carnet' }));
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Traversée du Vercors' } });
    fireEvent.change(screen.getByLabelText('Destination'), { target: { value: 'Vercors, France' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    // Étape 2 : photos
    expect(screen.getByLabelText('Ajouter une photo de couverture')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    // Étape 3 : publication
    expect(screen.getByLabelText('Visibilité')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('3');
    expect(screen.getByRole('button', { name: 'Créer le carnet' })).toBeTruthy();

    // Retour : étape 2 puis étape 1, valeurs conservées
    fireEvent.click(screen.getByRole('button', { name: 'Étape précédente' }));
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: 'Étape précédente' }));
    expect((screen.getByLabelText('Titre') as HTMLInputElement).value).toBe('Traversée du Vercors');
    expect((screen.getByLabelText('Destination') as HTMLInputElement).value).toBe('Vercors, France');
  });

  it('bloque « Continuer » tant que titre et destination manquent', () => {
    openDrawer('carnet');
    const next = () => screen.getByRole('button', { name: 'Continuer' }) as HTMLButtonElement;
    expect(next().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Vercors' } });
    expect(next().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Destination'), { target: { value: 'France' } });
    expect(next().disabled).toBe(false);
  });
});

describe('CreateDrawer — gabarit de champ (tokens)', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/components/compte/create/create-drawer.css'), 'utf8');

  it('tient les valeurs du contrat', () => {
    expect(css).toMatch(/height: 44px/);
    expect(css).toMatch(/border-radius: 14px/);
    expect(css).toMatch(/background: rgba\(255, 255, 255, 0\.72\)/);
    expect(css).toMatch(/border: 0\.5px solid rgba\(23, 43, 36, 0\.1\)/);
    expect(css).toMatch(/color: #172b24/);
    expect(css).toMatch(/box-shadow: 0 0 0 2px #17402c/);
    expect(css).toMatch(/min-height: 96px/);
    expect(css).toMatch(/border-radius: 18px/);
    expect(css).toMatch(/height: 48px/);
    expect(css).toMatch(/border-radius: 999px/);
    expect(css).toMatch(/#c13b34/);
    expect(css).toMatch(/opacity: 0\.4/);
    expect(css).toMatch(/width: 132px/);
    expect(css).toMatch(/height: 96px/);
    expect(css).toMatch(/width: 96px/);
    expect(css).toMatch(/220ms/);
    expect(css).toMatch(/cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
  });
});
