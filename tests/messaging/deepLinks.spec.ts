import { describe, it, expect, vi } from 'vitest';

// Aucun réseau dans ce fichier : `resolveHandleToUserId` (seule fonction qui
// parle à Supabase) n'est pas testée ici, mais son import ne doit rien ouvrir.
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));

import {
  parseMessageDeepLink,
  normaliseHandle,
  UUID_RE,
} from '@/features/messaging/lib/deepLinks';

// UUID v1 réel (version 1, variante a) : accepté par le parseur.
const DEST = '123e4567-e89b-12d3-a456-426614174000';
// UUID v4 (version 4, variante a) : accepté aussi.
const CONV = 'a3bb189e-8bf9-4888-bb2d-4d3e6a9b0c11';

describe('parseMessageDeepLink', () => {
  it('?dest=<uuid> remplit recipientId, sans conversation ni handle', () => {
    expect(parseMessageDeepLink(`?dest=${DEST}`)).toEqual({
      conversationId: null,
      recipientId: DEST,
      handle: null,
    });
  });

  it('?conversation=<uuid> remplit conversationId, sans destinataire', () => {
    expect(parseMessageDeepLink(`?conversation=${CONV}`)).toEqual({
      conversationId: CONV,
      recipientId: null,
      handle: null,
    });
  });

  it('?to=@Lea.Fontaine normalise le handle en minuscules sans arobase', () => {
    expect(parseMessageDeepLink('?to=@Lea.Fontaine')).toEqual({
      conversationId: null,
      recipientId: null,
      handle: 'lea.fontaine',
    });
  });

  it('ignore un dest qui n’est pas un UUID : aucune requête sur une entrée invalide', () => {
    expect(parseMessageDeepLink('?dest=abc')).toEqual({
      conversationId: null,
      recipientId: null,
      handle: null,
    });
    expect(parseMessageDeepLink('?dest=')).toEqual({
      conversationId: null,
      recipientId: null,
      handle: null,
    });
  });

  it('?conversation= : accepte un UUID valide, rejette les versions et variantes hors contrat', () => {
    expect(parseMessageDeepLink(`?conversation=${CONV}`).conversationId).toBe(CONV);

    const rejected = [
      '123e4567-e89b-12d3-a456-42661417400', // 35 caractères (tronqué)
      '123e4567-e89b-92d3-a456-426614174000', // version 9
      '00000000-0000-0000-0000-000000000000', // nil UUID (version 0)
      '123e4567-e89b-12d3-c456-426614174000', // variante c
      'not-a-uuid',
    ];
    for (const value of rejected) {
      expect(parseMessageDeepLink(`?conversation=${value}`).conversationId, value).toBeNull();
    }
  });

  it('?conversation= : le parseur accepte les versions 1 à 8 (v3 et v5 incluses)', () => {
    // Écart documenté : `UUID_RE` couvre les versions 1–8, pas seulement la v4.
    const v3 = '123e4567-e89b-32d3-a456-426614174000';
    const v5 = '123e4567-e89b-52d3-a456-426614174000';
    expect(UUID_RE.test(v3)).toBe(true);
    expect(UUID_RE.test(v5)).toBe(true);
    expect(parseMessageDeepLink(`?conversation=${v3}`).conversationId).toBe(v3);
    expect(parseMessageDeepLink(`?conversation=${v5}`).conversationId).toBe(v5);
  });

  it('accepte une query string sans « ? » initial', () => {
    expect(parseMessageDeepLink(`dest=${DEST}`).recipientId).toBe(DEST);
  });

  it('vide : tout nul, aucune exception', () => {
    expect(() => parseMessageDeepLink('')).not.toThrow();
    expect(parseMessageDeepLink('')).toEqual({
      conversationId: null,
      recipientId: null,
      handle: null,
    });
  });

  it('?to= ET ?dest= : dest gagne pour le destinataire, le handle reste parsé', () => {
    const link = parseMessageDeepLink(`?to=@Lea.Fontaine&dest=${DEST}`);
    expect(link.recipientId).toBe(DEST);
    expect(link.handle).toBe('lea.fontaine');
    // Un dest invalide ne masque pas le handle : le repli `?to=` reste possible.
    const fallback = parseMessageDeepLink('?to=@Lea.Fontaine&dest=abc');
    expect(fallback.recipientId).toBeNull();
    expect(fallback.handle).toBe('lea.fontaine');
  });
});

describe('normaliseHandle', () => {
  it('refuse les accents', () => {
    expect(normaliseHandle('@Léa')).toBeNull();
  });

  it('garde un handle simple', () => {
    expect(normaliseHandle('lea')).toBe('lea');
  });

  it('retire les espaces et l’arobase, passe en minuscules', () => {
    expect(normaliseHandle('  @LEA.F ')).toBe('lea.f');
  });

  it('refuse le vide et les handles trop courts (moins de 2 caractères)', () => {
    expect(normaliseHandle('')).toBeNull();
    expect(normaliseHandle('a')).toBeNull();
    expect(normaliseHandle('@')).toBeNull();
  });

  it('refuse les caractères hors contrat', () => {
    expect(normaliseHandle('@lea!')).toBeNull();
    expect(normaliseHandle('lea fontaine')).toBeNull();
  });
});
