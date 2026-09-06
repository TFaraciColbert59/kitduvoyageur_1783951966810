import React from 'react';
import { Info } from 'lucide-react';

export interface AffiliateDisclosureProps {
  className?: string;
}

/**
 * Composant de disclosure légal obligatoire (Art. L121-2 & L121-3 Code de la consommation,
 * Loi n° 2023-451 du 9 juin 2023, ROADMAP §5.1).
 * Doit impérativement être affiché de manière lisible au-dessus de chaque bloc de liens affiliés.
 */
export function AffiliateDisclosure({ className = '' }: AffiliateDisclosureProps) {
  return (
    <div
      role="note"
      aria-label="Transparence publicitaire et affiliation"
      className={`flex items-start gap-2.5 p-3 rounded-2xl bg-stone-100/90 border border-stone-200/80 text-[11px] sm:text-xs text-stone-600 leading-relaxed ${className}`}
    >
      <Info className="w-4 h-4 text-[#5B7F55] shrink-0 mt-0.5" />
      <div>
        <strong className="text-stone-900 font-semibold">
          Transparence & Indépendance :
        </strong>{' '}
        Les liens ci-dessous sont des liens partenaires rémunérés (vols, hébergements, activités). En réservant par leur intermédiaire, vous soutenez le projet LKDV sans aucun surcoût pour vous.{' '}
        <span className="font-semibold text-stone-800">
          La rémunération n’influence jamais l’ordre d’affichage ni la sélection des topos.
        </span>
      </div>
    </div>
  );
}
