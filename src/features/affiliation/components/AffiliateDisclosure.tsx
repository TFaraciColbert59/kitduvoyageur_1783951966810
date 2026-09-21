import React from 'react';
import Icon from '@/components/ui/Icon';

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
      className={`flex items-start gap-[var(--space-3)] rounded-[var(--lkv-radius-lg)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-muted)] p-[var(--space-3)] text-[length:var(--lkv-text-caption)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-text-secondary)] ${className}`}
    >
      <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--lkv-secondary)]" />
      <div>
        <strong className="font-semibold text-[color:var(--lkv-text-primary)]">Transparence & Indépendance :</strong> Les
        liens ci-dessous sont des liens partenaires rémunérés (vols, hébergements, activités). En
        réservant par leur intermédiaire, vous soutenez le projet LKDV sans aucun surcoût pour vous.{' '}
        <span className="font-semibold text-[color:var(--lkv-text-primary)]">
          La rémunération n’influence jamais l’ordre d’affichage ni la sélection des topos.
        </span>
      </div>
    </div>
  );
}
