import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { liveFieldIssue } from '../engine/errors';
import { nextTabIndex, swipeDirection } from '../carnet/daySwipe';
import { isMissingTableError, probeCarnetNights } from '../carnet/capabilities';
import {
  audioPreserved,
  decideVideoCompression,
  keepCompressedVideo,
  pickVideoOutputMime,
  compressVideoV2,
  VIDEO_COMPRESS_MIN_BYTES,
} from '../fields/videoCompress';
import {
  formatFiguresFr,
  importedFiguresV2,
  mapCarnetSources,
  mapSessionSources,
} from '../sortie/itinerarySourcesV2';
import {
  formatKitItemWeightV2,
  formatKitWeightV2,
  isItemBorrowedV2,
  kitWeatherSuggestionsV2,
  mergeKitSuggestionsV2,
  readStoredUnitsV2,
  summarizeBorrowedLoansV2,
  fetchKitWeatherV2,
} from '../kit/kitContextV2';
import { kitSuggestionsV2 } from '../kit/kitTemplatesV2';
import { storySchemaV2, createDefaultsV2, buildKitItemFixture } from './finitionFixtures';

describe('Story#17 — validation en direct d’un seul champ', () => {
  const values = (url: string) => ({
    ...createDefaultsV2('story'),
    stickers: { ...createDefaultsV2('story').stickers, link: { url, label: '' } },
  });

  it('signale un lien invalide dès qu’il est non vide, avec son chemin complet', () => {
    const outcome = liveFieldIssue(storySchemaV2, values('pas un lien'), 'stickers.link.url');
    expect(outcome.kind).toBe('invalid');
  });

  it('accepte un lien http(s) valide', () => {
    expect(liveFieldIssue(storySchemaV2, values('https://exemple.fr/carnet'), 'stickers.link.url').kind).toBe('ok');
  });

  it('classe une erreur sur valeur vide à part (muette tant que rien n’est tenté)', () => {
    const schema = z.object({ title: z.string().min(3, 'Trop court.') });
    expect(liveFieldIssue(schema, { title: '' }, 'title').kind).toBe('empty');
    expect(liveFieldIssue(schema, { title: 'ab' }, 'title')).toEqual({ kind: 'invalid', message: 'Trop court.' });
    expect(liveFieldIssue(schema, { title: 'abc' }, 'title').kind).toBe('ok');
  });
});

describe('Carnet#11 / #20 — navigation entre les jours', () => {
  it('flèches, Home et End bornent l’onglet visé', () => {
    expect(nextTabIndex('ArrowRight', 0, 3)).toBe(1);
    expect(nextTabIndex('ArrowRight', 2, 3)).toBe(2);
    expect(nextTabIndex('ArrowLeft', 0, 3)).toBe(0);
    expect(nextTabIndex('Home', 2, 3)).toBe(0);
    expect(nextTabIndex('End', 0, 3)).toBe(2);
    expect(nextTabIndex('a', 0, 3)).toBeNull();
    expect(nextTabIndex('ArrowRight', 0, 0)).toBeNull();
  });

  it('un glisser horizontal change de jour, un geste vertical jamais', () => {
    expect(swipeDirection(-80, 5, 300)).toBe(1);
    expect(swipeDirection(80, 5, 300)).toBe(-1);
    expect(swipeDirection(-80, 90, 300)).toBe(0);
    expect(swipeDirection(-20, 2, 300)).toBe(0);
    // Coup de doigt court mais rapide.
    expect(swipeDirection(-30, 2, 40)).toBe(1);
  });
});

describe('Carnet#13 — la nuitée suit la base, pas un drapeau', () => {
  it('reconnaît une table absente', () => {
    expect(isMissingTableError({ code: 'PGRST205' })).toBe(true);
    expect(isMissingTableError({ code: '42P01' })).toBe(true);
    expect(isMissingTableError({ message: 'Could not find the table public.carnet_nights' })).toBe(true);
    expect(isMissingTableError(null)).toBe(false);
  });

  it('la sonde est vraie seulement si la table répond', async () => {
    const make = (error: { code?: string } | null) => ({
      from: () => ({ select: () => Promise.resolve({ error }) }),
    });
    expect(await probeCarnetNights(make(null))).toBe(true);
    expect(await probeCarnetNights(make({ code: 'PGRST205' }))).toBe(false);
    expect(
      await probeCarnetNights({
        from: () => ({ select: () => Promise.reject(new Error('réseau')) }),
      }),
    ).toBe(false);
  });
});

