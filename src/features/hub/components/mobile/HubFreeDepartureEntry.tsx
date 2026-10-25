import Link from 'next/link';
import Icon from '@/components/ui/Icon';

/**
 * « Partir librement » — l'entree juste sous « Preparer une activite » (A3).
 *
 * Meme serveur que `HubPrepareEntry`, donc aucun client : un simple lien. Le
 * texte de la seconde ligne dit ce que ca fait DIFFEREMMENT de « Preparer » —
 * « sans itineraire » — pour que les deux propositions ne se confondent pas.
 */
export function HubFreeDepartureEntry() {
  return (
    <section aria-label="Partir librement" className="min-w-0">
      <Link
        href="/partir-librement"
        aria-label="Partir librement, sans itinéraire préparé"
        className="hub-chip-control glass-sub-card flex min-h-[44px] w-full items-center gap-3 rounded-2xl bg-[color:var(--card-tint-solid)] px-3 py-2.5 text-[color:var(--lkv-text-primary)] transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
      >
        <span className="hub-tile-glyph flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--lkv-primary)]/10">
          <Icon name="navigation" size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px] font-extrabold">Partir librement</span>
          <span className="mt-0.5 block truncate text-[9px] font-medium uppercase tracking-[0.12em] text-[color:var(--lkv-text-secondary)]">
            Sans itinéraire
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

export default HubFreeDepartureEntry;
