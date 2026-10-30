// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildFormPreview,
  FormPreview,
} from '@/features/community/create/shared/FormPreview';
import { KitCreateForm } from '@/features/community/create/KitCreateForm';
import { CarnetCreateForm } from '@/features/community/create/CarnetCreateForm';
import { StoryCreateForm } from '@/features/community/create/StoryCreateForm';
import { SortieCreateForm } from '@/features/community/create/SortieCreateForm';
import { ClubCreateForm } from '@/features/community/create/ClubCreateForm';
import { readFileSync } from 'node:fs';
import { createDefaults } from '@/features/community/create/engine/createSchemas';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));

afterEach(cleanup);

const cover = {
  id: 'cover-1',
  name: 'cover.jpg',
  type: 'image/jpeg',
  size: 1000,
  previewUrl: 'blob:cover',
  url: 'https://cdn.test/cover.jpg',
  alt: 'Vue du Vercors',
  cover: true,
  status: 'uploaded' as const,
  progress: 100,
};

describe('aperçu réel — les six types', () => {
  it('décrit une publication photo par son texte et sa couverture', () => {
    const preview = buildFormPreview('post', {
      ...createDefaults('post'),
      kind: 'photo',
      content: 'Lever de soleil sur le lac\nDeuxième ligne',
      audience: 'abonnies',
      location: 'Chamonix',
      media: [cover],
    });

    expect(preview.typeLabel).toBe('Photo / vidéo');
    expect(preview.title).toBe('Lever de soleil sur le lac');
    expect(preview.summary).toContain('Lever de soleil');
    expect(preview.meta).toContain('Abonnés');
    expect(preview.meta).toContain('Chamonix');
    expect(preview.cover?.id).toBe('cover-1');
  });

  it('décrit une story par sa légende, son audience et ses réponses', () => {
    const preview = buildFormPreview('story', {
      ...createDefaults('story'),
      caption: 'Bivouac au col',
      audience: 'abonnies',
      replyPolicy: 'followers',
      media: [cover],
    });

    expect(preview.typeLabel).toBe('Story · 24 h');
    expect(preview.title).toBe('Bivouac au col');
    expect(preview.meta).toContain('Abonnés');
    expect(preview.meta).toContain('Réponses des abonnés');
  });

  it('décrit un carnet avec sa destination et ses dates', () => {
    const preview = buildFormPreview('carnet', {
      ...createDefaults('carnet'),
      title: 'Traversée du Vercors',
      destination: 'Vercors',
      startDate: '2026-06-01',
      endDate: '2026-06-04',
      visibility: 'private',
      cover: [cover],
    });

    expect(preview.typeLabel).toBe('Carnet');
    expect(preview.title).toBe('Traversée du Vercors');
    expect(preview.summary).toBe('Vercors');
    expect(preview.meta).toContain('2026-06-01 → 2026-06-04');
    expect(preview.meta).toContain('Privé');
  });

  it('décrit une sortie, un kit et un club avec leurs valeurs réelles', () => {
    const sortie = buildFormPreview('sortie', {
      ...createDefaults('sortie'),
      title: 'Lac Blanc',
      location: 'Chamonix',
      startDate: '2026-07-10',
      level: 'difficile',
      maxParticipants: 12,
      cover: [cover],
    });
    expect(sortie.typeLabel).toBe('Sortie');
    expect(sortie.title).toBe('Lac Blanc');
    expect(sortie.meta).toContain('Difficile');
    expect(sortie.meta).toContain('12 pers.');

    const kit = buildFormPreview('kit', {
      ...createDefaults('kit'),
      name: 'Kit bivouac',
      season: 'ete',
      weightG: 4200,
      isPublic: false,
      cover: [cover],
    });
    expect(kit.typeLabel).toBe('Kit');
    expect(kit.title).toBe('Kit bivouac');
    expect(kit.meta).toContain('Été');
    expect(kit.meta).toContain('4,2 kg');
    expect(kit.meta).toContain('Privé');

    const club = buildFormPreview('club', {
      ...createDefaults('club'),
      name: 'La Cordée',
      category: 'Randonnée',
      location: 'Grenoble',
      privacy: 'closed',
      cover: [cover],
    });
    expect(club.typeLabel).toBe('Club');
    expect(club.title).toBe('La Cordée');
    expect(club.meta).toContain('Randonnée');
    expect(club.meta).toContain('Sur demande');
  });
});

describe('FormPreview — rendu compact', () => {
  it('affiche le type, le titre, le résumé et la couverture', () => {
    render(
      <FormPreview
        kind="carnet"
        values={{
          ...createDefaults('carnet'),
          title: 'Traversée du Vercors',
          destination: 'Vercors',
          cover: [cover],
        }}
      />,
    );

    const preview = screen.getByTestId('form-preview');
    expect(within(preview).getByText('Carnet')).toBeTruthy();
    expect(within(preview).getByText('Traversée du Vercors')).toBeTruthy();
    expect(within(preview).getByText('Vercors')).toBeTruthy();
    const image = within(preview).getByRole('img') as HTMLImageElement;
    expect(image.src).toContain('blob:cover');
    expect(image.alt).toBe('Vue du Vercors');
  });

  it('suit la saisie dans le formulaire Kit', () => {
    render(<KitCreateForm open onClose={() => {}} user={{ id: 'u' }} onCreated={() => {}} />);

    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Kit léger' } });

    const preview = screen.getByTestId('form-preview');
    expect(within(preview).getByText('Kit léger')).toBeTruthy();
    expect(within(preview).getByText('Kit')).toBeTruthy();
  });

  it('suit la saisie dans le formulaire Carnet', () => {
    render(
      <CarnetCreateForm open onClose={() => {}} user={{ id: 'u' }} onCreated={() => {}} />,
    );

    fireEvent.change(screen.getByLabelText('Titre'), {
      target: { value: 'Un carnet en cours' },
    });

    const preview = screen.getByTestId('form-preview');
    expect(within(preview).getByText('Un carnet en cours')).toBeTruthy();
    expect(within(preview).getByText('Carnet')).toBeTruthy();
  });

  it('est monté dans les six formulaires, y compris publication', () => {
    render(<StoryCreateForm open onClose={() => {}} user={{ id: 'u' }} onCreated={() => {}} />);
    expect(screen.getByTestId('form-preview')).toBeTruthy();
    cleanup();

    render(<SortieCreateForm open onClose={() => {}} user={{ id: 'u' }} onCreated={() => {}} />);
    expect(screen.getByTestId('form-preview')).toBeTruthy();
    cleanup();

    render(<ClubCreateForm open onClose={() => {}} user={{ id: 'u' }} onCreated={() => {}} />);
    expect(screen.getByTestId('form-preview')).toBeTruthy();
    cleanup();

    const forms: Array<[string, string]> = [
      ['PostCreateForm', 'post'],
      ['StoryCreateForm', 'story'],
      ['CarnetCreateForm', 'carnet'],
      ['SortieCreateForm', 'sortie'],
      ['KitCreateForm', 'kit'],
      ['ClubCreateForm', 'club'],
    ];
    for (const [file, kind] of forms) {
      const source = readFileSync(
        `src/features/community/create/${file}.tsx`,
        'utf8',
      );
      expect(source).toContain(`<FormPreview kind="${kind}" values={previewValues} />`);
    }
  });
});
