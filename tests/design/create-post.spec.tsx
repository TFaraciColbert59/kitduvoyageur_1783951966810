// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PostCreateForm,
  buildPostSnapshot,
} from '@/features/community/create/PostCreateForm';
import { createDefaults, createSchemas } from '@/features/community/create/engine/createSchemas';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: async () => ({ data: [] }),
        }),
      }),
    }),
  }),
}));

afterEach(cleanup);

function isoInDays(days: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function datetimeInHours(hours: number): string {
  const date = new Date(Date.now() + hours * 3_600_000);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}T${hour}:${minute}`;
}

function renderPost() {
  return render(<PostCreateForm open onClose={() => {}} user={{ id: 'user-post' }} onCreated={() => {}} />);
}

describe('PostCreateForm', () => {
  it('affiche les quatre étapes Format / Médias / Détails / Publication', () => {
    renderPost();

    expect(screen.getByRole('tab', { name: 'Format' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Médias' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Détails' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Publication' })).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('bloque l’étape Médias sans photo pour un format photo', async () => {
    renderPost();

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Médias' }).getAttribute('aria-selected')).toBe(
        'true',
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(
      (await screen.findAllByText('Ajoute au moins une photo ou une vidéo.')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: 'Médias' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('expose commentaires, j’aime et planification à l’étape Publication', async () => {
    renderPost();
    fireEvent.click(screen.getByRole('tab', { name: 'Publication' }));

    const comments = screen.getByRole('switch', { name: 'Commentaires' });
    const likes = screen.getByRole('switch', { name: 'J’aime' });
    expect(comments.getAttribute('aria-checked')).toBe('true');
    expect(likes.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(comments);
    expect(comments.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByLabelText('Publication programmée')).toBeTruthy();
  });

  it('valide le sondage 2 à 4 options et la planification future', () => {
    const base = {
      ...createDefaults('post'),
      kind: 'question' as const,
      title: 'Une question',
      content: 'Un texte',
    };

    expect(
      createSchemas.post.safeParse({ ...base, pollOptions: ['Une seule option'] }).success,
    ).toBe(false);
    expect(
      createSchemas.post.safeParse({ ...base, pollOptions: ['A', 'B'] }).success,
    ).toBe(true);
    expect(
      createSchemas.post.safeParse({
        ...base,
        pollOptions: ['A', 'B', 'C', 'D', 'E'],
      }).success,
    ).toBe(false);

    expect(
      createSchemas.post.safeParse({ ...base, scheduledAt: '2020-01-01T10:00' }).success,
    ).toBe(false);
    expect(
      createSchemas.post.safeParse({ ...base, scheduledAt: datetimeInHours(24) }).success,
    ).toBe(true);
    expect(
      createSchemas.post.safeParse({ ...base, scheduledAt: 'pas-une-date' }).success,
    ).toBe(false);

    // Un événement passé reste refusé, comme avant.
    expect(
      createSchemas.post.safeParse({
        ...base,
        kind: 'event',
        title: 'Sortie',
        eventDate: '2020-01-01',
      }).success,
    ).toBe(false);
    expect(
      createSchemas.post.safeParse({
        ...base,
        kind: 'event',
        title: 'Sortie',
        eventDate: isoInDays(7),
      }).success,
    ).toBe(true);
  });

  it('construit le snapshot des options de publication', () => {
    const snapshot = buildPostSnapshot({
      ...createDefaults('post'),
      content: 'Question',
      allowComments: false,
      allowLikes: true,
      scheduledAt: datetimeInHours(6),
      pollOptions: ['Bivouac', 'Refuge'],
    });

    expect(snapshot.schema).toBe('lkdv.post.options.v1');
    expect(snapshot.options).toEqual({ allow_comments: false, allow_likes: true });
    expect(snapshot.scheduled_at).toBe(datetimeInHours(6));
    expect(snapshot.poll).toEqual({ options: ['Bivouac', 'Refuge'] });

    expect(
      buildPostSnapshot({ ...createDefaults('post'), scheduledAt: '', pollOptions: [] }),
    ).toMatchObject({ scheduled_at: null, poll: null });
  });
});
