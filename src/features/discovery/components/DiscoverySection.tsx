'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui';
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
      <div className="flex flex-col items-start justify-between gap-2 border-b border-[color:var(--lkv-border)] pb-3 sm:flex-row sm:items-end">
        <div>
          <span className="mb-0.5 block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-secondary)]">
            {isViator ? 'Sélection partenaire · Viator' : 'Sélection Tripadvisor'}
          </span>
          <h3 className="font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">{title}</h3>
          {subtitle ? <p className="mt-0.5 font-mono text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">{subtitle}</p> : null}
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
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {isViator ? (
              <>
                <a
                  href={data?.attribution.sourceUrl || 'https://www.viator.com/'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-display text-[length:var(--lkv-text-footnote)] font-extrabold leading-none text-[color:var(--lkv-text-primary)] no-underline transition-colors hover:text-[color:var(--lkv-secondary)]"
                >
                  Viator
                </a>
                <span className="font-mono text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">
                  {data?.attribution.label}
                </span>
                <Badge tone="stone" className="font-mono uppercase">
                  Lien partenaire
                </Badge>
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
