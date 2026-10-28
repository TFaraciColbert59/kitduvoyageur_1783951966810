// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetLikesPane } from '../panes/CarnetLikesPane';
import { detail } from './fixtures';

afterEach(() => cleanup());

const DETAIL = detail({
  likers: [
    { id: 'u1', name: 'Léonie Fabre', handle: 'leonie', avatarUrl: null, reaction: 'like' },
    { id: 'u2', name: 'Rachid Benali', handle: 'rachid', avatarUrl: null, reaction: 'bravo' },
  ],
});

describe('CarnetLikesPane', () => {
  it('affiche les réactions réelles avec leur libellé', () => {
    render(<CarnetLikesPane detail={DETAIL} currentUserId="u1" />);
    expect(screen.getByText('Léonie Fabre')).toBeTruthy();
    expect(screen.getByText('Rachid Benali')).toBeTruthy();
    /* « bravo » est le libellé de la réaction et l'un des segments de filtre. */
    expect(screen.getAllByText('bravo').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('group', { name: 'Filtre des réactions' })).toBeTruthy();
  });

  it('donne le total réel et la bascule dans deux champs, jamais une phrase', () => {
    const { container } = render(
      <CarnetLikesPane detail={DETAIL} currentUserId="u1" like={{ liked: false, count: 2, onToggle: () => {} }} />,
    );
    const fields = [...container.querySelectorAll('.ckp-field')];
    expect(fields.map((field) => field.querySelector('.ckp-field-label')?.textContent)).toEqual([
      'réactions',
      'mon j’aime',
    ]);
    expect(fields[0].querySelector('.ckp-field-value')?.textContent).toBe('2');
    expect(fields[1].querySelector('.ckp-field-value')?.textContent).toBe('2');
    /* Aucun titre, aucun compteur nu : la donnée est toujours dans un champ. */
    expect(container.textContent).not.toMatch(/réactions$/);
  });

  it('filtre par réaction avec les segments du sous-sélecteur, sans masquer la liste au repos', () => {
    const { container } = render(<CarnetLikesPane detail={DETAIL} currentUserId="u1" />);
    const segments = [...container.querySelectorAll('.ckp-sub button')];
    expect(segments.map((segment) => segment.getAttribute('aria-label'))).toEqual(['j’aime', 'bravo']);
    expect(segments.every((segment) => segment.getAttribute('aria-pressed') === 'false')).toBe(true);
    expect(container.querySelectorAll('.ckp-liker')).toHaveLength(2);
    fireEvent.click(segments[1]);
    expect(container.querySelectorAll('.ckp-liker')).toHaveLength(1);
    fireEvent.click(segments[1]);
    expect(container.querySelectorAll('.ckp-liker')).toHaveLength(2);
  });

  it('affiche un état vide sans phrase : glyphe de 32 px et tiret', () => {
    const { container } = render(<CarnetLikesPane detail={detail({ likers: [] })} currentUserId={null} />);
    const empty = container.querySelector('.ckp-empty-state');
    expect(empty).toBeTruthy();
    expect(empty?.querySelector('.ckp-empty-dash')?.textContent).toBe('—');
    expect(container.querySelector('.ckp-empty-glyph > span')).toBeTruthy();
    expect(container.textContent).not.toMatch(/instant|premier|Aucun j’aime/);
  });

  it('porte la bascule J’aime du carnet quand elle est fournie', () => {
    const onToggle = vi.fn();
    render(
      <CarnetLikesPane
        detail={DETAIL}
        currentUserId="u1"
        like={{ liked: false, count: 22, onToggle }}
      />,
    );
    const toggle = screen.getByRole('button', { name: 'J’aime ce carnet' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('affiche l’état actif de la bascule sans changer les réactions', () => {
    render(
      <CarnetLikesPane
        detail={DETAIL}
        currentUserId="u1"
        like={{ liked: true, count: 22, onToggle: () => {} }}
      />,
    );
    const toggle = screen.getByRole('button', { name: 'Retirer mon j’aime' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.querySelector('.ckp-field-value')?.textContent).toBe('22');
  });
});
