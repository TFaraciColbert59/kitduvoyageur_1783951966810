import React from 'react';
import Icon from '@/components/ui/Icon';
import { Badge, Card } from '@/components/ui';
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
    <Card
      as="section"
      aria-label={`Klook — ${block.title}`}
      className={cn(
        'flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center',
        className
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <span className="block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-secondary)]">
          Sélection partenaire · Klook
        </span>
        <h3 className="font-display text-[length:var(--lkv-text-body)] font-bold leading-snug text-[color:var(--lkv-text-primary)]">
          {block.title}
        </h3>
        <p className="text-[length:var(--lkv-text-caption-1)] leading-relaxed text-[color:var(--lkv-text-muted)]">
          {block.description}
        </p>
        {block.isAffiliate ? (
          <Badge tone="stone" className="mt-1 font-mono uppercase">
            Lien partenaire
          </Badge>
        ) : null}
      </div>

      <a
        href={block.url}
        target="_blank"
        rel={block.rel}
        className="flex min-h-[44px] w-full shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] px-5 text-[length:var(--lkv-text-caption-1)] font-bold text-[color:var(--lkv-text-primary)] no-underline shadow-sm transition-transform active:scale-[var(--motion-press-scale)] hover:brightness-[1.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)] sm:w-auto"
      >
        <span>{block.ctaLabel}</span>
        <Icon name="external-link" className="h-3.5 w-3.5 opacity-70" />
      </a>
    </Card>
  );
}
