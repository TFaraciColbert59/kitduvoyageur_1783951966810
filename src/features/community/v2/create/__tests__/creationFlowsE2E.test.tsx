// @vitest-environment jsdom
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import type { User } from '@supabase/supabase-js';

import { ToastProvider } from '@/contexts/ToastContext';
import { CreateSheetV2 } from '../CreateSheetV2';
import { PostHeroPreview } from '../photo/PostHeroPreview';
import { PhotoThumbnailStrip } from '../photo/PhotoThumbnailStrip';
import { PhotoEditorPill } from '../photo/PhotoEditorPill';
import { PhotoEditorCard } from '../photo/PhotoEditorCard';
import {
  computePhotoFilterAndTransform,
  computeVignetteOverlayStyle,
  DEFAULT_PHOTO_MODIFIERS,
  PHOTO_EDITOR_CATEGORIES,
  type PhotoModifiersV2,
} from '../photo/photoEditor';
import { POST_STEPS } from '../engine/steps';
import {
  CREATE_KINDS_V2,
  createDefaultsV2,
  createMediaItemV2,
  postSchemaV2,
  carnetSchemaV2,
  kitSchemaV2,
  POST_MEDIA_MAX_COUNT,
  type PostFormValuesV2,
  type CarnetFormValuesV2,
  type KitFormValuesV2,
  type MediaItemV2,
  type KitItemV2,
} from '../engine/createSchemasV2';
import {
  buildPostPayload,
  buildCarnetPayload,
  buildKitPayload,
  carnetCover,
} from '../createRpc';
import { TracePaneV2 } from '../carnet/TracePaneV2';
import { DaysPaneV2 } from '../carnet/DaysPaneV2';
import { KitCatalogDrawerV2 } from '../kit/KitCatalogDrawerV2';
import { KitFavoritesDrawerV2 } from '../kit/KitFavoritesDrawerV2';
import {
  kitItemsWeightV2,
  kitGoalOfWeightV2,
  kitLayersV2,
} from '../kit/kitTemplatesV2';
import { formatKitWeightV2 } from '../kit/kitContextV2';
import { clearAllDraftsV2 } from '../engine/useDraftV2';
import type { InventoryItemV2 } from '../kit/kitSourcesV2';

// ---------------------------------------------------------------------------
// Standard Project Mocks (MapLibre, Supabase, Navigation)
// ---------------------------------------------------------------------------

const mapCenterTracker = vi.hoisted(() => ({
  center: null as [number, number] | null,
  easedTo: [] as Array<{ center: [number, number]; zoom?: number }>,
}));

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));
vi.mock('maplibre-gl', () => {
  class FakeMap {
    options: Record<string, unknown>;
    dragPan = { enable: vi.fn(), disable: vi.fn() };
    dragRotate = { enable: vi.fn(), disable: vi.fn() };
    doubleClickZoom = { enable: vi.fn(), disable: vi.fn() };
    scrollZoom = { enable: vi.fn(), disable: vi.fn() };
    keyboard = { enable: vi.fn(), disable: vi.fn() };
    touchZoomRotate = { enable: vi.fn(), disable: vi.fn() };

    constructor(options: Record<string, unknown>) {
      this.options = options;
      mapCenterTracker.center = options.center as [number, number];
    }
    on = vi.fn((event: string, ...args: unknown[]) => {
      const handler = (typeof args[0] === 'function' ? args[0] : args[1]) as ((e?: unknown) => void) | undefined;
      if (event === 'load' && handler) handler();
      return this;
    });
    off = vi.fn();
    addSource = vi.fn();
    getSource = vi.fn(() => ({ setData: vi.fn() }));
    addLayer = vi.fn();
    getCanvas = vi.fn(() => ({ style: {} }));
    getZoom = vi.fn(() => 10);
    easeTo = vi.fn((opts: { center: [number, number]; zoom?: number }) => {
      mapCenterTracker.easedTo.push(opts);
    });
    jumpTo = vi.fn();
    remove = vi.fn();
  }
  class FakeMarker {
    lngLat: [number, number] = [0, 0];
    setLngLat(ll: [number, number]) {
      this.lngLat = ll;
      return this;
    }
    addTo() {
      return this;
    }
    on() {
      return this;
    }
    remove() {
      return this;
    }
  }
  return {
    default: { Map: FakeMap, Marker: FakeMarker, setWorkerUrl: vi.fn() },
    Map: FakeMap,
    Marker: FakeMarker,
    setWorkerUrl: vi.fn(),
  };
});

const supabaseTracker = vi.hoisted(() => ({
  fromCalls: [] as Array<{ table: string; select?: string }>,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => {
    const client = {
      from: (table: string) => {
        const queryBuilder = {
          select: vi.fn((cols: string) => {
            supabaseTracker.fromCalls.push({ table, select: cols });
            return queryBuilder;
          }),
          eq: vi.fn(() => queryBuilder),
          not: vi.fn(() => queryBuilder),
          order: vi.fn(() => queryBuilder),
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          then: (resolve: (val: unknown) => void) => resolve({ data: [], error: null }),
        };
        return queryBuilder;
      },
      rpc: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    };
    return client;
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/communaute',
  useSearchParams: () => new URLSearchParams(),
}));

if (typeof URL.createObjectURL !== 'function') {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn((file) => `blob:${file?.name || 'test'}`),
  });
}

// Standard test user fixture
const testUser = {
  id: '11111111-1111-4111-8111-111111111111',
  is_anonymous: false,
  user_metadata: { full_name: 'Camille Rando', handle: 'camille' },
} as unknown as User;

function renderCreationSheet(kind: 'post' | 'carnet' | 'kit') {
  return render(
    <ToastProvider>
      <CreateSheetV2
        open
        initialKind={kind}
        onClose={vi.fn()}
        user={testUser}
        onCreated={vi.fn()}
        onRequireAuth={vi.fn()}
      />
    </ToastProvider>,
  );
}

function CarnetHarness({
  defaultValues,
  children,
}: {
  defaultValues?: Partial<CarnetFormValuesV2>;
  children: React.ReactNode;
}) {
  const form = useForm<CarnetFormValuesV2>({
    defaultValues: { ...createDefaultsV2('carnet'), ...defaultValues },
  });
  return <FormProvider {...form}>{children}</FormProvider>;
}

function createTestMedia(partial: Partial<MediaItemV2> = {}): MediaItemV2 {
  return createMediaItemV2({
    status: 'uploaded',
    progress: 100,
    url: 'https://images.unsplash.com/photo-test-alpine.jpg',
    storageBucket: 'carnet-media',
    storagePath: 'u/photo-test-alpine.jpg',
    crop: '4:5',
    modifiers: { ...DEFAULT_PHOTO_MODIFIERS },
    ...partial,
  });
}

beforeEach(() => {
  window.localStorage.clear();
  clearAllDraftsV2(CREATE_KINDS_V2);
  mapCenterTracker.center = null;
  mapCenterTracker.easedTo = [];
  supabaseTracker.fromCalls = [];
});

