'use client';

import React from 'react';
import Link from 'next/link';
import { XpIcon } from '../ui/XpIcon';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export function TopChrome({
  breadcrumb,
  current,
  onSearch,
  onBack,
  onLayers,
  activity,
  onCompass,
  northUp,
  offline = false,
  offlinePending = 0,
}: {
  breadcrumb: BreadcrumbItem[];
  current: string;
  onSearch: () => void;
  onBack?: () => void;
  onLayers?: () => void;
  activity?: boolean;
  onCompass?: () => void;
  northUp?: boolean;
  offline?: boolean;
  offlinePending?: number;
}) {
  return (
    <div className="xp-chrome">
      <div className="xp-search">
        {breadcrumb
          .filter((item) => item.label && item.label.trim().length > 0)
          .map((item, index) => (
            <button
              key={`${item.label}-${index}`}
              type="button"
              className="xp-crumb-btn"
              onClick={item.onClick}
              aria-label={`Revenir à ${item.label}`}
            >
              {item.label}
            </button>
          ))}
        {breadcrumb.length > 0 ? (
          <span className="xp-crumb-sep" aria-hidden="true">
            <XpIcon name="chevr" size={12} />
          </span>
        ) : null}
        <button
          type="button"
          className="xp-search-main"
          onClick={onSearch}
          aria-label={`Rechercher dans ${current}`}
        >
          <XpIcon name="search" size={16} />
          <span className="xp-crumb-current">{current}</span>
        </button>
        <button type="button" className="xp-scan-btn" onClick={onSearch} aria-label="Rechercher">
          <XpIcon name="scan" size={15} />
        </button>
      </div>

      {onBack ? (
        <button type="button" className="xp-icon-btn" onClick={onBack} aria-label="Revenir au niveau supérieur">
          <XpIcon name="chevl" size={17} />
        </button>
      ) : null}

      {activity ? (
        <button type="button" className="xp-icon-btn" onClick={onCompass} aria-label="Boussole">
          <XpIcon name="compass" size={17} />
          <span className="xp-visually-hidden">{northUp ? 'Nord en haut' : 'Cap en haut'}</span>
        </button>
      ) : (
        <button type="button" className="xp-icon-btn" onClick={onLayers} aria-label="Calques de la carte">
          <XpIcon name="layers" size={17} />
        </button>
      )}
    </div>
  );
}
