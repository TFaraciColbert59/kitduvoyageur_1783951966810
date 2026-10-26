'use client';

import React from 'react';
import type { CreateKind } from '../engine/createSchemas';
import type { MediaItem } from './mediaTypes';
import './create-shared.css';

/**
 * Aperçu compact et réel de la carte/story en cours de création.
 *
 * Il lit les valeurs courantes du formulaire (titre, type, couverture,
 * résumé) et reste sur une seule ligne pour ne jamais pousser le footer :
 * le corps du drawer scrolle, le footer reste collé en bas.
 */

export interface FormPreviewData {
  typeLabel: string;
  title: string;
  summary: string;
  meta: string;
  cover: MediaItem | null;
}

const POST_KIND_LABELS: Record<string, string> = {
  photo: 'Photo / vidéo',
  billet: 'Billet',
  question: 'Question',
  event: 'Événement',
};

const SEASON_LABELS: Record<string, string> = {
  toute_saison: 'Toute saison',
  printemps: 'Printemps',
  ete: 'Été',
  automne: 'Automne',
  hiver: 'Hiver',
};

const LEVEL_LABELS: Record<string, string> = {
  facile: 'Facile',
  moyen: 'Moyen',
  difficile: 'Difficile',
};

const AUDIENCE_LABELS: Record<string, string> = {
  public: 'Tout le monde',
  abonnies: 'Abonnés',
  club: 'Un club',
  only_me: 'Moi uniquement',
};

const REPLY_LABELS: Record<string, string> = {
  everyone: 'Réponses ouvertes',
  followers: 'Réponses des abonnés',
  off: 'Réponses coupées',
};

const FALLBACK_TITLES: Record<CreateKind, string> = {
  post: 'Publication à venir',
  story: 'Story sans légende',
  carnet: 'Titre du carnet',
  sortie: 'Titre de la sortie',
  kit: 'Nom du kit',
  club: 'Nom du club',
};

