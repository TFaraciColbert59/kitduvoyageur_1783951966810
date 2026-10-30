// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateFormEngine } from '@/features/community/create/engine/CreateFormEngine';
import { CreateDrawer } from '@/features/community/create/CreateDrawer';
import {
  CREATE_DRAFT_DEBOUNCE_MS,
  clearCreateDraft,
  createDraftStorageKey,
  forgetLiveCreateDraft,
  hasCreateDraftContent,
  readCreateDraft,
  sanitizeCreateDraftValues,
  writeCreateDraft,
} from '@/features/community/create/engine/useCreateDraft';
import {
  createDefaults,
  type KitFormValues,
} from '@/features/community/create/engine/createSchemas';
import type { MediaItem } from '@/features/community/create/shared/mediaTypes';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));

beforeEach(() => {
  window.localStorage.clear();
  for (const kind of ['post', 'story', 'carnet', 'sortie', 'kit', 'club'] as const) {
    clearCreateDraft(kind);
    forgetLiveCreateDraft(kind);
  }
});

afterEach(cleanup);

function uploadedMedia(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: 'm1',
    name: 'photo.jpg',
    type: 'image/jpeg',
    size: 1200,
    previewUrl: 'blob:photo',
    url: 'https://cdn.test/photo.jpg',
    alt: 'Un lac',
    cover: true,
    status: 'uploaded',
    progress: 100,
    storageBucket: 'stories-private',
    storagePath: 'user/story/photo.jpg',
    ...overrides,
  };
}

function localMedia(): MediaItem {
  return uploadedMedia({
    id: 'm2',
    name: 'local.jpg',
    previewUrl: 'blob:local',
    url: null,
    status: 'local',
    storagePath: '',
    file: new File(['local'], 'local.jpg', { type: 'image/jpeg' }),
  });
}

describe('brouillon local — stockage versionné', () => {
  it('écrit et relit un brouillon avec sa version et sa clé', () => {
    writeCreateDraft('kit', 'kit', { ...createDefaults('kit'), name: 'Kit bivouac' }, 1234);

    expect(createDraftStorageKey('kit')).toBe('lkdv.create-draft:kit:v1');
    const record = readCreateDraft<KitFormValues>('kit');
    expect(record?.draftKey).toBe('kit');
    expect(record?.version).toBe(1);
    expect(record?.updatedAt).toBe(1234);
    expect(record?.values.name).toBe('Kit bivouac');
  });

  it('ignore une version inconnue et les valeurs par défaut', () => {
    window.localStorage.setItem(
      createDraftStorageKey('kit'),
      JSON.stringify({ version: 0, draftKey: 'kit', updatedAt: 1, values: { name: 'Vieux' } }),
    );
    expect(readCreateDraft('kit')).toBeNull();

    writeCreateDraft('club', 'club', createDefaults('club'));
    expect(readCreateDraft('club')).toBeNull();
    expect(window.localStorage.getItem(createDraftStorageKey('club'))).toBeNull();
  });

  it('retire le fichier, l’aperçu blob et les médias jamais envoyés', () => {
    const values = sanitizeCreateDraftValues({
      ...createDefaults('story'),
      caption: 'Un moment',
      media: [uploadedMedia(), localMedia()],
    });

    expect(values.media).toHaveLength(1);
    expect(values.media[0]?.file).toBeUndefined();
    expect(values.media[0]?.previewUrl).toBe('');
    expect(values.media[0]?.storagePath).toBe('user/story/photo.jpg');
    expect(values.media[0]?.status).toBe('uploaded');
  });

  it('considère un contenu restauré comme non vide, même avant la sauvegarde débattue', () => {
    writeCreateDraft('kit', 'kit', { ...createDefaults('kit'), name: 'Bivouac' });

    expect(hasCreateDraftContent('kit', 'kit')).toBe(true);
    expect(hasCreateDraftContent('club', 'club')).toBe(false);
  });
});

