'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useDiscovery } from '../hooks/useDiscovery';
import { DiscoveryCard } from './DiscoveryCard';
import { DiscoveryEmpty, DiscoveryNotice, DiscoverySkeleton } from './DiscoveryStates';
import { TripadvisorAttribution } from './TripadvisorAttribution';
import type { DiscoveryCategory, DiscoverySectionName } from '../types/discovery.types';

export interface DiscoverySectionProps {
  countryCode: string;
  category: DiscoveryCategory;
  section?: DiscoverySectionName;
  title: string;
  subtitle?: string;
  limit?: number;
  enabled?: boolean;
  emptyLabel?: string;
  className?: string;
}

/**
 * Bloc Tripadvisor « à la demande ». Monté seulement quand la section Pays est
 * ouverte : aucun appel au chargement initial de la fiche. Rendu client-only,
 * donc absent du HTML serveur (indexation) et toujours placé sous l'éditorial.
 */
export function DiscoverySection({
  countryCode,
  category,
  section,
  title,
  subtitle,
  limit,
  enabled = true,
  emptyLabel,
  className,
}: DiscoverySectionProps) {
  const { data, isLoading, isError, refetch } = useDiscovery({
    countryCode,
    category,
    section,
    limit,
    enabled,
  });

  if (!enabled) return null;

  // API non configurée : on n'affiche rien, le contenu LKDV reste intact.
  if (data?.status === 'unconfigured') return null;

  const items = data?.items ?? [];
  const hasItems = data?.status === 'ok' && items.length > 0;
  const isViator = data?.provider === 'viator';
  const providerLabel = isViator ? 'Viator' : 'Tripadvisor';

  return (
    <section
      aria-busy={isLoading}
      aria-label={`${title} — ${
        isViator ? 'Offres fournies par Viator' : 'Données fournies par Tripadvisor'
      }`}
      className={cn('space-y-3', className)}
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2 border-b border-[#17402C]/10 pb-3">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#5B7F55] block mb-0.5">
            {isViator ? 'Sélection partenaire · Viator' : 'Sélection Tripadvisor'}
          </span>
          <h3 className="font-display font-bold text-xl sm:text-2xl text-[#17402C]">{title}</h3>
          {subtitle ? <p className="text-xs text-[#5A7064] mt-0.5 font-mono">{subtitle}</p> : null}
        </div>
      </div>

      {isLoading ? (
        <DiscoverySkeleton count={limit && limit <= 4 ? limit : 3} />
      ) : hasItems ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <DiscoveryCard key={item.id} item={item} />
            ))}
          </div>
          <div className="pt-1 flex items-center gap-3 flex-wrap">
            {isViator ? (
              <>
                <a
                  href={data?.attribution.sourceUrl || 'https://www.viator.com/'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-display font-extrabold text-[13px] leading-none text-[#17402C] hover:text-[#5B7F55] transition-colors"
                >
                  Viator
                </a>
                <span className="text-[10.5px] font-mono text-[#5A7064]">
                  {data?.attribution.label}
                </span>
                <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-[#5A7064] bg-white/80 border border-white rounded-full px-2 py-0.5">
                  Lien partenaire
                </span>
              </>
            ) : (
              <TripadvisorAttribution logoUrl={data?.attribution?.logoUrl || undefined} />
            )}
          </div>
        </div>
      ) : isError || data?.status === 'error' ? (
        <DiscoveryNotice tone="warn" onRetry={() => refetch()}>
          Contenu {providerLabel} momentanément indisponible.
        </DiscoveryNotice>
      ) : data?.status === 'quota' ? (
        <DiscoveryNotice tone="warn">
          Contenu {providerLabel} temporairement indisponible (quota atteint).
        </DiscoveryNotice>
      ) : data?.status === 'empty' ? (
        <DiscoveryEmpty
          label={emptyLabel || `Aucun résultat ${providerLabel} pour cette catégorie.`}
        />
      ) : null}
    </section>
  );
}
