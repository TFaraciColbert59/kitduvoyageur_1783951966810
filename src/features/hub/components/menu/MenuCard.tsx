// UI Layouts (MIT) — carte-onglet du MENU Hub, habillée Liquid Glass.
// Composant SERVEUR : les icônes sont passées ici-même (pas vers un client).
// Le spotlight (halo souris) est appliqué par BentoGrid (client).
import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { LiquidGlassCard } from '@/components/ui-layouts/liquid-glass';

export interface MenuCardProps {
  href: string;
  icon: LucideIcon;
  label: string;
  /** Micro-contenu de la carte (résumé de la section). */
  children?: React.ReactNode;
  /** Priorité visuelle (pastille accent vert foncé). */
  tone?: 'default' | 'accent';
  className?: string;
}

/**
 * Hub V4 — Carte-onglet du MENU : toute la carte est un lien vers la section.
 * Remplissage frosted (bg-white/60) pour une lecture franche sur fond uni,
 * typographie 12px minimum, pastille 40px, hauteur min 150px.
 */
export function MenuCard({
  href,
  icon: Icon,
  label,
  children,
  tone = 'default',
  className = '',
}: MenuCardProps) {
  return (
    <Link
      href={href}
      className={`group relative block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] rounded-[var(--lkv-radius-card)] ${className}`}
    >
      <LiquidGlassCard
        className="h-full min-h-[150px]"
        glowIntensity="sm"
        shadowIntensity="md"
        borderRadius="var(--lkv-radius-card)"
      >
        <div className="relative z-30 flex h-full min-h-[150px] flex-col justify-between rounded-[var(--lkv-radius-card)] border border-white/60 bg-white/55 p-4">
          <div className="flex items-start justify-between gap-2">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/60 shadow-2xs ${
                tone === 'accent'
                  ? 'bg-[var(--lkv-forest-900)] text-sage-300'
                  : 'bg-white/70 text-[var(--lkv-secondary)]'
              }`}
            >
              <Icon size={17} aria-hidden="true" />
            </span>
            <ArrowRight
              size={16}
              className="shrink-0 text-[var(--lkv-text-muted)] transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </div>
          <div className="mt-3 min-w-0">
            <p className="text-sm font-bold leading-tight text-[var(--lkv-text-primary)]">
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
