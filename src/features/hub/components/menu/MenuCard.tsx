import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { LiquidGlassCard } from '@/components/ui-layouts/liquid-glass';

export interface MenuCardProps {
  href: string;
  icon: LucideIcon;
  label: string;
  /** Micro-contenu de la carte (résumé de la section). */
  children?: React.ReactNode;
  /** Carte large (2 colonnes) pour les sections « héros ». */
  wide?: boolean;
  /** Priorité visuelle (accent vert foncé du contenu). */
  tone?: 'default' | 'accent';
  className?: string;
}

/**
 * Hub V4 — Carte-onglet du MENU : toute la carte est un lien vers la section,
 * habillée en Liquid Glass. Clic n'importe où = ouvre l'onglet complet.
 */
export function MenuCard({
  href,
  icon: Icon,
  label,
  children,
  wide = false,
  tone = 'default',
  className = '',
}: MenuCardProps) {
  return (
    <Link
      href={href}
      className={`group relative block h-full ${wide ? 'sm:col-span-2' : ''}`}
    >
      <LiquidGlassCard
        className="h-full min-h-[120px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
        glowIntensity="sm"
        shadowIntensity="md"
        borderRadius="24px"
      >
        <div className={`relative z-30 flex h-full min-h-[120px] flex-col justify-between p-4 ${className}`}>
          <div className="flex items-start justify-between gap-2">
            <span className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/60 shadow-2xs ${tone === 'accent' ? 'bg-[var(--lkv-forest-900)] text-sage-300' : 'bg-white/70 text-[var(--lkv-secondary)]'}`}>
              <Icon size={16} aria-hidden="true" />
            </span>
            <ArrowRight
              size={15}
              className="shrink-0 text-[var(--lkv-text-muted)] transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </div>
          <div className="mt-3 min-w-0">
            <p className="text-[13px] font-bold leading-tight text-[var(--lkv-text-primary)]">
              {label}
            </p>
            {children}
          </div>
        </div>
      </LiquidGlassCard>
    </Link>
  );
}

export default MenuCard;