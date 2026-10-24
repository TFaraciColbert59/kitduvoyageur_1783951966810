// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetMoreMenu } from '../CarnetMoreMenu';

afterEach(() => cleanup());

const noop = () => {};

describe('CarnetMoreMenu — menu ··· 226 px', () => {
  it('reprend la liste du menu du Compte', () => {
    render(
      <CarnetMoreMenu
        open
        saved={false}
        isOwner={false}
        onSave={noop}
        onShare={noop}
        onCopy={noop}
        onReport={noop}
        onManage={noop}
        onClose={noop}
      />,
    );
    const menu = screen.getByRole('group', { name: 'Options du carnet' });
    expect(menu.className).toContain('pmi-options-menu');
    expect(screen.getByRole('button', { name: /Enregistrer/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Copier le lien/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Partager/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Signaler/ })).toBeTruthy();
  });

  it('libelle « Retirer des enregistrements » quand le carnet est enregistré', () => {
    render(
      <CarnetMoreMenu
        open
        saved
        isOwner={false}
        onSave={noop}
        onShare={noop}
        onCopy={noop}
        onReport={noop}
        onManage={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByRole('button', { name: /Retirer des enregistrements/ })).toBeTruthy();
  });

  it('n’ajoute « Gérer le carnet » que pour le propriétaire', () => {
    render(
      <CarnetMoreMenu
        open
        saved={false}
        isOwner
        onSave={noop}
        onShare={noop}
        onCopy={noop}
        onReport={noop}
        onManage={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByRole('button', { name: 'Gérer le carnet' })).toBeTruthy();
    cleanup();
    render(
      <CarnetMoreMenu
        open
        saved={false}
        isOwner={false}
        onSave={noop}
        onShare={noop}
        onCopy={noop}
        onReport={noop}
        onManage={noop}
        onClose={noop}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Gérer le carnet' })).toBeNull();
  });

  it('ne rend rien quand il est fermé', () => {
    const { container } = render(
      <CarnetMoreMenu
        open={false}
        saved={false}
        isOwner={false}
        onSave={noop}
        onShare={noop}
        onCopy={noop}
        onReport={noop}
        onManage={noop}
        onClose={noop}
      />,
    );
    expect(container.querySelector('.pmi-options-menu')?.hasAttribute('hidden')).toBe(true);
  });

  it('appelle l’action et referme', () => {
    const onShare = vi.fn();
    const onClose = vi.fn();
    render(
      <CarnetMoreMenu
        open
        saved={false}
        isOwner={false}
        onSave={noop}
        onShare={onShare}
        onCopy={noop}
        onReport={noop}
        onManage={noop}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Partager/ }));
    expect(onShare).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
