import React from 'react';
import { cn } from '@/lib/utils';
import { TRIPADVISOR_ATTRIBUTION_LABEL, TRIPADVISOR_SOURCE_URL } from '../constants';

/**
 * Attribution Tripadvisor obligatoire, proche des cartes.
 *
 * Si un logo officiel a été fourni/autorisé (`logoUrl`), il est servi
 * directement depuis son domaine (hauteur ≥ 20px, jamais recoloré). Sinon —
 * cas actuel — l'attribution reste **textuelle** : aucune URL de logo n'est
 * inventée. L'asset de production reste à valider.
 */
export function TripadvisorAttribution({
  className,
  logoUrl,
}: {
  className?: string;
  logoUrl?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2.5 min-h-[24px]', className)}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo servi directement depuis son domaine (Display Requirements), jamais via next/image
        <img
          src={logoUrl}
          alt="Tripadvisor"
          height={20}
          style={{ height: 20, width: 'auto' }}
          className="h-5 w-auto shrink-0"
          loading="lazy"
        />
      ) : (
        <span
          aria-label="Tripadvisor"
          className="font-display font-extrabold text-[13px] leading-none text-[#17402C] shrink-0"
        >
          Tripadvisor
        </span>
      )}
      <a
        href={TRIPADVISOR_SOURCE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10.5px] font-mono text-[#5A7064] hover:text-[#17402C] transition-colors"
      >
        {TRIPADVISOR_ATTRIBUTION_LABEL}
      </a>
    </div>
  );
}
