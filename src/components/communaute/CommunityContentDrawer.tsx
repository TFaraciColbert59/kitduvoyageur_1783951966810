'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import SmartImage from '@/components/ui/SmartImage';
import { Button, Sheet } from '@/components/ui';
import CommunityPostCard from '@/components/communaute/CommunityPostCard';
import type { CommunityGridItem } from '@/components/communaute/CommunityGrid';

export interface CommunityContentDrawerProps {
  item: CommunityGridItem | null;
  onClose: () => void;
  user?: any;
  joinedEventIds?: Record<string, boolean>;
  onJoinEvent?: (eventId: string | number) => Promise<void> | void;
  focusCommentId?: string | null;
}

const KIND_LABEL: Record<CommunityGridItem['kind'], string> = {
  post: 'Publication',
  carnet: 'Carnet',
  club: 'Club',
  group: 'Expédition',
  event: 'Sortie',
};

function Cover({ src, alt }: { src?: string | null; alt: string }) {
  if (!src) return null;
  return (
    <div className="lkdv-content-drawer-cover">
      <SmartImage src={src} alt={alt} className="size-full object-cover" />
    </div>
  );
}

/**
 * Drawer de contenu de la Communauté.
 *
 * Tout ce qui compose la Communauté (publication, carnet, club, expédition,
 * sortie) s'ouvre ici, dans une feuille canonique — comme les contenus du
 * Compte. Aucun de ces contenus ne renvoie d'abord vers une page.
 */
export function CommunityContentDrawer({
  item,
  onClose,
  user,
  joinedEventIds = {},
  onJoinEvent,
  focusCommentId = null,
}: CommunityContentDrawerProps) {
  const open = Boolean(item);
  const raw = item?.raw;
  const joined = item ? Boolean(joinedEventIds[String(item.id)]) : false;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      hideTitle
      title={item ? `${KIND_LABEL[item.kind]} — ${item.title}` : 'Contenu de la communauté'}
      detent="auto"
      dragToDismiss
    >
      {item ? (
        <div className="lkdv-content-drawer">
          <div className="lkdv-content-drawer-kicker">
            <Icon
              name={
                item.kind === 'post'
                  ? 'image-plus'
                  : item.kind === 'carnet'
                    ? 'book-open'
                    : item.kind === 'club'
                      ? 'users'
                      : item.kind === 'group'
                        ? 'map'
                        : 'calendar'
              }
              size={14}
              aria-hidden="true"
            />
            <span>{KIND_LABEL[item.kind]}</span>
          </div>

          {item.kind === 'post' ? (
            <CommunityPostCard post={raw} user={user} focusCommentId={focusCommentId ?? undefined} />
          ) : item.kind === 'carnet' ? (
            <article className="lkdv-content-drawer-body">
              <Cover src={item.image} alt={item.title} />
              <h2>{item.title}</h2>
              {item.subtitle ? <p className="lkdv-content-drawer-meta">{item.subtitle}</p> : null}
              {raw?.description ? <p>{raw.description}</p> : null}
              {raw?.author?.full_name ? (
                <p className="lkdv-content-drawer-meta">Par {raw.author.full_name}</p>
              ) : null}
              <Link href={`/carnets/${item.id}`} className="lkdv-content-drawer-cta">
                Ouvrir le carnet
                <Icon name="arrow-right" size={15} aria-hidden="true" />
              </Link>
            </article>
          ) : item.kind === 'club' ? (
            <article className="lkdv-content-drawer-body">
              <Cover src={item.image} alt={item.title} />
              <h2>{item.title}</h2>
              {item.subtitle ? <p className="lkdv-content-drawer-meta">{item.subtitle}</p> : null}
              {raw?.description ? <p>{raw.description}</p> : null}
              <p className="lkdv-content-drawer-meta">
                {raw?.members_count ?? 0} membres
                {raw?.category ? ` · ${raw.category}` : ''}
              </p>
              <Link href={`/clubs/${raw?.slug || item.id}`} className="lkdv-content-drawer-cta">
                Ouvrir le club
                <Icon name="arrow-right" size={15} aria-hidden="true" />
              </Link>
            </article>
          ) : item.kind === 'group' ? (
            <article className="lkdv-content-drawer-body">
              <Cover src={item.image} alt={item.title} />
              <h2>{item.title}</h2>
              {item.subtitle ? <p className="lkdv-content-drawer-meta">{item.subtitle}</p> : null}
              {raw?.description ? <p>{raw.description}</p> : null}
              {raw?.max_members ? (
                <p className="lkdv-content-drawer-meta">{raw.max_members} places maximum</p>
              ) : null}
              <Link href={`/groupes/${item.id}`} className="lkdv-content-drawer-cta">
                Ouvrir l’expédition
                <Icon name="arrow-right" size={15} aria-hidden="true" />
              </Link>
            </article>
          ) : (
            <article className="lkdv-content-drawer-body">
              <Cover src={item.image} alt={item.title} />
              <h2>{item.title}</h2>
              {item.subtitle ? <p className="lkdv-content-drawer-meta">{item.subtitle}</p> : null}
              {raw?.guide ? <p className="lkdv-content-drawer-meta">Encadré par {raw.guide}</p> : null}
              <p className="lkdv-content-drawer-meta">
                {raw?.participants ?? 0}
                {raw?.maxParticipants ? `/${raw.maxParticipants}` : ''} inscrits
              </p>
              <div className="lkdv-content-drawer-actions">
                <Button
                  type="button"
                  variant={joined ? 'secondary' : 'primary'}
                  size="md"
                  disabled={joined}
                  onClick={() => onJoinEvent?.(item.id)}
                >
                  {joined ? 'Inscrit ✓' : "S'inscrire"}
                </Button>
                <Link href="/communaute?tab=evenements" className="lkdv-content-drawer-cta">
                  Voir toutes les sorties
                  <Icon name="arrow-right" size={15} aria-hidden="true" />
                </Link>
              </div>
            </article>
          )}

          {item.kind === 'post' ? (
            <Link href={`/communaute/post/${item.id}`} className="lkdv-content-drawer-cta">
              Ouvrir la publication
              <Icon name="arrow-right" size={15} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}

export default CommunityContentDrawer;
