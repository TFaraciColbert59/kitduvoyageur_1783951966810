// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StoryCreateForm } from '@/features/community/create/StoryCreateForm';
import { createDefaults, createSchemas } from '@/features/community/create/engine/createSchemas';

afterEach(cleanup);

const USER = { id: 'user-story' };

function renderStory() {
  return render(
    <StoryCreateForm open onClose={() => {}} user={USER} onCreated={() => {}} />,
  );
}

describe('StoryCreateForm', () => {
  it('affiche les deux étapes Média / Légende et le média picker', () => {
    renderStory();

    expect(screen.getByRole('tab', { name: 'Média' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Légende' }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByTestId('media-picker')).toBeTruthy();
    expect(screen.getByText('Un seul média, format vertical 9:16.')).toBeTruthy();
  });

  it('bloque l’étape Média sans fichier et affiche l’erreur du schéma', async () => {
    renderStory();

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    const errors = await screen.findAllByText('Ajoute au moins un média.');
    expect(errors.length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: 'Média' }).getAttribute('aria-selected')).toBe('true');
  });

  it('expose la légende, l’audience et la politique de réponse', async () => {
    renderStory();

    fireEvent.click(screen.getByRole('tab', { name: 'Légende' }));

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Légende' }).getAttribute('aria-selected')).toBe(
        'true',
      ),
    );
    expect(screen.getByRole('textbox', { name: 'Légende' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Audience' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Réponses' })).toBeTruthy();
  });

  it('valide la politique de réponse et le média unique dans le schéma', () => {
    const media = {
      id: 'm1',
      name: 'story.jpg',
      type: 'image/jpeg',
      size: 1000,
      previewUrl: 'blob:story',
      url: 'https://cdn.test/story.jpg',
      alt: '',
      cover: true,
      status: 'uploaded' as const,
      progress: 100,
    };

    expect(
      createSchemas.story.safeParse({
        ...createDefaults('story'),
        media: [media],
        replyPolicy: 'personne',
      }).success,
    ).toBe(false);

    expect(
      createSchemas.story.safeParse({
        ...createDefaults('story'),
        media: [media, { ...media, id: 'm2' }],
      }).success,
    ).toBe(false);

    expect(
      createSchemas.story.safeParse({
        ...createDefaults('story'),
        media: [media],
        replyPolicy: 'followers',
      }).success,
    ).toBe(true);
  });
});