describe('Story#15 — compression vidéo côté client', () => {
  const recorder = (supported: string[]) =>
    ({ isTypeSupported: (type: string) => supported.includes(type) }) as unknown as NonNullable<
      Parameters<typeof pickVideoOutputMime>[0]['MediaRecorder']
    >;

  it('choisit un MP4 seulement (lisible partout)', () => {
    expect(pickVideoOutputMime({ canCaptureStream: true, MediaRecorder: recorder(['video/webm']) })).toBeNull();
    expect(pickVideoOutputMime({ canCaptureStream: true, MediaRecorder: recorder(['video/mp4']) })).toBe('video/mp4');
  });

  it('ne ré-encode que les vidéos lourdes et seulement si le navigateur sait', () => {
    const env = { canCaptureStream: true, MediaRecorder: recorder(['video/mp4;codecs=avc1']) };
    expect(decideVideoCompression({ type: 'image/jpeg', size: 99_000_000 }, env)).toEqual({
      compress: false,
      reason: 'not-video',
    });
    expect(decideVideoCompression({ type: 'video/mp4', size: VIDEO_COMPRESS_MIN_BYTES }, env)).toEqual({
      compress: false,
      reason: 'small',
    });
    expect(decideVideoCompression({ type: 'video/mp4', size: VIDEO_COMPRESS_MIN_BYTES + 1 }, env)).toEqual({
      compress: true,
      mime: 'video/mp4;codecs=avc1',
    });
    expect(
      decideVideoCompression({ type: 'video/mp4', size: 20_000_000 }, { canCaptureStream: false }),
    ).toEqual({ compress: false, reason: 'unsupported' });
  });

  it('garde le résultat seulement s’il allège de 15 % ou plus, et sans perdre le son', () => {
    expect(keepCompressedVideo(10_000_000, 8_000_000)).toBe(true);
    expect(keepCompressedVideo(10_000_000, 9_500_000)).toBe(false);
    expect(keepCompressedVideo(10_000_000, 0)).toBe(false);
    expect(audioPreserved(true, 0)).toBe(false);
    expect(audioPreserved(true, 1)).toBe(true);
    expect(audioPreserved(false, 0)).toBe(true);
  });

  it('sans support, l’original repart tel quel (jamais bloquant)', async () => {
    const file = new File([new Uint8Array(10)], 'clip.mov', { type: 'video/quicktime' });
    expect(await compressVideoV2(file, { env: { canCaptureStream: false } })).toBe(file);
  });
});

describe('Sortie#5 — import depuis un carnet ou une sortie enregistrée', () => {
  it('arrondit le D+ à 50 m et borne la distance', () => {
    expect(importedFiguresV2({ distanceKm: 62.44, elevationGainM: 4120 })).toEqual({
      distanceKm: 62.4,
      elevationGainM: 4100,
    });
    expect(importedFiguresV2({ distanceKm: 900, elevationGainM: 90_000 })).toEqual({
      distanceKm: 500,
      elevationGainM: 20_000,
    });
    expect(importedFiguresV2({ distanceKm: Number.NaN, elevationGainM: -5 })).toEqual({
      distanceKm: 0,
      elevationGainM: 0,
    });
  });

  it('ignore les lignes sans distance et nomme les carnets sans titre', () => {
    const carnets = mapCarnetSources([
      { id: 'a', title: 'Tour des Écrins', distance_km: '62.4', denivele_m: 4120 },
      { id: 'b', title: '', distance_km: 12, denivele_m: null },
      { id: 'c', title: 'Sans distance', distance_km: 0 },
    ]);
    expect(carnets.map((entry) => entry.name)).toEqual(['Tour des Écrins', 'Carnet sans titre']);
    expect(formatFiguresFr(carnets[0])).toBe('62,4 km · +4120 m');
    const sessions = mapSessionSources([
      { id: 's', title: null, started_at: '2026-10-03T08:00:00Z', distance_km: 9.8, elevation_gain_m: 710 },
    ]);
    expect(sessions[0].name).toContain('Sortie du');
  });
});

