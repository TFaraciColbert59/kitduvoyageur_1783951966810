'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Camera,
  ChevronRight,
  Clock,
  Leaf,
  MapPin,
  Quote,
  Sparkles,
} from 'lucide-react';
import type { CarnetDetail, CarnetMomentItem } from '@/features/carnet/detail/types';
import { CARNET_SPRING, StaggerCard, StaggerList } from './CarnetDrawerMotion';

interface CarnetFilDrawerBodyProps {
  detail: CarnetDetail;
  lensId: string;
  onSelectMoment?: (moment: CarnetMomentItem, index: number) => void;
}

export function CarnetFilDrawerBody({
  detail,
  lensId,
  onSelectMoment,
}: CarnetFilDrawerBodyProps) {
  const [dayFilter, setDayFilter] = useState<number | 'all'>('all');

  const availableDays = useMemo(() => {
    const nums = new Set<number>();
    for (const m of detail.moments) {
      if (m.dayNumber) nums.add(m.dayNumber);
    }
    return Array.from(nums).sort((a, b) => a - b);
  }, [detail.moments]);

  const filteredMoments = useMemo(() => {
    if (dayFilter === 'all') return detail.moments;
    return detail.moments.filter((m) => m.dayNumber === dayFilter);
  }, [detail.moments, dayFilter]);

  const dayFilterBar =
    availableDays.length > 1 ? (
      <div className="lkdv-carnet-filter-rail" role="tablist" aria-label="Filtrer par jour">
        {(['all', ...availableDays] as const).map((val) => {
          const active = dayFilter === val;
          return (
            <button
              key={String(val)}
              type="button"
              role="tab"
              aria-selected={active}
              className={`lkdv-carnet-filter-pill${active ? ' is-active' : ''}`}
              onClick={() => setDayFilter(val)}
            >
              {active ? (
                <motion.span
                  layoutId="carnet-fil-day-pill"
                  className="lkdv-carnet-filter-pill-bg"
                  transition={CARNET_SPRING}
                />
              ) : null}
              <span className="lkdv-carnet-filter-pill-label">
                {val === 'all' ? 'Tout' : `Jour ${val}`}
              </span>
            </button>
          );
        })}
      </div>
    ) : null;

  if (lensId === 'moments') {
    if (detail.moments.length === 0) {
      return (
        <div className="lkdv-carnet-empty-card">
          <Clock size={22} aria-hidden="true" />
          <b>Aucun moment publié</b>
          <p>Les instants capturés le long du parcours apparaîtront ici en timeline.</p>
        </div>
      );
    }

    return (
      <div className="lkdv-carnet-drawer-pane">
        {dayFilterBar}
        <StaggerList className="lkdv-carnet-timeline">
          {filteredMoments.map((m, idx) => (
            <StaggerCard
              key={m.id}
              asButton
              className="lkdv-carnet-timeline-row"
              onClick={() => onSelectMoment?.(m, idx)}
            >
              <span className="lkdv-carnet-timeline-rail" aria-hidden="true">
                <span className="lkdv-carnet-timeline-dot" />
              </span>
              <div className="lkdv-carnet-timeline-card">
                <div className="lkdv-carnet-timeline-meta">
                  <span className="lkdv-carnet-chip-dark">J{m.dayNumber}</span>
                  {m.time ? (
                    <span className="lkdv-carnet-chip-soft">
                      <Clock size={10} /> {m.time}
                    </span>
                  ) : null}
                  {m.place ? (
                    <span className="lkdv-carnet-chip-place">
                      <MapPin size={10} /> {m.place}
                    </span>
                  ) : null}
                </div>
                <div className="lkdv-carnet-timeline-body">
                  {m.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.imageUrl}
                      alt=""
                      className="lkdv-carnet-timeline-thumb"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="lkdv-carnet-timeline-text">
                    {m.quote ? (
                      <p className="lkdv-carnet-timeline-quote">« {m.quote} »</p>
                    ) : (
                      <p className="lkdv-carnet-timeline-quote">Instant capturé</p>
                    )}
                    {m.authorName ? (
                      <small className="lkdv-carnet-timeline-author">{m.authorName}</small>
                    ) : null}
                  </div>
                  <ChevronRight size={15} className="lkdv-carnet-chevron" />
                </div>
              </div>
            </StaggerCard>
          ))}
        </StaggerList>
      </div>
    );
  }

  if (lensId === 'medias') {
    const photos =
      dayFilter === 'all'
        ? detail.photoMoments
        : detail.photoMoments.filter((m) => m.dayNumber === dayFilter);

    if (photos.length === 0) {
      return (
        <div className="lkdv-carnet-drawer-pane">
          {dayFilterBar}
          <div className="lkdv-carnet-empty-card">
            <Camera size={22} aria-hidden="true" />
            <b>Aucune photo partagée</b>
            <p>Les photos ajoutées aux moments s’afficheront ici en mosaïque.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="lkdv-carnet-drawer-pane">
        {dayFilterBar}
        <StaggerList className="lkdv-carnet-bento-grid">
          {photos.map((m, idx) => {
            const isHero = idx === 0 && photos.length >= 3;
            return (
              <StaggerCard
                key={m.id}
                asButton
                className={`lkdv-carnet-bento-tile${isHero ? ' is-hero' : ''}`}
                onClick={() => onSelectMoment?.(m, idx)}
              >
                {m.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.imageUrl} alt={m.quote ?? ''} loading="lazy" />
                ) : null}
                <div className="lkdv-carnet-bento-overlay">
                  <span className="lkdv-carnet-bento-day">J{m.dayNumber}</span>
                  {m.place ? <span className="lkdv-carnet-bento-place">{m.place}</span> : null}
                </div>
              </StaggerCard>
            );
          })}
        </StaggerList>
      </div>
    );
  }

  if (lensId === 'rencontres') {
    const quotes = filteredMoments.filter(
      (m) => Boolean(m.quote?.trim()) && m.quote?.trim().toLowerCase() !== 'rencontre sur le sentier',
    );
    const list = quotes.length > 0 ? quotes : filteredMoments.filter((m) => m.authorName || m.quote);

    if (list.length === 0) {
      return (
        <div className="lkdv-carnet-drawer-pane">
          {dayFilterBar}
          <div className="lkdv-carnet-empty-card">
            <Quote size={22} aria-hidden="true" />
            <b>Aucune rencontre notée</b>
            <p>Les citations et visages croisés sur le chemin apparaîtront ici.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="lkdv-carnet-drawer-pane">
        {dayFilterBar}
        <StaggerList className="lkdv-carnet-cards-col">
          {list.map((m, idx) => {
            const name = m.authorName?.trim() || 'Voyageur croisé';
            const initial = name.slice(0, 1).toUpperCase();
            return (
              <StaggerCard
                key={m.id}
                asButton
                className="lkdv-carnet-encounter-card"
                onClick={() => onSelectMoment?.(m, idx)}
              >
                <div className="lkdv-carnet-encounter-head">
                  <span className="lkdv-carnet-encounter-avatar">{initial}</span>
                  <div className="lkdv-carnet-encounter-meta">
                    <b>{name}</b>
                    <small>
                      Jour {m.dayNumber}
                      {m.place ? ` · ${m.place}` : ''}
                    </small>
                  </div>
                  <Quote size={16} className="lkdv-carnet-encounter-qicon" />
                </div>
                {m.quote ? (
                  <p className="lkdv-carnet-encounter-quote">« {m.quote} »</p>
                ) : null}
              </StaggerCard>
            );
          })}
        </StaggerList>
      </div>
    );
  }

  // lensId === 'nature'
  const natureMoments = filteredMoments.filter(
    (m) =>
      m.source?.toLowerCase().includes('nature') ||
      m.quote?.toLowerCase().match(/(faune|flore|sommet|col|lac|glacier|bouquetin|chamois|marmotte|forêt|cascade|neige)/),
  );

  return (
    <div className="lkdv-carnet-drawer-pane">
      {dayFilterBar}
      {natureMoments.length === 0 ? (
        <div className="lkdv-carnet-empty-card">
          <Leaf size={22} aria-hidden="true" />
          <b>Aucune observation nature</b>
          <p>Mentionnez faune, flore, cols ou lacs dans vos moments pour les retrouver ici.</p>
        </div>
      ) : (
        <StaggerList className="lkdv-carnet-cards-col">
          {natureMoments.map((m, idx) => (
            <StaggerCard
              key={m.id}
              asButton
              className="lkdv-carnet-nature-card"
              onClick={() => onSelectMoment?.(m, idx)}
            >
              <div className="lkdv-carnet-nature-badge">
                <Sparkles size={13} />
                <span>Observation · J{m.dayNumber}</span>
              </div>
              <div className="lkdv-carnet-nature-row">
                {m.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.imageUrl} alt="" className="lkdv-carnet-nature-thumb" loading="lazy" />
                ) : null}
                <div>
                  <b>{m.place || 'Sur le sentier'}</b>
                  {m.quote ? <p>{m.quote}</p> : null}
                </div>
              </div>
            </StaggerCard>
          ))}
        </StaggerList>
      )}
    </div>
  );
}