function DraftHarness({
  onSubmit = async () => {},
  draftDebounceMs = 10,
}: {
  onSubmit?: (values: KitFormValues) => Promise<void>;
  draftDebounceMs?: number;
}) {
  return (
    <CreateFormEngine<KitFormValues>
      kind="kit"
      draftKey="kit"
      draftDebounceMs={draftDebounceMs}
      defaultValues={createDefaults('kit')}
      onSubmit={onSubmit}
      resetOnSuccess
    >
      {(form, api) => (
        <>
          <label htmlFor="kit-name">Nom</label>
          <input id="kit-name" {...form.register('name')} />
          <button type="button" onClick={api.submit}>
            Créer le kit
          </button>
        </>
      )}
    </CreateFormEngine>
  );
}

describe('brouillon local — moteur', () => {
  it('restaure le brouillon au montage sans le remplacer par les valeurs par défaut', async () => {
    writeCreateDraft('kit', 'kit', { ...createDefaults('kit'), name: 'Brouillon restauré' });
    const view = render(<DraftHarness />);

    const input = (await screen.findByLabelText('Nom')) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('Brouillon restauré'));

    // Laisse passer le debounce : les defaults ne doivent pas écraser le brouillon.
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(readCreateDraft<KitFormValues>('kit')?.values.name).toBe('Brouillon restauré');

    view.unmount();
    render(<DraftHarness />);
    expect(((await screen.findByLabelText('Nom')) as HTMLInputElement).value).toBe(
      'Brouillon restauré',
    );
  });

  it('sauvegarde la saisie en debounce, sans attendre la fermeture', async () => {
    render(<DraftHarness />);
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Kit léger' } });

    await waitFor(
      () => expect(readCreateDraft<KitFormValues>('kit')?.values.name).toBe('Kit léger'),
      { timeout: CREATE_DRAFT_DEBOUNCE_MS + 1000 },
    );
  });

  it('efface le brouillon après une soumission réussie', async () => {
    const onSubmit = vi.fn(async () => {});
    writeCreateDraft('kit', 'kit', {
      ...createDefaults('kit'),
      name: 'Kit validé',
      weightG: 900,
    });

    render(<DraftHarness onSubmit={onSubmit} />);
    await waitFor(() =>
      expect((screen.getByLabelText('Nom') as HTMLInputElement).value).toBe('Kit validé'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Créer le kit' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(readCreateDraft('kit')).toBeNull());
    expect(window.localStorage.getItem(createDraftStorageKey('kit'))).toBeNull();
  });

  it('conserve le brouillon quand la soumission échoue', async () => {
    const onSubmit = vi.fn(async () => {
      throw new Error('Serveur indisponible');
    });
    writeCreateDraft('kit', 'kit', {
      ...createDefaults('kit'),
      name: 'Kit en échec',
      weightG: 900,
    });

    render(<DraftHarness onSubmit={onSubmit} />);
    await waitFor(() =>
      expect((screen.getByLabelText('Nom') as HTMLInputElement).value).toBe('Kit en échec'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Créer le kit' }));

    expect(await screen.findByText('Serveur indisponible')).toBeTruthy();
    expect(readCreateDraft<KitFormValues>('kit')?.values.name).toBe('Kit en échec');
  });
});

describe('reprise après fermeture', () => {
  it('demande confirmation si le contenu est non vide et conserve le brouillon', async () => {
    const onClose = vi.fn();
    render(
      <CreateDrawer
        open
        onClose={onClose}
        user={{ id: 'user-kit' }}
        onCreated={() => {}}
        initialKind="kit"
      />,
    );

    const input = (await screen.findByLabelText('Nom')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Mon kit en cours' } });
    await waitFor(() => expect(hasCreateDraftContent('kit', 'kit')).toBe(true));

    const backdrop = document.querySelector<HTMLElement>('.lkdv-drawer-backdrop');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop as HTMLElement);

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('Fermer sans publier ?');
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Continuer l’édition' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(backdrop as HTMLElement);
    fireEvent.click(await screen.findByRole('button', { name: 'Fermer' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(readCreateDraft<KitFormValues>('kit')?.values.name).toBe('Mon kit en cours');
  });

  it('ferme sans confirmation quand le formulaire est vide', async () => {
    const onClose = vi.fn();
    render(
      <CreateDrawer
        open
        onClose={onClose}
        user={{ id: 'user-kit' }}
        onCreated={() => {}}
        initialKind="kit"
      />,
    );

    await screen.findByLabelText('Nom');
    fireEvent.click(document.querySelector<HTMLElement>('.lkdv-drawer-backdrop') as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
