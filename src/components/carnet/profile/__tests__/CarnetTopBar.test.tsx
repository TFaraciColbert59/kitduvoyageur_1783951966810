// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetTopBar } from '../CarnetTopBar';

afterEach(() => cleanup());

const BASE = {
  title: 'Tour du Mont-Blanc',
  coverImage: 'https://cdn.test/cover.jpg',
  saved: false,
};

const noop = () => {};

describe('CarnetTopBar — top bar 52 du Compte', () => {
  it('rend le retour, la pilule titre et les trois boutons ronds du Compte', () => {
    render(
      <CarnetTopBar {...BASE} onBack={noop} onShare={noop} onSave={noop} onMenu={noop} onTitleClick={noop} />,
    );
    expect(screen.getByRole('button', { name: 'Retour' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Partager' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Options du carnet' })).toBeTruthy();
    const pill = screen.getByRole('button', { name: /Tour du Mont-Blanc/ });
    expect(pill.className).toContain('ckp-title-pill');
    expect(pill.querySelector('img')?.getAttribute('src')).toBe('https://cdn.test/cover.jpg');
  });

  it('appelle les actions au clic', () => {
    const onShare = vi.fn();
    const onSave = vi.fn();
    const onMenu = vi.fn();
    render(
      <CarnetTopBar {...BASE} onBack={noop} onShare={onShare} onSave={onSave} onMenu={onMenu} onTitleClick={noop} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Partager' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Options du carnet' }));
    expect(onShare).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledOnce();
    expect(onMenu).toHaveBeenCalledOnce();
  });

  it('affiche l’initiale quand le carnet n’a pas de couverture', () => {
    render(
      <CarnetTopBar {...BASE} coverImage={null} onBack={noop} onShare={noop} onSave={noop} onMenu={noop} onTitleClick={noop} />,
    );
    const pill = screen.getByRole('button', { name: /Tour du Mont-Blanc/ });
    expect(pill.querySelector('img')).toBeNull();
    expect(pill.querySelector('.ckp-title-cover--empty')?.textContent).toBe('T');
  });

  it('marque le bouton Enregistrer comme actif', () => {
    render(
      <CarnetTopBar {...BASE} saved onBack={noop} onShare={noop} onSave={noop} onMenu={noop} onTitleClick={noop} />,
    );
    expect(screen.getByRole('button', { name: 'Enregistrer' }).getAttribute('aria-pressed')).toBe('true');
  });
});
