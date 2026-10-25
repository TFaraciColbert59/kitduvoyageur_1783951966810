// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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
    expect(screen.getByText('Bravo')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Filtre des j’aime' })).toBeTruthy();
  });

  it('affiche l’état vide honnête', () => {
    render(<CarnetLikesPane detail={detail({ likers: [] })} currentUserId={null} />);
    expect(screen.getByText('Aucun j’aime pour l’instant.')).toBeTruthy();
  });
});
