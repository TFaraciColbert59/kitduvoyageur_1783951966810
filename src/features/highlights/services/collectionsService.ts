import type {
  Collection,
  CollectionSearchHit,
  CollectionView,
  Outcome,
  ShareLink,
  Viewer,
} from '../types';
import { projectCollection, projectHighlight, type ProjectCollectionOptions } from '../privacy';
import {
  addCollectionItem,
  createCollection,
  moveCollectionItem,
  removeCollectionItem,
  reorderCollection,
  saveHighlightToPlaces,
  updateCollection,
  type AddCollectionItemInput,
  type CreateCollectionInput,
  type UpdateCollectionInput,
} from '../engine/collections';
import {
  createShareLink,
  resolveShareLink,
  revokeAllShareLinks,
  revokeShareLink,
  sharePath,
} from '../engine/sharing';
import { searchCollections } from '../engine/search';
import { defaultRuntime, type Runtime } from '../engine/runtime';
import { fail, ok } from '../engine/result';
import type { HighlightsStore } from './store';

/**
 * Service Collections : propriété, ordre, partage révocable et recherche.
 * Toute projection passe par `projectCollection` ; un item Highlight est
 * filtré par `projectHighlight`, donc une photo/coordonnée masquée ne fuit
 * pas via une collection publique.
 */
export class CollectionsService {
  constructor(
    private readonly store: HighlightsStore,
    private readonly runtime: Runtime = defaultRuntime()
  ) {}

  private optionsFor(viewer: Viewer): ProjectCollectionOptions {
    return {
      canIncludeItem: (type, refId) => {
        if (type !== 'highlight') return true;
        const highlight = this.store.getHighlight(refId);
        if (!highlight || highlight.status === 'removed') return false;
        return projectHighlight(highlight, viewer) != null;
      },
    };
  }

