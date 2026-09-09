import { BookOpen } from 'lucide-react';
import type { TripFull } from '@/features/trips/types/trip.types';
import { hubSectionHref, type HubAdventureRef } from '../../registry/hubSectionRegistry';

/**
 * H-ACT — Bloc "Journal récent" de l'aperçu : les 2 dernières notes du
 * voyage (trip.notes déjà fetch) + lien vers le journal complet.
 */
export function JournalApercuBlock({ trip, slug }: { trip: TripFull; slug: string }) {
  const notes = [...(trip.notes ?? [])]
    .sort((a, b) => {
      if (a.day_number != null && b.day_number != null) return b.day_number - a.day_number;
      if (a.day_number != null) return -1;
      if (b.day_number != null) return 1;
      return b.created_at.localeCompare(a.created_at);
    })
    .slice(0, 2);
  const ref: HubAdventureRef = { nature: 'sortie', slug };

  return (
    <div className="glass p-5 rounded-[var(--lkv-radius-card)] border border-white/60 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-[var(--lkv-text-primary)] flex items-center gap-2">
          <BookOpen size={18} className="text-[var(--lkv-text-secondary)]" aria-hidden="true" />
          <span>Journal récent</span>
        </h2>
        <a
          href={hubSectionHref(ref, 'journal')}
          className="text-xs font-semibold text-[var(--lkv-primary)] hover:underline min-h-[44px] inline-flex items-center"
        >
          Voir tout →
        </a>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-[var(--lkv-text-secondary)]">
          Aucune note encore — racontez vos journées depuis la section Journal.
        </p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="px-3 py-2.5 rounded-[var(--lkv-radius-md)] bg-white/35 border border-white/50">
              <div className="flex items-center gap-2 mb-0.5">
                {n.day_number != null && (
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-secondary)]">
                    Jour {n.day_number}
                  </span>
                )}
                {n.title && (
                  <span className="text-sm font-semibold text-[var(--lkv-text-primary)] truncate">{n.title}</span>
                )}
              </div>
              <p className="text-xs text-[var(--lkv-text-secondary)] line-clamp-2">{n.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default JournalApercuBlock;
