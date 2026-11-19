// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CaptureSheet, { type CaptureSignalInput } from '../CaptureSheet';

beforeAll(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:preview'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => cleanup());

function jpeg(name = 'col.jpg'): File {
  return new File([new Uint8Array(4)], name, { type: 'image/jpeg' });
}

describe('CaptureSheet — signal de bord (proposition n° 37)', () => {
  it('publie une photo avec sa ligne en deux gestes et rend le jour', async () => {
    const publish = vi.fn(async (_input: CaptureSignalInput) => ({
      ok: true,
      carnetId: 'c-42',
      day: 3,
    }));
    const onPublished = vi.fn();
    const { container } = render(
      <CaptureSheet
        isOpen
        onClose={() => undefined}
        publish={publish}
        context={{ place: 'La Bérarde' }}
        onPublished={onPublished}
      />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [jpeg()] } });

    // Gestes 2 : la ligne puis l'envoi.
    const line = await screen.findByLabelText('Ligne du signal');
    fireEvent.change(line, { target: { value: 'Col de l’Eychauda' } });
    fireEvent.click(screen.getByRole('button', { name: /Envoyer le signal/i }));

    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    const input = publish.mock.calls[0][0] as CaptureSignalInput;
    expect(input.kind).toBe('photo');
    expect(input.text).toBe('Col de l’Eychauda');
    expect(input.file?.name).toBe('col.jpg');
    await waitFor(() => expect(onPublished).toHaveBeenCalledWith({ carnetId: 'c-42', day: 3 }));
    expect((await screen.findByRole('status')).textContent).toContain('Signal envoyé · J3');
  });

  it('publie une note texte en deux gestes', async () => {
    const publish = vi.fn(async (_input: CaptureSignalInput) => ({
      ok: true,
      carnetId: 'c-7',
      day: 2,
    }));
    render(<CaptureSheet isOpen onClose={() => undefined} publish={publish} />);

    fireEvent.click(screen.getByRole('button', { name: /Écrire une note terrain/i }));
    const textarea = await screen.findByLabelText('Ligne du signal');
    fireEvent.change(textarea, { target: { value: 'Le vent tourne.' } });
    fireEvent.click(screen.getByRole('button', { name: /Envoyer le signal/i }));

    await waitFor(() => expect(publish).toHaveBeenCalledWith({ kind: 'note', text: 'Le vent tourne.' }));
  });

  it('affiche l’erreur de la route sans fermer la feuille', async () => {
    const publish = vi.fn(async () => ({ ok: false, error: 'Connexion requise.' }));
    const onPublished = vi.fn();
    render(
      <CaptureSheet isOpen onClose={() => undefined} publish={publish} onPublished={onPublished} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Écrire une note terrain/i }));
    fireEvent.change(await screen.findByLabelText('Ligne du signal'), {
      target: { value: 'Ligne' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Envoyer le signal/i }));
    expect((await screen.findByRole('alert')).textContent).toContain('Connexion requise.');
    expect(onPublished).not.toHaveBeenCalled();
  });

  it('sans publish, conserve le comportement historique (capture locale)', async () => {
    const onCaptureAction = vi.fn();
    const { container } = render(
      <CaptureSheet isOpen onClose={() => undefined} onCaptureAction={onCaptureAction} />
    );
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [jpeg()] } });
    fireEvent.click(screen.getByRole('button', { name: /Envoyer le signal/i }));
    expect(onCaptureAction).toHaveBeenCalledTimes(1);
    expect(onCaptureAction.mock.calls[0][0]).toMatchObject({ type: 'PHOTO' });
  });
});
