import type {
  Audience,
  Highlight,
  HighlightPrivacy,
  HighlightView,
  Outcome,
  Viewer,
} from '../types';
import { projectHighlight } from '../privacy';
import {
  addPhoto,
  addTip,
  createHighlight,
  removeContribution,
  setHighlightAudience,
  setHighlightPrivacy,
  setHighlightStatus,
  toggleVote,
  type AddPhotoInput,
  type ContributionAuthor,
  type CreateHighlightInput,
} from '../engine/highlights';
import { defaultRuntime, type Runtime } from '../engine/runtime';
import { fail, ok } from '../engine/result';
import type { HighlightsStore } from './store';

function requireViewer(viewer: Viewer): Outcome<true> {
  if (viewer.id == null) return fail('unauthenticated', 'Connexion requise.');
  return ok(true);
}

/**
 * Service Highlights : orchestre les moteurs purs et le port de stockage.
 * Aucune lecture directe n'est renvoyée aux composants : tout passe par
 * `projectHighlight` (P01).
 */
export class HighlightsService {
  constructor(
    private readonly store: HighlightsStore,
    private readonly runtime: Runtime = defaultRuntime()
  ) {}

  list(viewer: Viewer): HighlightView[] {
    return this.store
      .listHighlights()
      .map((highlight) => projectHighlight(highlight, viewer))
      .filter((view): view is HighlightView => view != null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  get(id: string, viewer: Viewer): Outcome<HighlightView> {
    const highlight = this.store.getHighlight(id);
    if (!highlight) return fail('not-found', 'Highlight introuvable.');
    const view = projectHighlight(highlight, viewer);
    if (!view) return fail('forbidden', 'Ce highlight n’est pas visible.');
    return ok(view);
  }

  create(input: CreateHighlightInput, viewer: Viewer): Outcome<HighlightView> {
    const guard = requireViewer(viewer);
    if (!guard.ok) return guard;
    if (input.author.id !== viewer.id) return fail('forbidden', 'Auteur incohérent.');
    const created = createHighlight(input, this.runtime);
    if (!created.ok) return created;
    this.store.saveHighlight(created.value);
    return ok(projectHighlight(created.value, viewer) as HighlightView);
  }

  contributeTip(
    id: string,
    author: ContributionAuthor,
    body: string,
    viewer: Viewer
  ): Outcome<HighlightView> {
    return this.mutate(
      id,
      (highlight) => addTip(highlight, author, body, viewer, this.runtime),
      viewer
    );
  }

  contributePhoto(id: string, input: AddPhotoInput, viewer: Viewer): Outcome<HighlightView> {
    return this.mutate(id, (highlight) => addPhoto(highlight, input, viewer, this.runtime), viewer);
  }

  vote(id: string, viewer: Viewer, value: 1 | -1): Outcome<HighlightView> {
    return this.mutate(
      id,
      (highlight) => toggleVote(highlight, viewer, value, this.runtime),
      viewer
    );
  }

  removeContribution(
    id: string,
    contributionId: string,
    kind: 'tip' | 'photo',
    viewer: Viewer
  ): Outcome<HighlightView> {
    return this.mutate(
      id,
      (highlight) => removeContribution(highlight, contributionId, kind, viewer, this.runtime),
      viewer
    );
  }

  setAudience(id: string, audience: Audience, viewer: Viewer): Outcome<HighlightView> {
    return this.mutate(
      id,
      (highlight) => setHighlightAudience(highlight, audience, viewer, this.runtime),
      viewer
    );
  }

  setPrivacy(id: string, patch: Partial<HighlightPrivacy>, viewer: Viewer): Outcome<HighlightView> {
    return this.mutate(
      id,
      (highlight) => setHighlightPrivacy(highlight, patch, viewer, this.runtime),
      viewer
    );
  }

  setStatus(id: string, status: Highlight['status'], viewer: Viewer): Outcome<HighlightView> {
    return this.mutate(
      id,
      (highlight) => setHighlightStatus(highlight, status, viewer, this.runtime),
      viewer
    );
  }

  private mutate(
    id: string,
    mutation: (highlight: Highlight) => Outcome<Highlight>,
    viewer: Viewer
  ): Outcome<HighlightView> {
    const guard = requireViewer(viewer);
    if (!guard.ok) return guard;
    const highlight = this.store.getHighlight(id);
    if (!highlight) return fail('not-found', 'Highlight introuvable.');
    const result = mutation(highlight);
    if (!result.ok) return result;
    this.store.saveHighlight(result.value);
    const view = projectHighlight(result.value, viewer);
    if (!view) return fail('forbidden', 'Ce highlight n’est pas visible.');
    return ok(view);
  }
}
