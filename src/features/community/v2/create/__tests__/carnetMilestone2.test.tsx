/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import {
  carnetSchemaV2,
  carnetMomentSchema,
  carnetDaySchema,
  createDefaultsV2,
  type CarnetFormValuesV2,
} from '../engine/createSchemasV2';
import { carnetPhotos, carnetCover, buildCarnetPayload } from '../createRpc';
import { CARNET_MOMENT_MEDIA_LIMITS, IMAGE_LIMITS } from '../fields/media';
import { DaysPaneV2 } from '../carnet/DaysPaneV2';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          limit: () => Promise.resolve({ data: [] }),
          maybeSingle: () => Promise.resolve({ data: null }),
        }),
        in: () => Promise.resolve({ data: [] }),
        not: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [] }),
          }),
        }),
      }),
    }),
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.test/uploaded.jpg' } }),
      }),
    },
  }),
}));

function DaysPaneWrapper({ initialValues }: { initialValues?: Partial<CarnetFormValuesV2> }) {
  const defaults = {
    ...createDefaultsV2('carnet'),
    days: [
      {
        id: 'day-1',
        dayNumber: 1,
        title: '',
        date: '2026-07-15',
        night: null,
        moments: [],
      },
    ],
    ...initialValues,
  };
  const form = useForm<CarnetFormValuesV2>({
    defaultValues: defaults,
  });

  return (
    <FormProvider {...form}>
      <DaysPaneV2 user={{ id: 'user-test-123' }} />
    </FormProvider>
  );
}

