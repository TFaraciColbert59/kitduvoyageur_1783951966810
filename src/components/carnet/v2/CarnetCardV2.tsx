'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { CarnetDetail, CarnetMomentItem } from '@/features/carnet/detail/types';
import type { CarnetHighlight } from '@/features/carnet/detail/highlights';
import { isParticipantRole } from '@/features/carnet/detail/viewerRole';
import { CarnetDaySwipeView } from './CarnetDaySwipeView';
import { Check, Radio } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

/** Appui long d'une pastille « À la une » : édition (maquette, 500 ms). */
export const HIGHLIGHT_LONG_PRESS_MS = 500;

export interface CarnetCardV2Props {
  detail: CarnetDetail;
  activeDay: number;
  onDayChange: (day: number, dir?: number) => void;
  onOpenDrawerSlot: (
    slot: 'fil' | 'route' | 'sac' | 'chiffres' | 'equipage',
    lensIndex?: number
  ) => void;
  onOpenStories: (startIndex?: number) => void;
  onSelectMoment: (moment: CarnetMomentItem, index: number) => void;
  onPeekMoment?: (moment: CarnetMomentItem) => void;
  isEditing?: boolean;
  onAddMoment?: () => void;
  /** Sortie du mode modification (bouton « Terminer »). */
  onEndEdit?: () => void;
  /** Pastilles « À la une » (voyageurs et étapes clés). */
  highlights?: CarnetHighlight[];
  onHighlightTap?: (highlight: CarnetHighlight) => void;
  /** Appui long, participant seulement : tiroir d'édition de la pastille. */
  onHighlightEdit?: (highlight: CarnetHighlight) => void;
  pinnedIds?: ReadonlySet<string>;
  /** Visiteur : massif affiché à la place de la position exacte. */
  zoneLabel?: string | null;
}