const FALLBACK_SUMMARIES: Record<CreateKind, string> = {
  post: 'Ajoute un texte ou un média.',
  story: 'Choisis une photo ou une vidéo.',
  carnet: 'Destination et récit apparaîtront ici.',
  sortie: 'Lieu et date apparaîtront ici.',
  kit: 'Décris ton matériel.',
  club: 'Présente ta cordée.',
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numeric(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isMedia(value: unknown): value is MediaItem {
  const record = asRecord(value);
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    typeof record.type === 'string' &&
    typeof record.status === 'string'
  );
}

function mediaList(value: unknown): MediaItem[] {
  return Array.isArray(value) ? value.filter(isMedia) : [];
}

function chooseCover(items: MediaItem[]): MediaItem | null {
  return items.find((item) => item.cover) ?? items[0] ?? null;
}

/** Première ligne significative d’un texte markdown léger. */
export function firstLine(value: string, max = 96): string {
  const line = value
    .split('\n')
    .map((entry) => entry.replace(/^#+\s*/, '').replace(/^\*\*|\*\*$/g, '').trim())
    .find(Boolean);
  if (!line) return '';
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

function excerpt(value: string, max = 96): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

function dateRange(start: string, end: string): string {
  if (start && end) return `${start} → ${end}`;
  return start || end || '';
}

function weightLabel(grams: number): string {
  if (grams <= 0) return 'Poids à définir';
  if (grams >= 1000) {
    const kg = (grams / 1000)
      .toFixed(2)
      .replace(/0+$/, '')
      .replace(/\.$/, '')
      .replace('.', ',');
    return `${kg} kg`;
  }
  return `${grams} g`;
}

function joinMeta(parts: Array<string | false | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(' · ');
}

/** Construit l’aperçu réel à partir des valeurs courantes du formulaire. */
export function buildFormPreview(kind: CreateKind, values: unknown): FormPreviewData {
  const record = asRecord(values);
  const title = text(record.title);
  const name = text(record.name);
  const content = text(record.content);
  const description = text(record.description);

  if (kind === 'post') {
    const postKind = text(record.kind) || 'photo';
    const cover = chooseCover(mediaList(record.media));
    const isPhoto = postKind === 'photo';
    const displayTitle = isPhoto
      ? firstLine(content) || FALLBACK_TITLES.post
      : title || FALLBACK_TITLES.post;
    const summary = isPhoto
      ? content
        ? excerpt(content)
        : FALLBACK_SUMMARIES.post
      : content
        ? excerpt(content)
        : FALLBACK_SUMMARIES.post;
    return {
      typeLabel: POST_KIND_LABELS[postKind] ?? 'Publication',
      title: displayTitle,
      summary,
      meta: joinMeta([
        AUDIENCE_LABELS[text(record.audience)],
        text(record.location) ? `📍 ${text(record.location)}` : '',
        postKind === 'event' && text(record.eventDate) ? text(record.eventDate) : '',
        text(record.scheduledAt) ? `Programmé · ${text(record.scheduledAt)}` : '',
        Array.isArray(record.pollOptions) && record.pollOptions.length >= 2
          ? `Sondage · ${record.pollOptions.length} options`
          : '',
      ]),
      cover,
    };
  }

  if (kind === 'story') {
    const cover = chooseCover(mediaList(record.media));
    const caption = text(record.caption);
    return {
      typeLabel: 'Story · 24 h',
      title: firstLine(caption) || FALLBACK_TITLES.story,
      summary: caption ? excerpt(caption) : FALLBACK_SUMMARIES.story,
      meta: joinMeta([
        AUDIENCE_LABELS[text(record.audience)],
        REPLY_LABELS[text(record.replyPolicy)],
      ]),
      cover,
    };
  }

  if (kind === 'carnet') {
    const destination = text(record.destination);
    return {
      typeLabel: 'Carnet',
      title: title || FALLBACK_TITLES.carnet,
      summary: description ? excerpt(description) : destination || FALLBACK_SUMMARIES.carnet,
      meta: joinMeta([
        dateRange(text(record.startDate), text(record.endDate)),
        text(record.visibility) === 'private' ? 'Privé' : 'Public',
      ]),
      cover: chooseCover(mediaList(record.cover)),
    };
  }

  if (kind === 'sortie') {
    const location = text(record.location);
    return {
      typeLabel: 'Sortie',
      title: title || FALLBACK_TITLES.sortie,
      summary: description ? excerpt(description) : location || FALLBACK_SUMMARIES.sortie,
      meta: joinMeta([
        text(record.startDate),
        LEVEL_LABELS[text(record.level)],
        numeric(record.maxParticipants, 0) > 0
          ? `${numeric(record.maxParticipants)} pers.`
          : '',
      ]),
      cover: chooseCover(mediaList(record.cover)),
    };
  }

  if (kind === 'kit') {
    return {
      typeLabel: 'Kit',
      title: name || FALLBACK_TITLES.kit,
      summary: description ? excerpt(description) : FALLBACK_SUMMARIES.kit,
      meta: joinMeta([
        SEASON_LABELS[text(record.season)],
        weightLabel(numeric(record.weightG)),
        record.isPublic === false ? 'Privé' : 'Public',
      ]),
      cover: chooseCover(mediaList(record.cover)),
    };
  }

  return {
    typeLabel: 'Club',
    title: name || FALLBACK_TITLES.club,
    summary: description ? excerpt(description) : FALLBACK_SUMMARIES.club,
    meta: joinMeta([
      text(record.category),
      text(record.location) ? `📍 ${text(record.location)}` : '',
      text(record.privacy) === 'closed' ? 'Sur demande' : 'Ouvert',
    ]),
    cover: chooseCover(mediaList(record.cover)),
  };
}

export interface FormPreviewProps {
  kind: CreateKind;
  values: unknown;
  className?: string;
}

export function FormPreview({ kind, values, className = '' }: FormPreviewProps) {
  const preview = buildFormPreview(kind, values);
  const src = preview.cover?.previewUrl || preview.cover?.url || '';
  const isVideo = preview.cover?.type?.startsWith('video/') ?? false;
  const hasRealTitle = preview.title && preview.title !== FALLBACK_TITLES[kind];
  const hasRealSummary = preview.summary && preview.summary !== FALLBACK_SUMMARIES[kind];
  if (!src && !hasRealTitle && !hasRealSummary) return null;

  return (
    <aside
      className={`lkdv-create-form-preview ${className}`.trim()}
      data-testid="form-preview"
      data-preview-kind={kind}
      aria-label={`Aperçu — ${preview.typeLabel}`}
    >
      {src ? (
        <span className="lkdv-create-form-preview-cover">
          {isVideo ? (
            <video src={src} muted playsInline preload="metadata" aria-hidden="true" />
          ) : (
            <img
              src={src}
              alt={preview.cover?.alt || `Couverture — ${preview.title}`}
            />
          )}
        </span>
      ) : null}
      <div className="lkdv-create-form-preview-txt">
        <small className="lkdv-create-form-preview-kind">{preview.typeLabel}</small>
        <b>{preview.title}</b>
        <span className="lkdv-create-form-preview-summary">{preview.summary}</span>
        {preview.meta ? (
          <small className="lkdv-create-form-preview-meta">{preview.meta}</small>
        ) : null}
      </div>
    </aside>
  );
}

export default FormPreview;