describe('Kit#15 — unités', () => {
  it('formate en kg ou en lb avec la virgule française', () => {
    expect(formatKitWeightV2(1500, 'metric')).toBe('1,5 kg');
    expect(formatKitWeightV2(1000, 'imperial')).toBe('2,2 lb');
    expect(formatKitItemWeightV2(85, 'metric')).toBe('85 g');
    expect(formatKitItemWeightV2(1380, 'metric')).toBe('1,4 kg');
  });

  it('lit la préférence du compte (réglages /compte), métrique par défaut', () => {
    expect(readStoredUnitsV2({ getItem: () => 'imperial' })).toBe('imperial');
    expect(readStoredUnitsV2({ getItem: () => null })).toBe('metric');
    expect(readStoredUnitsV2({ getItem: () => { throw new Error('refusé'); } })).toBe('metric');
  });
});

describe('Kit#9 — suggestions selon la météo', () => {
  const none = [] as ReturnType<typeof buildKitItemFixture>[];

  it('froid, pluie et chaleur proposent des objets, sans doublon', () => {
    const cold = kitWeatherSuggestionsV2({ label: 'Neige', tempMin: -2, tempMax: 3 }, none).map((s) => s.name);
    expect(cold).toEqual(['Doudoune', 'Gants', 'Bonnet', 'Veste imperméable', 'Housse de pluie']);
    const hot = kitWeatherSuggestionsV2({ label: 'Ensoleillé', tempMin: 14, tempMax: 30 }, none).map((s) => s.name);
    expect(hot).toEqual(['Eau 2 L', 'Crème solaire']);
    expect(kitWeatherSuggestionsV2(null, none)).toEqual([]);
  });

  it('marque « ajouté » ce qui est déjà dans le sac et fusionne sans doublon', () => {
    const items = [buildKitItemFixture('Doudoune')];
    const weather = kitWeatherSuggestionsV2({ label: 'Nuageux', tempMin: 1, tempMax: 8 }, items);
    expect(weather.find((s) => s.name === 'Doudoune')?.added).toBe(true);
    const merged = mergeKitSuggestionsV2(kitSuggestionsV2('bivouac', 'hiver', items), weather);
    expect(merged.filter((s) => s.name === 'Doudoune')).toHaveLength(1);
    expect(merged.find((s) => s.name === 'Gants')?.reason).toContain('Min');
  });

  it('lit la route météo existante et reste muet en cas d’échec', async () => {
    const ok = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', days: [{ date: '2026-11-09', label: 'Pluie', tMaxC: 7.4, tMinC: 2.2 }] }),
    });
    expect(await fetchKitWeatherV2({ lat: 45.9, lng: 6.8 }, '2026-11-09', ok as unknown as typeof fetch)).toEqual({
      label: 'Pluie',
      tempMax: 7,
      tempMin: 2,
    });
    expect(String(ok.mock.calls[0][0])).toContain('/api/weather?lat=45.9000&lon=6.8000');
    const ko = vi.fn().mockResolvedValue({ ok: false });
    expect(await fetchKitWeatherV2({ lat: 1, lng: 1 }, '2026-11-09', ko as unknown as typeof fetch)).toBeNull();
  });
});

describe('Kit#12 — prêts', () => {
  it('ne compte que les prêts actifs où l’on emprunte', () => {
    const summary = summarizeBorrowedLoansV2([
      { product_ownership_id: 'o1', status: 'en_cours' },
      { product_ownership_id: 'o2', status: 'rendu' },
      { product_ownership_id: null, status: 'en_retard' },
    ]);
    expect(summary).toEqual({ ownershipIds: ['o1'], count: 2, error: null });
  });

  it('un objet est emprunté s’il est marqué ou lié à un prêt actif', () => {
    expect(isItemBorrowedV2({ ownershipId: 'o1' }, ['o1'])).toBe(true);
    expect(isItemBorrowedV2({ ownershipId: 'o9', borrowed: true }, [])).toBe(true);
    expect(isItemBorrowedV2({ ownershipId: null }, ['o1'])).toBe(false);
  });
});
