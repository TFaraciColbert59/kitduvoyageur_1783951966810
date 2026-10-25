// @vitest-environment jsdom
import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaPicker, type MediaPickerProps } from '@/features/community/create/shared/MediaPicker';
import type { MediaItem, MediaUploader } from '@/features/community/create/shared/mediaTypes';

beforeEach(() => {
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

function file(name: string, type = 'image/jpeg'): File {
  return new File(['contenu'], name, { type });
}

function Harness(props: Partial<MediaPickerProps> = {}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  return (
    <MediaPicker
      value={items}
      onChange={setItems}
      max={3}
      label="Photos"
      upload={props.upload}
      accept={props.accept}
    />
  );
}

function addFiles(files: File[]) {
  fireEvent.change(screen.getByLabelText(/Choisir (des|un) fichier/), {
    target: { files },
  });
}

describe('MediaPicker — médias partagés', () => {
  it('ajoute des fichiers, affiche la prévisualisation et le texte alternatif', () => {
    render(<Harness />);

    addFiles([file('photo-1.jpg')]);

    const item = screen.getByTestId('media-item');
    expect(within(item).getByText('photo-1.jpg')).toBeTruthy();
    expect(within(item).getByTestId('media-preview').getAttribute('src')).toBe('blob:photo-1.jpg');

    fireEvent.change(within(item).getByLabelText('Texte alternatif pour photo-1.jpg'), {
      target: { value: 'Un lac au lever du jour' },
    });

    expect(within(item).getByTestId('media-preview').getAttribute('alt')).toBe('Un lac au lever du jour');
  });

  it('gère une couverture unique, la réorganisation et la suppression', () => {
    render(<Harness />);
    addFiles([file('photo-1.jpg'), file('photo-2.jpg')]);

    const firstCover = screen.getByRole('button', { name: 'Définir photo-1.jpg comme couverture' });
    const secondCover = screen.getByRole('button', { name: 'Définir photo-2.jpg comme couverture' });
    expect(firstCover.getAttribute('aria-pressed')).toBe('true');
    expect(secondCover.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(secondCover);
    expect(firstCover.getAttribute('aria-pressed')).toBe('false');
    expect(secondCover.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Monter photo-2.jpg' }));
    const items = screen.getAllByTestId('media-item');
    expect(within(items[0]).getByText('photo-2.jpg')).toBeTruthy();
    expect(within(items[1]).getByText('photo-1.jpg')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer photo-1.jpg' }));
    expect(screen.queryByText('photo-1.jpg')).toBeNull();
    expect(screen.getAllByTestId('media-item')).toHaveLength(1);
  });

  it('téléverse via le callback contrôlé et affiche l’état envoyé', async () => {
    const upload: MediaUploader = vi.fn(async (uploaded, onProgress) => {
      onProgress?.(50);
      return `https://cdn.test/${uploaded.name}`;
    });
    render(<Harness upload={upload} />);

    addFiles([file('photo-1.jpg')]);

    await waitFor(() => expect(within(screen.getByTestId('media-item')).getByText('Envoyé')).toBeTruthy());
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledWith(expect.any(File), expect.any(Function));
  });

  it('affiche une erreur d’upload et permet de réessayer', async () => {
    const upload = vi
      .fn<MediaUploader>()
      .mockRejectedValueOnce(new Error('Réseau indisponible'))
      .mockResolvedValueOnce('https://cdn.test/photo-1.jpg');
    render(<Harness upload={upload} />);

    addFiles([file('photo-1.jpg')]);

    expect(await screen.findByText('Réseau indisponible')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer photo-1.jpg' }));

    await waitFor(() => expect(within(screen.getByTestId('media-item')).getByText('Envoyé')).toBeTruthy());
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it('refuse un format non accepté et affiche un message accessible', () => {
    render(<Harness />);
    addFiles([file('notes.txt', 'text/plain')]);

    expect(screen.getByRole('alert').textContent).toContain('Format non accepté');
    expect(screen.queryByTestId('media-item')).toBeNull();
  });

  it('accepte un dépôt de fichiers sur la zone de glisser-déposer', () => {
    render(<Harness />);
    fireEvent.drop(screen.getByTestId('media-dropzone'), {
      dataTransfer: { files: [file('drop.jpg')] },
    });

    expect(screen.getByText('drop.jpg')).toBeTruthy();
  });

  it('affiche une barre de progression accessible pendant l’envoi', async () => {
    let resolveUpload: ((url: string) => void) | undefined;
    const upload = vi.fn<MediaUploader>(
      (_file, onProgress) =>
        new Promise((resolve) => {
          onProgress?.(40);
          resolveUpload = resolve;
        }),
    );
    render(<Harness upload={upload} />);

    addFiles([file('photo-1.jpg')]);

    const bar = await screen.findByRole('progressbar', { name: 'Envoi de photo-1.jpg' });
    expect(bar.getAttribute('aria-valuenow')).toBe('40');
    expect(within(screen.getByTestId('media-item')).getByText('Envoi 40 %')).toBeTruthy();

    await act(async () => {
      resolveUpload?.('https://cdn.test/photo-1.jpg');
    });

    await waitFor(() =>
      expect(within(screen.getByTestId('media-item')).getByText('Envoyé')).toBeTruthy(),
    );
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('conserve le bucket et le chemin renvoyés par un upload de story', async () => {
    const onChange = vi.fn<(items: MediaItem[]) => void>();
    let resolveUpload: ((result: { url: string; bucket: string; path: string }) => void) | undefined;
    const upload = vi.fn<MediaUploader>(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    );
    render(
      <MediaPicker value={[]} onChange={onChange} max={1} label="Photo" upload={upload} />,
    );

    addFiles([file('story.jpg')]);
    await act(async () => {
      resolveUpload?.({
        url: 'https://cdn.test/story.jpg',
        bucket: 'stories-private',
        path: 'user/story/story.jpg',
      });
    });

    await waitFor(() => {
      const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0]?.[0];
      expect(last?.status).toBe('uploaded');
      expect(last?.url).toBe('https://cdn.test/story.jpg');
      expect(last?.storageBucket).toBe('stories-private');
      expect(last?.storagePath).toBe('user/story/story.jpg');
    });
  });
});
