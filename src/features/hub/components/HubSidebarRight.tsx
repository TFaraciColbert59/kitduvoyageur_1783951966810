'use client';

import React from 'react';
import {
  hubWidgetRegistry,
  hubEstimatedHeight,
  HUB_WIDGET_COLUMN_MAX_HEIGHT,
} from '../registry/hubWidgetRegistry';
import type { AdventureProfile } from '../engine/hubProfileEngine';

export interface HubSidebarRightProps {
  profile: AdventureProfile;
  /** column = colonne droite desktop · band = bande défilante mobile (§2.1). */
  variant?: 'column' | 'band';
}

/**
 * H3.3 — Colonne contextuelle du hub (canonique H-D85 R10).
 * Carte contexte (nature/party/échelle) + slots widgets du profil, ordonnés
 * par priorité, repliés au-delà de 2×900 (contrainte Y). Les widgets réels
 * sont livrés par nature en H4 ; le shell garantit déjà l'ordre et le budget.
 */
const NATURE_LABELS = { possession: 'Matériel', sortie: 'Voyage', collectif: 'Groupe' } as const;
const PARTY_LABELS = { solo: 'Solo', duo: 'Duo', group: 'Groupe' } as const;

export function HubSidebarRight({ profile, variant = 'column' }: HubSidebarRightProps) {
  const kept = hubWidgetRegistry
    .filter((w) => w.natures.includes(profile.nature) && profile.widgets.includes(w.id))
    .sort((a, b) => b.priority - a.priority);

  const shown: typeof kept = [];
  let used = 0;
  for (const w of kept) {
    if (used + w.estimatedHeight > HUB_WIDGET_COLUMN_MAX_HEIGHT) break;
    shown.push(w);
    used += w.estimatedHeight;
  }
  const folded = kept.length - shown.length;

  if (variant === 'band') {
    return (
      <div
        aria-label="Widgets de l'aventure"
        className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1"
      >
        <div className="glass px-3 py-2 rounded-full shrink-0 flex items-center gap-2 min-h-[44px]">
          <span className="text-[11px] font-bold text-[var(--lkv-text-primary)] whitespace-nowrap">
            {NATURE_LABELS[profile.nature]} · {PARTY_LABELS[profile.party]}
          </span>
        </div>
        {shown.map((w) => (
          <div
            key={w.id}
            data-hub-widget={w.id}
            className="glass px-3 py-2 rounded-full shrink-0 flex items-center min-h-[44px]"
          >
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-secondary)] whitespace-nowrap">
              {w.id}
            </span>
            <span className="sr-only">Widget {w.id} — contenu livré en H4</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <aside aria-label="Contexte de l'aventure" className="flex flex-col gap-3">
      <div className="glass p-4 rounded-[var(--lkv-radius-card)]">
        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-muted)]">
          Contexte
        </p>
        <p className="text-sm font-bold text-[var(--lkv-text-primary)] mt-1">
          {NATURE_LABELS[profile.nature]} · {PARTY_LABELS[profile.party]}
          {profile.scale ? ` · ${profile.scale}` : ''}
        </p>
        <p className="text-xs text-[var(--lkv-text-secondary)] mt-0.5">
          {profile.sections.length} section(s) · {profile.widgets.length} widget(s)
        </p>
      </div>

      {shown.map((w) => (
        <div
          key={w.id}
          data-hub-widget={w.id}
          className="glass p-4 rounded-[var(--lkv-radius-card)] min-h-[44px]"
        >
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-muted)]">
            {w.id}
          </p>
          <div className="mt-2 h-2 rounded-full bg-black/5" aria-hidden="true" />
          <span className="sr-only">Widget {w.id} — contenu livré en H4</span>
        </div>
      ))}
      {folded > 0 && (
        <p className="text-[11px] text-[var(--lkv-text-muted)] px-1">
          +{folded} widget(s) replié(s) — {hubEstimatedHeight(kept.map((w) => w.id))} px budgétés
        </p>
      )}
    </aside>
  );
}

export default HubSidebarRight;
