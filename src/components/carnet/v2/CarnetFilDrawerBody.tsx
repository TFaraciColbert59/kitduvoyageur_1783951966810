'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Binoculars,
  Camera,
  CloudSun,
  Clock,
  Flag,
  Leaf,
  Moon,
  Quote,
  Route,
  Sparkles,
  Users,
} from 'lucide-react';
import type {
  CarnetDetail,
  CarnetEtapeDay,
  CarnetMomentItem,
  CarnetNightItem,
} from '@/features/carnet/detail/types';
import { CARNET_SPRING, StaggerCard, StaggerList } from './CarnetDrawerMotion';

interface CarnetFilDrawerBodyProps {
  detail: CarnetDetail;
  lensId: string;
  onSelectMoment?: (moment: CarnetMomentItem, index: number) => void;
  onSelectEtape?: (etape: CarnetEtapeDay) => void;
  onSelectNight?: (night: CarnetNightItem) => void;
}

type TimelineEventKind = 'moment' | 'pokedex' | 'rencontre' | 'perf' | 'night';

interface TimelineEvent {
  id: string;
  day: number;
  kind: TimelineEventKind;
  badge: string;
  timeLabel: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  onClick?: () => void;
}

const SPECIES_MATCHERS: Array<{ re: RegExp; label: string }> = [
  { re: /bouquetin|capra|ibex/i, label: 'Pokédex · Bouquetin' },
  { re: /marmotte|marmota/i, label: 'Pokédex · Marmotte' },
  { re: /chamois|rupicapra/i, label: 'Pokédex · Chamois' },
  { re: /gypaète|gypaete|rapace/i, label: 'Pokédex · Gypaète' },
  { re: /edelweiss|leontopodium/i, label: 'Pokédex · Edelweiss' },
  { re: /gentiane/i, label: 'Pokédex · Gentiane' },
  { re: /glacier|sérac|serac|névé/i, label: 'Pokédex · Glacier' },
  { re: /lac/i, label: 'Pokédex · Lac alpin' },
];

function classifyMoment(m: CarnetMomentItem): { kind: TimelineEventKind; badge: string } {
  const text = `${m.quote ?? ''} ${m.place ?? ''}`;
  for (const sp of SPECIES_MATCHERS) {
    if (sp.re.test(text)) {
      return { kind: 'pokedex', badge: sp.label };
    }
  }
  if (
    m.source?.toLowerCase().includes('nature') ||
    m.source?.toLowerCase().includes('species')
  ) {
    return { kind: 'pokedex', badge: 'Pokédex' };
  }
  if (/croisé|rencontré|traileur|randonneur|refuge|échange/i.test(text)) {
    return { kind: 'rencontre', badge: 'Rencontre' };
  }
  return { kind: 'moment', badge: m.imageUrl ? 'Photo' : 'Moment' };
}

function eventIcon(kind: TimelineEventKind) {
  switch (kind) {
    case 'pokedex':
      return <Binoculars size={11} aria-hidden="true" />;
    case 'perf':
      return <Route size={11} aria-hidden="true" />;
    case 'rencontre':
      return <Users size={11} aria-hidden="true" />;
    case 'night':
      return <Moon size={11} aria-hidden="true" />;
    default:
      return <Camera size={11} aria-hidden="true" />;
  }
}

