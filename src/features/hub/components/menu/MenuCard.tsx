// UI Layouts (MIT) — carte-onglet du MENU Hub, habillée Liquid Glass.
// Composant SERVEUR. V5e : zéro icône (typographie seule), micro-label
// uppercase, densification p-3, variante `media` (fond plein, contenu
// posé sur un scrim — le média reste 100% visible au-dessus du texte).
import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui-layouts/liquid-glass';

export interface MenuCardProps {
  href: string;
  label: string;
  /** Micro-contenu de la carte (résumé de la section). */
  children?: React.ReactNode;
  /** Priorité visuelle (label en accent vert foncé). */
  tone?: 'default' | 'accent';
  /** Média plein fond (trace SVG…) — contenu posé sur un scrim dégradé. */
  media?: React.ReactNode;
  className?: string;
}

/**
 * Hub V5e — Carte-onglet du MENU : toute la carte est un lien vers la
 * section. Zéro icône (clarté), micro-label uppercase 11px, p-3.
 * `media` : le média couvre la carte ; le contenu s'arrête sur le scrim
 * bas (from-white/85) — jamais de texte sur le média.
 */
export function MenuCard({
  href,
  label,
  children,
  tone = 'default',
  media,
  className = '',
}: MenuCardProps) {
  return (
    <Link
      href={href}
      className={`group relative block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] rounded-[var(--lkv-radius-card)] transition-transform active:scale-[0.99] ${className}`}
    >
      <LiquidGlassCard
        className="h-full"
        glowIntensity="sm"
        shadowIntensity="md"
        borderRadius="var(--lkv-radius-card)"
      >
        {media && (
          <div data-media-root className="absolute inset-0 z-10 overflow-hidden rounded-[var(--lkv-radius-card)]">
            {media}
          </div>
        )}
        <div
          className={`relative z-30 flex h-full min-h-0 flex-col justify-end rounded-[var(--lkv-radius-card)] p-3 ${
            media ? '' : 'border border-white/60 bg-white/55'
          }`}
        >
          <div
            data-media-content-panel
            className={
              media
                ? 'flex h-full w-[42%] min-w-[230px] max-w-[320px] flex-col rounded-2xl border border-white/60 bg-white/95 p-3 shadow-sm backdrop-blur-sm'
                : 'flex min-h-0 min-w-0 flex-1 flex-col'
            }
          >
            <p
              className={`text-[11px] font-bold uppercase tracking-widest leading-tight ${
                tone === 'accent'
                  ? 'text-[var(--lkv-primary)]'
                  : 'text-[var(--lkv-text-secondary)]'
              }`}
            >
              {label}
            </p>
            {children && <div className="mt-1.5 min-h-0 min-w-0 flex-1 overflow-hidden">{children}</div>}
          </div>
        </div>
      </LiquidGlassCard>
    </Link>
  );
}

export default MenuCard;
