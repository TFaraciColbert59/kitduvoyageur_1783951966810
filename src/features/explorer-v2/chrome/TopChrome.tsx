'use client';

import React from 'react';
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
}: {
  breadcrumb: BreadcrumbItem[];
  current: string;
  onSearch: () => void;
  onBack?: () => void;
  onLayers?: () => void;
  activity?: boolean;
  onCompass?: () => void;
  northUp?: boolean;
}) {
  return (
    <div className="xp-chrome">
      <div className="xp-search">
        <button
          type="button"
          className="xp-search-main"
          onClick={onSearch}
          aria-label={`Rechercher dans ${current}`}
        >
          <XpIcon name="search" size={16} />
          {breadcrumb.length > 0 ? (
            <>
              {breadcrumb
                .filter((item) => item.label && item.label.trim().length > 0)
                .map((item, index) => (
                <React.Fragment key={`${item.label}-${index}`}>
                  <span
                    className="xp-crumb-btn"
                    role={item.onClick ? 'button' : undefined}
                    tabIndex={item.onClick ? 0 : undefined}
                    onClick={(event) => {
                      if (!item.onClick) return;
                      event.stopPropagation();
                      item.onClick();
                    }}
                    onKeyDown={(event) => {
                      if (!item.onClick) return;
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      event.stopPropagation();
                      item.onClick();
                    }}
                  >
                    {item.label}
                  </span>
                  <span className="xp-crumb-sep" aria-hidden="true">
                    <XpIcon name="chevr" size={12} />
                  </span>
                </React.Fragment>
              ))}
            </>
          ) : null}
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
