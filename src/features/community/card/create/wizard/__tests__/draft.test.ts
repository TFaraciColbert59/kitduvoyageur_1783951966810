// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { clearDraft, draftKey, hasContent, readDraft, writeDraft } from '../draft';
import { clampStep } from '../useWizard';
import { firstIssue, todayIso } from '../validate';
import { z } from 'zod';

beforeEach(() => window.localStorage.clear());

describe('brouillons de création', () => {
  it('clé propre à l’utilisateur, nulle sans utilisateur', () => {
    expect(draftKey('post', 'u1')).toBe('lkdv:draft:community:post:u1');
    expect(draftKey('post', null)).toBeNull();
    expect(draftKey('post', undefined)).toBeNull();
  });

  it('écrit puis relit une saisie', () => {
    const key = draftKey('carnet', 'u1');
    writeDraft(key, { title: 'Vercors', destination: '' });
    expect(readDraft<{ title: string }>(key)?.title).toBe('Vercors');
  });

  it('efface un brouillon', () => {
    const key = draftKey('kit', 'u1');
    writeDraft(key, { name: 'Sac 3 jours' });
    clearDraft(key);
    expect(readDraft(key)).toBeNull();
  });

  it('expire au-delà de 7 jours et supprime l’entrée', () => {
    const key = draftKey('club', 'u1');
    const start = 1_700_000_000_000;
    writeDraft(key, { name: 'Cordée' }, start);
    expect(readDraft(key, start + 6 * 24 * 3600 * 1000)).not.toBeNull();
    expect(readDraft(key, start + 8 * 24 * 3600 * 1000)).toBeNull();
    expect(window.localStorage.getItem(key as string)).toBeNull();
  });

  it('ignore un contenu corrompu au lieu de lever', () => {
    const key = draftKey('post', 'u1') as string;
    window.localStorage.setItem(key, '{pas du json');
    expect(readDraft(key)).toBeNull();
  });

  it('ne compte comme saisie que du texte non vide', () => {
    expect(hasContent({ a: '', b: '   ', n: 3 })).toBe(false);
    expect(hasContent({ a: '', b: 'x' })).toBe(true);
  });
});

describe('étapes et validation', () => {
  it('borne la position dans [0, total - 1]', () => {
    expect(clampStep(-3, 3)).toBe(0);
    expect(clampStep(1, 3)).toBe(1);
    expect(clampStep(9, 3)).toBe(2);
    expect(clampStep(4, 0)).toBe(0);
  });

  it('renvoie le premier message zod ou null', () => {
    const schema = z.object({ title: z.string().trim().min(1, 'Le titre est requis.') });
    expect(firstIssue(schema, { title: '  ' })).toBe('Le titre est requis.');
    expect(firstIssue(schema, { title: 'Lac Blanc' })).toBeNull();
  });

  it('formate la date locale du jour en YYYY-MM-DD', () => {
    expect(todayIso(new Date(2026, 9, 28, 23, 30))).toBe('2026-10-28');
  });
});
