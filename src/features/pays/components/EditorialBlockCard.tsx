import React from 'react';
import { cn } from '@/lib/utils';
import { BlockMarkdown } from './BlockMarkdown';
import { StructuredBlockContent } from './StructuredBlockContent';
import { parseStructuredBlock } from '../mappers/structuredBlock';
import type { SectionBlock } from '../types';

const BLOCK_LABELS: Partial<Record<SectionBlock['type'], string>> = {
  vue_ensemble: 'Vue d’ensemble',
  spots_incontournables: 'Spots incontournables',
  itineraires_suggeres: 'Itinéraires suggérés',
  niveau_difficulte: 'Niveau & difficulté',
  meilleure_periode_activite: 'Meilleure période',
  etiquette: 'Usages & savoir-vivre',
};

/** Date de fraîcheur déterministe (MM/YYYY) — évite tout mismatch d’hydratation. */
function freshnessLabel(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const [year, month] = isoDate.slice(0, 10).split('-');
  if (!year || !month) return null;
  return `${month}/${year}`;
}

/** Carte d'un bloc éditorial IA : libellé, contenu, fraîcheur, sources. */
export function EditorialBlockCard({ block, className }: { block: SectionBlock; className?: string }) {
  const label = block.label ?? BLOCK_LABELS[block.type] ?? 'Repères LKDV';
  const freshness = freshnessLabel(block.generatedAt);

  return (
    <article className={cn('glass rounded-[1.5rem] p-5 border border-white/50 shadow-xs space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#5B7F55]">
          {label}
        </span>
        {freshness ? (
          <span className="text-[9.5px] font-mono text-[#5A7064]">{freshness}</span>
        ) : null}
      </div>

      {parseStructuredBlock(block) ? (
        <StructuredBlockContent block={block} />
      ) : block.contentMd ? (
        <BlockMarkdown text={block.contentMd} />
      ) : null}

      {block.sources.length > 0 ? (
        <div className="pt-2 border-t border-[#17402C]/5 flex flex-wrap gap-1.5">
          {block.sources.map((source, index) => (
            <a
              key={`${source.url}-${index}`}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-pill !px-2 !py-0.5 text-[8.5px] font-mono text-[#17402C] hover:text-[#5B7F55]"
            >
              {source.title} ↗
            </a>
          ))}
        </div>
      ) : null}
    </article>
  );
}
