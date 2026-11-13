import { describe, expect, it } from 'vitest';
import {
  addCollectionItem,
  createCollection,
  moveCollectionItem,
  removeCollectionItem,
  reorderCollection,
  saveHighlightToPlaces,
  updateCollection,
} from '../engine/collections';
import { fixedRuntime } from '../engine/runtime';
import { InMemoryHighlightsStore } from '../services/store';
import { CollectionsService } from '../services/collectionsService';
import { OTHER, OWNER, makeCollection, makeHighlight } from './fixtures';

const owner = { id: 'user-owner', name: 'Tony' };

describe('K5.16 — collections personnelles', () => {
  it('combine parcours et POI, dans l’ordre d’ajout', () => {
    const created = createCollection({ owner, title: 'Week-end' }, fixedRuntime());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const withRoute = addCollectionItem(
      created.value,
      { type: 'route', refId: 'route-1', title: 'Tour du lac', sport: 'hike' },
      OWNER,
      fixedRuntime()
    );
    expect(withRoute.ok).toBe(true);
    if (!withRoute.ok) return;
    const withPoi = addCollectionItem(
      withRoute.value,
      { type: 'poi', refId: 'poi-1', title: 'Refuge' },
      OWNER,
      fixedRuntime()
    );
    expect(withPoi.ok).toBe(true);
    if (!withPoi.ok) return;
    expect(withPoi.value.items.map((item) => item.type)).toEqual(['route', 'poi']);
    expect(withPoi.value.items.map((item) => item.position)).toEqual([0, 1]);
  });

  it('refuse un doublon et un ajout par un autre compte', () => {
    const base = makeCollection();
    const first = addCollectionItem(
      base,
      { type: 'route', refId: 'route-1', title: 'Tour du lac' },
      OWNER,
      fixedRuntime()
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(
      addCollectionItem(
        first.value,
        { type: 'route', refId: 'route-1', title: 'Tour du lac' },
        OWNER,
        fixedRuntime()
      ).ok
    ).toBe(false);
    expect(
      addCollectionItem(
        first.value,
        { type: 'poi', refId: 'poi-1', title: 'Refuge' },
        OTHER,
        fixedRuntime()
      ).ok
    ).toBe(false);
  });

  it('réordonne et déplace, puis renumérote après retrait', () => {
    let collection = makeCollection();
    const runtime = fixedRuntime();
    for (const id of ['a', 'b', 'c']) {
      const added = addCollectionItem(
        collection,
        { type: 'poi', refId: id, title: id.toUpperCase() },
        OWNER,
        runtime
      );
      expect(added.ok).toBe(true);
      if (!added.ok) return;
      collection = added.value;
    }
    const ids = collection.items.map((item) => item.id);
    const reordered = reorderCollection(
      collection,
      [ids[2], ids[0], ids[1]],
      OWNER,
      fixedRuntime()
    );
    expect(reordered.ok).toBe(true);
    if (!reordered.ok) return;
    expect(reordered.value.items.map((item) => item.refId)).toEqual(['c', 'a', 'b']);
    const moved = moveCollectionItem(reordered.value, ids[0], 'down', OWNER, fixedRuntime());
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.value.items.map((item) => item.refId)).toEqual(['c', 'b', 'a']);
    const removed = removeCollectionItem(moved.value, ids[2], OWNER, fixedRuntime());
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.value.items.map((item) => item.position)).toEqual([0, 1]);
  });

  it('refuse un ordre incomplet ou inconnu', () => {
    const collection = makeCollection({
      items: [{ id: 'i1', type: 'poi', refId: 'p1', title: 'P1', sport: null, position: 0 }],
    });
    expect(reorderCollection(collection, [], OWNER, fixedRuntime()).ok).toBe(false);
    expect(reorderCollection(collection, ['i1', 'i2'], OWNER, fixedRuntime()).ok).toBe(false);
  });

  it('une collection éditoriale est publique et n’inclut que du public', () => {
    expect(
      createCollection(
        { owner, kind: 'editorial', title: 'Lacs', visibility: 'private' },
        fixedRuntime()
      ).ok
    ).toBe(false);
    const created = createCollection({ owner, kind: 'editorial', title: 'Lacs' }, fixedRuntime());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.visibility).toBe('public');
    expect(
      addCollectionItem(
        created.value,
        { type: 'highlight', refId: 'h1', title: 'Lac', audience: 'private' },
        OWNER,
        fixedRuntime()
      ).ok
    ).toBe(false);
  });

  it('change la visibilité, propriétaire seulement', () => {
    const collection = makeCollection();
    expect(updateCollection(collection, { visibility: 'public' }, OTHER, fixedRuntime()).ok).toBe(
      false
    );
    const updated = updateCollection(
      collection,
      { visibility: 'followers' },
      OWNER,
      fixedRuntime()
    );
    expect(updated.ok && updated.value.visibility).toBe('followers');
  });

  it('refuse de rétrograder une collection éditoriale', () => {
    const editorial = makeCollection({
      kind: 'editorial',
      visibility: 'public',
      partner: 'Office de tourisme',
    });
    expect(updateCollection(editorial, { visibility: 'private' }, OWNER, fixedRuntime()).ok).toBe(
      false
    );
  });
});

describe('K5.15 — enregistrer un highlight dans ses lieux', () => {
  it('crée « Mes lieux » à la première sauvegarde puis réutilise la collection', () => {
    const runtime = fixedRuntime();
    const highlight = makeHighlight();
    const first = saveHighlightToPlaces(highlight, owner, [], OWNER, runtime);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.created).toBe(true);
    expect(first.value.collection.title).toBe('Mes lieux');
    expect(first.value.collection.items).toHaveLength(1);

    const second = saveHighlightToPlaces(
      highlight,
      owner,
      [first.value.collection],
      OWNER,
      runtime
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.created).toBe(false);
    expect(second.value.collection.items).toHaveLength(1);
  });

  it('refuse de sauvegarder un highlight invisible', () => {
    const result = saveHighlightToPlaces(
      makeHighlight({ audience: 'private' }),
      owner,
      [],
      OTHER,
      fixedRuntime()
    );
    expect(result.ok).toBe(false);
  });
});

describe('service Collections', () => {
  it('filtre un highlight retiré de la collection publique', () => {
    const highlight = makeHighlight();
    const store = new InMemoryHighlightsStore({ highlights: [highlight] });
    const service = new CollectionsService(store, fixedRuntime());
    const created = service.create(
      { owner, title: 'Lacs', visibility: 'public', kind: 'personal' },
      OWNER
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const added = service.addItem(
      created.value.id,
      { type: 'highlight', refId: highlight.id, title: highlight.title },
      OWNER
    );
    expect(added.ok).toBe(true);
    expect(service.get(created.value.id, OTHER)?.ok).toBe(true);

    store.saveHighlight({ ...highlight, status: 'removed' });
    const view = service.get(created.value.id, OTHER);
    expect(view.ok).toBe(true);
    if (view.ok) expect(view.value.items).toHaveLength(0);
  });

  it('refuse une collection éditoriale avec un highlight privé', () => {
    const store = new InMemoryHighlightsStore({
      highlights: [makeHighlight({ audience: 'private' })],
    });
    const service = new CollectionsService(store, fixedRuntime());
    const created = service.create({ owner, kind: 'editorial', title: 'Lacs' }, OWNER);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const added = service.addItem(
      created.value.id,
      { type: 'highlight', refId: 'highlight-1', title: 'Lac' },
      OWNER
    );
    expect(added.ok).toBe(false);
  });
});
