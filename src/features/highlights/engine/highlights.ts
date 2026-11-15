import type {
  Audience,
  GeoPoint,
  Highlight,
  HighlightKind,
  HighlightPhoto,
  HighlightPrivacy,
  Outcome,
  Sport,
  Viewer,
} from '../types';
import { canViewAudience, isValidPoint, viewerRelation } from '../privacy';
import { fail, ok, plainText } from './result';
import type { Runtime } from './runtime';

const SPORTS: readonly Sport[] = ['hike', 'trail', 'mtb', 'road', 'gravel', 'ski', 'other'];
const AUDIENCES: readonly Audience[] = ['private', 'followers', 'public'];

export const HIGHLIGHT_LIMITS = {
  titleMin: 3,
  titleMax: 80,
  descriptionMax: 600,
  areaLabelMax: 120,
  tipMin: 3,
  tipMax: 500,
  tipsMax: 50,
  photosMax: 24,
} as const;

export interface CreateHighlightInput {
  author: { id: string; name: string | null };
  kind: HighlightKind;
  target: { type: 'place' | 'segment' | 'route'; id: string };
  title: string;
  description: string;
  sport: Sport;
  areaLabel: string;
  location: GeoPoint | null;
  audience?: Audience;
  privacy?: Partial<HighlightPrivacy>;
}

export interface ContributionAuthor {
  id: string;
  name: string | null;
}

function cleanAudience(value: Audience | undefined): Audience {
  return value && AUDIENCES.includes(value) ? value : 'private';
}

function cleanPrivacy(
  value: Partial<HighlightPrivacy> | undefined,
  location: GeoPoint | null
): HighlightPrivacy {
  return {
    hideExactLocation: value?.hideExactLocation ?? location == null,
    hidePhotos: value?.hidePhotos ?? false,
    requireExifStripped: value?.requireExifStripped ?? true,
    allowContributions: value?.allowContributions ?? true,
  };
}

export function createHighlight(input: CreateHighlightInput, runtime: Runtime): Outcome<Highlight> {
  if (!input.author.id)
    return fail('unauthenticated', 'Connexion requise pour créer un highlight.');
  if (!SPORTS.includes(input.sport)) return fail('invalid-input', 'Sport inconnu.');
  if (!input.target.id) return fail('invalid-input', 'Le lieu ou le tronçon est requis.');
  if (input.kind === 'segment' && input.target.type !== 'segment') {
    return fail('invalid-input', 'Un highlight de tronçon doit cibler un segment.');
  }
  if (input.kind === 'place' && input.target.type === 'segment') {
    return fail('invalid-input', 'Un highlight de lieu ne peut pas cibler un segment.');
  }

  const title = plainText(input.title, HIGHLIGHT_LIMITS.titleMax);
  if (title.length < HIGHLIGHT_LIMITS.titleMin) {
    return fail('invalid-input', `Titre : ${HIGHLIGHT_LIMITS.titleMin} caractères minimum.`);
  }
  const description = plainText(input.description, HIGHLIGHT_LIMITS.descriptionMax);
  const areaLabel = plainText(input.areaLabel, HIGHLIGHT_LIMITS.areaLabelMax);
  if (!areaLabel)
    return fail('invalid-input', 'Le secteur est requis (même sans position exacte).');
  if (input.location != null && !isValidPoint(input.location)) {
    return fail('invalid-input', 'Position invalide.');
  }

  const now = runtime.now();
  const highlight: Highlight = {
    id: runtime.id(),
    authorId: input.author.id,
    authorName: input.author.name,
    kind: input.kind,
    target: { ...input.target },
    title,
    description,
    sport: input.sport,
    areaLabel,
    location: input.location ? { lat: input.location.lat, lng: input.location.lng } : null,
    privacy: cleanPrivacy(input.privacy, input.location),
    audience: cleanAudience(input.audience),
    photos: [],
    tips: [],
    votes: [],
    status: 'published',
    createdAt: now,
    updatedAt: now,
  };

  return ok(highlight);
}

