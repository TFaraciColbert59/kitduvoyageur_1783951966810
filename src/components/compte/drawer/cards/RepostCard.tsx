'use client';

import React from 'react';

export interface RepostItem {
  id: string;
  sourceId?: string;
  sourceTitle: string;
  sourceAuthor?: string;
  /** Date du relais (celle de la ligne `community_posts`). */
  createdAt?: string;
  audience?: string;
}

const AUDIENCE_LABELS: Record<string, string> = {
  public: 'Public',
  abonnies: 'Abonnés',
  club: 'Club',
};

/** Date lisible sans décaler les dates pures (`YYYY-MM-DD`) d'un fuseau. */
function formatCardDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(dateOnly ? { timeZone: 'UTC' as const } : {}),
  }).format(date);
}

const THUMB_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="m3 19 6-12 4 7 2-3 6 8H3Z" />
    <path d="m7 12 2 1 1-2" />
  </svg>
);

/**
 * Carte d'une republication : vignette de la source, auteur d'origine, date du
 * relais, audience et lien vers la publication originale. Aucune valeur n'est
 * fabriquée : les champs absents sont simplement omis. Le nom accessible est
 * porté par l'élément de liste, pas par les spans décoratifs internes.
 */
export function RepostCard({ repost }: { repost: RepostItem }) {
  const title = repost.sourceTitle.trim() || 'Publication sans titre';
  const author = repost.sourceAuthor?.trim() || '';
  const relayDate = formatCardDate(repost.createdAt);
  const audience = repost.audience?.trim() || '';
  const audienceLabel = audience ? AUDIENCE_LABELS[audience] || audience : '';
  const href = `/communaute/post/${encodeURIComponent(repost.sourceId || repost.id)}`;
  const itemLabel = author
    ? `Republication : ${title}, source ${author}`
    : `Republication : ${title}`;

  return (
    <li className="li lkdv-repost" aria-label={itemLabel}>
      <span className="lkdv-repost-thumb" aria-hidden="true">
        {THUMB_ICON}
      </span>

      <div className="lkdv-repost-main">
        <b className="lkdv-repost-title">{title}</b>
        <div className="lkdv-repost-meta">
          {author ? (
            <span className="lkdv-repost-author">{author}</span>
          ) : null}
          {relayDate ? (
            <time className="lkdv-repost-date" dateTime={repost.createdAt}>
              Relayé le {relayDate}
            </time>
          ) : null}
          {audienceLabel ? (
            <span className="ig-pill lkdv-repost-audience">{audienceLabel}</span>
          ) : null}
        </div>
      </div>

      <a
        className="mbtn soft lkdv-repost-original"
        href={href}
        aria-label={`Voir l'original : ${title}`}
      >
        Voir l&apos;original
      </a>
    </li>
  );
}

export default RepostCard;
