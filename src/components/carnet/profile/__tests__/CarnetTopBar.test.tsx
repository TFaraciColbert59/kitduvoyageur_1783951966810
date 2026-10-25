// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetTopBar } from '../CarnetTopBar';

afterEach(() => cleanup());

const BASE = {
  title: 'Tour du Mont-Blanc',
  saved: false,
};

const noop = () => {};

describe('CarnetTopBar — top bar 36 du Compte', () => {
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
    // `ig-handle` du Compte : pas de vignette, le titre seul.
    expect(pill.querySelector('img')).toBeNull();
    expect(pill.textContent).toBe('Tour du Mont-Blanc');
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

  it('remonte en haut au clic sur la pilule', () => {
    const onTitleClick = vi.fn();
    render(
      <CarnetTopBar {...BASE} onBack={noop} onShare={noop} onSave={noop} onMenu={noop} onTitleClick={onTitleClick} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Tour du Mont-Blanc/ }));
    expect(onTitleClick).toHaveBeenCalledOnce();
  });

  it('marque le bouton Enregistrer comme actif', () => {
    render(
      <CarnetTopBar {...BASE} saved onBack={noop} onShare={noop} onSave={noop} onMenu={noop} onTitleClick={noop} />,
    );
    expect(screen.getByRole('button', { name: 'Enregistrer' }).getAttribute('aria-pressed')).toBe('true');
  });
});
