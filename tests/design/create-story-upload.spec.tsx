// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoryCreateForm } from '@/features/community/create/StoryCreateForm';
import { clearCreateDraft } from '@/features/community/create/engine/useCreateDraft';

const { uploadMock } = vi.hoisted(() => ({ uploadMock: vi.fn() }));

vi.mock('@/features/community/create/upload', () => ({
  createStoryMediaUploader: () => uploadMock,
}));

beforeEach(() => {
  window.localStorage.clear();
  clearCreateDraft('story');
  uploadMock.mockReset();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn((file: File) => `blob:${file.name}`),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

afterEach(cleanup);

function file(name = 'story.jpg'): File {
  return new File(['contenu'], name, { type: 'image/jpeg' });
}

function addFile() {
  fireEvent.change(screen.getByLabelText('Choisir un fichier'), {
    target: { files: [file()] },
  });
}

function renderStory() {
  return render(
    <StoryCreateForm open onClose={() => {}} user={{ id: 'user-story' }} onCreated={() => {}} />,
  );
}

describe('Story — progression d’upload et réessai', () => {
  it('affiche la progression pendant l’envoi du média', async () => {
    let rejectUpload: ((error: Error) => void) | undefined;
    uploadMock.mockImplementation(
      (_file: File, onProgress?: (percent: number) => void) =>
        new Promise((_resolve, reject) => {
          onProgress?.(35);
          rejectUpload = reject;
        }),
    );
    renderStory();

    addFile();

    expect(await screen.findByText('Envoi 35 %')).toBeTruthy();
    const bar = screen.getByRole('progressbar', { name: /Envoi de story\.jpg/ });
    expect(bar.getAttribute('aria-valuenow')).toBe('35');

    await act(async () => {
      rejectUpload?.(new Error('Réseau indisponible'));
    });

    expect(await screen.findByText('Réseau indisponible')).toBeTruthy();
  });

  it('réessaie sans reprendre la story et conserve l’URL et le chemin', async () => {
    uploadMock
      .mockRejectedValueOnce(new Error('Réseau indisponible'))
      .mockImplementationOnce(
        async (_file: File, onProgress?: (percent: number) => void) => {
          onProgress?.(70);
          return {
            url: 'https://cdn.test/story.jpg',
            bucket: 'stories-private',
            path: 'user-story/story/story.jpg',
          };
        },
      );
    renderStory();

    addFile();

    expect(await screen.findByText('Réseau indisponible')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer story.jpg' }));

    await waitFor(() => {
      const item = screen.getByTestId('media-item');
      expect(within(item).getByText('Envoyé')).toBeTruthy();
    });

    const preview = within(screen.getByTestId('media-item')).getByTestId(
      'media-preview',
    ) as HTMLImageElement;
    expect(preview.src).toContain('blob:story.jpg');
    expect(uploadMock).toHaveBeenCalledTimes(2);
    expect(uploadMock).toHaveBeenCalledWith(expect.any(File), expect.any(Function));
  });

  it('permet de retirer un média en échec', async () => {
    uploadMock.mockRejectedValueOnce(new Error('Format refusé'));
    renderStory();

    addFile();
    expect(await screen.findByText('Format refusé')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer story.jpg' }));
    expect(screen.queryByTestId('media-item')).toBeNull();
    expect(screen.getByText('0/1 média')).toBeTruthy();
  });
});