export function CarnetFilDrawerBody({
  detail,
  lensId,
  onSelectMoment,
  onSelectEtape,
  onSelectNight,
}: CarnetFilDrawerBodyProps) {
  const [dayFilter, setDayFilter] = useState<number | 'all'>('all');

  const availableDays = useMemo(() => {
    const nums = new Set<number>();
    for (const m of detail.moments) if (m.dayNumber) nums.add(m.dayNumber);
    for (const e of detail.etapes) if (e.dayNumber) nums.add(e.dayNumber);
    for (const n of detail.nights ?? []) if (n.dayNumber) nums.add(n.dayNumber);
    return Array.from(nums).sort((a, b) => a - b);
  }, [detail.moments, detail.etapes, detail.nights]);

  // Chronological day-by-day groups combining Etape/Perf + Moments + Pokédex + Rencontres + Nuit
  const timelineByDay = useMemo(() => {
    const days = availableDays.length > 0 ? availableDays : [1];
    return days.map((day) => {
      const events: TimelineEvent[] = [];

      const etape = detail.etapes.find((e) => e.dayNumber === day);
      const dayStats = detail.days.find((d) => (d.dayNumber ?? d.index) === day);

      if (etape || (dayStats && (dayStats.distanceKm || dayStats.elevationM))) {
        const km = etape?.distanceKm ?? dayStats?.distanceKm ?? null;
        const elev = etape?.elevationM ?? dayStats?.elevationM ?? null;
        const dur = etape?.durationText ?? null;
        const parts = [
          km ? `${Number(km).toFixed(1)} km` : null,
          elev ? `+${Math.round(elev)} m` : null,
          dur,
        ].filter(Boolean);
        events.push({
          id: `perf-${day}`,
          day,
          kind: 'perf',
          badge: 'Performance',
          timeLabel: 'Étape',
          title: etape?.from && etape?.to ? `${etape.from} → ${etape.to}` : `Étape J${day}`,
          subtitle: parts.join(' · ') || etape?.weather || 'Trace du jour',
          onClick: etape && onSelectEtape ? () => onSelectEtape(etape) : undefined,
        });
      }

      const dayMoments = detail.moments
        .filter((m) => m.dayNumber === day)
        .slice()
        .sort((a, b) => (a.time ?? '12:00').localeCompare(b.time ?? '12:00'));

      dayMoments.forEach((m, idx) => {
        const { kind, badge } = classifyMoment(m);
        events.push({
          id: `m-${m.id}`,
          day,
          kind,
          badge,
          timeLabel: m.time || `J${day}`,
          title: m.place || m.authorName || 'Sur le sentier',
          subtitle: m.quote || undefined,
          imageUrl: m.imageUrl,
          onClick: onSelectMoment ? () => onSelectMoment(m, idx) : undefined,
        });
      });

      const night = (detail.nights ?? []).find((n) => n.dayNumber === day);
      if (night) {
        events.push({
          id: `night-${night.id}`,
          day,
          kind: 'night',
          badge: night.type === 'bivouac' ? 'Bivouac' : 'Refuge',
          timeLabel: 'Soir',
          title: night.name,
          subtitle: [
            night.altitudeM ? `${night.altitudeM} m` : null,
            night.infos,
          ]
            .filter(Boolean)
            .join(' · '),
          onClick: onSelectNight ? () => onSelectNight(night) : undefined,
        });
      }

      return {
        day,
        etape,
        events,
      };
    });
  }, [availableDays, detail.days, detail.etapes, detail.moments, detail.nights, onSelectEtape, onSelectMoment, onSelectNight]);

  if (lensId === 'moments') {
    const hasAnyEvent = timelineByDay.some((g) => g.events.length > 0);
    if (!hasAnyEvent) {
      return (
        <div className="lkdv-carnet-empty-card">
          <Clock size={22} aria-hidden="true" />
          <b>Aucun moment enregistré</b>
          <p>Les étapes, performances, rencontres, espèces et nuits du voyage défileront ici.</p>
        </div>
      );
    }

    let globalIdx = 0;

    return (
      <div className="lkdv-carnet-htimeline" role="region" aria-label="Frise chronologique du voyage">
        <div className="lkdv-carnet-htimeline-track">
          {timelineByDay.map((group) => {
            if (group.events.length === 0) return null;
            return (
              <React.Fragment key={group.day}>
                <div className="lkdv-carnet-hday-sep" aria-label={`Jour ${group.day}`}>
                  <span className="lkdv-carnet-hday-pill">Jour {group.day}</span>
                  {group.etape?.weather ? (
                    <span className="lkdv-carnet-hday-meta">
                      <CloudSun size={10} /> {group.etape.weather.split('·')[0].trim()}
                    </span>
                  ) : null}
                </div>

                {group.events.map((ev) => {
                  const isTop = globalIdx % 2 === 0;
                  globalIdx += 1;

                  const cardNode = (
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      className={`lkdv-carnet-hcard is-${ev.kind}`}
                      onClick={ev.onClick}
                    >
                      <div className="lkdv-carnet-hcard-top">
                        <span className={`lkdv-carnet-hbadge is-${ev.kind}`}>
                          {eventIcon(ev.kind)}
                          <span>{ev.badge}</span>
                        </span>
                        <span className="lkdv-carnet-htime">{ev.timeLabel}</span>
                      </div>
                      <div className="lkdv-carnet-hcard-body">
                        {ev.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ev.imageUrl} alt="" loading="lazy" className="lkdv-carnet-hthumb" />
                        ) : null}
                        <div className="lkdv-carnet-hcard-text">
                          <b>{ev.title}</b>
                          {ev.subtitle ? <p>{ev.subtitle}</p> : null}
                        </div>
                      </div>
                    </motion.button>
                  );

                  return (
                    <div
                      key={ev.id}
                      className={`lkdv-carnet-hevent ${isTop ? 'is-top' : 'is-bottom'}`}
                    >
                      <div className="lkdv-carnet-hevent-half is-upper">
                        {isTop ? (
                          <>
                            {cardNode}
                            <span className="lkdv-carnet-hstem" aria-hidden="true" />
                          </>
                        ) : (
                          <span className="lkdv-carnet-hevent-time-Opposite">{ev.timeLabel}</span>
                        )}
                      </div>

                      <div className="lkdv-carnet-haxis-node" aria-hidden="true">
                        <span className={`lkdv-carnet-hdot is-${ev.kind}`} />
                      </div>

                      <div className="lkdv-carnet-hevent-half is-lower">
                        {!isTop ? (
                          <>
                            <span className="lkdv-carnet-hstem" aria-hidden="true" />
                            {cardNode}
                          </>
                        ) : (
                          <span className="lkdv-carnet-hevent-time-Opposite">{ev.timeLabel}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  }

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

  const filteredMoments =
    dayFilter === 'all'
      ? detail.moments
      : detail.moments.filter((m) => m.dayNumber === dayFilter);

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
                {m.quote ? <p className="lkdv-carnet-encounter-quote">« {m.quote} »</p> : null}
              </StaggerCard>
            );
          })}
        </StaggerList>
      </div>
    );
  }

  // Fallback
  return (
    <div className="lkdv-carnet-drawer-pane">
      {dayFilterBar}
      <div className="lkdv-carnet-empty-card">
        <Flag size={22} aria-hidden="true" />
        <b>Carnet de bord</b>
        <p>Retrouvez chaque instant de la sortie.</p>
      </div>
    </div>
  );
}
