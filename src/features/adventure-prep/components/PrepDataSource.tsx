/**
 * La source d'une mesure, affichee a cote du chiffre.
 *
 * Ce composant ne calcule rien : il rend ce que `engine/provenance.ts` a
 * decide, a partir du fournisseur reellement interroge. Il ne propose ni
 * bouton ni lien — une provenance n'est pas une action, et un lien
 * « en savoir plus » inventerait une page qui n'existe pas.
 *
 * POINT D'INTEGRATION : ce composant s'insere la ou une mesure est affichee,
 * typiquement sous la tuile de distance et sous la meteo du jour
 * (`ItineraryStep.tsx`). Il attend une `DataSourceEntry` construite par
 * l'appelant, qui doit lire le `provider` transmis par `/api/route` et
 * `/api/weather` — jamais le deviner.
 */

import React from 'react';
import { describeDataSource, type DataSourceEntry } from '../engine/provenance';

const LINE: React.CSSProperties = {
  display: 'block',
  font: 'inherit',
  color: 'var(--lkv-text-muted, currentColor)',
  fontSize: '0.75rem',
  lineHeight: 1.4,
  opacity: 0.8,
};

/** La ligne seule : « Distance : 12,4 km · OpenStreetMap (OSRM) ». */
export function PrepDataSourceLine({ entry }: { entry: DataSourceEntry }): React.ReactElement {
  return <span style={LINE}>{describeDataSource(entry)}</span>;
}

export interface PrepDataSourceProps {
  readonly entry: DataSourceEntry;
}

/** La ligne avec son paragraphe, pour un emplacement de bloc. */
export function PrepDataSource({ entry }: PrepDataSourceProps): React.ReactElement {
  return (
    <p className="prep-note" style={LINE}>
      {describeDataSource(entry)}
    </p>
  );
}
