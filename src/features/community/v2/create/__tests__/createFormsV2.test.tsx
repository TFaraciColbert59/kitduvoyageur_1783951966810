// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { ToastProvider } from '@/contexts/ToastContext';
import { CreateSheetV2 } from '../CreateSheetV2';
import { CREATE_KINDS_V2, createDefaultsV2, type CreateKindV2 } from '../engine/createSchemasV2';
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

const EXPECTED_STEPS: Record<CreateKindV2, string[]> = {
  post: ['Étape 1 : Format', 'Étape 2 : Contenu', 'Étape 3 : Diffusion'],
  story: ['Étape 1 : Média', 'Étape 2 : Édition', 'Étape 3 : Diffusion'],
  carnet: ['Étape 1 : Infos', 'Étape 2 : Tracé', 'Étape 3 : Jours', 'Étape 4 : Partage'],
  sortie: [
    'Étape 1 : Activité et lieu',
    'Étape 2 : Itinéraire',
    'Étape 3 : Participants',
    'Étape 4 : Sécurité',
  ],
  kit: ['Étape 1 : Inventaire', 'Étape 2 : Compléter', 'Étape 3 : Partager'],
  club: ['Étape 1 : Identité', 'Étape 2 : Univers', 'Étape 3 : Adhésion', 'Étape 4 : Publication'],
};

beforeEach(() => {
  window.localStorage.clear();
  clearAllDraftsV2(CREATE_KINDS_V2);
});

afterEach(cleanup);

function renderKind(kind: CreateKindV2) {
  return render(
    <ToastProvider>
      <CreateSheetV2
        open
        initialKind={kind}
        onClose={vi.fn()}
        user={user}
        onCreated={vi.fn()}
        onRequireAuth={vi.fn()}
      />
    </ToastProvider>,
  );
}

describe('les six formulaires V2 passent par le même moteur', () => {
  for (const kind of CREATE_KINDS_V2) {
    it(`${kind} : formulaire monté, capsule à 6 types, étapes dans la mini-capsule`, async () => {
      renderKind(kind);
      await waitFor(() => expect(screen.getByTestId(`cv2-form-${kind}`)).toBeTruthy());
      const capsule = screen.getByRole('tablist', { name: 'Type de création' });
      expect(capsule.querySelectorAll('[role="tab"]')).toHaveLength(6);
      const steps = screen.getByRole('tablist', { name: /Étapes de la création/ });
      const labels = Array.from(steps.querySelectorAll('[role="tab"]')).map((tab) =>
        tab.getAttribute('aria-label'),
      );
      expect(labels).toEqual(EXPECTED_STEPS[kind]);
      // Le pied propose toujours Suivant, et un Retour désactivé à l'étape 1.
      expect(screen.getByRole('button', { name: 'Suivant' })).toBeTruthy();
      expect((screen.getByRole('button', { name: 'Retour' }) as HTMLButtonElement).disabled).toBe(true);
      // data-testid de champ sur le premier champ du formulaire (sauf étapes
      // faites de cartes/jauges : Publication Format, Kit Inventaire).
      if (kind !== 'post' && kind !== 'kit') {
        expect(document.querySelectorAll('[data-testid^="cv2-field-"]').length).toBeGreaterThan(0);
      }
    });
  }

  it('Story : aperçu compact et deux pilules Galerie / Caméra à l’étape Média', async () => {
    renderKind('story');
    await waitFor(() => expect(screen.getByTestId('cv2-story-preview')).toBeTruthy());
    const preview = screen.getByTestId('cv2-story-preview');
    expect(preview.textContent).toContain('Story · 24 h');
    expect(preview.textContent).toContain('Ajoute un média pour commencer');
    // Maquette : deux boutons, plus de segment (HTML L2890).
    expect(screen.getByRole('button', { name: /Galerie/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Caméra/ })).toBeTruthy();
    // La scène 9:16 n'est plus le contenu de l'étape Média.
    expect(screen.queryByTestId('cv2-story-stage')).toBeNull();
  });

  it('Story : un brouillon rouvert à l’étape Édition monte l’éditeur et son cadrage', async () => {
    const media = {
      id: 's1',
      name: 'story.jpg',
      type: 'image/jpeg',
      size: 120,
      previewUrl: '',
      url: 'https://example.test/story.jpg',
      alt: '',
      cover: true,
      status: 'uploaded' as const,
      progress: 100,
      storageBucket: 'stories-private',
      storagePath: 'u/story.jpg',
      crop: '9:16' as const,
    };
    window.localStorage.setItem(
      draftStorageKey('story'),
      JSON.stringify({
        version: 1,
        kind: 'story',
        updatedAt: Date.now(),
        values: { ...createDefaultsV2('story'), media: [media] },
        step: 1,
      }),
    );
    renderKind('story');
    // Étape 2 restaurée (N1) : la scène et le cadrage sont rendus.
    await waitFor(() => expect(screen.getByTestId('cv2-story-stage')).toBeTruthy());
    expect(screen.getByRole('group', { name: 'Cadrage de la story' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zoomer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remplacer' })).toBeTruthy();
    // Légende et texte alternatif sont dans le flux, avant les outils.
    expect(screen.getByLabelText(/Légende/)).toBeTruthy();
    expect(screen.getByLabelText(/Texte alternatif/)).toBeTruthy();
  });

  it('Sortie : l’aperçu billet vivant est présent dès l’étape 1', async () => {
    renderKind('sortie');
    await waitFor(() => expect(screen.getByLabelText(/Aperçu :/)).toBeTruthy());
  });

  it('Carnet : la visibilité par défaut est privée', async () => {
    const defaults = createDefaultsV2('carnet');
    expect(defaults.visibility).toBe('private');
  });

  it('FID-056 : les six aperçus vivent dans l’emplacement fixe de la coque', async () => {
    for (const kind of CREATE_KINDS_V2) {
      renderKind(kind);
      await waitFor(() =>
        expect(screen.getByTestId('cv2-preview-slot').childElementCount).toBeGreaterThan(0),
      );
      expect(screen.getByTestId('cv2-preview-slot').getAttribute('aria-label')).toBe(
        'Aperçu en direct',
      );
      cleanup();
    }
  });
});