function canContribute(highlight: Highlight, viewer: Viewer): boolean {
  if (viewer.id == null || highlight.status !== 'published') return false;
  if (!highlight.privacy.allowContributions) return false;
  return canViewAudience(highlight.audience, viewerRelation(viewer, highlight.authorId));
}

function withUpdate(highlight: Highlight, patch: Partial<Highlight>, runtime: Runtime): Highlight {
  return { ...highlight, ...patch, updatedAt: runtime.now() };
}

export function addTip(
  highlight: Highlight,
  author: ContributionAuthor,
  body: string,
  viewer: Viewer,
  runtime: Runtime
): Outcome<Highlight> {
  if (viewer.id == null || viewer.id !== author.id)
    return fail('unauthenticated', 'Connexion requise.');
  if (highlight.status === 'removed') return fail('invalid-state', 'Ce highlight a été retiré.');
  if (!canContribute(highlight, viewer))
    return fail('forbidden', 'Les contributions sont fermées.');
  if (highlight.tips.length >= HIGHLIGHT_LIMITS.tipsMax) {
    return fail('limit-reached', 'Trop de conseils sur ce highlight.');
  }
  const text = plainText(body, HIGHLIGHT_LIMITS.tipMax);
  if (text.length < HIGHLIGHT_LIMITS.tipMin) {
    return fail('invalid-input', `Conseil : ${HIGHLIGHT_LIMITS.tipMin} caractères minimum.`);
  }
  const now = runtime.now();
  const tip = {
    id: runtime.id(),
    authorId: author.id,
    authorName: author.name,
    body: text,
    createdAt: now,
  };
  return ok(withUpdate(highlight, { tips: [...highlight.tips, tip] }, runtime));
}

export interface AddPhotoInput {
  author: ContributionAuthor;
  url: string;
  caption?: string | null;
  exifStripped: boolean;
  masked?: boolean;
  consentPublic?: boolean;
}

