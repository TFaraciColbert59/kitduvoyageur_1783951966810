'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { Sheet } from '@/components/ui';
import { CapsuleTabs, type CapsuleTabItem } from '@/components/ui/CapsuleTabs';

export interface CommunityContextClub {
  id?: string;
  name?: string;
  title?: string;
  members_count?: number | null;
}

export interface CommunityContextDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  massifs: string[];
  clubs: CommunityContextClub[];
}

const LENSES: CapsuleTabItem[] = [
  { id: 'massifs', label: 'Destinations', icon: <Icon name="map-pin" size={18} aria-hidden="true" /> },
  { id: 'clubs', label: 'Clubs', icon: <Icon name="users" size={18} aria-hidden="true" /> },
];

/**
 * La « carte contexte » de la Communauté.
 *
 * Le Compte ouvre une carte 3D ; la Communauté n'a pas de géographie propre à
 * projeter et n'embarque donc pas MapLibre. Son contexte, ce sont les destinations
 * réellement présentes dans les carnets chargés et les clubs dont la personne
 * est membre — deux lentilles de la même capsule 48 px, dans une `Sheet`
 * canonique (pas d'en-tête : ni titre, ni sous-titre, ni partage).
 */
export function CommunityContextDrawer({
  open,
  onOpenChange,
  massifs,
  clubs,
}: CommunityContextDrawerProps) {
  const [lensIndex, setLensIndex] = useState(0);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      hideTitle
      title="Contexte de la communauté"
      detent="medium"
      dragToDismiss
    >
      <div className="lkdv-context">
        <CapsuleTabs
          items={LENSES}
          activeIndex={lensIndex}
          onIndexChange={setLensIndex}
          ariaLabel="Contexte de la communauté"
          panelIdFor={(id) => `lkdv-context-panel-${id}`}
          idFor={(id) => `lkdv-context-tab-${id}`}
        />

        {lensIndex === 0 ? (
          <div
            className="lkdv-context-body"
            id="lkdv-context-panel-massifs"
            role="tabpanel"
            aria-labelledby="lkdv-context-tab-massifs"
          >
            {massifs.length === 0 ? (
              <p className="lkdv-context-empty">
                Aucune destination dans les carnets chargés. Publiez un carnet pour situer vos sorties.
              </p>
            ) : (
              <ul className="lkdv-context-list">
                {massifs.map((massif) => (
                  <li key={massif}>
                    <Icon name="map-pin" size={15} aria-hidden="true" />
                    <span>{massif}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div
            className="lkdv-context-body"
            id="lkdv-context-panel-clubs"
            role="tabpanel"
            aria-labelledby="lkdv-context-tab-clubs"
          >
            {clubs.length === 0 ? (
              <p className="lkdv-context-empty">Aucun club rejoint pour le moment.</p>
            ) : (
              <ul className="lkdv-context-list">
                {clubs.map((club, index) => (
                  <li key={club.id || club.name || club.title || index}>
                    <Icon name="users" size={15} aria-hidden="true" />
                    <span>{club.name || club.title || 'Club'}</span>
                    {typeof club.members_count === 'number' ? (
                      <span className="lkdv-context-count">{club.members_count}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

export default CommunityContextDrawer;
