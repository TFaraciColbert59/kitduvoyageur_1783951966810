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
        onLikes={noop}
        onComments={noop}
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
        onLikes={noop}
        onComments={noop}
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
        onLikes={noop}
        onComments={noop}
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
        onLikes={noop}
        onComments={noop}
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
        onLikes={noop}
        onComments={noop}
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
        onLikes={noop}
        onComments={noop}
        onReport={noop}
        onManage={noop}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Partager/ }));
    expect(onShare).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('ouvre les pages J’aime et Commentaires depuis le menu, puis se referme', () => {
    const onLikes = vi.fn();
    const onComments = vi.fn();
    const onClose = vi.fn();
    render(
      <CarnetMoreMenu
        open
        saved={false}
        isOwner={false}
        onSave={noop}
        onShare={noop}
        onCopy={noop}
        onLikes={onLikes}
        onComments={onComments}
        onReport={noop}
        onManage={noop}
        onClose={onClose}
      />,
    );
    const menu = screen.getByRole('group', { name: 'Options du carnet' });
    expect([...menu.querySelectorAll('button')].map((node) => node.textContent)).toEqual([
      'Enregistrer',
      'Partager',
      'Copier le lien',
      'J’aime',
      'Commentaires',
      'Signaler',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'J’aime' }));
    expect(onLikes).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Commentaires' }));
    expect(onComments).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('garde les deux entrées pour le propriétaire, entre le lien et Gérer', () => {
    render(
      <CarnetMoreMenu
        open
        saved={false}
        isOwner
        onSave={noop}
        onShare={noop}
        onCopy={noop}
        onLikes={noop}
        onComments={noop}
        onReport={noop}
        onManage={noop}
        onClose={noop}
      />,
    );
    const menu = screen.getByRole('group', { name: 'Options du carnet' });
    expect([...menu.querySelectorAll('button')].map((node) => node.textContent)).toEqual([
      'Enregistrer',
      'Partager',
      'Copier le lien',
      'J’aime',
      'Commentaires',
      'Gérer le carnet',
      'Signaler',
    ]);
  });
});