describe('Milestone 2 : Carnet Creation Flow & Moments Timeline', () => {
  afterEach(cleanup);

  describe('F2.4 & F2.7 : Empty state & Sequential addition', () => {
    it('affiche un bouton carte pointillée centrée pour le premier moment quand day.moments est vide', () => {
      render(<DaysPaneWrapper />);
      const emptyBtn = document.querySelector('button.lkdv-cv2c-moment-empty');
      expect(emptyBtn).toBeTruthy();
      expect(emptyBtn?.className).toContain('lkdv-cv2c-moment-empty');
      expect(emptyBtn?.querySelector('.lkdv-cv2c-moment-empty-icon')).toBeTruthy();
    });

    it('cliquer sur le bouton vide ajoute le premier moment avec le layout à 2 colonnes', async () => {
      render(<DaysPaneWrapper />);
      const emptyBtn = document.querySelector('button.lkdv-cv2c-moment-empty') as HTMLButtonElement;
      expect(emptyBtn).toBeTruthy();
      fireEvent.click(emptyBtn);

      // Le bouton vide disparaît, la carte de moment apparaît
      await waitFor(() => {
        expect(document.querySelector('button.lkdv-cv2c-moment-empty')).toBeNull();
        expect(screen.getByLabelText(/Titre du moment/i)).toBeTruthy();
      });
      expect(screen.getByLabelText(/Heure du moment/i)).toBeTruthy();
      expect(screen.getByLabelText(/Lieu du moment/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /Ajouter une rencontre/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Ajouter une photo ou vidéo/i })).toBeTruthy();

      // Bouton séquentiel présent
      expect(screen.getByRole('button', { name: /Ajouter un moment/i })).toBeTruthy();
    });

    it('le bloc d’en-tête titre et date du jour (lkdv-cv2c-media-edit) est supprimé', () => {
      render(<DaysPaneWrapper />);
      // Il n'y a pas d'input pour "Titre du jour"
      expect(screen.queryByLabelText(/Titre du jour/i)).toBeNull();
      expect(screen.queryByLabelText(/^Date$/i)).toBeNull();
    });
  });

  describe('F2.5 & F2.6 : Moment details, Encounter pills & 2-column card', () => {
    it('gère l’ajout et la suppression des rencontres multiples sans limite', async () => {
      render(
        <DaysPaneWrapper
          initialValues={{
            days: [
              {
                id: 'day-1',
                dayNumber: 1,
                title: '',
                date: '2026-07-15',
                night: null,
                moments: [
                  {
                    id: 'm-1',
                    title: 'Rencontre au sommet',
                    kind: 'rencontre',
                    time: '14:00',
                    text: 'Discussion sympa',
                    place: 'Col',
                    photo: null,
                    media: [],
                    encounters: ['Alice'],
                  },
                ],
              },
            ],
          }}
        />,
      );

      // Alice est affichée dans un chip
      expect(screen.getByText('Alice')).toBeTruthy();

      // Bouton [+] Rencontre
      const addEncounterBtn = screen.getByRole('button', { name: /Ajouter une rencontre/i });
      expect(addEncounterBtn).toBeTruthy();

      fireEvent.click(addEncounterBtn);
      const input = screen.getByPlaceholderText('Ami ou @pseudo');
      expect(input).toBeTruthy();

      fireEvent.change(input, { target: { value: 'Bob' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('Bob')).toBeTruthy();
      });

      // Retrait d'Alice
      const removeAliceBtn = screen.getByRole('button', { name: /Retirer Alice/i });
      fireEvent.click(removeAliceBtn);
      await waitFor(() => {
        expect(screen.queryByText('Alice')).toBeNull();
      });
      expect(screen.getByText('Bob')).toBeTruthy();
    });

    it('affiche le slot média 100x100 à droite avec indicateur', () => {
      render(
        <DaysPaneWrapper
          initialValues={{
            days: [
              {
                id: 'day-1',
                dayNumber: 1,
                title: '',
                date: '2026-07-15',
                night: null,
                moments: [
                  {
                    id: 'm-1',
                    title: 'Pause goûter',
                    kind: 'photo',
                    time: '16:00',
                    text: '',
                    place: '',
                    photo: null,
                    media: [
                      {
                        id: 'photo-1',
                        name: 'gouter.jpg',
                        type: 'image/jpeg',
                        size: 500,
                        previewUrl: '',
                        url: 'https://example.test/gouter.jpg',
                        alt: 'Goûter',
                        cover: true,
                        status: 'uploaded',
                        progress: 100,
                        storageBucket: 'carnet-media',
                        storagePath: 'u/gouter.jpg',
                        crop: '1:1',
                      },
                    ],
                    encounters: [],
                  },
                ],
              },
            ],
          }}
        />,
      );

      const slot = document.querySelector('.lkdv-cv2c-moment-media-slot');
      expect(slot).toBeTruthy();
      expect(screen.getByText('1/1')).toBeTruthy();
      expect(screen.getByRole('button', { name: /Retirer ce média/i })).toBeTruthy();
    });
  });

  describe('F2.7 : Schemas validation & limits', () => {
    it('accepte jusqu’à 100 moments par jour dans carnetDaySchema', () => {
      const moments = Array.from({ length: 100 }, (_, i) => ({
        id: `m-${i}`,
        title: `M ${i}`,
        kind: 'photo' as const,
        time: '12:00',
        text: '',
        place: '',
        photo: null,
        media: [],
        encounters: [],
      }));
      const res = carnetDaySchema.safeParse({
        id: 'd-1',
        dayNumber: 1,
        title: '',
        date: '2026-07-15',
        night: null,
        moments,
      });
      expect(res.success).toBe(true);

      const resOver = carnetDaySchema.safeParse({
        id: 'd-1',
        dayNumber: 1,
        title: '',
        date: '2026-07-15',
        night: null,
        moments: [...moments, { ...moments[0], id: 'm-101' }],
      });
      expect(resOver.success).toBe(false);
    });

    it('accepte jusqu’à 5 médias par moment et rejette au-delà', () => {
      const mediaItem = {
        id: 'med-1',
        name: 'test.jpg',
        type: 'image/jpeg',
        size: 100,
        previewUrl: '',
        url: 'https://example.test/test.jpg',
        alt: '',
        cover: true,
        status: 'uploaded' as const,
        progress: 100,
        storageBucket: 'carnet-media' as const,
        storagePath: 'u/test.jpg',
        crop: '1:1' as const,
      };

      const valid = carnetMomentSchema.safeParse({
        id: 'm-1',
        title: 'Photos',
        kind: 'photo',
        time: '',
        text: '',
        place: '',
        photo: null,
        media: Array(5).fill(mediaItem),
        encounters: [],
      });
      expect(valid.success).toBe(true);

      const invalid = carnetMomentSchema.safeParse({
        id: 'm-1',
        title: 'Photos',
        kind: 'photo',
        time: '',
        text: '',
        place: '',
        photo: null,
        media: Array(6).fill(mediaItem),
        encounters: [],
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe('F2.5 & F2.7 : Media limits & RPC serialization', () => {
    it('autorise carnet-moments-media et les vidéos dans CARNET_MOMENT_MEDIA_LIMITS', () => {
      expect(CARNET_MOMENT_MEDIA_LIMITS.allowVideo).toBe(true);
      expect(IMAGE_LIMITS.allowVideo).toBe(false);
    });

    it('sérialise title, titre, encounters et les types médias dans buildCarnetPayload', () => {
      const formValues: CarnetFormValuesV2 = {
        ...createDefaultsV2('carnet'),
        title: 'Mon Tour',
        destination: 'Alpes',
        visibility: 'public',
        trace: [
          [6.87, 45.92],
          [6.88, 45.93],
        ],
        days: [
          {
            id: 'd-1',
            dayNumber: 1,
            title: '',
            date: '2026-07-15',
            night: null,
            moments: [
              {
                id: 'm-1',
                title: 'Bivouac Magique',
                kind: 'photo',
                time: '20:15',
                text: 'Superbe soirée',
                place: 'Lac',
                photo: null,
                media: [
                  {
                    id: 'med-video',
                    name: 'video.mp4',
                    type: 'video/mp4',
                    size: 1000,
                    previewUrl: '',
                    url: 'https://example.test/video.mp4',
                    alt: 'Vidéo coucher de soleil',
                    cover: true,
                    status: 'uploaded',
                    progress: 100,
                    storageBucket: 'carnet-moments-media',
                    storagePath: 'u/video.mp4',
                    crop: '1:1',
                  },
                ],
                encounters: ['Théo', 'Emma'],
              },
            ],
          },
        ],
        postEnabled: true,
        postContent: 'Découvrez mon carnet dans les Alpes !',
      };

      const payload = buildCarnetPayload(formValues, { hasCarnetNights: false });
      expect(carnetPhotos(formValues)).toHaveLength(1);
      expect(payload.moments).toHaveLength(1);
      const momentPayload = (payload.moments as Record<string, unknown>[])[0];
      expect(momentPayload.title).toBe('Bivouac Magique');
      expect(momentPayload.titre).toBe('Bivouac Magique');
      expect(momentPayload.encounters).toEqual(['Théo', 'Emma']);
      expect(momentPayload.image_url).toBe('https://example.test/video.mp4');

      const mediaPayload = payload.media as { url: string; type: string }[];
      expect(mediaPayload).toHaveLength(1);
      expect(mediaPayload[0].type).toBe('video');

      expect((payload.post as { enabled: boolean; content: string }).enabled).toBe(true);
      expect((payload.post as { enabled: boolean; content: string }).content).toBe('Découvrez mon carnet dans les Alpes !');
    });
  });
});
