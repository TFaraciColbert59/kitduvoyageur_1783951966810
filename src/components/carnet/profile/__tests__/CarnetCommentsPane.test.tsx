// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetCommentsPane } from '../panes/CarnetCommentsPane';

afterEach(() => cleanup());

const COMMENTS = [
  { id: 'c1', authorId: 'u1', authorName: 'Léonie', authorAvatar: null, content: 'Superbe', createdAt: '2026-05-06T10:00:00Z' },
  { id: 'c2', authorId: 'u2', authorName: 'Rachid', authorAvatar: null, content: 'Merci', createdAt: '2026-05-07T10:00:00Z' },
];

const base = {
  loading: false,
  canWrite: true,
  currentUserId: 'u1',
  onSend: async () => true,
  onRemove: async () => true,
  onRequireAuth: () => {},
};

describe('CarnetCommentsPane', () => {
  it('trie du plus récent au plus ancien par défaut', () => {
    const { container } = render(<CarnetCommentsPane comments={COMMENTS} {...base} />);
    const names = [...container.querySelectorAll('.ckp-comment-name')].map((n) => n.textContent);
    expect(names).toEqual(['Rachid', 'Léonie']);
    expect(screen.getByRole('group', { name: 'Tri des commentaires' })).toBeTruthy();
  });

  it('bascule le tri en anciens', () => {
    const { container } = render(<CarnetCommentsPane comments={COMMENTS} {...base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Anciens' }));
    const names = [...container.querySelectorAll('.ckp-comment-name')].map((n) => n.textContent);
    expect(names).toEqual(['Léonie', 'Rachid']);
  });

  it('affiche l’état vide du Compte', () => {
    render(<CarnetCommentsPane comments={[]} {...base} currentUserId={null} />);
    expect(screen.getByText('Sois le premier à répondre.')).toBeTruthy();
  });

  it('envoie un commentaire', async () => {
    const onSend = vi.fn(async () => true);
    render(<CarnetCommentsPane comments={[]} {...base} onSend={onSend} />);
    fireEvent.change(screen.getByLabelText('Ajouter un commentaire'), { target: { value: 'Bravo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le commentaire' }));
    expect(onSend).toHaveBeenCalledWith('Bravo');
  });
});
