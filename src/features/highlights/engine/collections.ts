import type {
  Audience,
  Collection,
  CollectionItem,
  CollectionItemType,
  CollectionVisibility,
  Outcome,
  Sport,
  Viewer,
} from '../types';
import { canViewAudience, viewerRelation } from '../privacy';
import { fail, ok, plainText } from './result';
import type { Runtime } from './runtime';

export const COLLECTION_LIMITS = {
  titleMin: 3,
  titleMax: 80,
  descriptionMax: 600,
  itemsMax: 100,
} as const;

const ITEM_TYPES: readonly CollectionItemType[] = ['highlight', 'route', 'poi'];
const VISIBILITIES: readonly CollectionVisibility[] = [
  'private',
  'followers',
  'public',
  'unlisted',
];

export interface CreateCollectionInput {
  owner: { id: string; name: string | null };
  kind?: Collection['kind'];
  title: string;
  description?: string;
  theme?: string | null;
  region?: string | null;
  partner?: string | null;
  visibility?: CollectionVisibility;
}

export function createCollection(
  input: CreateCollectionInput,
  runtime: Runtime
): Outcome<Collection> {
  if (!input.owner.id) return fail('unauthenticated', 'Connexion requise.');
  const title = plainText(input.title, COLLECTION_LIMITS.titleMax);
  if (title.length < COLLECTION_LIMITS.titleMin) {
    return fail('invalid-input', `Titre : ${COLLECTION_LIMITS.titleMin} caractères minimum.`);
  }
  const kind = input.kind ?? 'personal';
  if (kind !== 'personal' && kind !== 'editorial')
    return fail('invalid-input', 'Type de collection inconnu.');
  const visibility = input.visibility ?? (kind === 'editorial' ? 'public' : 'private');
  if (!VISIBILITIES.includes(visibility)) return fail('invalid-input', 'Visibilité inconnue.');
  if (kind === 'editorial' && visibility !== 'public') {
    return fail('invalid-input', 'Une collection éditoriale est publique.');
  }
  const now = runtime.now();
  return ok({
    id: runtime.id(),
    ownerId: input.owner.id,
    ownerName: input.owner.name,
    kind,
    title,
    description: plainText(input.description ?? '', COLLECTION_LIMITS.descriptionMax),
    theme: input.theme ? plainText(input.theme, 60) : null,
    region: input.region ? plainText(input.region, 80) : null,
    partner: kind === 'editorial' && input.partner ? plainText(input.partner, 80) : null,
    visibility,
    items: [],
    shareLinks: [],
    createdAt: now,
    updatedAt: now,
  });
}

function requireOwner(collection: Collection, viewer: Viewer): Outcome<true> {
  if (viewer.id == null) return fail('unauthenticated', 'Connexion requise.');
  if (viewer.id !== collection.ownerId) return fail('forbidden', 'Réservé au propriétaire.');
  return ok(true);
}

function touch(collection: Collection, patch: Partial<Collection>, runtime: Runtime): Collection {
  return { ...collection, ...patch, updatedAt: runtime.now() };
}

export interface AddCollectionItemInput {
  type: CollectionItemType;
  refId: string;
  title: string;
  sport?: Sport | null;
  /** Pour une collection éditoriale, l'item doit être public. */
  audience?: Audience;
}

export function addCollectionItem(
  collection: Collection,
  input: AddCollectionItemInput,
  viewer: Viewer,
  runtime: Runtime
): Outcome<Collection> {
  const owner = requireOwner(collection, viewer);
  if (!owner.ok) return owner;
  if (!ITEM_TYPES.includes(input.type)) return fail('invalid-input', 'Type d’objet inconnu.');
  if (!input.refId) return fail('invalid-input', 'Référence manquante.');
  const title = plainText(input.title, 120);
  if (!title) return fail('invalid-input', 'Titre d’objet manquant.');
  if (collection.items.length >= COLLECTION_LIMITS.itemsMax) {
    return fail('limit-reached', 'Collection pleine.');
  }
  if (collection.items.some((item) => item.type === input.type && item.refId === input.refId)) {
    return fail('invalid-input', 'Cet objet est déjà dans la collection.');
  }
  if (collection.kind === 'editorial' && input.audience != null && input.audience !== 'public') {
    return fail('invalid-input', 'Une collection éditoriale n’inclut que des objets publics.');
  }
  const position = collection.items.reduce((max, item) => Math.max(max, item.position), -1) + 1;
  const item: CollectionItem = {
    id: runtime.id(),
    type: input.type,
    refId: input.refId,
    title,
    sport: input.sport ?? null,
    position,
  };
  return ok(touch(collection, { items: [...collection.items, item] }, runtime));
}

export function removeCollectionItem(
  collection: Collection,
  itemId: string,
  viewer: Viewer,
  runtime: Runtime
): Outcome<Collection> {
  const owner = requireOwner(collection, viewer);
  if (!owner.ok) return owner;
  if (!collection.items.some((item) => item.id === itemId))
    return fail('not-found', 'Objet introuvable.');
  const items = collection.items
    .filter((item) => item.id !== itemId)
    .sort((a, b) => a.position - b.position)
    .map((item, index) => ({ ...item, position: index }));
  return ok(touch(collection, { items }, runtime));
}