export function CarnetCardV2({
  detail,
  activeDay,
  onDayChange,
  onOpenDrawerSlot,
  onOpenStories,
  onSelectMoment,
  onPeekMoment,
  isEditing = false,
  onAddMoment,
  onEndEdit,
  highlights = [],
  onHighlightTap,
  onHighlightEdit,
  pinnedIds,
  zoneLabel = null,
}: CarnetCardV2Props) {
  const { haptic } = useHapticFeedback();
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);
  const [seenHighlights, setSeenHighlights] = useState<ReadonlySet<string>>(() => new Set());
  const hasValidCover = Boolean(detail.coverImage && detail.coverImage !== failedCoverUrl);
  const coverInitials = (detail.title || detail.author?.name || 'LK')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase() || 'LK';

  // Filter moments for the active day (if 0, show all moments)
  const currentMoments = useMemo(() => {
    if (activeDay === 0) {
      return detail.moments;
    }
    return detail.moments.filter((m) => m.dayNumber === activeDay);
  }, [activeDay, detail.moments]);

  const daysCount = detail.days.length || detail.etapes.length || 1;
  const daysLabel = `${daysCount} ${daysCount > 1 ? 'jours' : 'jour'}`;
  const distanceFormatted = detail.distanceKm
    ? detail.distanceKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
    : '—';
  const elevationFormatted = detail.elevationM
    ? `+${Math.round(detail.elevationM).toLocaleString('fr-FR')}`
    : '—';
  const travellers = Math.max(1, detail.participants.length);
  /* « lieu de départ · mois année · n voyageurs » (spec § 1.2). */
  const subtitle = [
    detail.place.locality ?? detail.destination,
    detail.startDate
      ? new Date(`${detail.startDate}T12:00:00Z`).toLocaleDateString('fr-FR', {
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : null,
    `${travellers} voyageur${travellers > 1 ? 's' : ''}`,
  ]
    .filter(Boolean)
    .join(' · ');

  /**
   * Statut réel du carnet : la date décide, pas une étiquette décorative.
   * Aucune date inventée ; sans dates, pas de pilule de statut.
   */
  /* L'instant est lu côté client après le montage : le serveur et le navigateur
     ne s'accordent pas sur « maintenant », la pilule d'état se pose donc au montage
     (la place est réservée, aucun saut de mise en page). */
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => setNowMs(Date.now()), []);
  const liveStatus = useMemo(() => {
    if (nowMs === null) return null;
    const start = detail.startDate ? new Date(`${detail.startDate}T12:00:00`) : null;
    const end = detail.endDate ? new Date(`${detail.endDate}T12:00:00`) : null;
    if (!start || Number.isNaN(start.getTime())) return null;
    const now = new Date(nowMs);
    const dayMs = 86_400_000;
    /* Les jours se comptent en jours civils : « maintenant » n'a pas à franchir
       midi pour passer au jour suivant, ni à dépasser la minute de fin. */
    const dayOf = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const today = dayOf(now);
    const hasEnd = Boolean(end) && !Number.isNaN((end as Date).getTime());
    if (!detail.liveSharing) {
      /* Sans partage en direct : « Terminé » seulement si la date de fin est passée. */
      return hasEnd && today > dayOf(end as Date)
        ? { state: 'done' as const, label: `Terminé · ${daysLabel}` }
        : null;
    }
    if (today < dayOf(start)) {
      return {
        state: 'upcoming' as const,
        label: `Départ le ${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`,
      };
    }
    const finished = hasEnd ? today > dayOf(end as Date) : false;
    if (finished) return { state: 'done' as const, label: `Terminé · ${daysLabel}` };
    const dayNumber = Math.max(
      1,
      Math.min(daysCount, Math.floor((now.getTime() - start.getTime()) / dayMs) + 1)
    );
    return { state: 'live' as const, label: `En route · J${dayNumber} sur ${daysCount}` };
  }, [daysCount, daysLabel, detail.endDate, detail.liveSharing, detail.startDate]);

  // Utilisateurs du carnet affichés avec la pilule utilisateur de base (.lkdv-post-author)
  const carnetUsers = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{
      id: string;
      userId: string | null;
      name: string;
      avatarUrl: string | null;
      meta: string;
      badge?: string;
    }> = [];

    const roleLabel = (role?: string) => {
      if (role === 'author' || role === 'owner') return 'Auteur';
      if (role === 'collaborator' || role === 'contributor') return 'Membre';
      return 'Participant';
    };

    if (detail.author) {
      const key = detail.author.id || detail.author.name;
      seen.add(key);
      list.push({
        id: key,
        userId: detail.author.id || null,
        name: detail.author.name || 'Voyageur LKDV',
        avatarUrl: detail.author.avatarUrl || null,
        meta: detail.author.handle ? `@${detail.author.handle.replace(/^@/, '')}` : 'Auteur du carnet',
        badge: 'Auteur',
      });
    }

    for (const p of detail.participants) {
      const key = p.userId || p.id || p.name;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      list.push({
        id: key,
        userId: p.userId || null,
        name: p.name || 'Voyageur LKDV',
        avatarUrl: p.avatarUrl || null,
        meta: p.handle ? `@${p.handle.replace(/^@/, '')}` : roleLabel(p.role),
        badge: roleLabel(p.role),
      });
    }

    return list;
  }, [detail.author, detail.participants]);

  // Stories À la une : uniquement les stories du carnet (groupées par jour ou par moment photo)
  const highlights = useMemo(() => {
    const photos = detail.photoMoments.filter((m) => Boolean(m.imageUrl));
    if (photos.length === 0) return [];

    const byDay = new Map<number, CarnetMomentItem[]>();
    for (const m of photos) {
      const arr = byDay.get(m.dayNumber) ?? [];
      arr.push(m);
      byDay.set(m.dayNumber, arr);
    }

    if (byDay.size > 1) {
      return Array.from(byDay.entries())
        .sort(([a], [b]) => a - b)
        .slice(0, 5)
        .map(([dayNum, items]) => {
          const dayInfo = detail.days.find((d) => d.dayNumber === dayNum);
          const first = items[0];
          return {
            id: `day-${dayNum}`,
            title: dayInfo?.title?.trim() || `Jour ${dayNum}`,
            image: first.imageUrl || detail.coverImage,
          };
        });
    }

    return photos.slice(0, 5).map((m) => ({
      id: `moment-${m.id}`,
      title: m.caption || m.title || `J${m.dayNumber}`,
      image: m.imageUrl || detail.coverImage,
    }));
  }, [detail.coverImage, detail.days, detail.photoMoments]);

  return (
    <div className="lkdv-carnet-card" id="card" role="region" aria-label="En-tête du carnet">
      <div className="lkdv-carnet-card-scroll" id="cardscroll">
        <div className="lkdv-ig-header">
          <button
            type="button"
            className={`lkdv-ig-avi-wrap ${detail.liveSharing ? 'live' : ''}`}
            onClick={() => {
              haptic('light');
              onOpenStories();
            }}
            aria-label={`Ouvrir les stories du carnet${detail.liveSharing ? ', en route' : ''}`}
          >
            <span className="lkdv-ig-avi">
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverUrl}
                  alt={detail.title}
                  loading="lazy"
                  decoding="async"
                  onError={() => setFailedCoverUrl(coverUrl)}
                />
              ) : (
                <CarnetArt className="lkdv-ig-avi-art" />
              )}
            </span>
            <span className="seal" aria-hidden="true">
              <Check size={11} strokeWidth={2.5} />
            </span>
          </button>

          <div className="lkdv-ig-stats" role="group" aria-label="Statistiques principales">
            <button
              type="button"
              className="lkdv-ig-stat"
              onClick={() => {
                haptic('light');
                onOpenDrawerSlot('chiffres', 2);
              }}
              aria-label={`${daysCount} jours de randonnée`}
            >
              <b>{daysCount}</b>
              <span>{daysCount > 1 ? 'jours' : 'jour'}</span>
            </button>

            <button
              type="button"
              className="lkdv-ig-stat"
              onClick={() => {
                haptic('light');
                onOpenDrawerSlot('chiffres', 0);
              }}
              aria-label={`${distanceFormatted} kilomètres parcourus`}
            >
              <b>{distanceFormatted}</b>
              <span>km</span>
            </button>

            <button
              type="button"
              className="lkdv-ig-stat"
              onClick={() => {
                haptic('light');
                onOpenDrawerSlot('chiffres', 1);
              }}
              aria-label={`${elevationFormatted} mètres de dénivelé positif`}
            >
              <b>{elevationFormatted}</b>
              <span>D+</span>
            </button>
          </div>
        </div>

        <div className="lkdv-ig-bio">
          <span className="lkdv-ig-name">{detail.title}</span>
          <span className="lkdv-ig-handle-sub">
            {subtitle}
          </span>
        </div>

        {liveStatus ? (
          <div className="lkdv-ig-actions">
            <span className="lkdv-ig-live" data-state={liveStatus.state}>
              <Radio size={13} aria-hidden="true" />
              <span>{liveStatus.label}</span>
            </span>
          </div>
        ) : null}

        {carnetUsers.length > 0 ? (
          <div className="lkdv-carnet-users-row" role="group" aria-label="Membres du carnet">
            {carnetUsers.map((u) => {
              const inner = (
                <>
                  {u.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="lkdv-post-author-av" src={u.avatarUrl} alt="" />
                  ) : (
                    <span className="lkdv-post-author-av pmi-author-initial" aria-hidden="true">
                      {u.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="lkdv-post-author-txt">
                    <span className="lkdv-post-author-line">
                      <b>{u.name}</b>
                      {u.badge ? <span className="lkdv-post-author-badge">{u.badge}</span> : null}
                    </span>
                    <span className="lkdv-post-author-meta">{u.meta}</span>
                  </span>
                </>
              );
              return u.userId ? (
                <Link
                  key={u.id}
                  href={`/profil/${u.userId}`}
                  className="lkdv-post-author"
                  aria-label={`${u.name} — ${u.meta}`}
                >
                  {inner}
                </Link>
              ) : (
                <button
                  key={u.id}
                  type="button"
                  className="lkdv-post-author"
                  aria-label={`${u.name} — ${u.meta}`}
                  onClick={() => {
                    haptic('light');
                    onOpenDrawerSlot('equipage', 0);
                  }}
                >
                  {inner}
                </button>
              );
            })}
          </div>
        ) : null}

        {highlights.length > 0 ? (
          <div className="lkdv-ig-hl-row" role="group" aria-label="Stories à la une">
            {highlights.map((hl, idx) => (
              <button
                key={hl.id}
                type="button"
                className={`lkdv-ig-hl${seenHighlights.has(hl.id) ? ' seen' : ''}`}
                onClick={() => {
                  clearHlTimer();
                  if (hlLongPressed.current) {
                    hlLongPressed.current = false;
                    return;
                  }
                  haptic('light');
                  setSeenHighlights((prev) => {
                    const next = new Set(prev);
                    next.add(hl.id);
                    return next;
                  });
                  onOpenStories(idx);
                }}
              >
                <span className="lkdv-ig-hl-ring">
                  <i className="lkdv-ig-hl-glyph" aria-hidden="true">
                    {hl.kind === 'crew' ? hl.label.slice(0, 1).toUpperCase() : <Flag size={19} />}
                  </i>
                </span>
                <span className="lkdv-ig-hl-label">{hl.label}</span>
              </button>
            ))}
          </div>
        ) : null}

        <CarnetDaySwipeView
          days={detail.days}
          etapes={detail.etapes}
          activeDay={activeDay}
          onDayChange={onDayChange}
          moments={currentMoments}
          onSelectMoment={onSelectMoment}
          onPeekMoment={onPeekMoment}
          isEditing={isEditing && isParticipant}
          onAddMoment={onAddMoment}
          pinnedIds={pinnedIds}
          nights={detail.nights}
          coverImage={coverUrl}
          travellers={detail.participants.length || 1}
          distanceKm={detail.distanceKm}
          elevationM={detail.elevationM}
        />
      </div>
    </div>
  );
}
