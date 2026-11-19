// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { ToastProvider } from '@/contexts/ToastContext';
import { CreateSheetV2 } from '../CreateSheetV2';
import { POST_MEDIA_MAX_COUNT, postSchemaV2, type MediaItemV2 } from '../engine/createSchemasV2';
import { POST_STEPS } from '../engine/steps';
import {
  computePhotoFilterAndTransform,
  computePhotoStyle,
  computeVignetteOverlayStyle,
  DEFAULT_PHOTO_MODIFIERS,
  PHOTO_EDITOR_CATEGORIES,
} from '../photo/photoEditor';
import { PhotoEditorPill } from '../photo/PhotoEditorPill';
import { PhotoEditorCard } from '../photo/PhotoEditorCard';
import { PhotoThumbnailStrip } from '../photo/PhotoThumbnailStrip';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/communaute',
  useSearchParams: () => new URLSearchParams(),
}));

const testUser = {
  id: '22222222-2222-4222-8222-222222222222',
  is_anonymous: false,
  user_metadata: { full_name: 'Camille Rando' },
} as unknown as User;

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(cleanup);

describe('Milestone 1 — Photo Editor & Post Flow (F1.1 to F1.6)', () => {
  describe('F1.5 & Engine : 15 modificateurs sur 3 catégories sans filtres prédéfinis', () => {
    it('comprend exactement 3 catégories de 5 modificateurs chacune (15 au total)', () => {
      expect(PHOTO_EDITOR_CATEGORIES).toHaveLength(3);
      const [light, color, detail] = PHOTO_EDITOR_CATEGORIES;

      expect(light.id).toBe('light');
      expect(light.label).toBe('Lumière');
      expect(light.modifiers).toHaveLength(5);
      expect(light.modifiers.map((m) => m.key)).toEqual([
        'brightness',
        'contrast',
        'exposure',
        'shadows',
        'warmth',
      ]);

      expect(color.id).toBe('color');
      expect(color.label).toBe('Couleur');
      expect(color.modifiers).toHaveLength(5);
      expect(color.modifiers.map((m) => m.key)).toEqual([
        'saturation',
        'hue',
        'temperature',
        'fade',
        'vibrance',
      ]);

      expect(detail.id).toBe('detail');
      expect(detail.label).toBe('Détails & Géométrie');
      expect(detail.modifiers).toHaveLength(5);
      expect(detail.modifiers.map((m) => m.key)).toEqual([
        'rotation',
        'vignette',
        'blur',
        'zoom',
        'flipX',
      ]);
    });

    it('calcule les valeurs par défaut proprement sans transformation résiduelle', () => {
      const { filter, transform } = computePhotoFilterAndTransform(DEFAULT_PHOTO_MODIFIERS);
      expect(filter).toContain('brightness(100%)');
      expect(filter).toContain('contrast(100%)');
      expect(filter).toContain('saturate(100%)');
      expect(filter).toContain('hue-rotate(0deg)');
      expect(filter).not.toContain('sepia');
      expect(filter).not.toContain('blur');
      expect(transform).toBe('scaleX(1) scale(1) rotate(0deg)');
    });

    it('applique les modificateurs de la catégorie Lumière (brightness, contrast, exposure, shadows, warmth)', () => {
      const res = computePhotoFilterAndTransform({
        brightness: 130,
        contrast: 110,
        exposure: 15,
        shadows: 20,
        warmth: 25,
      });
      // Brightness = 130 + 15 + 20 * 0.2 = 149%
      expect(res.filter).toContain('brightness(149%)');
      // Warmth > 0 ajoute sepia
      expect(res.filter).toContain('sepia(10%)');
    });

    it('applique les modificateurs de la catégorie Couleur (saturation, hue, temperature, fade, vibrance)', () => {
      const res = computePhotoFilterAndTransform({
        saturation: 150,
        vibrance: 20,
        hue: 45,
        fade: 20,
        temperature: -10,
      });
      // Saturation = 150 + 20 = 170%
      expect(res.filter).toContain('saturate(170%)');
      // Fade adoucit le contraste (100 * (1 - 20/200) = 90%)
      expect(res.filter).toContain('contrast(90%)');
      // Hue = 45 - 2 = 43deg
      expect(res.filter).toContain('hue-rotate(43deg)');
    });

    it('applique les modificateurs de la catégorie Détails & Géométrie (rotation, vignette, blur, zoom, flipX)', () => {
      const res = computePhotoFilterAndTransform({
        rotation: 15,
        blur: 3,
        zoom: 125,
        flipX: true,
      });
      expect(res.filter).toContain('blur(3px)');
      expect(res.transform).toBe('scaleX(-1) scale(1.25) rotate(15deg)');

      const vignette = computeVignetteOverlayStyle(40);
      expect(vignette).toBeTruthy();
      expect(vignette?.background).toContain('radial-gradient');
    });
  });

  describe('F1.3 & F1.4 : Pilule flottante en verre et 3 icônes de retouche', () => {
    it('rend les 3 icônes de catégories dans la barre d’outils', () => {
      const onSelect = vi.fn();
      render(<PhotoEditorPill activeCategory={null} onSelectCategory={onSelect} />);

      const pill = screen.getByTestId('photo-editor-pill');
      expect(pill).toBeTruthy();

      const btnLight = screen.getByTestId('editor-cat-light');
      const btnColor = screen.getByTestId('editor-cat-color');
      const btnDetail = screen.getByTestId('editor-cat-detail');

      expect(btnLight.getAttribute('aria-label')).toBe('Lumière');
      expect(btnColor.getAttribute('aria-label')).toBe('Couleur');
      expect(btnDetail.getAttribute('aria-label')).toBe('Détails & Géométrie');

      fireEvent.click(btnLight);
      expect(onSelect).toHaveBeenCalledWith('light');

      fireEvent.click(btnColor);
      expect(onSelect).toHaveBeenCalledWith('color');

      fireEvent.click(btnDetail);
      expect(onSelect).toHaveBeenCalledWith('detail');
    });

    it('affiche l’état actif sur le bouton correspondant', () => {
      const { rerender } = render(
        <PhotoEditorPill activeCategory="color" onSelectCategory={vi.fn()} />,
      );
      expect(screen.getByTestId('editor-cat-color').classList.contains('is-active')).toBe(true);
      expect(screen.getByTestId('editor-cat-light').classList.contains('is-active')).toBe(false);

      rerender(<PhotoEditorPill activeCategory="detail" onSelectCategory={vi.fn()} />);
      expect(screen.getByTestId('editor-cat-detail').classList.contains('is-active')).toBe(true);
    });
  });

  describe('F1.5 : Carte inférieure non-défilante avec curseurs fonctionnels', () => {
    it('affiche les 5 réglages de la catégorie Lumière et réagit aux modifications', () => {
      const onChange = vi.fn();
      const onReset = vi.fn();
      const onClose = vi.fn();

      render(
        <PhotoEditorCard
          category="light"
          modifiers={DEFAULT_PHOTO_MODIFIERS}
          onChangeModifier={onChange}
          onResetCategory={onReset}
          onClose={onClose}
        />,
      );

      expect(screen.getByTestId('photo-editor-card-light')).toBeTruthy();
      expect(screen.getByTestId('slider-brightness')).toBeTruthy();
      expect(screen.getByTestId('slider-contrast')).toBeTruthy();
      expect(screen.getByTestId('slider-exposure')).toBeTruthy();
      expect(screen.getByTestId('slider-shadows')).toBeTruthy();
      expect(screen.getByTestId('slider-warmth')).toBeTruthy();

      fireEvent.change(screen.getByTestId('slider-brightness'), { target: { value: '125' } });
      expect(onChange).toHaveBeenCalledWith('brightness', 125);

      fireEvent.click(screen.getByTestId('editor-reset-btn'));
      expect(onReset).toHaveBeenCalledWith('light');

      fireEvent.click(screen.getByTestId('editor-close-btn'));
      expect(onClose).toHaveBeenCalled();
    });

    it('gère l’interrupteur Miroir horizontal (flipX) de la catégorie Détails', () => {
      const onChange = vi.fn();
      render(
        <PhotoEditorCard
          category="detail"
          modifiers={{ ...DEFAULT_PHOTO_MODIFIERS, flipX: false }}
          onChangeModifier={onChange}
          onResetCategory={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      const toggle = screen.getByTestId('toggle-flipX');
      expect(toggle.getAttribute('aria-checked')).toBe('false');

      fireEvent.click(toggle);
      expect(onChange).toHaveBeenCalledWith('flipX', true);
    });
  });

  describe('F1.2 : Bandeau de miniatures carrées (jusqu’à 15 photos + bouton « + »)', () => {
    it('affiche les miniatures sélectionnées et le bouton carré « + »', () => {
      const media: MediaItemV2[] = [
        {
          id: 'p1',
          name: 'photo1.jpg',
          type: 'image/jpeg',
          size: 1000,
          previewUrl: 'blob:photo1',
          url: 'blob:photo1',
          alt: '',
          cover: true,
          status: 'uploaded',
          progress: 100,
          storageBucket: 'carnet-media',
          storagePath: 'p/p1.jpg',
          crop: '4:5',
        },
        {
          id: 'p2',
          name: 'photo2.jpg',
          type: 'image/jpeg',
          size: 1000,
          previewUrl: 'blob:photo2',
          url: 'blob:photo2',
          alt: '',
          cover: false,
          status: 'uploaded',
          progress: 100,
          storageBucket: 'carnet-media',
          storagePath: 'p/p2.jpg',
          crop: '4:5',
        },
      ];

      const onSelect = vi.fn();
      const onRemove = vi.fn();
      const onAdd = vi.fn();

      render(
        <PhotoThumbnailStrip
          media={media}
          activeIndex={0}
          onSelectPhoto={onSelect}
          onRemovePhoto={onRemove}
          onAddPhotoClick={onAdd}
          maxCount={15}
        />,
      );

      expect(screen.getByTestId('photo-thumb-0').classList.contains('is-active')).toBe(true);
      expect(screen.getByTestId('photo-thumb-1').classList.contains('is-active')).toBe(false);

      const addBtn = screen.getByTestId('post-add-photo-btn');
      expect(addBtn).toBeTruthy();

      fireEvent.click(screen.getByTestId('photo-thumb-1').querySelector('button[role="tab"]')!);
      expect(onSelect).toHaveBeenCalledWith(1);

      fireEvent.click(screen.getByTestId('photo-remove-0'));
      expect(onRemove).toHaveBeenCalledWith(0);

      fireEvent.click(addBtn);
      expect(onAdd).toHaveBeenCalled();
    });

    it('masque le bouton « + » quand le plafond de 15 photos est atteint', () => {
      const fullList: MediaItemV2[] = Array.from({ length: 15 }, (_, i) => ({
        id: `p${i}`,
        name: `photo${i}.jpg`,
        type: 'image/jpeg',
        size: 500,
        previewUrl: `blob:photo${i}`,
        url: `blob:photo${i}`,
        alt: '',
        cover: i === 0,
        status: 'uploaded',
        progress: 100,
        storageBucket: 'carnet-media',
        storagePath: `p/p${i}.jpg`,
        crop: '4:5',
      }));

      render(
        <PhotoThumbnailStrip
          media={fullList}
          activeIndex={0}
          onSelectPhoto={vi.fn()}
          onRemovePhoto={vi.fn()}
          onAddPhotoClick={vi.fn()}
          maxCount={15}
        />,
      );

      expect(screen.queryByTestId('post-add-photo-btn')).toBeNull();
      expect(screen.getAllByRole('tab')).toHaveLength(15);
    });
  });

  describe('F1.6 & Schéma : 2 étapes (Format -> Contenu), suppression de l’étape Récapitulatif', () => {
    it('POST_STEPS ne contient plus que Format et Contenu', () => {
      expect(POST_STEPS).toHaveLength(2);
      expect(POST_STEPS[0].id).toBe('format');
      expect(POST_STEPS[1].id).toBe('contenu');
      expect(POST_STEPS.map((s) => s.id)).not.toContain('diffusion');
    });

    it('POST_MEDIA_MAX_COUNT vaut 15 et le schéma Zod accepte 15 médias', () => {
      expect(POST_MEDIA_MAX_COUNT).toBe(15);

      const items15 = Array.from({ length: 15 }, (_, i) => ({
        id: `p${i}`,
        name: `p${i}.jpg`,
        type: 'image/jpeg',
        size: 500,
        previewUrl: `blob:p${i}`,
        url: `https://example.test/p${i}.jpg`,
        alt: '',
        cover: i === 0,
        status: 'uploaded' as const,
        progress: 100,
        storageBucket: 'carnet-media',
        storagePath: `p/p${i}.jpg`,
        crop: '4:5' as const,
      }));

      const validValues = {
        format: 'photo' as const,
        audience: 'public' as const,
        clubId: '',
        media: items15,
        title: '',
        content: 'Superbe randonnée',
        location: 'Massif du Mont-Blanc',
        locationLat: 45.83,
        locationLng: 6.86,
        tags: [],
        mentions: [],
        allowComments: true,
        allowLikes: true,
        scheduleEnabled: false,
        scheduleDate: '',
        scheduleTime: '09:00',
        clientRequestId: 'test-req-1',
      };

      const result15 = postSchemaV2.safeParse(validValues);
      expect(result15.success).toBe(true);

      const items16 = [...items15, { ...items15[0], id: 'p16' }];
      const result16 = postSchemaV2.safeParse({ ...validValues, media: items16 });
      expect(result16.success).toBe(false);
    });
  });

  describe('Intégration CreateSheetV2 : Post Flow complet', () => {
    it('monte la coque avec le formulaire post, l’aperçu interactif, et sans étape Récapitulatif', async () => {
      render(
        <ToastProvider>
          <CreateSheetV2 open initialKind="post" onClose={vi.fn()} user={testUser} />
        </ToastProvider>,
      );

      // Aperçu présent sans attribut inert ni aria-hidden="true"
      const heroPreview = await screen.findByTestId('post-hero-preview');
      expect(heroPreview).toBeTruthy();
      expect(heroPreview.hasAttribute('inert')).toBe(false);
      expect(heroPreview.getAttribute('aria-hidden')).toBeNull();

      // Input fichier présent dans le DOM
      const fileInput = screen.getByTestId('post-file-input');
      expect(fileInput).toBeTruthy();
      expect(fileInput.getAttribute('type')).toBe('file');

      // Mini-capsule d'étapes : seulement 2 étapes
      const tabs = screen.getAllByRole('tab');
      const stepTabs = tabs.filter((t) => t.getAttribute('aria-label')?.startsWith('Étape'));
      expect(stepTabs).toHaveLength(2);
      expect(screen.queryByText(/Étape 3/)).toBeNull();

      // Passage à l’étape Contenu
      const nextBtn = screen.getByRole('button', { name: 'Suivant' });
      fireEvent.click(nextBtn);

      // À l’étape 2 (Contenu), l’action finale est « Publier »
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Publier' })).toBeTruthy();
      });

      // Switches de publication présents sur l'étape Contenu
      expect(screen.getByTestId('post-publication-switches')).toBeTruthy();
      expect(screen.getByRole('switch', { name: 'Autoriser les commentaires' })).toBeTruthy();
      expect(screen.getByRole('switch', { name: 'Autoriser les j’aime' })).toBeTruthy();
      expect(screen.getByRole('switch', { name: 'Programmer la publication' })).toBeTruthy();

      // Aucune carte Récapitulatif
      expect(screen.queryByText('Récapitulatif')).toBeNull();
    });

    it('le clic sur l’aperçu déclenche l’input de sélection de fichier', async () => {
      render(
        <ToastProvider>
          <CreateSheetV2 open initialKind="post" onClose={vi.fn()} user={testUser} />
        </ToastProvider>,
      );

      const fileInput = await screen.findByTestId('post-file-input');
      const clickSpy = vi.spyOn(fileInput, 'click');

      const mediaBox = screen.getByTestId('post-preview-media-box');
      fireEvent.click(mediaBox);

      expect(clickSpy).toHaveBeenCalled();
    });
  });
});
