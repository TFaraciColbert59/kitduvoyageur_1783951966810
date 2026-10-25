'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { useLocale } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/locale';
import { fr } from '@/lib/i18n/translations/fr';
import { affiliateDisclosureCopy } from '../engine/disclosureRegion';

export interface AffiliateDisclosureProps {
  className?: string;
  /**
   * Version compacte (Compas) : la mention « Liens partenaires » reste visible
   * au-dessus des liens ; le texte complet s'ouvre sur le « i ».
   */
  compact?: boolean;
  /** Langue du texte ; par défaut celle du site (`useLocale`, `fr` tant qu'aucune autre n'est allumée). */
  locale?: Locale;
  /**
   * Région de la personne (code ISO `US` ou balise `en-GB`) : choisit la variante régionale
   * (`engine/disclosureRegion.ts`). Par défaut, la région de la langue (`fr` → France).
   */
  region?: string | null;
}

/** Texte compact français, à la lettre (mention d'origine). */
export const AFFILIATE_DISCLOSURE_TEXT: string = fr.affiliation.disclosure.compact;

/**
 * Composant de disclosure légal obligatoire (Art. L121-2 & L121-3 Code de la consommation,
 * Loi n° 2023-451 du 9 juin 2023, ROADMAP §5.1).
 * Doit impérativement être affiché de manière lisible au-dessus de chaque bloc de liens affiliés.
 * Hors de France, une note régionale (États-Unis, Royaume-Uni) est lue AVANT le texte
 * (PLAN-100 6.4) ; en France, le texte est celui d'origine, au caractère près.
 */
export function AffiliateDisclosure({
  className = '',
  compact = false,
  locale,
  region,
}: AffiliateDisclosureProps) {
  const site = useLocale().locale;
  const copy = affiliateDisclosureCopy(locale ?? site, region);
  if (compact)
    return (
      <details role="note" aria-label={copy.ariaLabel} className={`cp-aff ${className}`}>
        <summary>
          <span>{copy.summary}</span>
          <Icon name="info" size={13} aria-hidden="true" />
          <span className="sr-only">{copy.showDetail}</span>
        </summary>
        <p>{copy.note ? `${copy.note} ${copy.compact}` : copy.compact}</p>
      </details>
    );
  return (
    <div
      role="note"
      aria-label={copy.ariaLabel}
      className={`flex items-start gap-[var(--space-3)] rounded-[var(--lkv-radius-lg)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-[var(--space-3)] text-[length:var(--lkv-text-caption)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-text-secondary)] ${className}`}
    >
      <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--lkv-secondary-ink)]" />
      <div>
        <strong className="font-semibold text-[color:var(--lkv-text-primary)]">{copy.title}</strong>{' '}
        {copy.note ? (
          <>
            <span className="font-semibold text-[color:var(--lkv-text-primary)]">{copy.note}</span>{' '}
          </>
        ) : null}
        {copy.body}{' '}
        <span className="font-semibold text-[color:var(--lkv-text-primary)]">{copy.emphasis}</span>
      </div>
    </div>
  );
}
