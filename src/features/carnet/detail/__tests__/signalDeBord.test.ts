// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SIGNAL_TEXT_MAX,
  publishSignal,
  signalDayNumber,
  validateSignalFile,
} from '../signalDeBord';

afterEach(() => {
  vi.restoreAllMocks();
});

function fileLike(type: string, size: number, name = 'fichier'): File {
  return new File([new Uint8Array(Math.min(size, 8))], name, { type });
}

describe('signalDayNumber — jour courant du carnet (Europe/Paris, borné)', () => {
  it('sans date de départ : jour 1 (jamais un jour inventé)', () => {
    expect(signalDayNumber(null, new Date('2026-07-14T10:00:00+02:00'))).toBe(1);
    expect(signalDayNumber(undefined, new Date('2026-07-14T10:00:00+02:00'))).toBe(1);
  });

  it('calcule le jour civil depuis la date de départ', () => {
    expect(signalDayNumber('2026-07-13', new Date('2026-07-13T23:30:00+02:00'))).toBe(1);
    expect(signalDayNumber('2026-07-13', new Date('2026-07-14T00:10:00+02:00'))).toBe(2);
    expect(signalDayNumber('2026-07-13', new Date('2026-07-16T12:00:00+02:00'))).toBe(4);
  });

  it('borne à 1..366 (date de départ dans le futur ou très ancienne)', () => {
    expect(signalDayNumber('2026-07-20', new Date('2026-07-13T12:00:00+02:00'))).toBe(1);
    expect(signalDayNumber('2020-01-01', new Date('2026-07-13T12:00:00+02:00'))).toBe(366);
  });
});

describe('validateSignalFile — MIME et plafond avant envoi', () => {
  it('accepte une photo JPEG sous la limite', () => {
    expect(validateSignalFile('photo', fileLike('image/jpeg', 4096))).toEqual({ ok: true });
  });
  it('refuse un format non pris en charge', () => {
    const result = validateSignalFile('photo', fileLike('application/pdf', 4096));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Format photo/);
  });
  it('refuse une vidéo trop lourde', () => {
    const result = validateSignalFile('video', {
      type: 'video/mp4',
      size: 26 * 1024 * 1024,
      name: 'v.mp4',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/trop lourd/);
  });
  it('refuse un fichier absent ou vide', () => {
    expect(validateSignalFile('photo', null).ok).toBe(false);
    expect(validateSignalFile('photo', { type: 'image/jpeg', size: 0, name: 'vide.jpg' }).ok).toBe(false);
  });
});

describe('publishSignal — envoi vers /api/carnets/signal', () => {
  const okResponse = {
    ok: true,
    status: 200,
    json: async () => ({ ok: true, carnetId: 'c-1', day: 4, momentId: 'm-1' }),
  } as unknown as Response;

  it('poste un FormData same-origin et rend le carnet/jour publiés', async () => {
    const fetchImpl = vi.fn(async () => okResponse);
    const result = await publishSignal(
      {
        kind: 'photo',
        text: '  Col de l’Eychauda  ',
        place: 'Col',
        tripId: '11111111-1111-4111-8111-111111111111',
        file: fileLike('image/jpeg', 2048, 'col.jpg'),
      },
      { fetchImpl: fetchImpl as unknown as typeof fetch }
    );
    expect(result).toEqual({ ok: true, carnetId: 'c-1', day: 4, momentId: 'm-1' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/carnets/signal');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).credentials).toBe('same-origin');
    const body = (init as RequestInit).body as FormData;
    expect(body.get('kind')).toBe('photo');
    expect(body.get('text')).toBe('Col de l’Eychauda');
    expect(body.get('tripId')).toBe('11111111-1111-4111-8111-111111111111');
    expect(body.get('file')).toBeInstanceOf(File);
  });

  it('refuse une note vide avant tout appel réseau', async () => {
    const fetchImpl = vi.fn();
    const result = await publishSignal(
      { kind: 'note', text: '   ' },
      { fetchImpl: fetchImpl as unknown as typeof fetch }
    );
    expect(result.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuse une ligne trop longue avant tout appel réseau', async () => {
    const fetchImpl = vi.fn();
    const result = await publishSignal(
      { kind: 'note', text: 'x'.repeat(SIGNAL_TEXT_MAX + 1) },
      { fetchImpl: fetchImpl as unknown as typeof fetch }
    );
    expect(result.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('ne transmet ni carnetId ni tripId qui ne sont pas des UUID', async () => {
    const fetchImpl = vi.fn(async () => okResponse);
    await publishSignal(
      {
        kind: 'note',
        text: 'Ligne',
        carnetId: 'pas-un-uuid',
        tripId: '../../etc/passwd',
      },
      { fetchImpl: fetchImpl as unknown as typeof fetch }
    );
    const body = (fetchImpl.mock.calls[0][1] as RequestInit).body as FormData;
    expect(body.get('carnetId')).toBeNull();
    expect(body.get('tripId')).toBeNull();
  });

  it('rend une erreur lisible quand la route refuse', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ ok: false, error: 'Connexion requise.' }),
    })) as unknown as typeof fetch;
    const result = await publishSignal({ kind: 'note', text: 'Ligne' }, { fetchImpl });
    expect(result).toEqual({ ok: false, error: 'Connexion requise.' });
  });

  it('rend une erreur lisible quand le réseau tombe', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    const result = await publishSignal({ kind: 'note', text: 'Ligne' }, { fetchImpl });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Connexion impossible/);
  });
});
