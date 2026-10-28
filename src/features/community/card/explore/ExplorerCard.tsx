'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type {
  CarnetRow,
  ClubRow,
  EventRow,
} from '@/features/community/card/sections/useCommunitySections';

export type ExplorerItem =
  | { kind: 'carnet'; row: CarnetRow }
  | { kind: 'club'; row: ClubRow }
  | { kind: 'sortie'; row: EventRow };

const dateFr = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('fr-FR') : null;

export function itemKey(item: ExplorerItem): string {
  return `${item.kind}-${item.row.id}`;
}

export function itemTitle(item: ExplorerItem): string {
  return item.kind === 'club' ? item.row.name : item.row.title;
}

export function itemCover(item: ExplorerItem): string | null {
  return item.row.cover_image ?? null;
}

/** Ligne de contexte : auteur et date, membres et catégorie, date lieu et places. */
export function itemMeta(item: ExplorerItem): string {
  if (item.kind === 'carnet')
    return [item.row.author_name, dateFr(item.row.created_at)].filter(Boolean).join(' · ');
  if (item.kind === 'club')
    return `${item.row.members_count ?? 0} membres${item.row.category ? ` · ${item.row.category}` : ''}`;
  const places = item.row.max_participants
    ? `${item.row.current_participants ?? 0}/${item.row.max_participants}`
    : `${item.row.current_participants ?? 0}`;
  return [dateFr(item.row.event_date), item.row.location, `${places} inscrits`]
    .filter(Boolean)
    .join(' · ');
}

export function itemHref(item: ExplorerItem): string {
  if (item.kind === 'carnet') return `/carnets/${item.row.id}`;
  if (item.kind === 'club') return `/clubs/${item.row.slug || item.row.id}`;
  return '/evenements';
}

/** Verbe de l'action principale selon l'état de la personne ; `null` pour un carnet (lecture seule). */
export function itemActionLabel(item: ExplorerItem): string | null {
  if (item.kind === 'club') return item.row.is_member ? 'Quitter' : 'Rejoindre';
  if (item.kind === 'sortie') return item.row.is_registered ? 'Se désinscrire' : 'S’inscrire';
  return null;
}

function Cover({ item, className }: { item: ExplorerItem; className: string }) {
  const src = itemCover(item);
  return (
    <span className={className} aria-hidden="true">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- couvertures distantes
        <img src={src} alt="" loading="lazy" decoding="async" />
      ) : (
        <b>{itemTitle(item).charAt(0).toUpperCase()}</b>
      )}
    </span>
  );
}

/** Grande carte d'un carrousel : couverture, titre 19/700, contexte, description, action. */
export function ExplorerCard({
  item,
  onOpen,
  onAction,
}: {
  item: ExplorerItem;
  onOpen: () => void;
  onAction: () => void;
}) {
  const action = itemActionLabel(item);
  const description = item.row.description?.trim();
  return (
    <article className="lkdv-ex-card">
      <button
        type="button"
        className="lkdv-ex-card-open"
        onClick={onOpen}
        aria-label={`Ouvrir ${itemTitle(item)}`}
      >
        <Cover item={item} className="lkdv-ex-card-cover" />
        <span className="lkdv-ex-card-body">
          <b>{itemTitle(item)}</b>
          <small>{itemMeta(item)}</small>
          {description ? <span className="lkdv-ex-card-desc">{description}</span> : null}
        </span>
      </button>
      <div className="lkdv-ex-card-actions">
        {action ? (
          <button type="button" className="lkdv-ex-primary" onClick={onAction}>
            {action}
          </button>
        ) : (
          <button type="button" className="lkdv-ex-primary" onClick={onOpen}>
            Lire
          </button>
        )}
        <Link href={itemHref(item)} className="lkdv-ex-secondary">
          Voir la page
        </Link>
      </div>
    </article>
  );
}

/** Petite carte d'un rail « Pour toi ». */
export function ExplorerMini({ item, onOpen }: { item: ExplorerItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="lkdv-ex-mini"
      onClick={onOpen}
      aria-label={`Ouvrir ${itemTitle(item)}`}
    >
      <Cover item={item} className="lkdv-ex-mini-cover" />
      <b>{itemTitle(item)}</b>
      <small>{itemMeta(item)}</small>
    </button>
  );
}

/** Détail en place : remplace le carrousel dans la carte, avec retour. */
export function ExplorerDetail({
  item,
  onBack,
  onAction,
  onClose,
}: {
  item: ExplorerItem;
  onBack: () => void;
  onAction: () => void;
  onClose: () => void;
}) {
  const action = itemActionLabel(item);
  const description = item.row.description?.trim();
  return (
    <section className="lkdv-ex-detail" aria-label={itemTitle(item)}>
      <button type="button" className="lkdv-ex-back" onClick={onBack}>
        <ChevronLeft size={18} aria-hidden="true" />
        Retour
      </button>
      <Cover item={item} className="lkdv-ex-detail-cover" />
      <h3>{itemTitle(item)}</h3>
      <p className="lkdv-ex-detail-meta">{itemMeta(item)}</p>
      {description ? <p className="lkdv-ex-detail-desc">{description}</p> : null}
      <div className="lkdv-ex-card-actions">
        {action ? (
          <button type="button" className="lkdv-ex-primary" onClick={onAction}>
            {action}
          </button>
        ) : null}
        <Link href={itemHref(item)} className="lkdv-ex-secondary" onClick={onClose}>
          Voir la page
        </Link>
      </div>
    </section>
  );
}
