import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import type { CarnetsHubFilter } from '@/features/carnet/hub/types';

/** Glyphes du jeu installé (`Icon`, registre monochrome). */
type EmptyIconName = 'compass' | 'users' | 'mountain' | 'route';

interface EmptyCopy {
  icon: EmptyIconName;
  title: string;
  description: string;
  actionLabel: string;
  action: 'create' | 'explore';
  secondaryLabel?: string;
}

/**
 * État vide par filtre (proposition n° 62) : chaque filtre explique ce qu'il
 * montrerait et offre le geste qui le remplit — jamais un écran muet.
 */
const EMPTY_COPY: Record<CarnetsHubFilter, EmptyCopy> = {
  route: {
    icon: 'compass',
    title: 'Aucun carnet en route pour le moment',
    description:
      'Dès qu’un voyageur partage son aventure en direct, son carnet s’affiche ici, avec le jour et les kilomètres.',
    actionLabel: 'Créer un carnet',
    action: 'create',
    secondaryLabel: 'Voir tous les carnets',
  },
  followed: {
    icon: 'users',
    title: 'Aucun carnet de vos suivis',
    description:
      'Les carnets des voyageurs que vous suivez apparaissent ici. Suivez quelqu’un depuis son profil pour les retrouver.',
    actionLabel: 'Explorer les carnets',
    action: 'explore',
  },
  world: {
    icon: 'mountain',
    title: 'Aucun carnet public à afficher',
    description:
      'Les carnets partagés par les voyageurs se retrouvent ici. Le premier peut être le vôtre.',
    actionLabel: 'Créer un carnet',
    action: 'create',
  },
  mine: {
    icon: 'route',
    title: 'Votre premier carnet vous attend',
    description:
      'Racontez une sortie, ajoutez vos moments et partagez-la avec vos proches.',
    actionLabel: 'Créer un carnet',
    action: 'create',
  },
};

export interface CarnetHubEmptyStateProps {
  filter: CarnetsHubFilter;
  /** Bascule sur le filtre « Monde » (ou ouvre l’exploration). */
  onExplore: () => void;
}

export function CarnetHubEmptyState({ filter, onExplore }: CarnetHubEmptyStateProps) {
  const copy = EMPTY_COPY[filter];

  return (
    <section className="lkdh-empty" data-testid="lkdh-empty" data-filter={filter}>
      <span className="lkdh-empty-icon" aria-hidden="true">
        <Icon name={copy.icon} size={24} />
      </span>
      <h2>{copy.title}</h2>
      <p>{copy.description}</p>
      <div className="lkdh-empty-actions">
        {copy.action === 'explore' ? (
          <button type="button" className="lkdh-empty-btn" onClick={onExplore}>
            {copy.actionLabel}
          </button>
        ) : (
          <Link className="lkdh-empty-btn" href="/communaute?creer=carnet">
            {copy.actionLabel}
          </Link>
        )}
        {copy.secondaryLabel ? (
          <button
            type="button"
            className="lkdh-empty-btn lkdh-empty-btn--ghost"
            onClick={onExplore}
          >
            {copy.secondaryLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}

export default CarnetHubEmptyState;