export function reorderCollection(
  collection: Collection,
  orderedIds: readonly string[],
  viewer: Viewer,
  runtime: Runtime
): Outcome<Collection> {
  const owner = requireOwner(collection, viewer);
  if (!owner.ok) return owner;
  if (orderedIds.length !== collection.items.length) {
    return fail('invalid-input', 'La liste réordonnée doit contenir tous les objets.');
  }
  const byId = new Map(collection.items.map((item) => [item.id, item]));
  if (new Set(orderedIds).size !== orderedIds.length) {
    return fail('invalid-input', 'Objet répété dans l’ordre.');
  }
  const items: CollectionItem[] = [];
  for (let index = 0; index < orderedIds.length; index += 1) {
    const item = byId.get(orderedIds[index]);
    if (!item) return fail('invalid-input', 'Objet inconnu dans l’ordre.');
    items.push({ ...item, position: index });
  }
  return ok(touch(collection, { items }, runtime));
}

export function moveCollectionItem(
  collection: Collection,
  itemId: string,
  direction: 'up' | 'down',
  viewer: Viewer,
  runtime: Runtime
): Outcome<Collection> {
  const ordered = collection.items.slice().sort((a, b) => a.position - b.position);
  const index = ordered.findIndex((item) => item.id === itemId);
  if (index < 0) return fail('not-found', 'Objet introuvable.');
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= ordered.length)
    return fail('invalid-state', 'Déjà en bout de liste.');
  const next = ordered.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return reorderCollection(
    collection,
    next.map((item) => item.id),
    viewer,
    runtime
  );
}

export interface UpdateCollectionInput {
  title?: string;
  description?: string;
  theme?: string | null;
  region?: string | null;
  partner?: string | null;
  visibility?: CollectionVisibility;
}

export function updateCollection(
  collection: Collection,
  patch: UpdateCollectionInput,
  viewer: Viewer,
  runtime: Runtime
): Outcome<Collection> {
  const owner = requireOwner(collection, viewer);
  if (!owner.ok) return owner;
  const next: Partial<Collection> = {};
  if (patch.title !== undefined) {
    const title = plainText(patch.title, COLLECTION_LIMITS.titleMax);
    if (title.length < COLLECTION_LIMITS.titleMin)
      return fail('invalid-input', 'Titre trop court.');
    next.title = title;
  }
  if (patch.description !== undefined) {
    next.description = plainText(patch.description, COLLECTION_LIMITS.descriptionMax);
  }
  if (patch.theme !== undefined) next.theme = patch.theme ? plainText(patch.theme, 60) : null;
  if (patch.region !== undefined) next.region = patch.region ? plainText(patch.region, 80) : null;
  if (patch.partner !== undefined) {
    next.partner =
      collection.kind === 'editorial' && patch.partner ? plainText(patch.partner, 80) : null;
  }
  if (patch.visibility !== undefined) {
    if (!VISIBILITIES.includes(patch.visibility))
      return fail('invalid-input', 'Visibilité inconnue.');
    if (collection.kind === 'editorial' && patch.visibility !== 'public') {
      return fail('invalid-input', 'Une collection éditoriale reste publique.');
    }
    next.visibility = patch.visibility;
  }
  return ok(touch(collection, next, runtime));
}

export function sortCollectionItems(collection: Collection): CollectionItem[] {
  return collection.items.slice().sort((a, b) => a.position - b.position);
}

export function collectionContains(
  collection: Collection,
  type: CollectionItemType,
  refId: string
): boolean {
  return collection.items.some((item) => item.type === type && item.refId === refId);
}

/**
 * K5.15 — le favori devient réutilisable dans les parcours et les collections.
 * Crée « Mes lieux » à la première sauvegarde, puis ajoute le highlight.
 */
export function saveHighlightToPlaces(
  highlight: { id: string; title: string; sport: Sport; audience: Audience; authorId: string },
  owner: { id: string; name: string | null },
  collections: readonly Collection[],
  viewer: Viewer,
  runtime: Runtime
): Outcome<{ collection: Collection; created: boolean }> {
  if (viewer.id == null || viewer.id !== owner.id)
    return fail('unauthenticated', 'Connexion requise.');
  if (!canViewAudience(highlight.audience, viewerRelation(viewer, highlight.authorId))) {
    return fail('forbidden', 'Ce highlight n’est pas visible.');
  }
  const existing = collections.find(
    (collection) =>
      collection.ownerId === owner.id &&
      collection.kind === 'personal' &&
      collection.title === 'Mes lieux' &&
      collection.visibility === 'private'
  );
  if (existing) {
    if (collectionContains(existing, 'highlight', highlight.id)) {
      return ok({ collection: existing, created: false });
    }
    const added = addCollectionItem(
      existing,
      {
        type: 'highlight',
        refId: highlight.id,
        title: highlight.title,
        sport: highlight.sport,
        audience: 'private',
      },
      viewer,
      runtime
    );
    if (!added.ok) return added;
    return ok({ collection: added.value, created: false });
  }
  const created = createCollection(
    { owner, kind: 'personal', title: 'Mes lieux', visibility: 'private' },
    runtime
  );
  if (!created.ok) return created;
  const added = addCollectionItem(
    created.value,
    {
      type: 'highlight',
      refId: highlight.id,
      title: highlight.title,
      sport: highlight.sport,
      audience: 'private',
    },
    viewer,
    runtime
  );
  if (!added.ok) return added;
  return ok({ collection: added.value, created: true });
}
