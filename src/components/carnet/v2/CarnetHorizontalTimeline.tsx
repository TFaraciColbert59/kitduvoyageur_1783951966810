'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Binoculars,
  Camera,
  CloudSun,
  Moon,
  Route,
  Users,
  Wallet,
} from 'lucide-react';

export type HorizontalTimelineKind =
  | 'moment'
  | 'pokedex'
  | 'rencontre'
  | 'spend'
  | 'perf'
  | 'night'
  | 'meteo';

export interface HorizontalTimelineUserPill {
  name: string;
  avatarUrl?: string | null;
  meta?: string | null;
}

export interface HorizontalTimelineEvent {
  id: string;
  day: number;
  kind: HorizontalTimelineKind;
  badge: string;
  timeLabel: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  userPill?: HorizontalTimelineUserPill | null;
  onClick?: () => void;
}

export interface HorizontalTimelineDayGroup {
  day: number;
  meta?: string;
  events: HorizontalTimelineEvent[];
}

function eventIcon(kind: HorizontalTimelineKind) {
  switch (kind) {
    case 'pokedex':
      return <Binoculars size={11} aria-hidden="true" />;
    case 'perf':
      return <Route size={11} aria-hidden="true" />;
    case 'rencontre':
      return <Users size={11} aria-hidden="true" />;
    case 'spend':
      return <Wallet size={11} aria-hidden="true" />;
    case 'night':
      return <Moon size={11} aria-hidden="true" />;
    case 'meteo':
      return <CloudSun size={11} aria-hidden="true" />;
    default:
      return <Camera size={11} aria-hidden="true" />;
  }
}

export function CarnetHorizontalTimeline({
  groups,
  ariaLabel = 'Frise chronologique horizontale',
}: {
  groups: HorizontalTimelineDayGroup[];
  ariaLabel?: string;
}) {
  let globalIdx = 0;

  return (
    <div className="lkdv-carnet-htimeline" role="region" aria-label={ariaLabel}>
      <div className="lkdv-carnet-htimeline-track">
        {groups.map((group) => {
          if (group.events.length === 0) return null;
          return (
            <React.Fragment key={group.day}>
              <div className="lkdv-carnet-hday-sep" aria-label={`Jour ${group.day}`}>
                <span className="lkdv-carnet-hday-pill">Jour {group.day}</span>
                {group.meta ? (
                  <span className="lkdv-carnet-hday-meta">
                    <CloudSun size={10} /> {group.meta}
                  </span>
                ) : null}
              </div>

              {group.events.map((ev) => {
                const isTop = globalIdx % 2 === 0;
                globalIdx += 1;

                const cardNode = (
                  <motion.button
                    type="button"
                    whileTap={ev.onClick ? { scale: 0.97 } : undefined}
                    className={`lkdv-carnet-hcard is-${ev.kind}`}
                    onClick={ev.onClick}
                    style={!ev.onClick ? { cursor: 'default' } : undefined}
                  >
                    <div className="lkdv-carnet-hcard-top">
                      <span className={`lkdv-carnet-hbadge is-${ev.kind}`}>
                        {eventIcon(ev.kind)}
                        <span>{ev.badge}</span>
                      </span>
                      <span className="lkdv-carnet-htime">{ev.timeLabel}</span>
                    </div>
                    <div className="lkdv-carnet-hcard-body">
                      {ev.userPill ? (
                        <div className="lkdv-carnet-huser-pill">
                          {ev.userPill.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={ev.userPill.avatarUrl}
                              alt=""
                              loading="lazy"
                              className="lkdv-carnet-huser-avi"
                            />
                          ) : (
                            <span className="lkdv-carnet-huser-avi is-fallback" aria-hidden="true">
                              {ev.userPill.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className="lkdv-carnet-huser-info">
                            <b>{ev.userPill.name}</b>
                            {ev.userPill.meta ? <small>{ev.userPill.meta}</small> : null}
                          </span>
                        </div>
                      ) : (
                        <>
                          {ev.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={ev.imageUrl}
                              alt=""
                              loading="lazy"
                              className="lkdv-carnet-hthumb"
                            />
                          ) : null}
                          <div className="lkdv-carnet-hcard-text">
                            <b>{ev.title}</b>
                            {ev.subtitle ? <p>{ev.subtitle}</p> : null}
                          </div>
                        </>
                      )}
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
