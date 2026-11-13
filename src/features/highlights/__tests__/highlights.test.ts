import { describe, expect, it } from 'vitest';
import {
  addPhoto,
  addTip,
  createHighlight,
  removeContribution,
  setHighlightPrivacy,
  setHighlightStatus,
  toggleVote,
} from '../engine/highlights';
import { fixedRuntime } from '../engine/runtime';
import { projectHighlight } from '../privacy';
import { InMemoryHighlightsStore } from '../services/store';
import { HighlightsService } from '../services/highlightsService';
import { ANON, OTHER, OWNER, makeHighlight } from './fixtures';

const input = {
  author: { id: 'user-owner', name: 'Tony' },
  kind: 'place' as const,
  target: { type: 'place' as const, id: 'place-1' },
  title: 'Belvédère du lac',
  description: 'Vue nette.',
  sport: 'hike' as const,
  areaLabel: 'Chamonix',
  location: { lat: 45.9237, lng: 6.8694 },
  audience: 'public' as const,
};

describe('K5.13 — créer un highlight', () => {
  it('valide le titre, le secteur et la cible', () => {
    const runtime = fixedRuntime();
    expect(createHighlight({ ...input, title: 'a' }, runtime).ok).toBe(false);
    expect(createHighlight({ ...input, areaLabel: '' }, runtime).ok).toBe(false);
    expect(createHighlight({ ...input, target: { type: 'place', id: '' } }, runtime).ok).toBe(
      false
    );
    expect(createHighlight({ ...input, location: { lat: 999, lng: 0 } }, runtime).ok).toBe(false);
    const created = createHighlight(input, runtime);
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.title).toBe('Belvédère du lac');
      expect(created.value.audience).toBe('public');
    }
  });

  it('sans position, la position exacte est masquée par défaut', () => {
    const created = createHighlight({ ...input, location: null }, fixedRuntime());
    expect(created.ok && created.value.privacy.hideExactLocation).toBe(true);
  });

  it('nettoie le HTML du titre et de la description', () => {
    const created = createHighlight(
      { ...input, title: '<b>Lac</b> bleu', description: '<script>alert(1)</script>Calme' },
      fixedRuntime()
    );
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.title).toBe('Lac bleu');
      expect(created.value.description).not.toContain('<script>');
    }
  });
});

