import type { Collection, Highlight } from '../types';

export interface HighlightsStore {
  listHighlights(): readonly Highlight[];
  getHighlight(id: string): Highlight | null;
  saveHighlight(highlight: Highlight): void;
  listCollections(): readonly Collection[];
  getCollection(id: string): Collection | null;
  saveCollection(collection: Collection): void;
  deleteCollection(id: string): void;
}

export interface HighlightsSeed {
  highlights?: Highlight[];
  collections?: Collection[];
}

/**
 * Adaptateur mémoire : les tests et la préproduction peuvent monter le lot
 * sans base. Le port `HighlightsStore` est le point où un adaptateur Supabase
 * (RLS par `auth.uid()`) se branchera sans toucher aux moteurs.
 */
export class InMemoryHighlightsStore implements HighlightsStore {
  private readonly highlights = new Map<string, Highlight>();
  private readonly collections = new Map<string, Collection>();

  constructor(seed: HighlightsSeed = {}) {
    for (const highlight of seed.highlights ?? []) this.highlights.set(highlight.id, highlight);
    for (const collection of seed.collections ?? [])
      this.collections.set(collection.id, collection);
  }

  listHighlights(): readonly Highlight[] {
    return [...this.highlights.values()];
  }

  getHighlight(id: string): Highlight | null {
    return this.highlights.get(id) ?? null;
  }

  saveHighlight(highlight: Highlight): void {
    this.highlights.set(highlight.id, highlight);
  }

  listCollections(): readonly Collection[] {
    return [...this.collections.values()];
  }

  getCollection(id: string): Collection | null {
    return this.collections.get(id) ?? null;
  }

  saveCollection(collection: Collection): void {
    this.collections.set(collection.id, collection);
  }

  deleteCollection(id: string): void {
    this.collections.delete(id);
  }
}
