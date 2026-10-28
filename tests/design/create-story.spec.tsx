// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  StoryCreateForm,
  buildStoryComposition,
} from '@/features/community/create/StoryCreateForm';
import { createDefaults, createSchemas } from '@/features/community/create/engine/createSchemas';

afterEach(cleanup);

const USER = { id: 'user-story' };

const MEDIA = {
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

function renderStory() {
  return render(
    <StoryCreateForm open onClose={() => {}} user={USER} onCreated={() => {}} />,
  );
}

describe('StoryCreateForm', () => {
  it('affiche les trois étapes Média / Édition / Diffusion et le média picker', () => {
    renderStory();

    expect(screen.getByRole('tab', { name: 'Média' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Édition' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Diffusion' })).toBeTruthy();
    expect(screen.getByTestId('media-picker')).toBeTruthy();
    expect(screen.getByText('Un seul média, format vertical 9:16.')).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('bloque l’étape Média sans fichier et affiche l’erreur du schéma', async () => {
    renderStory();

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    const errors = await screen.findAllByText('Ajoute au moins un média.');
    expect(errors.length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: 'Média' }).getAttribute('aria-selected')).toBe('true');
  });

  it('expose la légende, le texte et le lien à l’étape Édition', async () => {
    renderStory();

    fireEvent.click(screen.getByRole('tab', { name: 'Édition' }));

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Édition' }).getAttribute('aria-selected')).toBe(
        'true',
      ),
    );
    expect(screen.getByRole('textbox', { name: 'Légende' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Texte de la story' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Lien de la story' })).toBeTruthy();
  });

  it('expose audience, réponses et partage à l’étape Diffusion', () => {
    renderStory();
    fireEvent.click(screen.getByRole('tab', { name: 'Diffusion' }));

    expect(screen.getByRole('combobox', { name: 'Audience' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Réponses' })).toBeTruthy();
    const reshare = screen.getByRole('switch', { name: 'Partage' });
    expect(reshare.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(reshare);
    expect(reshare.getAttribute('aria-checked')).toBe('false');
  });

  it('valide la politique de réponse, le média unique, le lien et le partage', () => {
    expect(
      createSchemas.story.safeParse({
        ...createDefaults('story'),
        media: [MEDIA],
        replyPolicy: 'personne',
      }).success,
    ).toBe(false);

    expect(
      createSchemas.story.safeParse({
        ...createDefaults('story'),
        media: [MEDIA, { ...MEDIA, id: 'm2' }],
      }).success,
    ).toBe(false);

    expect(
      createSchemas.story.safeParse({
        ...createDefaults('story'),
        media: [MEDIA],
        replyPolicy: 'followers',
        overlayText: 'Sommet atteint',
        overlayLink: 'https://exemple.test/recit',
        allowReshare: false,
      }).success,
    ).toBe(true);

    expect(
      createSchemas.story.safeParse({
        ...createDefaults('story'),
        media: [MEDIA],
        overlayLink: 'javascript:alert(1)',
      }).success,
    ).toBe(false);
  });

  it('construit la composition v1 des overlays', () => {
    expect(
      buildStoryComposition({ overlayText: '  ', overlayLink: '' }),
    ).toBeNull();

    expect(
      buildStoryComposition({
        overlayText: 'Col du midi',
        overlayLink: 'https://exemple.test/col',
      }),
    ).toEqual([
      { type: 'text', text: 'Col du midi' },
      { type: 'link', url: 'https://exemple.test/col' },
    ]);
  });
});
