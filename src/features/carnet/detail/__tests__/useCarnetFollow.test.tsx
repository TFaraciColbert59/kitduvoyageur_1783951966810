// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

/** État configurable du faux client Supabase (aucune requête réseau). */
const db: {
  row: { notify_mode?: string | null } | null;
  loadError: { code?: string; message?: string } | null;
  writeError: { code?: string; message?: string } | null;
  calls: Array<[string, Record<string, unknown>?]>;
} = { row: null, loadError: null, writeError: null, calls: [] };

vi.mock('@/lib/supabase/client', () => {
  const readBuilder: Record<string, unknown> = {};
  readBuilder.select = () => readBuilder;
  readBuilder.eq = () => readBuilder;
  readBuilder.maybeSingle = async () => ({ data: db.row, error: db.loadError });
  const writeChain = () => {
    const b: Record<string, unknown> = {};
    b.eq = () => b;
    b.then = (resolve: (value: { error: unknown }) => unknown) =>
      resolve({ error: db.writeError });
    return b;
  };
  const from = () => ({
    select: () => readBuilder,
    insert: async (payload: Record<string, unknown>) => {
      db.calls.push(['insert', payload]);
      return { error: db.writeError };
    },
    update: (payload: Record<string, unknown>) => {
      db.calls.push(['update', payload]);
      const b: Record<string, unknown> = {};
      b.eq = () => b;
      b.then = (resolve: (value: { error: unknown }) => unknown) =>
        resolve({ error: db.writeError });
      return b;
    },
    delete: () => {
      db.calls.push(['delete']);
      return writeChain();
    },
  });
  return { createClient: () => ({ from }) };
});

import { useCarnetFollow } from '../useCarnetFollow';

const CARNET = 'carnet-1';
const USER = 'user-visiteur';

beforeEach(() => {
  db.row = null;
  db.loadError = null;
  db.writeError = null;
  db.calls = [];
  window.localStorage.clear();
});

describe('useCarnetFollow — suivi du carnet + fréquence (propositions 20/41)', () => {
  it('lit le suivi et la fréquence du compte quand ils existent', async () => {
    db.row = { notify_mode: 'highlights' };
    const { result } = renderHook(() =>
      useCarnetFollow({ carnetId: CARNET, userId: USER })
    );
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.following).toBe(true);
    expect(result.current.notifyMode).toBe('highlights');
    expect(result.current.persisted).toBe(true);
  });

  it('sans ligne en base : pas de suivi, valeur locale par défaut', async () => {
    const { result } = renderHook(() =>
      useCarnetFollow({ carnetId: CARNET, userId: USER })
    );
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.following).toBe(false);
    expect(result.current.notifyMode).toBe('digest');
    expect(result.current.persisted).toBe(false);
  });

  it('table absente (PGRST205) : repli local sans casser l’écran', async () => {
    db.loadError = { code: 'PGRST205', message: 'table not found' };
    const { result } = renderHook(() =>
      useCarnetFollow({ carnetId: CARNET, userId: USER })
    );
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.persisted).toBe(false);
  });

  it('suit un carnet : insert carnet_follows avec la fréquence locale', async () => {
    window.localStorage.setItem(`lkdv:carnet:${CARNET}:notif-pref`, '2');
    const { result } = renderHook(() =>
      useCarnetFollow({ carnetId: CARNET, userId: USER })
    );
    await waitFor(() => expect(result.current.state).toBe('ready'));
    await act(async () => {
      await result.current.toggle();
    });
    expect(result.current.following).toBe(true);
    expect(result.current.persisted).toBe(true);
    expect(db.calls).toContainEqual([
      'insert',
      { carnet_id: CARNET, user_id: USER, notify_mode: 'highlights' },
    ]);
  });

  it('ne plus suivre : delete carnet_follows', async () => {
    db.row = { notify_mode: 'digest' };
    const { result } = renderHook(() =>
      useCarnetFollow({ carnetId: CARNET, userId: USER })
    );
    await waitFor(() => expect(result.current.following).toBe(true));
    await act(async () => {
      await result.current.toggle();
    });
    expect(result.current.following).toBe(false);
    expect(db.calls.some(([kind]) => kind === 'delete')).toBe(true);
  });

  it('change la fréquence d’un suivi existant : update ciblé', async () => {
    db.row = { notify_mode: 'digest' };
    const { result } = renderHook(() =>
      useCarnetFollow({ carnetId: CARNET, userId: USER })
    );
    await waitFor(() => expect(result.current.persisted).toBe(true));
    await act(async () => {
      await result.current.setNotifyMode('moment');
    });
    expect(result.current.notifyMode).toBe('moment');
    const update = db.calls.find(([kind]) => kind === 'update');
    expect(update?.[1]).toMatchObject({ notify_mode: 'moment' });
  });

  it('choisir une fréquence sans suivre encore : un seul geste, insert', async () => {
    const { result } = renderHook(() =>
      useCarnetFollow({ carnetId: CARNET, userId: USER })
    );
    await waitFor(() => expect(result.current.state).toBe('ready'));
    await act(async () => {
      await result.current.setNotifyMode('moment');
    });
    expect(result.current.following).toBe(true);
    expect(db.calls).toContainEqual([
      'insert',
      { carnet_id: CARNET, user_id: USER, notify_mode: 'moment' },
    ]);
  });

  it('une erreur d’écriture retombe en local, jamais un faux état serveur', async () => {
    db.writeError = { code: '42501', message: 'refusé' };
    const { result } = renderHook(() =>
      useCarnetFollow({ carnetId: CARNET, userId: USER })
    );
    await waitFor(() => expect(result.current.state).toBe('ready'));
    await act(async () => {
      await result.current.toggle();
    });
    expect(result.current.persisted).toBe(false);
    expect(result.current.following).toBe(true);
    expect(window.localStorage.getItem(`lkdv:carnet:${CARNET}:following`)).toBe('1');
  });

  it('un participant ne suit pas son propre carnet et n’appelle pas le réseau', async () => {
    window.localStorage.setItem(`lkdv:carnet:${CARNET}:following`, '1');
    const { result } = renderHook(() =>
      useCarnetFollow({ carnetId: CARNET, userId: USER, isParticipant: true })
    );
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.following).toBe(false);
    await act(async () => {
      await result.current.toggle();
    });
    expect(db.calls).toHaveLength(0);
  });

  it('invité : lit la préférence locale, aucun appel réseau', async () => {
    window.localStorage.setItem(`lkdv:carnet:${CARNET}:notif-pref`, '0');
    const { result } = renderHook(() =>
      useCarnetFollow({ carnetId: CARNET, userId: null })
    );
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.notifyMode).toBe('moment');
    expect(db.calls).toHaveLength(0);
  });
});
