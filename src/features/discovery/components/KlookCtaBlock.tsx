import React from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KlookBlock } from '../providers/klook/klookTypes';

export interface KlookCtaBlockProps {
  block?: KlookBlock | null;
  className?: string;
}

/**
 * Bloc éditorial Klook (mode sans product feed) : titre, description LKDV,
 * CTA vers Klook. Aucune fausse activité/prix/note/avis/photo. Le lien est un
 * simple `<a>` statique — aucun script tiers, aucun appel externe au chargement.
 */
export function KlookCtaBlock({ block, className }: KlookCtaBlockProps) {
  if (!block) return null;

  return (
    <section
      aria-label={`Klook — ${block.title}`}
      className={cn(
        'glass rounded-[1.5rem] border border-white/50 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between',
        className
      )}
    >
      <div className="space-y-1.5 min-w-0">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#5B7F55] block">
          Sélection partenaire · Klook
        </span>
        <h3 className="font-display font-bold text-lg text-[#17402C] leading-snug">
          {block.title}
        </h3>
        <p className="text-xs text-[#5A7064] leading-relaxed">{block.description}</p>
        {block.isAffiliate ? (
          <span className="inline-block mt-1 text-[9.5px] font-mono font-bold uppercase tracking-wider text-[#5A7064] bg-white/80 border border-white rounded-full px-2 py-0.5">
            Lien partenaire
          </span>
        ) : null}
      </div>

      <a
        href={block.url}
        target="_blank"
        rel={block.rel}
        className="w-full sm:w-auto shrink-0 min-h-[44px] px-5 rounded-xl bg-[#17402C] hover:bg-[#123323] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
      >
        <span>{block.ctaLabel}</span>
        <ExternalLink className="w-3.5 h-3.5 text-white/70" />
      </a>
    </section>
  );
}
