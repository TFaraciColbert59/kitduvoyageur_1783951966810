// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { ToastProvider } from '@/contexts/ToastContext';
import { CreateSheetV2 } from '../CreateSheetV2';
import { CREATE_KINDS_V2, createDefaultsV2 } from '../engine/createSchemasV2';
import { clearAllDraftsV2, draftStorageKey } from '../engine/useDraftV2';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/communaute',
  useSearchParams: () => new URLSearchParams(),
}));

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  is_anonymous: false,
  user_metadata: { full_name: 'Toi' },
} as unknown as User;

function renderSheet(props: Partial<React.ComponentProps<typeof CreateSheetV2>> = {}) {
  return render(
    <ToastProvider>
      <CreateSheetV2
        open
        initialKind="post"
        onClose={vi.fn()}
        user={user}
        onCreated={vi.fn()}
        onRequireAuth={vi.fn()}
        {...props}
      />
    </ToastProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  clearAllDraftsV2(CREATE_KINDS_V2);
});

afterEach(cleanup);

describe('CreateSheetV2 — moteur et coque', () => {
  it('affiche Suivant, jamais Retour à l’étape 1, et les 3 étapes en mini-capsule', async () => {
    renderSheet();
    const next = await screen.findByRole('button', { name: 'Suivant' });
    expect(next).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retour' })).toBeNull();
    const steps = screen.getByRole('tablist', { name: /Étapes de la création/ });
    expect(steps.querySelectorAll('[role="tab"]')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: 'Étape 1 : Format' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Étape 2 : Contenu' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Étape 3 : Diffusion' })).toBeTruthy();
  });

  it('Retour apparaît à l’étape 2 ; la capsule change d’étape sans perdre la saisie', async () => {
    renderSheet();
    fireEvent.click(await screen.findByRole('button', { name: 'Suivant' }));
    expect(await screen.findByRole('button', { name: 'Retour' })).toBeTruthy();
    // Le contenu de l'étape 2 est rendu (champ Légende).
    expect(await screen.findByLabelText(/Légende/)).toBeTruthy();
  });

  it('Suivant bloque une étape invalide : compteur unique et focus sur le premier champ fautif', async () => {
    renderSheet();
    // Audience « Un club » sans club choisi : l'étape 1 devient invalide.
    fireEvent.click(await screen.findByRole('radio', { name: /Un club/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));

    const summary = await screen.findByTestId('cv2c-error-summary');
    expect(summary.textContent).toContain('1 champ à corriger');
    // L'erreur est affichée une seule fois, sous son champ.
    const messages = await screen.findAllByText('Choisis un club.');
    expect(messages).toHaveLength(1);
    // Le focus va au champ fautif.
    await waitFor(() => {
      expect(document.activeElement?.id).toBe('cv2c-clubId');
    });
    // Toujours à l'étape 1.
    expect(screen.queryByLabelText(/Légende/)).toBeNull();
  });

  it('restaure un brouillon avec le bandeau « Brouillon restauré · Effacer »', async () => {
    const draft = { ...createDefaultsV2('post'), content: 'Mon brouillon' };
    window.localStorage.setItem(
      draftStorageKey('post'),
      JSON.stringify({ version: 1, kind: 'post', updatedAt: Date.now(), values: draft }),
    );
    renderSheet();
    const banner = await screen.findByTestId('cv2c-draft-banner');
    expect(banner.textContent).toContain('Brouillon restauré');
    fireEvent.click(screen.getByRole('button', { name: 'Effacer' }));
    await waitFor(() => {
      expect(screen.queryByTestId('cv2c-draft-banner')).toBeNull();
    });
  });

  it('demande confirmation avant de fermer une saisie (alertdialog)', async () => {
    const onClose = vi.fn();
    const draft = { ...createDefaultsV2('post'), content: 'Mon brouillon' };
    window.localStorage.setItem(
      draftStorageKey('post'),
      JSON.stringify({ version: 1, kind: 'post', updatedAt: Date.now(), values: draft }),
    );
    renderSheet({ onClose });
    await screen.findByTestId('cv2c-draft-banner');
    fireEvent.keyDown(document, { key: 'Escape' });
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('Fermer sans publier ?');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Continuer l’édition' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
  });
});
