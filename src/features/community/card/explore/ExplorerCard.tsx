'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, BookOpen, CalendarCheck, CalendarPlus, ChevronLeft, UserCheck, UserPlus } from 'lucide-react';
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

/** Icône de l'action principale : rejoindre / déjà membre, s'inscrire / inscrit, lire. */
function ActionIcon({ item }: { item: ExplorerItem }) {
  if (item.kind === 'club') return item.row.is_member ? <UserCheck size={17} aria-hidden="true" /> : <UserPlus size={17} aria-hidden="true" />;
  if (item.kind === 'sortie') return item.row.is_registered ? <CalendarCheck size={17} aria-hidden="true" /> : <CalendarPlus size={17} aria-hidden="true" />;
  return <BookOpen size={17} aria-hidden="true" />;
}

/**
 * Grande carte d'un carrousel : l'image occupe toute la carte, rien ne la
 * recouvre en dur. Titre et repères dans une pastille de verre, actions en
 * petites pilules de verre ; pas de description (elle est sur la page).
 */
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
  const active = item.kind === 'club' ? Boolean(item.row.is_member) : item.kind === 'sortie' ? Boolean(item.row.is_registered) : false;
  return (
    <article className="lkdv-ex-card" data-cover={itemCover(item) ? 'true' : 'false'}>
      <button
        type="button"
        className="lkdv-ex-card-open"
        onClick={onOpen}
        aria-label={`Ouvrir ${itemTitle(item)}`}
      >
        <Cover item={item} className="lkdv-ex-card-cover" />
      </button>
      <div className="lkdv-ex-card-glass">
        <span className="lkdv-ex-card-body">
          <b>{itemTitle(item)}</b>
          <small>{itemMeta(item)}</small>
        </span>
        <div className="lkdv-ex-card-actions">
          <button
            type="button"
            className="lkdv-ex-pill"
            data-on={active ? 'true' : 'false'}
            onClick={action ? onAction : onOpen}
            aria-label={action ?? 'Lire'}
            title={action ?? 'Lire'}
          >
            <ActionIcon item={item} />
          </button>
          <Link href={itemHref(item)} className="lkdv-ex-pill" aria-label="Voir la page" title="Voir la page">
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
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

/** Détail en place : remplace le carrousel dans la carte ; l'image remplit la carte, le reste est en verre. */
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
  const active = item.kind === 'club' ? Boolean(item.row.is_member) : item.kind === 'sortie' ? Boolean(item.row.is_registered) : false;
  const description = item.row.description?.trim();
  return (
    <section className="lkdv-ex-detail" aria-label={itemTitle(item)}>
      <Cover item={item} className="lkdv-ex-detail-cover" />
      <button type="button" className="lkdv-ex-pill lkdv-ex-back" onClick={onBack} aria-label="Retour" title="Retour">
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <div className="lkdv-ex-card-glass lkdv-ex-detail-glass">
        <span className="lkdv-ex-card-body">
          <b>{itemTitle(item)}</b>
          <small>{itemMeta(item)}</small>
          {description ? <span className="lkdv-ex-detail-desc">{description}</span> : null}
        </span>
        <div className="lkdv-ex-card-actions">
          {action ? (
            <button type="button" className="lkdv-ex-pill" data-on={active ? 'true' : 'false'} onClick={onAction} aria-label={action} title={action}>
              <ActionIcon item={item} />
            </button>
          ) : null}
          <Link href={itemHref(item)} className="lkdv-ex-pill" onClick={onClose} aria-label="Voir la page" title="Voir la page">
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
