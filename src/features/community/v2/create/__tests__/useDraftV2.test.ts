// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CREATE_DRAFT_V2_PREFIX,
  clearDraftV2,
  draftHasContentV2,
  draftStorageKey,
  flushDraftV2,
  hasDraftContentV2,
  readDraftV2,
  rememberLiveDraftV2,
  sanitizeDraftValuesV2,
  writeDraftV2,
} from '../engine/useDraftV2';
import { createDefaultsV2 } from '../engine/createSchemasV2';

const uploadMedia = {
  id: 'm1',
  name: 'lac.jpg',
  type: 'image/jpeg',
  size: 100,
  previewUrl: '',
  url: 'https://example.test/lac.jpg',
  alt: '',
  cover: true,
  status: 'uploaded' as const,
  progress: 100,
  storageBucket: 'carnet-media',
  storagePath: 'u/lac.jpg',
  crop: 'original' as const,
};

beforeEach(() => {
  window.localStorage.clear();
});

describe('brouillons V2', () => {
  it('écrit, relit et purge un brouillon par type', () => {
    expect(writeDraftV2('post', { ...createDefaultsV2('post'), content: 'Brouillon' })).toBe(true);
    const record = readDraftV2('post');
    expect(record?.kind).toBe('post');
    expect((record?.values as { content: string }).content).toBe('Brouillon');
    // Un autre type n'est pas touché.
    expect(readDraftV2('story')).toBeNull();
    clearDraftV2('post');
    expect(readDraftV2('post')).toBeNull();
    expect(window.localStorage.getItem(draftStorageKey('post'))).toBeNull();
  });

  it('utilise une clé versionnée préfixée', () => {
    expect(draftStorageKey('carnet')).toBe(`${CREATE_DRAFT_V2_PREFIX}:carnet:v1`);
  });

  it('ne sérialise jamais un File ni un aperçu blob:', () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const sanitized = sanitizeDraftValuesV2({
      ...createDefaultsV2('post'),
      media: [{ ...uploadMedia, file, previewUrl: 'blob:http://localhost/123' }],
    });
    const media = (sanitized as { media: Array<Record<string, unknown>> }).media;
    expect(media).toHaveLength(1);
    expect(media[0].file).toBeUndefined();
    expect(media[0].previewUrl).toBe('');
    expect(media[0].url).toBe('https://example.test/lac.jpg');
  });

  it('écarte un média jamais envoyé (URL vide) et un brouillon vide', () => {
    const values = {
      ...createDefaultsV2('post'),
      media: [{ ...uploadMedia, url: '', status: 'uploading' as const }],
    };
    const sanitized = sanitizeDraftValuesV2(values) as { media: unknown[] };
    expect(sanitized.media).toHaveLength(0);
    expect(writeDraftV2('post', createDefaultsV2('post'))).toBe(true);
    expect(readDraftV2('post')).toBeNull();
    expect(draftHasContentV2('post', createDefaultsV2('post'))).toBe(false);
  });

  it('conserve un clientRequestId stable (envoi rejoué idempotent)', () => {
    const values = { ...createDefaultsV2('sortie'), title: 'Lac Blanc' };
    writeDraftV2('sortie', values);
    const record = readDraftV2('sortie');
    expect((record?.values as { clientRequestId: string }).clientRequestId).toBe(values.clientRequestId);
  });

  it('hasDraftContentV2 lit le brouillon en mémoire avant la fin du debounce', () => {
    expect(hasDraftContentV2('club')).toBe(false);
    rememberLiveDraftV2('club', { ...createDefaultsV2('club'), name: 'La Cordée' });
    expect(hasDraftContentV2('club')).toBe(true);
    flushDraftV2('club');
    expect(readDraftV2('club')).not.toBeNull();
  });
});
