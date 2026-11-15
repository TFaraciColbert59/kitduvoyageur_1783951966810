import type { Collection, CollectionSearchHit, Viewer } from '../types';
import { normalizeKey } from './result';
import { projectCollection, type ProjectCollectionOptions } from '../privacy';

export interface SearchCollectionsOptions extends ProjectCollectionOptions {
  limit?: number;
}

function queryTokens(query: string): string[] {
  return normalizeKey(query)
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 2);
}

/**
 * Recherche de collections (K5.18). Une collection privée ou non listée d'un
 * autre propriétaire n'entre jamais dans l'index ; un lien révoqué ne rend pas
 * la collection trouvable.
 */
export function searchCollections(
  query: string,
  collections: readonly Collection[],
  viewer: Viewer,
  options: SearchCollectionsOptions = {}
): CollectionSearchHit[] {
  const tokens = queryTokens(query);
  const hits: CollectionSearchHit[] = [];

  for (const collection of collections) {
    const view = projectCollection(collection, viewer, options);
    if (!view) continue;
    const fields = {
      title: normalizeKey(collection.title),
      description: normalizeKey(collection.description),
      theme: normalizeKey(collection.theme ?? ''),
      region: normalizeKey(collection.region ?? ''),
    };
    const haystack = `${fields.title} ${fields.description} ${fields.theme} ${fields.region}`;
    if (tokens.length > 0 && !tokens.every((token) => haystack.includes(token))) continue;

    let score = 0;
    let reason: CollectionSearchHit['reason'] = 'title';
    if (tokens.length === 0) {
      score = 0;
    } else {
      for (const token of tokens) {
        if (fields.title === normalizeKey(query)) score += 12;
        if (fields.title.startsWith(token)) score += 6;
        else if (fields.title.includes(token)) score += 4;
        if (fields.theme.includes(token)) {
          score += 3;
          reason = 'theme';
        }
        if (fields.region.includes(token)) {
          score += 2;
          reason = reason === 'title' ? 'region' : reason;
        }
        if (fields.description.includes(token)) {
          score += 1;
          if (reason === 'title') reason = 'description';
        }
      }
    }
    hits.push({ collection: view, score, reason });
  }

  hits.sort(
    (a, b) => b.score - a.score || b.collection.updatedAt.localeCompare(a.collection.updatedAt)
  );
  return hits.slice(0, options.limit ?? 20);
}
