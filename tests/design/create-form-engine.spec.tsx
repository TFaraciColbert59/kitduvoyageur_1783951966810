// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreateFormEngine } from '@/features/community/create/engine/CreateFormEngine';
import {
  createDefaults,
  createSchemas,
  type ClubFormValues,
} from '@/features/community/create/engine/createSchemas';

afterEach(cleanup);

function isoInDays(days: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

describe('createSchemas — validation des six types', () => {
  it('refuse une sortie sans date future', () => {
    const result = createSchemas.sortie.safeParse({
      ...createDefaults('sortie'),
      title: 'Lac Blanc',
      location: 'Chamonix',
      startDate: '2020-01-01',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('date'))).toBe(true);
    }
  });

  it('accepte une sortie complète et future', () => {
    const result = createSchemas.sortie.safeParse({
      ...createDefaults('sortie'),
      title: 'Lac Blanc',
      location: 'Chamonix',
      startDate: isoInDays(7),
      endDate: isoInDays(8),
    });
    expect(result.success).toBe(true);
  });

  it('refuse une plage de dates inversée pour un carnet', () => {
    const result = createSchemas.carnet.safeParse({
      ...createDefaults('carnet'),
      title: 'Traversée',
      destination: 'Vercors',
      startDate: isoInDays(4),
      endDate: isoInDays(1),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('endDate'))).toBe(true);
    }
  });

  it('impose un média pour une story', () => {
    const result = createSchemas.story.safeParse({ ...createDefaults('story'), caption: 'Un moment' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Ajoute au moins un média.');
    }
  });

  it('impose un club quand la publication cible un club', () => {
    const result = createSchemas.post.safeParse({
      ...createDefaults('post'),
      kind: 'billet',
      title: 'Billet',
      content: 'Un texte',
      audience: 'club',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('clubId'))).toBe(true);
    }
  });

  it('impose un média pour une publication photo', () => {
    const result = createSchemas.post.safeParse({ ...createDefaults('post'), kind: 'photo' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message === 'Ajoute au moins une photo ou une vidéo.')).toBe(true);
    }
  });

  it('refuse un poids de kit nul', () => {
    const result = createSchemas.kit.safeParse({
      ...createDefaults('kit'),
      name: 'Kit bivouac',
      weightG: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message === 'Le poids doit être supérieur à 0 g.')).toBe(true);
    }
  });

  it('produit des messages français pour un club incomplet', () => {
    const result = createSchemas.club.safeParse({ ...createDefaults('club') });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain('Le nom du club est requis.');
      expect(messages).toContain('La catégorie est requise.');
    }
  });

  it('refuse une URL de média invalide', () => {
    const result = createSchemas.story.safeParse({
      ...createDefaults('story'),
      media: [
        {
          id: 'm1',
          name: 'photo.jpg',
          type: 'image/jpeg',
          size: 1200,
          previewUrl: 'blob:preview',
          url: 'pas-une-url',
          alt: '',
          cover: true,
          status: 'uploaded',
          progress: 100,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe('CreateFormEngine — moteur React Hook Form + Zod', () => {
  it('valide via Zod, affiche le message FR et ne soumet pas', async () => {
    const onSubmit = vi.fn();
    render(
      <CreateFormEngine<ClubFormValues>
        kind="club"
        defaultValues={createDefaults('club')}
        onSubmit={onSubmit}
      >
        {(form) => (
          <>
            <label htmlFor="club-name">Nom</label>
            <input id="club-name" {...form.register('name')} />
            <label htmlFor="club-category">Catégorie</label>
            <input id="club-category" {...form.register('category')} />
            <button type="submit">Créer</button>
            {form.formState.errors.name ? <p role="alert">{form.formState.errors.name.message}</p> : null}
          </>
        )}
      </CreateFormEngine>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Créer' }));

    expect(await screen.findByText('Le nom du club est requis.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('soumet les valeurs validées quand le formulaire est complet', async () => {
    const onSubmit = vi.fn(async () => {});
    render(
      <CreateFormEngine<ClubFormValues>
        kind="club"
        defaultValues={createDefaults('club')}
        onSubmit={onSubmit}
      >
        {(form) => (
          <>
            <label htmlFor="club-name">Nom</label>
            <input id="club-name" {...form.register('name')} />
            <label htmlFor="club-category">Catégorie</label>
            <input id="club-category" {...form.register('category')} />
            <button type="submit">Créer</button>
          </>
        )}
      </CreateFormEngine>
    );

    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'La Cordée du Vercors' } });
    fireEvent.change(screen.getByLabelText('Catégorie'), { target: { value: 'Randonnée' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const values = onSubmit.mock.calls[0]?.[0] as ClubFormValues | undefined;
    expect(values?.name).toBe('La Cordée du Vercors');
    expect(values?.privacy).toBe('open');
  });

  it('rend visible une erreur serveur sans perdre la saisie', async () => {
    const onSubmit = vi.fn(async () => {
      throw new Error('Serveur indisponible');
    });
    render(
      <CreateFormEngine<ClubFormValues>
        kind="club"
        defaultValues={{ ...createDefaults('club'), name: 'La Cordée', category: 'Randonnée' }}
        onSubmit={onSubmit}
      >
        {(form) => (
          <>
            <label htmlFor="club-name">Nom</label>
            <input id="club-name" {...form.register('name')} />
            <button type="submit">Créer</button>
          </>
        )}
      </CreateFormEngine>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Créer' }));

    expect(await screen.findByText('Serveur indisponible')).toBeTruthy();
    expect((screen.getByLabelText('Nom') as HTMLInputElement).value).toBe('La Cordée');
  });
});
