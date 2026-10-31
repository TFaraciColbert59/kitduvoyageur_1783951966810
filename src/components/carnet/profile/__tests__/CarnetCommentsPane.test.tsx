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
    const names = [...container.querySelectorAll('.lkdv-comment-name')].map((n) => n.textContent);
    expect(names).toEqual(['Rachid', 'Léonie']);
    expect(screen.getByRole('group', { name: 'Tri des commentaires' })).toBeTruthy();
  });

  it('bascule le tri en anciens', () => {
    const { container } = render(<CarnetCommentsPane comments={COMMENTS} {...base} />);
    fireEvent.click(screen.getByRole('button', { name: 'anciens' }));
    const names = [...container.querySelectorAll('.lkdv-comment-name')].map((n) => n.textContent);
    expect(names).toEqual(['Léonie', 'Rachid']);
  });

  it('porte le handle réel et les métadonnées sous le texte', () => {
    const { container } = render(
      <CarnetCommentsPane
        comments={[{ ...COMMENTS[0], authorHandle: 'leonie' }]}
        {...base}
      />,
    );
    expect(container.querySelector('.lkdv-comment-handle')?.textContent).toBe('@leonie');
    const row = container.querySelector('.lkdv-comment') as HTMLElement;
    expect(row.querySelector('.lkdv-comment-time')?.textContent?.length).toBeGreaterThan(0);
    expect([...row.querySelectorAll('.lkdv-comment-actions button')].map((b) => b.textContent)).toEqual(['Supprimer']);
  });

  it('anime l’entrée d’un nouveau commentaire, jamais la liste montée', () => {
    const { container, rerender } = render(<CarnetCommentsPane comments={COMMENTS} {...base} />);
    expect(container.querySelectorAll('.lkdv-comment.is-new')).toHaveLength(0);
    rerender(
      <CarnetCommentsPane
        comments={[
          ...COMMENTS,
          { id: 'c3', authorId: 'u1', authorName: 'Léonie', authorAvatar: null, content: 'Encore', createdAt: '2026-05-08T10:00:00Z' },
        ]}
        {...base}
      />,
    );
    expect(container.querySelectorAll('.lkdv-comment.is-new')).toHaveLength(1);
  });

  it('affiche l’état vide sans phrase : glyphe de 32 px et tiret', () => {
    const { container } = render(<CarnetCommentsPane comments={[]} {...base} canWrite={false} currentUserId={null} />);
    const empty = container.querySelector('.ckp-empty-state');
    expect(empty?.querySelector('.ckp-empty-dash')?.textContent).toBe('—');
    expect(container.querySelector('.ckp-empty-glyph > span')).toBeTruthy();
    /* La porte d'authentification reste un geste, pas une phrase. */
    expect(screen.getByRole('button', { name: 'Se connecter pour commenter' })).toBeTruthy();
    expect(container.textContent).not.toMatch(/premier|Connectez-vous/);
  });

  it('charge en squelette : 5 lignes de 48 px, aucun texte', () => {
    const { container } = render(<CarnetCommentsPane comments={[]} {...base} loading />);
    expect(container.querySelectorAll('.ckp-load-bar--row')).toHaveLength(5);
    expect(container.querySelectorAll('.ckp-load-bar--hero')).toHaveLength(0);
    expect(screen.queryByText('Chargement…')).toBeNull();
  });

  it('charge en partie : les lignes connues restent, le reste attend', () => {
    const { container } = render(<CarnetCommentsPane comments={COMMENTS} {...base} loading />);
    expect(container.querySelectorAll('.lkdv-comment')).toHaveLength(2);
    expect(container.querySelectorAll('.ckp-load-bar--row')).toHaveLength(2);
    expect(container.querySelector('.ckp-comments-list')?.getAttribute('data-state')).toBe('partial');
  });

  it('envoie un commentaire', async () => {
    const onSend = vi.fn(async () => true);
    render(<CarnetCommentsPane comments={[]} {...base} onSend={onSend} />);
    fireEvent.change(screen.getByLabelText('Ajouter un commentaire'), { target: { value: 'Bravo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publier le commentaire' }));
    expect(onSend).toHaveBeenCalledWith('Bravo');
  });
});
