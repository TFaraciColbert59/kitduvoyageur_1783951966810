import { describe, expect, it } from 'vitest';
import {
  applyFeedPreferences,
  defaultFeedPreferences,
  feedPreferencesStorageKey,
  mergeFeedPreferences,
  normalizeFeedPreferences,
  readFeedPreferences,
  serializeFeedPreferences,
} from '../feedPreferences';

const AUTHOR = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const POST = '33333333-3333-4333-8333-333333333333';
const POST_2 = '44444444-4444-4444-8444-444444444444';

const items = [
  { id: POST, authorId: AUTHOR, sport: 'rando', audienceAllowed: true },
  { id: POST_2, authorId: OTHER, sport: 'velo', audienceAllowed: true },
  { id: '55555555-5555-4555-8555-555555555555', authorId: OTHER, sport: 'ski', audienceAllowed: false },
];

describe('G01 feed preferences — normalisation', () => {
  it('désactive l’autoplay et active l’économie de données par défaut', () => {
    const prefs = defaultFeedPreferences();
    expect(prefs.video.autoplay).toBe(false);
    expect(prefs.video.sound).toBe(false);
    expect(prefs.video.loop).toBe(false);
    expect(prefs.video.data_saver).toBe(true);
    expect(prefs.show_activity).toBe(true);
  });

  it('ignore un schéma inconnu', () => {
    const prefs = normalizeFeedPreferences({
      schema: 'autre',
      muted_authors: [AUTHOR],
      show_activity: false,
      video: { autoplay: true },
    });
    expect(prefs.muted_authors).toEqual([]);
    expect(prefs.show_activity).toBe(true);
    expect(prefs.video.autoplay).toBe(false);
  });

  it('n’accepte que des UUID dans les listes', () => {
    const prefs = normalizeFeedPreferences({
      schema: 'lkdv.feed.preferences.v1',
      muted_authors: [AUTHOR, 'pas-un-uuid', AUTHOR],
      hidden_posts: [POST],
      muted_sports: ['rando', 'rando', 'inconnu'],
    });
    expect(prefs.muted_authors).toEqual([AUTHOR]);
    expect(prefs.hidden_posts).toEqual([POST]);
    expect(prefs.muted_sports).toEqual(['rando']);
  });

  it('lit un JSON corrompu sans exception', () => {
    const prefs = readFeedPreferences('{');
    expect(prefs.video.autoplay).toBe(false);
    expect(readFeedPreferences('null').show_activity).toBe(true);
  });

  it('sérialise et relit les mêmes valeurs', () => {
    const prefs = mergeFeedPreferences(defaultFeedPreferences(), {
      muted_sports: ['ski'],
      video: { autoplay: true, data_saver: false },
    });
    const roundTrip = readFeedPreferences(serializeFeedPreferences(prefs));
    expect(roundTrip.muted_sports).toEqual(['ski']);
    expect(roundTrip.video.autoplay).toBe(true);
    expect(roundTrip.video.data_saver).toBe(false);
  });

  it('construit une clé stable par utilisateur', () => {
    expect(feedPreferencesStorageKey(AUTHOR)).toContain(AUTHOR);
    expect(feedPreferencesStorageKey(null)).toContain('anonyme');
  });
});

describe('G01 feed preferences — filtrage', () => {
  it('applique les sourdines et les préférences de contenu', () => {
    const prefs = mergeFeedPreferences(defaultFeedPreferences(), {
      muted_authors: [AUTHOR],
      muted_sports: ['velo'],
      hidden_posts: [POST_2],
    });
    const result = applyFeedPreferences(items, prefs);
    expect(result.visible).toEqual([]);
    expect(result.hidden).toBe(3);
  });

  it('masque une carte dont l’audience n’est pas explicitement autorisée', () => {
    const result = applyFeedPreferences(
      [{ id: POST, authorId: AUTHOR, sport: 'rando', audienceAllowed: false }],
      defaultFeedPreferences()
    );
    expect(result.visible).toEqual([]);
    expect(result.hidden).toBe(1);
  });

  it('masque toutes les activités quand l’utilisateur coupe le fil sportif', () => {
    const prefs = mergeFeedPreferences(defaultFeedPreferences(), { show_activity: false });
    expect(applyFeedPreferences(items, prefs).visible).toEqual([]);
  });

  it('laisse passer un élément sans sport quand seuls des sports sont masqués', () => {
    const prefs = mergeFeedPreferences(defaultFeedPreferences(), { muted_sports: ['ski'] });
    const result = applyFeedPreferences(
      [{ id: POST, authorId: AUTHOR, sport: null, audienceAllowed: true }],
      prefs
    );
    expect(result.visible).toHaveLength(1);
  });

  it('ne casse pas sur une liste absente', () => {
    expect(applyFeedPreferences(null, defaultFeedPreferences())).toEqual({
      visible: [],
      hidden: 0,
    });
  });
});
