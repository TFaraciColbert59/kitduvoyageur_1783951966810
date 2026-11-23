import type { ReactNode } from 'react';
import { dataSourceAttrs, provenanceLine, type Provenance } from '../../../analyse/provenance';

/**
 * Une valeur de l'onglet Analyser avec sa source et sa date (7.9). `data-analyse-value` désigne la valeur,
 * `data-source` et `data-source-at` la source et la date (ou « date inconnue ») : un test balaie l'onglet et
 * refuse toute valeur qui n'en porte pas. En vue experte, la ligne de source est aussi écrite.
 */
export function Sourced({
  id,
  provenance,
  expert,
  children,
  className = '',
}: {
  id: string;
  provenance: Provenance;
  expert: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rcw-sourced ${className}`.trim()} data-analyse-value={id} {...dataSourceAttrs(provenance)}>
      {children}
      {expert ? (
        <small className="rcw-prov" data-testid={`prov-${id}`}>
          {provenanceLine(provenance)}
        </small>
      ) : null}
    </div>
  );
}