function isSafePhotoUrl(url: string): boolean {
  if (url.startsWith('/')) return !url.startsWith('//');
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function addPhoto(
  highlight: Highlight,
  input: AddPhotoInput,
  viewer: Viewer,
  runtime: Runtime
): Outcome<Highlight> {
  if (viewer.id == null || viewer.id !== input.author.id)
    return fail('unauthenticated', 'Connexion requise.');
  if (highlight.status === 'removed') return fail('invalid-state', 'Ce highlight a été retiré.');
  if (!canContribute(highlight, viewer))
    return fail('forbidden', 'Les contributions sont fermées.');
  if (highlight.photos.length >= HIGHLIGHT_LIMITS.photosMax) {
    return fail('limit-reached', 'Galerie pleine pour ce highlight.');
  }
  if (!input.exifStripped) {
    return fail('invalid-input', 'La photo doit être nettoyée de ses métadonnées (P01).');
  }
  const url = input.url.trim();
  if (!isSafePhotoUrl(url)) return fail('invalid-input', 'Adresse de photo invalide.');
  const now = runtime.now();
  const photo: HighlightPhoto = {
    id: runtime.id(),
    authorId: input.author.id,
    url,
    caption: input.caption ? plainText(input.caption, 160) : null,
    masked: input.masked === true,
    exifStripped: true,
    consentPublic: input.consentPublic !== false,
    createdAt: now,
  };
  return ok(withUpdate(highlight, { photos: [...highlight.photos, photo] }, runtime));
}

export function toggleVote(
  highlight: Highlight,
  viewer: Viewer,
  value: 1 | -1,
  runtime: Runtime
): Outcome<Highlight> {
  if (viewer.id == null) return fail('unauthenticated', 'Connexion requise pour voter.');
  if (highlight.status !== 'published')
    return fail('invalid-state', 'Ce highlight n’est plus votable.');
  if (viewer.id === highlight.authorId)
    return fail('forbidden', 'On ne vote pas pour son propre highlight.');
  if (!canViewAudience(highlight.audience, viewerRelation(viewer, highlight.authorId))) {
    return fail('forbidden', 'Ce highlight n’est pas visible.');
  }
  if (value !== 1 && value !== -1) return fail('invalid-input', 'Vote invalide.');

  const existing = highlight.votes.find((vote) => vote.userId === viewer.id);
  let votes: Highlight['votes'];
  if (!existing) {
    votes = [...highlight.votes, { userId: viewer.id, value, createdAt: runtime.now() }];
  } else if (existing.value === value) {
    votes = highlight.votes.filter((vote) => vote.userId !== viewer.id);
  } else {
    votes = highlight.votes.map((vote) =>
      vote.userId === viewer.id ? { ...vote, value, createdAt: runtime.now() } : vote
    );
  }
  return ok(withUpdate(highlight, { votes }, runtime));
}

export function removeContribution(
  highlight: Highlight,
  contributionId: string,
  contributionKind: 'tip' | 'photo',
  viewer: Viewer,
  runtime: Runtime
): Outcome<Highlight> {
  if (viewer.id == null) return fail('unauthenticated', 'Connexion requise.');
  const isOwner = viewer.id === highlight.authorId;
  if (contributionKind === 'tip') {
    const tip = highlight.tips.find((item) => item.id === contributionId);
    if (!tip) return fail('not-found', 'Conseil introuvable.');
    if (!isOwner && tip.authorId !== viewer.id)
      return fail('forbidden', 'Suppression non autorisée.');
    return ok(
      withUpdate(
        highlight,
        { tips: highlight.tips.filter((item) => item.id !== contributionId) },
        runtime
      )
    );
  }
  const photo = highlight.photos.find((item) => item.id === contributionId);
  if (!photo) return fail('not-found', 'Photo introuvable.');
  if (!isOwner && photo.authorId !== viewer.id)
    return fail('forbidden', 'Suppression non autorisée.');
  return ok(
    withUpdate(
      highlight,
      { photos: highlight.photos.filter((item) => item.id !== contributionId) },
      runtime
    )
  );
}

export function setHighlightAudience(
  highlight: Highlight,
  audience: Audience,
  viewer: Viewer,
  runtime: Runtime
): Outcome<Highlight> {
  if (viewer.id == null || viewer.id !== highlight.authorId)
    return fail('forbidden', 'Réservé à l’auteur.');
  if (!AUDIENCES.includes(audience)) return fail('invalid-input', 'Audience inconnue.');
  return ok(withUpdate(highlight, { audience }, runtime));
}

export function setHighlightPrivacy(
  highlight: Highlight,
  patch: Partial<HighlightPrivacy>,
  viewer: Viewer,
  runtime: Runtime
): Outcome<Highlight> {
  if (viewer.id == null || viewer.id !== highlight.authorId)
    return fail('forbidden', 'Réservé à l’auteur.');
  // Masquer la position quand il n’y en a pas est sans effet, mais reste valide.
  const privacy: HighlightPrivacy = { ...highlight.privacy, ...patch };
  return ok(withUpdate(highlight, { privacy }, runtime));
}

export function setHighlightStatus(
  highlight: Highlight,
  status: Highlight['status'],
  viewer: Viewer,
  runtime: Runtime
): Outcome<Highlight> {
  if (viewer.id == null || viewer.id !== highlight.authorId)
    return fail('forbidden', 'Réservé à l’auteur.');
  if (highlight.status === 'removed')
    return fail('invalid-state', 'Un highlight retiré ne revient pas.');
  if (!['published', 'hidden', 'removed'].includes(status))
    return fail('invalid-input', 'État inconnu.');
  return ok(withUpdate(highlight, { status }, runtime));
}
