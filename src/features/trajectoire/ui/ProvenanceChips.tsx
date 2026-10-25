'use client';

/**
 * Les chips de provenance (gate T2).
 *
 * Le dossier pose la regle — « chaque donnee affichee porte sa provenance » —
 * mais laisse la presentation ouverte. Ce composant tranche deux points :
 *
 *  1. IL REPREND LE CHIP CANONIQUE du design system. Aucune primitive neuve :
 *     le dossier n'autorise une exception que pour le curseur d'echelle, parce
 *     que c'est la signature LKDV. Un deuxieme type de pilule dans la meme page
 *     est exactement ce que la gouvernance DESIGN_SYSTEM interdit.
 *
 *  2. IL MONTRE LES SOURCES DISTINCTES D'UNE CARTE, PAS UNE PAR LIGNE. Huit
 *     cartes x quarante lignes, cela ferait plusieurs centaines de chips, et
 *     l'utilisateur arreterait de les lire — donc de faire confiance a l'ecran.
 *     Une carte affiche d'ou vient ce qu'elle affiche ; le detail ligne a ligne
 *     reste dans le DOM (`title`) et pour les lecteurs d'ecran.
 */

import * as React from 'react';

import { Chip } from '@/design';

import {
  SOURCE_LABEL,
  SOURCE_TITLE,
  cardProvenance,
} from '@/features/trajectoire/domain/provenance';
import type { CardLocation } from '@/features/trajectoire/domain/provenance';
import type { TrajectoireSnapshot } from '@/features/trajectoire/domain/types';

/** Ton du chip, deduit de l'etat de resolution — pas du contenu. */
const RESOLVABLE_TONE = 'info' as const;
const UNRESOLVABLE_TONE = 'danger' as const;

export interface ProvenanceChipsProps {
  snapshot: TrajectoireSnapshot;
  location: CardLocation;
  /** Nombre max de sources affichees avant « +N ». 3 reste lisible. */
  max?: number;
}

export function ProvenanceChips({
  snapshot,
  location,
  max = 3,
}: ProvenanceChipsProps): React.ReactElement | null {
  const card = React.useMemo(() => cardProvenance(snapshot, location), [snapshot, location]);

  // Une carte sans donnee n'a pas de provenance a afficher : ne pas rendre
  // un conteneur vide, qui laisserait un espace mort dans l'en-tete.
  if (card.sources.length === 0) return null;

  const visible = card.sources.slice(0, max);
  const overflow = card.sources.length - visible.length;

  // Une provenance non resolvable est un BUG (gate T2). On ne la masque pas
  // derriere un ton neutre : elle doit sauter aux yeux, sinon personne ne la
  // corrigerait jamais.
  const tone = card.resolvable ? RESOLVABLE_TONE : UNRESOLVABLE_TONE;
  const fullTitles = card.sources.map((id) => SOURCE_TITLE[id]).join(', ');

  return (
    <span
      className="tj-prov"
      role="group"
      aria-label={`Sources : ${fullTitles}`}
      title={fullTitles}
    >
      {visible.map((sourceId) => (
        <Chip key={sourceId} tone={tone} icon={<span>{SOURCE_LABEL[sourceId]}</span>}>
          {card.resolvable ? 'Source' : 'Sans source'}
        </Chip>
      ))}
      {overflow > 0 ? (
        <span className="tj-prov__more" aria-label={`${overflow} source(s) de plus`}>
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}

export default ProvenanceChips;
