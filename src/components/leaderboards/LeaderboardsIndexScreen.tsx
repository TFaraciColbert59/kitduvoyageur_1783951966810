import React from 'react';
import type { SegmentLeaderboardSummary } from '@/lib/leaderboards/types';
import { LeaderboardSummaryList } from './LeaderboardSummaryList';

export interface LeaderboardsIndexScreenProps {
  segments: ReadonlyArray<SegmentLeaderboardSummary>;
}

/**
 * Écran d'index `/classements` : toutes les entrées passent par le contrat S02
 * (titres KOM/QOM/CR, filtres retirés, Local Legend autorisée).
 */
export function LeaderboardsIndexScreen({ segments }: LeaderboardsIndexScreenProps) {
  return (
    <div className="lkb-index">
      <header className="lkb-index-hero">
        <p className="lkb-eyebrow">S4.05 · S4.06 · S4.08</p>
        <h1 className="lkb-title">Classements de segments</h1>
        <p className="lkb-intro">
          Les meilleurs passages vérifiés, les titres KOM, QOM et CR, et les Local Legends d’un
          segment. Chaque projection applique les contrôles anti-triche et les choix de
          confidentialité avant publication.
        </p>
        <ul className="lkb-principles">
          <li>Vitesse, tracé, complétion et modération vérifiés.</li>
          <li>Comptes privés, efforts sans consentement et blocages exclus.</li>
          <li>Âge et poids ne sont pas des filtres de classement.</li>
        </ul>
      </header>

      <section className="lkb-index-list" aria-labelledby="lkb-index-list-title">
        <div className="lkb-section-head">
          <h2 id="lkb-index-list-title" className="lkb-section-title">
            Segments classés
          </h2>
          <span className="lkb-section-count">{segments.length}</span>
        </div>
        <LeaderboardSummaryList segments={segments} />
      </section>
    </div>
  );
}
