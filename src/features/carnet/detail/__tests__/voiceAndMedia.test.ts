import { describe, expect, it } from 'vitest';
import { bucketFor, extensionOf, mediaPlan } from '../useCarnetEdits';
import { formatClock, pickRecorderMime } from '../useVoiceRecorder';
import { momentInsertRow, validateMomentInput } from '../createMoment';
import { parseMomentMeta } from '../momentTypes';

const file = (type: string, size = 10) => new File([new Uint8Array(size)], 'f', { type });

describe('plan de téléversement', () => {
  it('range les images dans carnet-media, la voix et la vidéo dans leur seau', () => {
    expect(bucketFor('photo')).toBe('carnet-media');
    expect(bucketFor('voice')).toBe('carnet-moments-media');
    expect(bucketFor('video')).toBe('carnet-moments-media');
  });

  it('exige un enregistrement pour une note vocale et un type cohérent', () => {
    expect(mediaPlan('voice', null)).toEqual({ ok: false, error: 'Enregistre ta note vocale.' });
    expect(mediaPlan('voice', file('image/png'))).toMatchObject({ ok: false, error: 'Enregistrement invalide.' });
    expect(mediaPlan('voice', file('audio/webm')).ok).toBe(true);
    expect(mediaPlan('photo', file('video/mp4'))).toMatchObject({ ok: false, error: 'Choisis une image.' });
  });

  it('plafonne les images à 10 Mo (seau durci) et le reste à 25 Mo', () => {
    const big = (type: string, mb: number) => {
      const f = file(type, 1);
      Object.defineProperty(f, 'size', { value: mb * 1024 * 1024 + 1 });
      return f;
    };
    expect(mediaPlan('photo', big('image/jpeg', 10))).toEqual({ ok: false, error: 'Le fichier dépasse 10 Mo.' });
    expect(mediaPlan('video', big('video/mp4', 20)).ok).toBe(true);
    expect(mediaPlan('video', big('video/mp4', 25))).toEqual({ ok: false, error: 'Le fichier dépasse 25 Mo.' });
  });

  it('choisit une extension acceptée par la politique de stockage', () => {
    expect(extensionOf('voice', 'audio/webm;codecs=opus')).toBe('webm');
    expect(extensionOf('voice', 'audio/mp4')).toBe('m4a');
    expect(extensionOf('voice', 'audio/ogg')).toBe('ogg');
    expect(extensionOf('video', 'video/quicktime')).toBe('mov');
    expect(extensionOf('photo', 'image/png')).toBe('png');
  });
});

describe('enregistreur vocal (fonctions pures)', () => {
  it('formate la durée comme les moments (0:42)', () => {
    expect(formatClock(42)).toBe('0:42');
    expect(formatClock(125.4)).toBe('2:05');
    expect(formatClock(-3)).toBe('0:00');
  });

  it('prend le premier format supporté, Safari compris', () => {
    expect(pickRecorderMime((m) => m === 'audio/mp4')).toBe('audio/mp4');
    expect(pickRecorderMime(() => true)).toBe('audio/webm;codecs=opus');
    expect(pickRecorderMime(() => false)).toBeNull();
  });
});

describe('moment vocal', () => {
  it('garde l’URL https de l’enregistrement dans moment_meta, refuse le reste', () => {
    const ok = validateMomentInput({
      type: 'voice',
      day: 1,
      place: 'Col',
      caption: 'On est au col.',
      durationLabel: '0:38',
      audioUrl: 'https://x.supabase.co/storage/v1/object/public/carnet-moments-media/u/a.webm',
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      const row = momentInsertRow(ok.value, {
        carnetId: 'c',
        userId: 'u',
        authorName: 'A',
        imageUrl: null,
        now: new Date('2026-07-14T09:45:00'),
      });
      expect(row.moment_meta).toEqual({
        durationLabel: '0:38',
        audioUrl: 'https://x.supabase.co/storage/v1/object/public/carnet-moments-media/u/a.webm',
      });
      expect(row.image_url).toBeNull();
    }
    expect(
      validateMomentInput({ type: 'voice', day: 1, place: 'Col', caption: 'x', audioUrl: 'javascript:alert(1)' }).ok
    ).toBe(false);
    expect(parseMomentMeta({ audioUrl: 'http://insecure/a.webm' })).toBeNull();
    expect(parseMomentMeta({ audioUrl: 'https://ok/a.webm' })).toEqual({ audioUrl: 'https://ok/a.webm' });
  });
});
