'use client';

import { staleDraftMessage, type StaleDraftNotice } from '../engine/staleDraft';

export interface StaleDraftBannerProps {
  /** `null` = rien a signaler, le bandeau ne rend alors aucun noeud. */
  notice: StaleDraftNotice | null;
  /** Repartir d un plan neuf : la personne, jamais le moteur, en decide. */
  onReset: () => void;
}

/**
 * Le bandeau qui dit enfin ce que le silence cachait.
 *
 * Le brouillon est persiste : revenir un mois plus tard resservait un plan
 * entierement date, sans un mot. Ce bandeau nomme la date vraie et le retard
 * reel, puis propose — sans l'imposer — de repartir d'un plan neuf.
 *
 * Il n'est pas modal et ne bloque rien : on peut continuer a lire le plan
 * perime. C'est une information, pas un mur.
 */
export function StaleDraftBanner({ notice, onReset }: StaleDraftBannerProps) {
  if (notice === null) return null;

  return (
    <div className="prep-stale" role="status">
      <p className="prep-stale__text">{staleDraftMessage(notice)}</p>
      <button type="button" className="prep-stale__action" onClick={onReset}>
        Repartir sur un plan neuf
      </button>
    </div>
  );
}

export default StaleDraftBanner;