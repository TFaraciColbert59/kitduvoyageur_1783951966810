'use client';

import React from 'react';

export interface StatTileProps {
  /** Libellé court, toujours visible sous la valeur. */
  label: string;
  /** Valeur déjà formatée : aucune donnée n'est fabriquée ici. */
  value: string;
  /** Icône décorative optionnelle (masquée aux lecteurs d'écran). */
  icon?: React.ReactNode;
}

/**
 * Tuile compacte de la vitrine (nuits, massifs, pays).
 *
 * Elle ne calcule rien : la valeur arrive formatée par `VitrineSlot` et le
 * libellé est statique. Le rendu s'appuie sur la classe `.li` du runtime pour
 * la bordure et les espacements, avec une géométrie locale scopée.
 */
export function StatTile({ label, value, icon }: StatTileProps) {
  return (
    <div className="li lkdv-stat-tile" role="listitem">
      {icon ? (
        <span className="lkdv-stat-tile-ico" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <b className="lkdv-stat-tile-value">{value}</b>
      <span className="lkdv-stat-tile-label">{label}</span>
    </div>
  );
}

export default StatTile;
