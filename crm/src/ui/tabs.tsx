'use client';

import type { ReactNode } from 'react';
import s from './crm.module.css';
import { cx } from './cx';

export type TabDef = { id: string; label: string; badge?: string | number };

/** Barre d'onglets accessible (rôle tablist, flèches gauche/droite). */
export function Tabs({
  tabs,
  value,
  onChange,
  ariaLabel
}: {
  tabs: TabDef[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className={s.tablist} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const on = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            className={cx(s.tab, on && s.tabOn)}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
              event.preventDefault();
              const index = tabs.findIndex((t) => t.id === value);
              const next = event.key === 'ArrowRight' ? index + 1 : index - 1;
              const target = tabs[(next + tabs.length) % tabs.length];
              if (target) onChange(target.id);
            }}
          >
            {tab.label}
            {tab.badge !== undefined ? <span className={s.muted}>{tab.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Panneau d'onglet : rendu seulement quand actif, annoncé aux lecteurs d'écran. */
export function TabPanel({ active, children }: { active: boolean; children: ReactNode }) {
  if (!active) return null;
  return (
    <div role="tabpanel" className={s.colGap}>
      {children}
    </div>
  );
}
