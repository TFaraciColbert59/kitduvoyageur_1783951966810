'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import type { CarnetPlaceFocus } from './CarnetCard';

/** Carte du monde du Compte, telle quelle : MapLibre 3D, HUD, crédits Esri. */
const CompteMap = dynamic(
  () => import('@/components/compte/map/CompteMap').then((mod) => mod.CompteMap),
  {
    ssr: false,
    loading: () => <div className="ckp-mapzone-loading">Initialisation du Relief 3D…</div>,
  },
);

export interface CarnetMapCardProps {
  detail: CarnetDetail;
  /** Cible de recentrage demandée depuis la ligne de lieu de la carte. */
  focus?: CarnetPlaceFocus | null;
}

/**
 * Carte 3D du bas de la fiche : elle ne peint que le tracé réel du carnet
 * (`detail.trace`), avec la même peinture et la même inclinaison que la carte
 * d'une sortie du Compte. Sans trace en base, l'état vide est affiché — jamais
 * l'invitation « connecte-toi » de la carte du compte, qui n'a pas de sens ici.
 */
export function CarnetMapCard({ detail, focus = null }: CarnetMapCardProps) {
  /* `isOwner` est calculé côté serveur avec les cookies : c'est la seule
     source fiable pour l'état de la carte (le contexte client peut être en
     retard sur la session). */
  const authState = detail.isOwner ? 'owner' : 'guest';

  return (
    <section className="ckp-mapzone" aria-label={`Carte du monde — ${detail.title}`}>
      <div className="ckp-mapzone-canvas">
        <CompteMap
          authState={authState}
          context={{ mode: 'overview' }}
          focus={focus}
          variant="carnet"
          trace={detail.trace}
          emptyTitle="Aucun tracé enregistré pour ce carnet."
          emptyHint="L’auteur n’a pas joint de trace GPS : rien n’est dessiné plutôt qu’inventé."
        />
      </div>
      <span className="ckp-mapzone-badge">GLOBE 3D</span>
    </section>
  );
}

export default CarnetMapCard;
