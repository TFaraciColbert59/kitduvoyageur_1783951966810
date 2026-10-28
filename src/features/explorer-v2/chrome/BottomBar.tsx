'use client';

import React from 'react';
import Link from 'next/link';
import { XpIcon } from '../ui/XpIcon';

const ITEMS = [
  { id: 'hub', href: '/hub', label: 'Hub', icon: 'house' },
  { id: 'communaute', href: '/communaute', label: 'Communauté', icon: 'users' },
  { id: 'explorer', href: '/explorer', label: 'Explorer', icon: 'compass' },
  { id: 'messages', href: '/messages', label: 'Messages', icon: 'send' },
  { id: 'compte', href: '/compte', label: 'Compte', icon: 'userplus' },
];

export function BottomBar({ active = 'explorer' }: { active?: string }) {
  return (
    <nav className="xp-bottombar" aria-label="Navigation principale">
      {ITEMS.map((item) => {
        const isActive = item.id === active;
        const isCenter = item.id === 'explorer';
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
            className={isCenter ? 'xp-bottombar-center' : undefined}
          >
            {isCenter ? (
              <span>
                <XpIcon name={item.icon} size={17} />
              </span>
            ) : (
              <XpIcon name={item.icon} size={18} />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function ActivityPill({
  sportLabel,
  elapsed,
  distanceLabel,
  paused,
  onPause,
  onFlag,
  onStop,
}: {
  sportLabel: string;
  elapsed: string;
  distanceLabel: string;
  paused: boolean;
  onPause: () => void;
  onFlag: () => void;
  onStop: () => void;
}) {
  return (
    <div className="xp-activity-pill" role="group" aria-label="Commandes d'activité">
      <span className="xp-pill-sport">{sportLabel}</span>
      <span className="xp-pill-timer" aria-live="off">
        {elapsed}
      </span>
      <span className="xp-pill-dist">{distanceLabel}</span>
      <span style={{ flex: 1 }} />
      <button
        type="button"
        className="xp-pill-btn"
        onClick={onPause}
        aria-label={paused ? 'Reprendre' : 'Pause'}
      >
        <XpIcon name={paused ? 'play' : 'pause'} size={15} />
      </button>
      <button type="button" className="xp-pill-btn" onClick={onFlag} aria-label="Poser un repère">
        <XpIcon name="flag" size={15} />
      </button>
      <button
        type="button"
        className="xp-pill-btn"
        data-tone="bad"
        onClick={onStop}
        aria-label="Arrêter la sortie"
      >
        <XpIcon name="stop" size={15} />
      </button>
    </div>
  );
}