afterEach(cleanup);

/* ========================================================================= */
/* TIER 1: FEATURE COVERAGE (R1, R2, R3)                                     */
/* ========================================================================= */
describe('Tier 1: Feature Coverage (R1, R2, R3)', () => {
  it('Form Mounting: CreateSheetV2 mounts successfully for post, carnet, and kit', async () => {
    const p = renderCreationSheet('post');
    await waitFor(() => expect(screen.getByTestId('cv2-form-post')).toBeTruthy());
    p.unmount();

    const c = renderCreationSheet('carnet');
    await waitFor(() => expect(screen.getByTestId('cv2-form-carnet')).toBeTruthy());
    c.unmount();

    const k = renderCreationSheet('kit');
    await waitFor(() => expect(screen.getByTestId('cv2-form-kit')).toBeTruthy());
    k.unmount();
  });

  describe('R1: Post Creation Flow & Photo Editor', () => {
    it('F1.1: Direct photo preview picker trigger contract and file acceptance', async () => {
      renderCreationSheet('post');
      await waitFor(() => expect(screen.getByTestId('post-file-input')).toBeTruthy());

      const fileInput = screen.getByTestId('post-file-input') as HTMLInputElement;
      expect(fileInput.getAttribute('type')).toBe('file');
      expect(fileInput.getAttribute('accept')).toBe('image/*');
      expect(fileInput.hasAttribute('multiple')).toBe(true);

      const clickSpy = vi.spyOn(fileInput, 'click');
      const mediaBox = screen.getByTestId('post-preview-media-box');
      fireEvent.click(mediaBox);
      expect(clickSpy).toHaveBeenCalled();

      const testFile = new File(['alpine-bytes'], 'mont-blanc.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [testFile] } });

      await waitFor(() => {
        expect(screen.getByTestId('post-preview-active-image')).toBeTruthy();
      });
    });

    it('F1.2: Thumbnail carousel strip accepts up to 15 items ending with dashed "+" button', () => {
      expect(POST_MEDIA_MAX_COUNT).toBe(15);

      const onSelect = vi.fn();
      const onRemove = vi.fn();
      const onAdd = vi.fn();

      const items3: MediaItemV2[] = [
        createTestMedia({ id: 'p1', url: 'https://example.test/p1.jpg' }),
        createTestMedia({ id: 'p2', url: 'https://example.test/p2.jpg' }),
        createTestMedia({ id: 'p3', url: 'https://example.test/p3.jpg' }),
      ];

      const { unmount } = render(
        <PhotoThumbnailStrip
          media={items3}
          activeIndex={0}
          onSelectPhoto={onSelect}
          onRemovePhoto={onRemove}
          onAddPhotoClick={onAdd}
          maxCount={POST_MEDIA_MAX_COUNT}
        />,
      );

      expect(screen.getByTestId('photo-thumb-0').className).toContain('is-active');
      expect(screen.getByTestId('post-add-photo-btn')).toBeTruthy();

      fireEvent.click(screen.getByTestId('photo-remove-1'));
      expect(onRemove).toHaveBeenCalledWith(1);

      fireEvent.click(screen.getByTestId('post-add-photo-btn'));
      expect(onAdd).toHaveBeenCalled();
      unmount();

      const items15: MediaItemV2[] = Array.from({ length: 15 }, (_, i) =>
        createTestMedia({ id: `p-${i + 1}`, url: `https://example.test/p-${i + 1}.jpg` }),
      );

      render(
        <PhotoThumbnailStrip
          media={items15}
          activeIndex={0}
          onSelectPhoto={onSelect}
          onRemovePhoto={onRemove}
          onAddPhotoClick={onAdd}
          maxCount={POST_MEDIA_MAX_COUNT}
        />,
      );

      expect(screen.getAllByRole('tab')).toHaveLength(15);
      expect(screen.queryByTestId('post-add-photo-btn')).toBeNull();
    });

    it('F1.3: Realistic post proportions (4:5 / 1:1) and 3-button pill specification', () => {
      const activeMedia = createTestMedia({ id: 'cover-1' });

      const { rerender } = render(
        <PostHeroPreview
          values={{ ...createDefaultsV2('post'), media: [activeMedia] }}
          user={testUser}
          activePhotoIndex={0}
          activeCategory={null}
          onSelectCategory={vi.fn()}
          onTriggerFileInput={vi.fn()}
          fileInputRef={{ current: null }}
          onFilesSelected={vi.fn()}
        />,
      );

      expect(screen.getByTestId('post-hero-preview')).toBeTruthy();
      expect(screen.getByTestId('post-preview-active-image')).toBeTruthy();
      expect(screen.getByTestId('photo-editor-pill')).toBeTruthy();
      expect(screen.getByText('Camille Rando')).toBeTruthy();

      rerender(
        <PostHeroPreview
          values={{ ...createDefaultsV2('post'), media: [] }}
          user={testUser}
          activePhotoIndex={0}
          activeCategory={null}
          onSelectCategory={vi.fn()}
          onTriggerFileInput={vi.fn()}
          fileInputRef={{ current: null }}
          onFilesSelected={vi.fn()}
        />,
      );

      expect(screen.queryByTestId('photo-editor-pill')).toBeNull();
      expect(screen.getByText('Ajoute ta photo')).toBeTruthy();
      expect(screen.getByText(/Touche ici pour sélectionner/i)).toBeTruthy();
    });

    it('F1.4: 3-Category photo editor icons (Sun, Palette, SlidersHorizontal)', () => {
      const onSelectCategory = vi.fn();

      render(
        <PhotoEditorPill
          activeCategory="light"
          onSelectCategory={onSelectCategory}
        />,
      );

      const btnLight = screen.getByTestId('editor-cat-light');
      const btnColor = screen.getByTestId('editor-cat-color');
      const btnDetail = screen.getByTestId('editor-cat-detail');

      expect(btnLight.getAttribute('aria-label')).toBe('Lumière');
      expect(btnColor.getAttribute('aria-label')).toBe('Couleur');
      expect(btnDetail.getAttribute('aria-label')).toBe('Détails & Géométrie');

      expect(btnLight.getAttribute('aria-pressed')).toBe('true');
      expect(btnLight.className).toContain('is-active');
      expect(btnColor.getAttribute('aria-pressed')).toBe('false');

      fireEvent.click(btnColor);
      expect(onSelectCategory).toHaveBeenCalledWith('color');
    });

    it('F1.5: 15 Modifiers non-scrollable bottom card with real-time CSS transforms and no preset filters', () => {
      expect(PHOTO_EDITOR_CATEGORIES).toHaveLength(3);
      expect(PHOTO_EDITOR_CATEGORIES.every((c) => c.modifiers.length === 5)).toBe(true);
      expect(Object.keys(DEFAULT_PHOTO_MODIFIERS)).toHaveLength(15);

      const onChangeModifier = vi.fn();
      const onClose = vi.fn();
      const onReset = vi.fn();

      const { rerender } = render(
        <PhotoEditorCard
          category="light"
          modifiers={DEFAULT_PHOTO_MODIFIERS}
          onChangeModifier={onChangeModifier}
          onClose={onClose}
          onResetCategory={onReset}
        />,
      );

      expect(screen.getByTestId('photo-editor-card-light')).toBeTruthy();
      expect(screen.getByTestId('slider-brightness')).toBeTruthy();
      expect(screen.getByTestId('slider-contrast')).toBeTruthy();
      expect(screen.getByTestId('slider-exposure')).toBeTruthy();
      expect(screen.getByTestId('slider-shadows')).toBeTruthy();
      expect(screen.getByTestId('slider-warmth')).toBeTruthy();

      fireEvent.change(screen.getByTestId('slider-brightness'), { target: { value: '125' } });
      expect(onChangeModifier).toHaveBeenCalledWith('brightness', 125);

      fireEvent.click(screen.getByTestId('editor-reset-btn'));
      expect(onReset).toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('editor-close-btn'));
      expect(onClose).toHaveBeenCalled();

      rerender(
        <PhotoEditorCard
          category="detail"
          modifiers={DEFAULT_PHOTO_MODIFIERS}
          onChangeModifier={onChangeModifier}
          onClose={onClose}
          onResetCategory={onReset}
        />,
      );
      expect(screen.getByTestId('toggle-flipX')).toBeTruthy();

      const adjusted: PhotoModifiersV2 = {
        ...DEFAULT_PHOTO_MODIFIERS,
        brightness: 120,
        contrast: 110,
        saturation: 130,
        rotation: 10,
        flipX: true,
      };
      const renderedCss = computePhotoFilterAndTransform(adjusted);
      expect(renderedCss.filter).toContain('brightness(120%)');
      expect(renderedCss.filter).toContain('contrast(110%)');
      expect(renderedCss.filter).toContain('saturate(130%)');
      expect(renderedCss.transform).toContain('scaleX(-1)');
      expect(renderedCss.transform).toContain('rotate(10deg)');

      const vignetteStyle = computeVignetteOverlayStyle(50);
      expect(vignetteStyle).not.toBeNull();
      expect(vignetteStyle?.background).toContain('radial-gradient');
    });

    it('F1.6: Post flow steps and publication toggles integration', () => {
      expect(POST_STEPS).toHaveLength(2);
      expect(POST_STEPS.map((s) => s.id)).toEqual(['format', 'contenu']);
      expect(POST_STEPS.map((s) => s.id)).not.toContain('recap');
      expect(POST_STEPS.map((s) => s.id)).not.toContain('diffusion');

      const postValues: PostFormValuesV2 = {
        ...createDefaultsV2('post'),
        format: 'photo',
        content: 'Bivouac au coucher du soleil',
        media: [createTestMedia()],
        allowComments: true,
        allowLikes: false,
        scheduleEnabled: false,
      };

      const payload = buildPostPayload(postValues);
      expect(payload.content).toBe('Bivouac au coucher du soleil');
      const meta = payload.creation_meta as { allow_comments: boolean; allow_likes: boolean };
      expect(meta.allow_comments).toBe(true);
      expect(meta.allow_likes).toBe(false);
    });
  });

  describe('R2: Carnet Creation Flow & Moments Timeline', () => {
    it('F2.1: Map autofocus on previous position using start coordinates or trace origin', () => {
      render(
        <CarnetHarness defaultValues={{ startLat: 45.923, startLng: 6.869 }}>
          <TracePaneV2 user={{ id: 'test-user-1' }} />
        </CarnetHarness>,
      );

      expect(screen.getByLabelText('Carte du tracé du carnet')).toBeTruthy();
      expect(mapCenterTracker.center).toEqual([6.869, 45.923]);

      const carnet: CarnetFormValuesV2 = {
        ...createDefaultsV2('carnet'),
        title: 'Traversée du Beaufortain',
        destination: 'Beaufortain',
        trace: [
          [6.726, 45.823],
          [6.735, 45.832],
        ],
      };
      const payload = buildCarnetPayload(carnet, { hasCarnetNights: false });
      expect(payload.start_lng).toBe(6.726);
      expect(payload.start_lat).toBe(45.823);
      expect((payload.map_points as { trace: [number, number][] }).trace).toHaveLength(2);
    });

    it('F2.2: TracePane clean-up contract — removed buttons and points list', () => {
      render(
        <CarnetHarness defaultValues={{ trace: [] }}>
          <TracePaneV2 user={{ id: 'test-user-1' }} />
        </CarnetHarness>,
      );

      expect(screen.queryByRole('button', { name: /enregistrer une sortie/i })).toBeNull();
      expect(document.querySelector('.lkdv-cv2c-point-list')).toBeNull();
    });

    it('F2.3: Outing search integration querying participated outings in hike_sessions_participant', async () => {
      render(
        <CarnetHarness>
          <TracePaneV2 user={{ id: 'user-hiker-42' }} />
        </CarnetHarness>,
      );

      const outingBtn = screen.getByRole('button', { name: /rechercher une sortie/i });
      fireEvent.click(outingBtn);

      await waitFor(() => {
        expect(
          supabaseTracker.fromCalls.some((c) => c.table === 'hike_sessions_participant'),
        ).toBe(true);
      });
    });

    it('F2.4: Moments empty state displays dashed card outline with centered dashed "+"', async () => {
      render(
        <CarnetHarness
          defaultValues={{
            days: [{ id: 'd1', dayNumber: 1, title: '', date: '', night: null, moments: [] }],
          }}
        >
          <DaysPaneV2 user={{ id: 'test-user-1' }} />
        </CarnetHarness>,
      );

      expect(screen.getByTestId('cv2c-day-panel')).toBeTruthy();

      const addBtn = screen.getByRole('button', { name: /ajouter un premier moment/i });
      expect(addBtn).toBeTruthy();
      expect(addBtn.className).toContain('lkdv-cv2c-moment-empty');

      fireEvent.click(addBtn);
      await waitFor(() => {
        expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('F2.5: Right-side square media slot supporting up to 5 photos/videos per moment', () => {
      const momentPhoto = createTestMedia({ id: 'cover-media', url: 'https://example.test/moment.jpg' });
      const carnetWithMoment = {
        ...createDefaultsV2('carnet'),
        title: 'Tour du Queyras',
        destination: 'Queyras',
        trace: [
          [6.7, 44.7],
          [6.8, 44.8],
        ] as [number, number][],
        days: [
          {
            id: 'd1',
            dayNumber: 1,
            title: 'Jour 1',
            date: '2026-08-01',
            night: null,
            moments: [
              {
                id: 'm1',
                kind: 'photo' as const,
                time: '10:00',
                text: 'Pause au col',
                place: 'Col Agnel',
                photo: momentPhoto,
                media: [momentPhoto],
                encounters: [],
              },
            ],
          },
        ],
        coverMediaId: 'cover-media',
      };

      const parsed = carnetSchemaV2.safeParse(carnetWithMoment);
      expect(parsed.success).toBe(true);

      const coverItem = carnetCover(carnetWithMoment);
      expect(coverItem?.id).toBe('cover-media');
      expect(coverItem?.url).toBe('https://example.test/moment.jpg');
    });

    it('F2.6: Moment details & encounter pills (horizontal scroll, dashed "+", no addition limit)', () => {
      render(
        <CarnetHarness
          defaultValues={{
            days: [
              {
                id: 'd1',
                dayNumber: 1,
                title: 'Jour 1',
                date: '2026-08-01',
                night: null,
                moments: [
                  {
                    id: 'm1',
                    kind: 'photo',
                    title: 'Sommet',
                    time: '12:00',
                    text: 'Sommet atteint',
                    place: 'Aiguille',
                    photo: null,
                    media: [],
                    encounters: ['@leo', '@chloe'],
                  },
                ],
              },
            ],
          }}
        >
          <DaysPaneV2 user={{ id: 'test-user-1' }} />
        </CarnetHarness>,
      );

      const placeInput = screen.getByLabelText('Lieu du moment') as HTMLInputElement;
      fireEvent.change(placeInput, { target: { value: 'Lac Cornu' } });
      expect(placeInput.value).toBe('Lac Cornu');

      const textInput = screen.getByLabelText('Commentaire du moment') as HTMLTextAreaElement;
      fireEvent.change(textInput, { target: { value: 'Rencontre avec des bouquetins au sommet' } });
      expect(textInput.value).toBe('Rencontre avec des bouquetins au sommet');

      expect(screen.getByText('@leo')).toBeTruthy();
      expect(screen.getByText('@chloe')).toBeTruthy();
      expect(screen.getByRole('button', { name: /ajouter une rencontre/i })).toBeTruthy();
    });

    it('F2.7: Sequential addition up to 100 moments per day limit and header removal', () => {
      render(
        <CarnetHarness
          defaultValues={{
            days: [{ id: 'd1', dayNumber: 1, title: '', date: '', night: null, moments: [] }],
          }}
        >
          <DaysPaneV2 user={{ id: 'test-user-1' }} />
        </CarnetHarness>,
      );

      expect(screen.queryByLabelText(/titre du jour/i)).toBeNull();
      expect(screen.queryByLabelText(/^date$/i)).toBeNull();

      const addFirstBtn = screen.getByRole('button', { name: /ajouter un premier moment/i });
      fireEvent.click(addFirstBtn);

      const addMoreBtn = screen.getByRole('button', { name: /ajouter un moment/i });
      fireEvent.click(addMoreBtn);
      expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(2);

      const validCarnet = {
        ...createDefaultsV2('carnet'),
        title: 'Grande Traversée',
        destination: 'Alpes',
        trace: [
          [6.5, 45.0],
          [6.6, 45.1],
        ] as [number, number][],
        days: [
          {
            id: 'd1',
            dayNumber: 1,
            title: 'Jour 1',
            date: '2026-07-01',
            night: null,
            moments: [
              { id: 'm1', kind: 'photo' as const, time: '09:00', text: 'Départ', place: 'Refuge', photo: null, media: [], encounters: [] },
              { id: 'm2', kind: 'photo' as const, time: '14:00', text: 'Arrivée', place: 'Vallée', photo: null, media: [], encounters: [] },
            ],
          },
        ],
      };
      expect(carnetSchemaV2.safeParse(validCarnet).success).toBe(true);
    });

    it('F2.8: Final step settings overhaul (visibility, collaborative, postEnabled, tags, cover)', () => {
      const carnetValues: CarnetFormValuesV2 = {
        ...createDefaultsV2('carnet'),
        title: 'Traversée du Queyras',
        destination: 'Queyras',
        visibility: 'public',
        postEnabled: true,
        postContent: 'Carnet de trek en autonomie 4 jours.',
        tags: ['queyras', 'bivouac', 'alpes'],
        trace: [
          [6.7, 44.7],
          [6.8, 44.8],
        ],
        days: [
          {
            id: 'd1',
            dayNumber: 1,
            title: 'Jour 1',
            date: '2026-08-10',
            night: null,
            moments: [
              {
                id: 'm1',
                kind: 'photo',
                time: '09:00',
                text: 'Départ sous le soleil',
                place: 'Ceillac',
                photo: createTestMedia({ id: 'cover-media', url: 'https://example.test/queyras.jpg' }),
                media: [],
                encounters: [],
              },
            ],
          },
        ],
        coverMediaId: 'cover-media',
      };

      const payload = buildCarnetPayload(carnetValues, { hasCarnetNights: false });
      expect(payload.visibility).toBe('public');
      expect(payload.cover_image).toBe('https://example.test/queyras.jpg');
      expect(payload.tags).toEqual(['queyras', 'bivouac', 'alpes']);
      expect(payload.moments).toHaveLength(1);
      const postConfig = payload.post as { enabled: boolean; content: string };
      expect(postConfig.enabled).toBe(true);
      expect(postConfig.content).toBe('Carnet de trek en autonomie 4 jours.');
    });
  });

  describe('R3: Kit Creation Flow & Product Sheet Overhaul', () => {
    it('F3.1: Product sheet clean white background (#ffffff) and modern UX improvements', () => {
      const sampleInventory: InventoryItemV2[] = [
        {
          ownershipId: 'own-1',
          productId: 'prod-1',
          name: 'Tente Dôme Ultralight',
          category: 'Abri',
          weightG: 1250,
        },
      ];

      const onAdd = vi.fn();
      const onClose = vi.fn();

      render(
        <KitCatalogDrawerV2
          open={true}
          inventory={sampleInventory}
          addedKeys={new Set()}
          onClose={onClose}
          onAddProduct={onAdd}
        />,
      );

      expect(screen.getByRole('dialog', { name: /Catalogue de matériel/i })).toBeTruthy();

      const infoBtn = screen.getByRole('button', { name: /Informations sur Tente Dôme Ultralight/i });
      fireEvent.click(infoBtn);

      const sheetDialog = screen.getByRole('dialog', { name: /Détails : Tente Dôme Ultralight/i });
      expect(sheetDialog).toBeTruthy();
      expect(sheetDialog.className).toContain('is-level2');
      expect(within(sheetDialog).getByText('Fiche produit')).toBeTruthy();
      expect(within(sheetDialog).getByText('Tente Dôme Ultralight')).toBeTruthy();

      const addBtn = within(sheetDialog).getByRole('button', { name: /Ajouter au kit/i });
      fireEvent.click(addBtn);
      expect(onAdd).toHaveBeenCalled();
    });

    it('F3.2: Constrained drawer widths (max-width: 440px) matching Apple HIG sheet shell', () => {
      render(
        <KitCatalogDrawerV2
          open={true}
          inventory={[]}
          addedKeys={new Set()}
          onClose={vi.fn()}
          onAddProduct={vi.fn()}
        />,
      );

      const drawer = screen.getByRole('dialog', { name: /Catalogue de matériel/i });
      expect(drawer.className).toContain('lkdv-cv2c-stack-overlay');

      const cssPath = path.resolve(__dirname, '../create-v2.css');
      const cssContent = fs.readFileSync(cssPath, 'utf-8');
      expect(cssContent).toContain('.lkdv-cv2c-stack-overlay');
      expect(cssContent).toContain('margin: 0 auto;');
    });

    it('F3.3: Preparation mode removal contract from kit creation workflow', () => {
      const kitDefaults = createDefaultsV2('kit');
      expect(kitDefaults).toHaveProperty('items');
      expect(kitDefaults.items).toEqual([]);

      const validKitValues: KitFormValuesV2 = {
        ...kitDefaults,
        name: 'Pack Bivouac Léger',
        isPublic: true,
        items: [
          {
            id: 'item-1',
            name: 'Tente Dôme 2P',
            category: 'Abri',
            weightG: 1250,
            quantity: 1,
            productId: null,
            ownershipId: null,
            isChecked: false,
          },
        ],
      };

      const parsed = kitSchemaV2.safeParse(validKitValues);
      expect(parsed.success).toBe(true);

      const payload = buildKitPayload(validKitValues);
      expect(payload.name).toBe('Pack Bivouac Léger');
      expect(payload.is_public).toBe(true);
      expect(payload.items).toHaveLength(1);
    });

    it('F3.4: Rectangular share preview block (16:9) with topo curves, gear mosaic, and weight metrics', () => {
      const items: KitItemV2[] = [
        { id: '1', name: 'Tente', category: 'Abri', weightG: 1200, quantity: 1, productId: null, ownershipId: null, isChecked: false },
        { id: '2', name: 'Duvet', category: 'Couchage', weightG: 800, quantity: 1, productId: null, ownershipId: null, isChecked: false },
        { id: '3', name: 'Réchaud', category: 'Cuisine', weightG: 120, quantity: 1, productId: null, ownershipId: null, isChecked: false },
        { id: '4', name: 'Doudoune', category: 'Vêtements', weightG: 350, quantity: 1, productId: null, ownershipId: null, isChecked: false },
      ];

      const totalWeight = kitItemsWeightV2(items);
      expect(totalWeight).toBe(2470);

      const goal = kitGoalOfWeightV2(totalWeight);
      expect(goal).toBe('ultra');

      const formatted = formatKitWeightV2(totalWeight, 'metric');
      expect(formatted).toBe('2,5 kg');

      const layers = kitLayersV2(items);
      expect(layers.sac).toBeGreaterThan(0);

      const payload = buildKitPayload({
        ...createDefaultsV2('kit'),
        name: 'Pack Bivouac 2.5kg',
        isPublic: true,
        items,
      });
      expect(payload.share_content).toContain('Pack Bivouac 2.5kg');
      expect(payload.share_content).toContain('4 objets');
    });
  });
});

/* ========================================================================= */
/* TIER 2: BOUNDARY & CORNER CASES                                           */
/* ========================================================================= */
describe('Tier 2: Boundary & Corner Cases', () => {
  describe('Post Boundary Limits', () => {
    it('Media count limits: exactly 15 photos accepted, 16 photos rejected', () => {
      const baseValues: PostFormValuesV2 = {
        ...createDefaultsV2('post'),
        format: 'photo',
        content: 'Test limite photos',
      };

      const media15 = Array.from({ length: 15 }, (_, i) => createTestMedia({ id: `p-${i + 1}` }));
      const result15 = postSchemaV2.safeParse({ ...baseValues, media: media15 });
      expect(result15.success).toBe(true);

      const media16 = Array.from({ length: 16 }, (_, i) => createTestMedia({ id: `p-${i + 1}` }));
      const result16 = postSchemaV2.safeParse({ ...baseValues, media: media16 });
      expect(result16.success).toBe(false);
      if (!result16.success) {
        expect(result16.error.issues[0].message).toContain('15');
      }
    });

    it('0 photos boundary: required for format "photo", optional for format "question"', () => {
      const photoWith0 = {
        ...createDefaultsV2('post'),
        format: 'photo' as const,
        content: 'Sans photo',
        media: [],
      };
      expect(postSchemaV2.safeParse(photoWith0).success).toBe(false);

      const questionWith0 = {
        ...createDefaultsV2('post'),
        format: 'question' as const,
        title: 'Où bivouaquer ?',
        content: 'Je cherche un spot près du lac.',
        media: [],
      };
      expect(postSchemaV2.safeParse(questionWith0).success).toBe(true);
    });

    it('Modifier value clamping bounds: extreme out-of-range inputs safely bounded', () => {
      const extremeModifiers: Partial<PhotoModifiersV2> = {
        brightness: 9999,
        contrast: -500,
        exposure: 200,
        shadows: -100,
        warmth: 100,
        saturation: 500,
        hue: -720,
        temperature: 150,
        fade: -20,
        vibrance: -80,
        rotation: 90,
        vignette: 150,
        blur: 50,
        zoom: 300,
        flipX: false,
      };

      const result = computePhotoFilterAndTransform(extremeModifiers);
      expect(result.filter).toContain('brightness(');
      expect(result.filter).toContain('contrast(');
      expect(result.filter).toContain('saturate(');
      expect(result.transform).toContain('scale(');
      expect(result.transform).toContain('rotate(90deg)');
    });
  });

  describe('Carnet Boundary Limits', () => {
    it('5 media per moment limit: exactly 5 accepted, 6 rejected by contract', () => {
      const baseCarnet = {
        ...createDefaultsV2('carnet'),
        title: 'Trace Alpine',
        destination: 'Alpes',
        trace: [
          [6.5, 45.0],
          [6.6, 45.1],
        ] as [number, number][],
      };

      const media5 = Array.from({ length: 5 }, (_, i) => createTestMedia({ id: `med-${i + 1}` }));
      const dayWith5Media = {
        id: 'd1',
        dayNumber: 1,
        title: 'Jour 1',
        date: '2026-07-01',
        night: null,
        moments: [
          {
            id: 'm1',
            kind: 'photo' as const,
            time: '12:00',
            text: 'Moment avec 5 médias',
            place: 'Col',
            photo: media5[0],
            media: media5,
            encounters: [],
          },
        ],
      };

      expect(carnetSchemaV2.safeParse({ ...baseCarnet, days: [dayWith5Media] }).success).toBe(true);

      const media6 = Array.from({ length: 6 }, (_, i) => createTestMedia({ id: `med-${i + 1}` }));
      const dayWith6Media = {
        ...dayWith5Media,
        moments: [
          {
            ...dayWith5Media.moments[0],
            media: media6,
          },
        ],
      };
      expect(carnetSchemaV2.safeParse({ ...baseCarnet, days: [dayWith6Media] }).success).toBe(false);
    });

    it('100 moments per day limit: boundary at 100 moments, 101 rejected by schema', () => {
      const baseCarnet = {
        ...createDefaultsV2('carnet'),
        title: 'Grand Tour',
        destination: 'Alpes',
        trace: [
          [6.5, 45.0],
          [6.6, 45.1],
        ] as [number, number][],
      };

      const moments100 = Array.from({ length: 100 }, (_, i) => ({
        id: `m-${i + 1}`,
        kind: 'photo' as const,
        time: '12:00',
        text: `Moment ${i + 1}`,
        place: 'Sentier',
        photo: null,
        media: [],
        encounters: [],
      }));

      const day100 = {
        ...baseCarnet,
        days: [{ id: 'd1', dayNumber: 1, title: 'Jour 1', date: '2026-07-01', night: null, moments: moments100 }],
      };
      expect(carnetSchemaV2.safeParse(day100).success).toBe(true);

      const day101 = {
        ...baseCarnet,
        days: [
          {
            id: 'd1',
            dayNumber: 1,
            title: 'Jour 1',
            date: '2026-07-01',
            night: null,
            moments: [
              ...moments100,
              { id: 'm-101', kind: 'photo' as const, time: '12:00', text: 'Trop', place: '', photo: null, media: [], encounters: [] },
            ],
          },
        ],
      };
      expect(carnetSchemaV2.safeParse(day101).success).toBe(false);
    });

    it('Trace GPS autofocus boundary: 0 points, 1 point, and multi-point coordinates', () => {
      const carnetEmpty: CarnetFormValuesV2 = {
        ...createDefaultsV2('carnet'),
        title: 'Sans trace',
        destination: 'Zone',
        trace: [],
      };
      const pEmpty = buildCarnetPayload(carnetEmpty, { hasCarnetNights: false });
      expect(pEmpty.start_lat).toBeNull();
      expect(pEmpty.start_lng).toBeNull();

      const carnetOne: CarnetFormValuesV2 = {
        ...createDefaultsV2('carnet'),
        title: 'Trace unitaire',
        destination: 'Zone',
        trace: [[6.123, 45.456]],
      };
      const pOne = buildCarnetPayload(carnetOne, { hasCarnetNights: false });
      expect(pOne.start_lng).toBe(6.123);
      expect(pOne.start_lat).toBe(45.456);

      const carnetMulti: CarnetFormValuesV2 = {
        ...createDefaultsV2('carnet'),
        title: 'Trace multiple',
        destination: 'Zone',
        trace: [
          [6.5, 45.2],
          [6.6, 45.3],
          [6.7, 45.4],
        ],
      };
      const pMulti = buildCarnetPayload(carnetMulti, { hasCarnetNights: false });
      expect(pMulti.start_lng).toBe(6.5);
      expect(pMulti.start_lat).toBe(45.2);
    });
  });

  describe('Kit Boundary Limits', () => {
    it('Drawer 440px constraint across various screen widths', () => {
      const { unmount } = render(
        <KitCatalogDrawerV2
          open={true}
          inventory={[]}
          addedKeys={new Set()}
          onClose={vi.fn()}
          onAddProduct={vi.fn()}
        />,
      );
      const catalogDrawer = screen.getByRole('dialog', { name: /Catalogue de matériel/i });
      expect(catalogDrawer.className).toContain('lkdv-cv2c-stack-overlay');
      unmount();

      render(
        <KitFavoritesDrawerV2
          open={true}
          userId="user-test"
          onClose={vi.fn()}
          onImport={vi.fn()}
        />,
      );
      const favDrawer = screen.getByRole('dialog', { name: /Nos favoris/i });
      expect(favDrawer.className).toContain('lkdv-cv2c-stack-overlay');
    });

    it('Kit weight boundaries: 0g, negative sanitized, ultra-light vs light thresholds', () => {
      const zeroItems: KitItemV2[] = [
        { id: '1', name: 'Carte IGN', category: 'Orientation', weightG: 0, quantity: 1, productId: null, ownershipId: null, isChecked: false },
      ];
      expect(kitItemsWeightV2(zeroItems)).toBe(0);
      expect(kitGoalOfWeightV2(0)).toBe('ultra');

      expect(kitGoalOfWeightV2(4499)).toBe('ultra');
      expect(kitGoalOfWeightV2(4500)).toBe('ultra');
      expect(kitGoalOfWeightV2(4501)).toBe('light');

      expect(kitGoalOfWeightV2(7499)).toBe('light');
      expect(kitGoalOfWeightV2(7500)).toBe('light');
      expect(kitGoalOfWeightV2(7501)).toBe('std');

      expect(kitGoalOfWeightV2(11000)).toBe('std');

      const multiplierItems: KitItemV2[] = [
        { id: '1', name: 'Mousqueton', category: 'Matériel', weightG: 350, quantity: 3, productId: null, ownershipId: null, isChecked: false },
      ];
      expect(kitItemsWeightV2(multiplierItems)).toBe(1050);
    });
  });
});

/* ========================================================================= */
/* TIER 3: CROSS-FEATURE COMBINATIONS (PAIRWISE)                             */
/* ========================================================================= */
describe('Tier 3: Cross-Feature Combinations', () => {
  it('Pairwise 1: Photo modifiers applied independently to specific carousel thumbnail', () => {
    const photo1 = createTestMedia({ id: 'photo-1', modifiers: DEFAULT_PHOTO_MODIFIERS });
    const photo2Modifiers: PhotoModifiersV2 = {
      ...DEFAULT_PHOTO_MODIFIERS,
      saturation: 160,
      rotation: -15,
      zoom: 120,
    };
    const photo2 = createTestMedia({ id: 'photo-2', modifiers: photo2Modifiers });
    const photo3 = createTestMedia({ id: 'photo-3', modifiers: DEFAULT_PHOTO_MODIFIERS });

    const css1 = computePhotoFilterAndTransform(photo1.modifiers);
    const css2 = computePhotoFilterAndTransform(photo2.modifiers);
    const css3 = computePhotoFilterAndTransform(photo3.modifiers);

    expect(css1.filter).toContain('saturate(100%)');
    expect(css2.filter).toContain('saturate(160%)');
    expect(css2.transform).toContain('rotate(-15deg)');
    expect(css3.filter).toContain('saturate(100%)');
  });

  it('Pairwise 2: Multi-photo carousel + Audience picker privacy warning toggle', () => {
    const postValues: PostFormValuesV2 = {
      ...createDefaultsV2('post'),
      format: 'photo',
      audience: 'abonnies',
      media: [createTestMedia({ id: 'p1' }), createTestMedia({ id: 'p2' })],
    };

    const parsedPrivate = postSchemaV2.safeParse(postValues);
    expect(parsedPrivate.success).toBe(false);

    const publicPost = { ...postValues, audience: 'public' as const };
    expect(postSchemaV2.safeParse(publicPost).success).toBe(true);
  });

  it('Pairwise 3: Carnet Moments + Friend Encounter Pills + Multi-Media Right Slot', () => {
    const momentMedia = createTestMedia({ id: 'media-photo', type: 'image/jpeg' });

    const carnetValues: CarnetFormValuesV2 = {
      ...createDefaultsV2('carnet'),
      title: 'Rando Lac Cornu',
      destination: 'Chamonix',
      trace: [
        [6.8, 45.9],
        [6.9, 46.0],
      ],
      days: [
        {
          id: 'day-1',
          dayNumber: 1,
          title: 'Jour 1',
          date: '2026-07-20',
          night: null,
          moments: [
            {
              id: 'm-complex',
              kind: 'photo',
              time: '14:30',
              text: 'Pause déjeuner au lac',
              place: 'Lac Cornu',
              photo: momentMedia,
              media: [momentMedia],
              encounters: ['@antoine', '@sophie'],
            },
          ],
        },
      ],
    };

    expect(carnetSchemaV2.safeParse(carnetValues).success).toBe(true);
    const payload = buildCarnetPayload(carnetValues, { hasCarnetNights: false });
    expect(payload.moments).toHaveLength(1);
    const m = (payload.moments as Array<{ citation: string; lieu: string; image_url: string }>)[0];
    expect(m.citation).toBe('Pause déjeuner au lac');
    expect(m.lieu).toBe('Lac Cornu');
    expect(m.image_url).toBe(momentMedia.url);
  });

  it('Pairwise 4: Destination coordinates + Trace GPX + Sequential Moments build complete Carnet RPC payload', () => {
    const carnet: CarnetFormValuesV2 = {
      ...createDefaultsV2('carnet'),
      title: 'Tour des Dômes de Miage',
      destination: 'Les Contamines-Montjoie',
      startLat: 45.823,
      startLng: 6.726,
      trace: [
        [6.726, 45.823],
        [6.735, 45.832],
        [6.745, 45.841],
      ],
      distanceKm: 18.5,
      deniveleM: 1400,
      days: [
        {
          id: 'day-1',
          dayNumber: 1,
          title: 'Montée au refuge',
          date: '2026-07-20',
          night: null,
          moments: [
            {
              id: 'm1',
              kind: 'photo',
              time: '08:00',
              text: 'Départ du Cugnon',
              place: 'Le Cugnon',
              photo: createTestMedia({ id: 'cugnon-photo' }),
              media: [],
              encounters: [],
            },
            {
              id: 'm2',
              kind: 'photo',
              time: '12:30',
              text: 'Pause au Chalet de Tré-la-Tête',
              place: 'Tré-la-Tête',
              photo: createTestMedia({ id: 'tre-photo' }),
              media: [],
              encounters: [],
            },
          ],
        },
      ],
      visibility: 'public',
      postEnabled: true,
      postContent: 'Retour sur une magnifique course!',
    };

    const payload = buildCarnetPayload(carnet, { hasCarnetNights: false });
    expect(payload.title).toBe('Tour des Dômes de Miage');
    expect(payload.destination).toBe('Les Contamines-Montjoie');
    expect(payload.moments).toHaveLength(2);
    const mapPoints = payload.map_points as { trace: [number, number][] };
    expect(mapPoints.trace).toHaveLength(3);
    expect(payload.start_lat).toBe(45.823);
    expect(payload.start_lng).toBe(6.726);
  });

  it('Pairwise 5: Kit Quantity Stepper + Weight Delta + Category Reassignment', () => {
    const initialItems: KitItemV2[] = [
      { id: '1', name: 'Matelas gonflable', category: 'Couchage', weightG: 450, quantity: 1, productId: null, ownershipId: null, isChecked: false },
    ];
    const initialWeight = kitItemsWeightV2(initialItems);
    expect(initialWeight).toBe(450);

    const updatedItems: KitItemV2[] = [
      { id: '1', name: 'Matelas gonflable', category: 'Divers', weightG: 450, quantity: 2, productId: null, ownershipId: null, isChecked: false },
    ];
    const updatedWeight = kitItemsWeightV2(updatedItems);
    const weightDelta = updatedWeight - initialWeight;

    expect(weightDelta).toBe(+450);
    expect(updatedWeight).toBe(900);

    const layers = kitLayersV2(updatedItems);
    expect(layers.sac).toBe(900);
  });

  it('Pairwise 6: Kit Rectangular Preview + Season Pill + Weight Gauge Metrics', () => {
    const kitItems: KitItemV2[] = [
      { id: '1', name: 'Tente 4 saisons', category: 'Abri', weightG: 2400, quantity: 1, productId: null, ownershipId: null, isChecked: false },
      { id: '2', name: 'Duvet -15°C', category: 'Couchage', weightG: 1600, quantity: 1, productId: null, ownershipId: null, isChecked: false },
      { id: '3', name: 'Raquettes à neige', category: 'Portage', weightG: 1800, quantity: 1, productId: null, ownershipId: null, isChecked: false },
    ];

    const totalWeight = kitItemsWeightV2(kitItems);
    expect(totalWeight).toBe(5800);

    const goal = kitGoalOfWeightV2(totalWeight);
    expect(goal).toBe('light');

    const formattedWeight = formatKitWeightV2(totalWeight, 'metric');
    expect(formattedWeight).toBe('5,8 kg');

    const payload = buildKitPayload({
      ...createDefaultsV2('kit'),
      name: 'Kit Hivernal Vanoise',
      season: 'hiver',
      isPublic: true,
      items: kitItems,
    });

    expect(payload.name).toBe('Kit Hivernal Vanoise');
    expect(payload.season).toBe('hiver');
    expect(payload.share_content).toContain('Kit Hivernal Vanoise');
    expect(payload.share_content).toContain('3 objets');
  });
});

/* ========================================================================= */
/* TIER 4: REAL-WORLD APPLICATION SCENARIOS                                  */
/* ========================================================================= */
describe('Tier 4: Real-World Application Scenarios', () => {
  it('Scenario 1: Complete End-User Post Journey — Alpine Sunset Photoshoot', async () => {
    renderCreationSheet('post');
    await waitFor(() => expect(screen.getByTestId('post-file-input')).toBeTruthy());

    const fileInput = screen.getByTestId('post-file-input') as HTMLInputElement;
    const testFile = new File(['sunset'], 'sunset-1.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(screen.getByTestId('post-preview-active-image')).toBeTruthy();
      expect(screen.getByTestId('photo-editor-pill')).toBeTruthy();
    });

    const nextBtn = screen.getByRole('button', { name: 'Suivant' });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByTestId('photo-thumbnail-strip')).toBeTruthy();
    });

    const btnLight = screen.getByTestId('editor-cat-light');
    fireEvent.click(btnLight);
    await waitFor(() => expect(screen.getByTestId('photo-editor-card-light')).toBeTruthy());

    const sliderBrightness = screen.getByTestId('slider-brightness');
    fireEvent.change(sliderBrightness, { target: { value: '115' } });

    const postValues: PostFormValuesV2 = {
      ...createDefaultsV2('post'),
      format: 'photo',
      audience: 'public',
      media: [
        createTestMedia({ id: 'photo-1', url: 'https://example.test/sunset-1.jpg' }),
        createTestMedia({ id: 'photo-2', url: 'https://example.test/sunset-2.jpg' }),
        createTestMedia({ id: 'photo-3', url: 'https://example.test/sunset-3.jpg' }),
      ],
      content: 'Coucher de soleil inoubliable au bivouac après 6h de marche. #alpes #bivouac',
      location: 'Refuge du Promontoire, La Bérarde',
      locationLat: 44.978,
      locationLng: 6.345,
      allowComments: true,
      allowLikes: true,
      scheduleEnabled: false,
    };

    expect(postSchemaV2.safeParse(postValues).success).toBe(true);

    const rpcPayload = buildPostPayload(postValues);
    expect(rpcPayload.content).toContain('Coucher de soleil inoubliable');
    expect(rpcPayload.image_url).toBe('https://example.test/sunset-1.jpg');
    expect(rpcPayload.media_urls).toHaveLength(3);
    expect(rpcPayload.place_label).toBe('Refuge du Promontoire, La Bérarde');
    expect(rpcPayload.place_lat).toBe(44.978);
    expect(rpcPayload.place_lng).toBe(6.345);
    expect((rpcPayload.creation_meta as { allow_comments: boolean }).allow_comments).toBe(true);
  });

  it('Scenario 2: Complete End-User Carnet Journey — 3-Day Vanoise Traverse', async () => {
    const destination = 'Vanoise - Pralognan';
    const startCoords = { lat: 45.381, lng: 6.721 };
    const gpxTrace: [number, number][] = [
      [6.721, 45.381],
      [6.732, 45.392],
      [6.745, 45.405],
      [6.761, 45.418],
    ];

    const carnetValues: CarnetFormValuesV2 = {
      ...createDefaultsV2('carnet'),
      title: 'Haute Route de la Vanoise',
      destination,
      startLat: startCoords.lat,
      startLng: startCoords.lng,
      startDate: '2026-07-15',
      endDate: '2026-07-18',
      nbJours: 2,
      nbVoyageurs: 2,
      trace: gpxTrace,
      distanceKm: 42.5,
      deniveleM: 2850,
      days: [
        {
          id: 'day-1',
          dayNumber: 1,
          title: 'Montée au Refuge Félix Faure',
          date: '2026-07-15',
          night: null,
          moments: [
            {
              id: 'm-1-1',
              kind: 'photo',
              time: '08:30',
              text: 'Départ sous les mélèzes',
              place: 'Pralognan',
              photo: createTestMedia({ id: 'p-1-1', url: 'https://example.test/depart.jpg' }),
              media: [],
              encounters: [],
            },
            {
              id: 'm-1-2',
              kind: 'photo',
              time: '12:45',
              text: 'Passage du Col de la Vanoise',
              place: 'Col de la Vanoise',
              photo: createTestMedia({ id: 'p-1-2', url: 'https://example.test/col.jpg' }),
              media: [],
              encounters: [],
            },
          ],
        },
        {
          id: 'day-2',
          dayNumber: 2,
          title: 'Lac des Vaches',
          date: '2026-07-16',
          night: null,
          moments: [
            {
              id: 'm-2-1',
              kind: 'photo',
              time: '09:15',
              text: 'Traversée du Lac des Vaches sur les dalles',
              place: 'Lac des Vaches',
              photo: createTestMedia({ id: 'p-2-1', url: 'https://example.test/lac.jpg' }),
              media: [],
              encounters: [],
            },
          ],
        },
      ],
      coverMediaId: 'p-1-2',
      visibility: 'public',
      postEnabled: true,
      postContent: 'Trek inoubliable au coeur de la Vanoise avec paysages glaciaires.',
      tags: ['vanoise', 'haute-montagne', 'refuge'],
    };

    const validation = carnetSchemaV2.safeParse(carnetValues);
    expect(validation.success).toBe(true);

    const payload = buildCarnetPayload(carnetValues, { hasCarnetNights: false });
    expect(payload.title).toBe('Haute Route de la Vanoise');
    expect(payload.cover_image).toBe('https://example.test/col.jpg');
    expect(payload.moments).toHaveLength(3);
    expect(payload.start_lng).toBe(6.721);
    expect(payload.start_lat).toBe(45.381);
    expect(carnetCover(carnetValues)?.id).toBe('p-1-2');
  });

  it('Scenario 3: Complete End-User Kit Journey — Ultralight Bivouac Gear Build', () => {
    const selectedGear: KitItemV2[] = [
      { id: 'g1', name: 'Tente Tarp Ultralight 1P', category: 'Abri', weightG: 680, quantity: 1, productId: 'prod-tarp', ownershipId: null, isChecked: true },
      { id: 'g2', name: 'Sac de couchage Duvet 850FP', category: 'Couchage', weightG: 520, quantity: 1, productId: 'prod-duvet', ownershipId: null, isChecked: true },
      { id: 'g3', name: 'Matelas gonflable R-4.2', category: 'Couchage', weightG: 390, quantity: 1, productId: 'prod-matelas', ownershipId: null, isChecked: true },
      { id: 'g4', name: 'Réchaud Titane 25g', category: 'Cuisine', weightG: 25, quantity: 1, productId: 'prod-rechaud', ownershipId: null, isChecked: true },
      { id: 'g5', name: 'Popote Titane 550ml', category: 'Cuisine', weightG: 80, quantity: 1, productId: 'prod-popote', ownershipId: null, isChecked: true },
      { id: 'g6', name: 'Doudoune Compressible', category: 'Vêtements', weightG: 280, quantity: 1, productId: 'prod-doudoune', ownershipId: null, isChecked: true },
      { id: 'g7', name: 'Sac à dos Frameless 40L', category: 'Portage', weightG: 720, quantity: 1, productId: 'prod-sac', ownershipId: null, isChecked: true },
    ];

    const totalWeight = kitItemsWeightV2(selectedGear);
    expect(totalWeight).toBe(2695);

    const goal = kitGoalOfWeightV2(totalWeight);
    expect(goal).toBe('ultra');

    const formattedWeight = formatKitWeightV2(totalWeight, 'metric');
    expect(formattedWeight).toBe('2,7 kg');

    const kitValues: KitFormValuesV2 = {
      ...createDefaultsV2('kit'),
      name: 'Bivouac Sub-3kg Éte 2026',
      season: 'ete',
      description: 'Kit de bivouac minimaliste orienté autonomie 3 jours.',
      isPublic: true,
      items: selectedGear,
    };

    const parsed = kitSchemaV2.safeParse(kitValues);
    expect(parsed.success).toBe(true);

    const rpcPayload = buildKitPayload(kitValues);
    expect(rpcPayload.name).toBe('Bivouac Sub-3kg Éte 2026');
    expect(rpcPayload.is_public).toBe(true);
    expect(rpcPayload.items).toHaveLength(7);
    expect(rpcPayload.share_content).toContain('Bivouac Sub-3kg Éte 2026');
    expect(rpcPayload.share_content).toContain('7 objets');
  });
});
