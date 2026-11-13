import { describe, expect, it } from 'vitest';
import { createShareLink, resolveShareLink, revokeShareLink } from '../engine/sharing';
import { fixedRuntime } from '../engine/runtime';
import { searchCollections } from '../engine/search';
import { InMemoryHighlightsStore } from '../services/store';
import { CollectionsService } from '../services/collectionsService';
import { ANON, OTHER, OWNER, makeCollection, makeHighlight } from './fixtures';
import type { Viewer } from '../types';

const THIRD: Viewer = { id: 'user-third', relation: 'authenticated' };

describe('K5.18 — lien de partage révocable', () => {
  it('crée un jeton opaque, propriétaire seulement', () => {
    const collection = makeCollection();
    expect(createShareLink(collection, OTHER, fixedRuntime()).ok).toBe(false);
    const result = createShareLink(collection, OWNER, fixedRuntime(), { expiresInDays: 7 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.link.token).toMatch(/^token-/);
    expect(result.value.link.expiresAt).not.toBeNull();
    expect(result.value.collection.shareLinks).toHaveLength(1);
  });

  it('résout un lien valide, refuse expiré, révoqué et inconnu', () => {
    const created = createShareLink(makeCollection(), OWNER, fixedRuntime(), { expiresInDays: 1 });
    if (!created.ok) throw new Error('lien non créé');
    const link = created.value.link;
    const collection = created.value.collection;
    expect(resolveShareLink(collection, link.token, '2026-11-11T12:00:00.000Z').ok).toBe(true);
    expect(resolveShareLink(collection, link.token, '2027-01-01T00:00:00.000Z')).toEqual({
      ok: false,
      reason: 'expired',
    });
    expect(resolveShareLink(collection, 'inconnu', '2026-11-11T12:00:00.000Z')).toEqual({
      ok: false,
      reason: 'not-found',
    });
    const revoked = revokeShareLink(collection, link.id, OWNER, fixedRuntime());
    expect(revoked.ok).toBe(true);
    if (!revoked.ok) return;
    expect(resolveShareLink(revoked.value, link.token, '2026-11-11T12:00:00.000Z')).toEqual({
      ok: false,
      reason: 'revoked',
    });
  });

  it('le service résout un lien en lecture seule sans propriétaire ni coordonnée', () => {
    const store = new InMemoryHighlightsStore({ highlights: [makeHighlight()] });
    const service = new CollectionsService(store, fixedRuntime());
    const created = service.create(
      { owner: { id: 'user-owner', name: 'Tony' }, title: 'Mes lieux' },
      OWNER
    );
    if (!created.ok) throw new Error('collection non créée');
    const added = service.addItem(
      created.value.id,
      { type: 'highlight', refId: 'highlight-1', title: 'Lac' },
      OWNER
    );
    if (!added.ok) throw new Error('item non ajouté');
    const shared = service.share(created.value.id, OWNER);
    if (!shared.ok) throw new Error('partage non créé');

    const view = service.resolveShare(shared.value.link.token);
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    expect(view.value.shared).toBe(true);
    expect(view.value.ownerName).toBeNull();
    expect(view.value.canEdit).toBe(false);
    const serialized = JSON.stringify(view.value);
    expect(serialized).not.toContain('45.9237');
    expect(serialized).not.toContain('user-owner');
  });

  it('révoquer invalide l’accès et les aperçus', () => {
    const store = new InMemoryHighlightsStore({ highlights: [makeHighlight()] });
    const service = new CollectionsService(store, fixedRuntime());
    const created = service.create(
      { owner: { id: 'user-owner', name: 'Tony' }, title: 'Mes lieux' },
      OWNER
    );
    if (!created.ok) throw new Error('collection non créée');
    service.addItem(
      created.value.id,
      { type: 'highlight', refId: 'highlight-1', title: 'Lac' },
      OWNER
    );
    const shared = service.share(created.value.id, OWNER);
    if (!shared.ok) throw new Error('partage non créé');
    const revoked = service.revoke(created.value.id, shared.value.link.id, OWNER);
    expect(revoked.ok).toBe(true);
    expect(service.resolveShare(shared.value.link.token).ok).toBe(false);
  });

  it('retirer un highlight invalide son aperçu dans le lien', () => {
    const store = new InMemoryHighlightsStore({ highlights: [makeHighlight()] });
    const service = new CollectionsService(store, fixedRuntime());
    const created = service.create(
      { owner: { id: 'user-owner', name: 'Tony' }, title: 'Mes lieux' },
      OWNER
    );
    if (!created.ok) throw new Error('collection non créée');
    service.addItem(
      created.value.id,
      { type: 'highlight', refId: 'highlight-1', title: 'Lac' },
      OWNER
    );
    const shared = service.share(created.value.id, OWNER);
    if (!shared.ok) throw new Error('partage non créé');
    store.saveHighlight({ ...makeHighlight(), status: 'removed' });
    const view = service.resolveShare(shared.value.link.token);
    expect(view.ok).toBe(true);
    if (view.ok) expect(view.value.items).toHaveLength(0);
  });
});

describe('K5.18 — recherche de collections', () => {
  it('ne révèle jamais une collection privée à un autre compte', () => {
    const secret = makeCollection({ id: 'secret', title: 'Secret', visibility: 'private' });
    expect(searchCollections('secret', [secret], OWNER)).toHaveLength(1);
    expect(searchCollections('secret', [secret], OTHER)).toHaveLength(0);
    expect(searchCollections('secret', [secret], ANON)).toHaveLength(0);
  });

  it('trouve une collection publique par titre, thème ou région, sans accents', () => {
    const publicCollection = makeCollection({
      id: 'public',
      title: 'Tour des lacs',
      theme: 'Lacs',
      region: 'Chamonix',
      visibility: 'public',
    });
    expect(searchCollections('lacs', [publicCollection], OTHER)[0]?.collection.id).toBe('public');
    expect(searchCollections('chamonix', [publicCollection], OTHER)[0]?.collection.id).toBe(
      'public'
    );
    expect(searchCollections('inaccessible', [publicCollection], OTHER)).toHaveLength(0);
  });

  it('une collection non listée n’est pas indexée pour les autres', () => {
    const unlisted = makeCollection({
      id: 'unlisted',
      title: 'Lien privé',
      visibility: 'unlisted',
    });
    expect(searchCollections('lien', [unlisted], OTHER)).toHaveLength(0);
    expect(searchCollections('lien', [unlisted], OWNER)).toHaveLength(1);
  });

  it('une collection publique sans correspondance de requête est absente', () => {
    const publicCollection = makeCollection({
      id: 'public',
      title: 'Tour des lacs',
      visibility: 'public',
    });
    expect(searchCollections('vélo', [publicCollection], THIRD)).toHaveLength(0);
  });
});
