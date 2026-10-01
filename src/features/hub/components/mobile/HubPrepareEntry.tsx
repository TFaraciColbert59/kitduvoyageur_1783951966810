import Link from 'next/link';
import Icon from '@/components/ui/Icon';

/**
 * P7 — Entrée visible du préparateur dans le hub mobile.
 *
 * Server Component (aucun 'use client') : la carte est un simple lien vers la
 * route du préparateur. Elle reprend le langage visuel de ses voisines
 * (InfoChipsRow / SectionCarousel) — glass-sub-card, rayon 2xl, cible tactile
 * 44 px, tokens CSS — sans introduire de couleur codée en dur.
 *
 * L'icône passe par la primitive canonique `Icon` (prop `name` statique) :
 * aucune icône n'est passée via une prop `icon`.
 */
export function HubPrepareEntry() {
  return (
    <section aria-label="Préparer une activité" className="min-w-0">
      <Link
        href="/compas?nouvelle=1"
        aria-label="Préparer une activité"
        className="hub-chip-control glass-sub-card flex min-h-[44px] w-full items-center gap-3 rounded-2xl bg-[color:var(--card-tint-solid)] px-3 py-2.5 text-[color:var(--lkv-text-primary)] transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
      >
        <span className="hub-tile-glyph flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--lkv-primary)]/10">
          <Icon name="backpack" size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px] font-extrabold">
            Préparer une activité
          </span>
          <span className="mt-0.5 block truncate text-[9px] font-medium uppercase tracking-[0.12em] text-[color:var(--lkv-text-secondary)]">
            Activité, route, itinéraire
          </span>
        </span>
        <Icon
          name="chevron-right"
          size={15}
          className="shrink-0 text-[color:var(--lkv-text-secondary)]"
          aria-hidden="true"
        />
      </Link>
    </section>
  );
}

export default HubPrepareEntry;