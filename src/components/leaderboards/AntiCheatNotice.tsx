'use client';

import React from 'react';
import type { AntiCheatSummary } from '@/lib/leaderboards/types';

export interface AntiCheatNoticeProps {
  summary: AntiCheatSummary;
  compact?: boolean;
}

const CATEGORY_LABELS = {
  anti_cheat: 'Contrôle sportif',
  privacy: 'Confidentialité',
  period: 'Période',
} as const;

/**
 * Agrégat anti-triche S02. Seuls des compteurs et des règles sortent : aucun
 * nom, aucun identifiant d'effort, aucun diagnostic nominatif.
 */
export function AntiCheatNotice({ summary, compact = false }: AntiCheatNoticeProps) {
  const hasRejections = summary.rejectedCount > 0;
  const visibleReasons = summary.reasons.slice(0, compact ? 2 : 4);

  return (
    <section className="lkb-integrity" aria-labelledby="lkb-integrity-title">
      <div className="lkb-integrity-head">
        <span className="lkb-integrity-mark" aria-hidden="true">
          ✓
        </span>
        <div>
          <h2 id="lkb-integrity-title" className="lkb-integrity-title">
            Classement contrôlé
          </h2>
          <p className="lkb-integrity-sub">
            {hasRejections
              ? `${summary.rejectedCount} passage${summary.rejectedCount > 1 ? 's' : ''} écarté${summary.rejectedCount > 1 ? 's' : ''} avant publication.`
              : 'Aucun passage écarté sur cette projection.'}
          </p>
        </div>
      </div>

      {visibleReasons.length > 0 && (
        <ul className="lkb-integrity-reasons" aria-label="Motifs de retrait agrégés">
          {visibleReasons.map((reason) => (
            <li key={reason.reason} className="lkb-integrity-reason">
              <span className="lkb-integrity-count">{reason.count}</span>
              <span>
                <span className="lkb-integrity-reason-label">{reason.label}</span>
                <span className="lkb-integrity-category">{CATEGORY_LABELS[reason.category]}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <details className="lkb-integrity-details">
        <summary>Comment les passages sont vérifiés</summary>
        <ul>
          {summary.checks.map((check) => (
            <li key={check.id}>
              <strong>{check.label}.</strong> {check.detail}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