describe('K5.14 — conseils, photos et votes', () => {
  it('un autre compte peut conseiller un highlight public', () => {
    const result = addTip(
      makeHighlight(),
      { id: 'user-other', name: 'Léa' },
      'Fontaine au col.',
      OTHER,
      fixedRuntime()
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tips).toHaveLength(1);
      expect(projectHighlight(result.value, OTHER)?.tips[0].body).toBe('Fontaine au col.');
    }
  });

  it('refuse un conseil vide ou sur un highlight privé', () => {
    expect(
      addTip(makeHighlight(), { id: 'user-other', name: null }, 'a', OTHER, fixedRuntime()).ok
    ).toBe(false);
    const privateHighlight = makeHighlight({ audience: 'private' });
    expect(
      addTip(
        privateHighlight,
        { id: 'user-other', name: null },
        'Conseil valide',
        OTHER,
        fixedRuntime()
      ).ok
    ).toBe(false);
  });

  it('refuse une photo sans EXIF nettoyé et accepte une photo sûre', () => {
    const rejected = addPhoto(
      makeHighlight(),
      {
        author: { id: 'user-other', name: null },
        url: 'https://cdn.test/a.jpg',
        exifStripped: false,
      },
      OTHER,
      fixedRuntime()
    );
    expect(rejected.ok).toBe(false);

    const accepted = addPhoto(
      makeHighlight(),
      {
        author: { id: 'user-other', name: null },
        url: 'https://cdn.test/a.jpg',
        exifStripped: true,
      },
      OTHER,
      fixedRuntime()
    );
    expect(accepted.ok).toBe(true);
    if (accepted.ok) {
      expect(accepted.value.photos).toHaveLength(1);
      expect(projectHighlight(accepted.value, ANON)?.photos).toHaveLength(1);
    }
  });

  it('refuse les URL de photo dangereuses', () => {
    const result = addPhoto(
      makeHighlight(),
      { author: { id: 'user-other', name: null }, url: 'javascript:alert(1)', exifStripped: true },
      OTHER,
      fixedRuntime()
    );
    expect(result.ok).toBe(false);
  });

  it('vote une seule fois, bascule et retire le vote', () => {
    const up = toggleVote(makeHighlight(), OTHER, 1, fixedRuntime());
    expect(up.ok).toBe(true);
    if (!up.ok) return;
    expect(projectHighlight(up.value, OTHER)?.score).toBe(1);
    const off = toggleVote(up.value, OTHER, 1, fixedRuntime());
    expect(off.ok && projectHighlight(off.value, OTHER)?.score).toBe(0);
    if (!off.ok) return;
    const down = toggleVote(off.value, OTHER, -1, fixedRuntime());
    expect(down.ok && projectHighlight(down.value, OTHER)?.score).toBe(-1);
    if (!down.ok) return;
    const flipped = toggleVote(down.value, OTHER, 1, fixedRuntime());
    expect(flipped.ok && projectHighlight(flipped.value, OTHER)?.score).toBe(1);
  });

  it('interdit l’auto-vote et le vote anonyme', () => {
    expect(toggleVote(makeHighlight(), OWNER, 1, fixedRuntime()).ok).toBe(false);
    expect(toggleVote(makeHighlight(), ANON, 1, fixedRuntime()).ok).toBe(false);
  });

  it('retire un conseil selon les droits', () => {
    const added = addTip(
      makeHighlight(),
      { id: 'user-other', name: null },
      'Conseil utile',
      OTHER,
      fixedRuntime()
    );
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const tipId = added.value.tips[0].id;
    const third = { id: 'user-third', relation: 'authenticated' as const };
    expect(removeContribution(added.value, tipId, 'tip', third, fixedRuntime()).ok).toBe(false);
    const removed = removeContribution(added.value, tipId, 'tip', OTHER, fixedRuntime());
    expect(removed.ok && removed.value.tips).toHaveLength(0);
  });

  it('applique hidePhotos après ajout : la galerie ne sort plus', () => {
    const added = addPhoto(
      makeHighlight(),
      {
        author: { id: 'user-owner', name: 'Tony' },
        url: 'https://cdn.test/a.jpg',
        exifStripped: true,
      },
      OWNER,
      fixedRuntime()
    );
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const hidden = setHighlightPrivacy(added.value, { hidePhotos: true }, OWNER, fixedRuntime());
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) return;
    expect(projectHighlight(hidden.value, OTHER)?.photos).toEqual([]);
    expect(projectHighlight(hidden.value, OWNER)?.photos).toHaveLength(1);
  });

  it('un highlight retiré ne réapparaît pas', () => {
    const removed = setHighlightStatus(makeHighlight(), 'removed', OWNER, fixedRuntime());
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(projectHighlight(removed.value, OWNER)).toBeNull();
    expect(setHighlightStatus(removed.value, 'published', OWNER, fixedRuntime()).ok).toBe(false);
  });
});

describe('service Highlights', () => {
  it('crée, liste et mute via le port de stockage', () => {
    const store = new InMemoryHighlightsStore();
    const service = new HighlightsService(store, fixedRuntime());
    const created = service.create(input, OWNER);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(service.list(OTHER)).toHaveLength(1);

    const tip = service.contributeTip(
      created.value.id,
      { id: 'user-other', name: 'Léa' },
      'Eau au col.',
      OTHER
    );
    expect(tip.ok).toBe(true);
    const vote = service.vote(created.value.id, OTHER, 1);
    expect(vote.ok && vote.value.score).toBe(1);

    const hidden = service.setStatus(created.value.id, 'hidden', OWNER);
    expect(hidden.ok).toBe(true);
    expect(service.list(OTHER)).toHaveLength(0);
    expect(service.list(OWNER)).toHaveLength(1);
  });

  it('refuse de créer pour un autre auteur', () => {
    const service = new HighlightsService(new InMemoryHighlightsStore(), fixedRuntime());
    const result = service.create({ ...input, author: { id: 'user-other', name: null } }, OWNER);
    expect(result.ok).toBe(false);
  });
});
