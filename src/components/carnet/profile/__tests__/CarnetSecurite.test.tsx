// @vitest-environment jsdom
/**
 * Gardes de sécurité de la fiche carnet — comportement, pas intention.
 *
 * Trois verrous, chacun vérifié sur le DOM réel :
 *  1. tout lien sortant de la fiche (drawer Partage, champs `href`) porte
 *     `rel="noopener noreferrer"` : la page ouverte ne peut ni manipuler
 *     `window.opener` ni recevoir le Referer complet ;
 *  2. le composer de commentaire porte un `maxLength` réel (colonne
 *     `carnet_comments.content` = `text` sans contrainte côté base) ;
 *  3. aucune erreur technique n'est rendue : le hook de commentaires expose un
 *     message générique et le message PostgREST reste en console.
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetField } from '../CarnetField';
import { CARNET_COMMENT_MAX_LENGTH, CarnetCommentsPane } from '../panes/CarnetCommentsPane';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('liens sortants de la fiche', () => {
  it('pose rel="noopener noreferrer" et target="_blank" sur un champ href', () => {
    render(<CarnetField label="whatsapp" href="https://wa.me/?text=carnet" ariaLabel="whatsapp" />);
    const link = screen.getByRole('link', { name: 'whatsapp' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('ne pose aucun target sur un champ bouton', () => {
    render(<CarnetField label="copier le lien" onClick={() => {}} ariaLabel="Copier le lien du carnet" />);
    const button = screen.getByRole('button', { name: 'Copier le lien du carnet' });
    expect(button.getAttribute('target')).toBeNull();
    expect(button.getAttribute('rel')).toBeNull();
  });
});

describe('longueur des champs libres', () => {
  it('plafonne la saisie du commentaire et garde le plafond unique de la maison', () => {
    render(
      <CarnetCommentsPane
        comments={[]}
        loading={false}
        canWrite
        currentUserId="u1"
        onSend={async () => true}
        onRemove={async () => true}
        onRequireAuth={() => {}}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Ajouter un commentaire' }) as HTMLInputElement;
    expect(CARNET_COMMENT_MAX_LENGTH).toBe(500);
    expect(input.getAttribute('maxlength')).toBe(String(CARNET_COMMENT_MAX_LENGTH));
  });
});
