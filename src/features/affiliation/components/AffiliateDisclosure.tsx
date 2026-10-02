import React from 'react';
import Icon from '@/components/ui/Icon';

export interface AffiliateDisclosureProps {
  className?: string;
  /**
   * Version compacte (Compas) : la mention « Liens partenaires » reste visible
   * au-dessus des liens ; le texte complet s'ouvre sur le « i ».
   */
  compact?: boolean;
}

export const AFFILIATE_DISCLOSURE_TEXT =
  'Ces liens sont des liens partenaires rémunérés (vols, hébergements, activités). Réserver par eux soutient LKDV sans surcoût pour toi. La rémunération n’influence jamais l’ordre d’affichage ni la sélection.';

/**
 * Composant de disclosure légal obligatoire (Art. L121-2 & L121-3 Code de la consommation,
 * Loi n° 2023-451 du 9 juin 2023, ROADMAP §5.1).
 * Doit impérativement être affiché de manière lisible au-dessus de chaque bloc de liens affiliés.
 */
export function AffiliateDisclosure({ className = '', compact = false }: AffiliateDisclosureProps) {
  if (compact)
    return (
      <details
        role="note"
        aria-label="Transparence publicitaire et affiliation"
        className={`cp-aff ${className}`}
      >
        <summary>
          <span>Liens partenaires</span>
          <Icon name="info" size={13} aria-hidden="true" />
          <span className="sr-only">Afficher le détail</span>
        </summary>
        <p>{AFFILIATE_DISCLOSURE_TEXT}</p>
      </details>
    );
  return (
    <div
      role="note"
      aria-label="Transparence publicitaire et affiliation"
      className={`flex items-start gap-[var(--space-3)] rounded-[var(--lkv-radius-lg)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-[var(--space-3)] text-[length:var(--lkv-text-caption)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-text-secondary)] ${className}`}
    >
      <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--lkv-secondary-ink)]" />
      <div>
        <strong className="font-semibold text-[color:var(--lkv-text-primary)]">
          Transparence & Indépendance :
        </strong>{' '}
        Les liens ci-dessous sont des liens partenaires rémunérés (vols, hébergements, activités).
        En réservant par leur intermédiaire, vous soutenez le projet LKDV sans aucun surcoût pour
        vous.{' '}
        <span className="font-semibold text-[color:var(--lkv-text-primary)]">
          La rémunération n’influence jamais l’ordre d’affichage ni la sélection des topos.
        </span>
      </div>
    </div>
  );
}