  list(viewer: Viewer): CollectionView[] {
    const options = this.optionsFor(viewer);
    return this.store
      .listCollections()
      .map((collection) => projectCollection(collection, viewer, options))
      .filter((view): view is CollectionView => view != null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  get(id: string, viewer: Viewer): Outcome<CollectionView> {
    const collection = this.store.getCollection(id);
    if (!collection) return fail('not-found', 'Collection introuvable.');
    const view = projectCollection(collection, viewer, this.optionsFor(viewer));
    if (!view) return fail('forbidden', 'Cette collection n’est pas accessible.');
    return ok(view);
  }

  search(query: string, viewer: Viewer, limit = 20): CollectionSearchHit[] {
    return searchCollections(query, this.store.listCollections(), viewer, {
      ...this.optionsFor(viewer),
      limit,
    });
  }

  create(input: CreateCollectionInput, viewer: Viewer): Outcome<CollectionView> {
    if (viewer.id == null) return fail('unauthenticated', 'Connexion requise.');
    if (viewer.id !== input.owner.id) return fail('forbidden', 'Propriétaire incohérent.');
    const created = createCollection(input, this.runtime);
    if (!created.ok) return created;
    this.store.saveCollection(created.value);
    return this.view(created.value, viewer);
  }

  addItem(id: string, input: AddCollectionItemInput, viewer: Viewer): Outcome<CollectionView> {
    return this.mutate(id, viewer, (collection) => {
      const enriched = { ...input };
      if (collection.kind === 'editorial' && enriched.audience == null)
        enriched.audience = 'public';
      if (enriched.type === 'highlight') {
        const highlight = this.store.getHighlight(enriched.refId);
        if (!highlight || highlight.status === 'removed')
          return fail('not-found', 'Highlight introuvable.');
        if (collection.kind === 'editorial') {
          const projection = projectHighlight(highlight, { id: null, relation: 'anonymous' });
          if (!projection)
            return fail('forbidden', 'Un guide public n’inclut que des highlights publics.');
        }
        enriched.title = enriched.title || highlight.title;
        enriched.sport = enriched.sport ?? highlight.sport;
      }
      return addCollectionItem(collection, enriched, viewer, this.runtime);
    });
  }

  removeItem(id: string, itemId: string, viewer: Viewer): Outcome<CollectionView> {
    return this.mutate(id, viewer, (collection) =>
      removeCollectionItem(collection, itemId, viewer, this.runtime)
    );
  }

  reorder(id: string, orderedIds: readonly string[], viewer: Viewer): Outcome<CollectionView> {
    return this.mutate(id, viewer, (collection) =>
      reorderCollection(collection, orderedIds, viewer, this.runtime)
    );
  }

  move(
    id: string,
    itemId: string,
    direction: 'up' | 'down',
    viewer: Viewer
  ): Outcome<CollectionView> {
    return this.mutate(id, viewer, (collection) =>
      moveCollectionItem(collection, itemId, direction, viewer, this.runtime)
    );
  }

  update(id: string, patch: UpdateCollectionInput, viewer: Viewer): Outcome<CollectionView> {
    return this.mutate(id, viewer, (collection) =>
      updateCollection(collection, patch, viewer, this.runtime)
    );
  }

  delete(id: string, viewer: Viewer): Outcome<true> {
    const collection = this.store.getCollection(id);
    if (!collection) return fail('not-found', 'Collection introuvable.');
    if (viewer.id == null) return fail('unauthenticated', 'Connexion requise.');
    if (viewer.id !== collection.ownerId) return fail('forbidden', 'Réservé au propriétaire.');
    this.store.deleteCollection(id);
    return ok(true);
  }

  share(
    id: string,
    viewer: Viewer,
    options: { expiresInDays?: number } = {}
  ): Outcome<{ link: ShareLink; path: string; collection: CollectionView }> {
    const collection = this.store.getCollection(id);
    if (!collection) return fail('not-found', 'Collection introuvable.');
    const result = createShareLink(collection, viewer, this.runtime, options);
    if (!result.ok) return result;
    this.store.saveCollection(result.value.collection);
    const view = projectCollection(result.value.collection, viewer, this.optionsFor(viewer));
    if (!view) return fail('forbidden', 'Collection inaccessible.');
    return ok({
      link: result.value.link,
      path: sharePath(result.value.link.token),
      collection: view,
    });
  }

  revoke(id: string, linkId: string, viewer: Viewer): Outcome<CollectionView> {
    return this.mutate(id, viewer, (collection) =>
      revokeShareLink(collection, linkId, viewer, this.runtime)
    );
  }

  revokeAll(id: string, viewer: Viewer): Outcome<CollectionView> {
    return this.mutate(id, viewer, (collection) =>
      revokeAllShareLinks(collection, viewer, this.runtime)
    );
  }

  /**
   * Résolution d'un lien : la collection reste privée/non listée dans l'index,
   * mais son contenu est projeté en lecture seule. Le propriétaire n'est pas
   * exposé et P01 continue de retirer photos/coordonnées masquées.
   */
  resolveShare(token: string, now = this.runtime.now()): Outcome<CollectionView> {
    const collection = this.store
      .listCollections()
      .find((candidate) => candidate.shareLinks.some((link) => link.token === token));
    if (!collection) return fail('not-found', 'Lien invalide.');
    const resolution = resolveShareLink(collection, token, now);
    if (!resolution.ok) return fail('not-found', 'Lien invalide ou expiré.');
    const view = projectCollection(
      collection,
      { id: null, relation: 'anonymous' },
      {
        shared: true,
        canIncludeItem: (type, refId) => {
          if (type !== 'highlight') return true;
          const highlight = this.store.getHighlight(refId);
          return highlight != null && highlight.status !== 'removed';
        },
      }
    );
    if (!view) return fail('not-found', 'Lien invalide.');
    return ok(view);
  }

  /** K5.15 — enregistre un highlight dans « Mes lieux ». */
  saveHighlight(
    highlightId: string,
    owner: { id: string; name: string | null },
    viewer: Viewer
  ): Outcome<{ collection: CollectionView; created: boolean }> {
    if (viewer.id == null) return fail('unauthenticated', 'Connexion requise.');
    if (viewer.id !== owner.id) return fail('forbidden', 'Propriétaire incohérent.');
    const highlight = this.store.getHighlight(highlightId);
    if (!highlight) return fail('not-found', 'Highlight introuvable.');
    const result = saveHighlightToPlaces(
      highlight,
      owner,
      this.store.listCollections(),
      viewer,
      this.runtime
    );
    if (!result.ok) return result;
    this.store.saveCollection(result.value.collection);
    const view = projectCollection(result.value.collection, viewer, this.optionsFor(viewer));
    if (!view) return fail('forbidden', 'Collection inaccessible.');
    return ok({ collection: view, created: result.value.created });
  }

  private view(collection: Collection, viewer: Viewer): Outcome<CollectionView> {
    const view = projectCollection(collection, viewer, this.optionsFor(viewer));
    if (!view) return fail('forbidden', 'Collection inaccessible.');
    return ok(view);
  }

  private mutate(
    id: string,
    viewer: Viewer,
    mutation: (collection: Collection) => Outcome<Collection>
  ): Outcome<CollectionView> {
    if (viewer.id == null) return fail('unauthenticated', 'Connexion requise.');
    const collection = this.store.getCollection(id);
    if (!collection) return fail('not-found', 'Collection introuvable.');
    const result = mutation(collection);
    if (!result.ok) return result;
    this.store.saveCollection(result.value);
    return this.view(result.value, viewer);
  }
}
