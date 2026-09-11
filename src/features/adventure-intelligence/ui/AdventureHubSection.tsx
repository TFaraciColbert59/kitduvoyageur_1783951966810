'use client';

/**
 * A7 — Bloc Hub : état global, décisions requises et grille compacte vers les
 * sections existantes du Hub (ids du registre `hubSectionRegistry`, aucune
 * route nouvelle). Composant autonome, prêt à être monté en Phase 9.
 */
import { motion, useReducedMotion } from 'framer-motion';
import Icon from '@/components/ui/Icon';
import type { CockpitTone, CockpitView } from '../domain/cockpit';
import OfflineBanner from './OfflineBanner';

export interface HubQuickLink {
  id: string;
  label: string;
  icon: string;
}

/** Miroir des sections cœur d'une sortie (ids registre hub). */
export const DEFAULT_HUB_QUICK_LINKS: HubQuickLink[] = [
  { id: 'itinerary', label: 'Itinéraire', icon: 'navigation' },
  { id: 'safety', label: 'Sécurité', icon: 'shield-alert' },
  { id: 'checklist', label: 'Checklist', icon: 'check-square' },
  { id: 'journal', label: 'Journal', icon: 'book-open' },
];

export interface AdventureHubSectionProps {
  view: CockpitView;
  sections?: HubQuickLink[];
  onSelectSection?: (sectionId: string) => void;
  onDecide?: (decisionId: string) => void;
  onOpenCockpit?: () => void;
  pendingSyncCount?: number;
  className?: string;
}

const TONE_TEXT_CLASSES: Record<CockpitTone, string> = {
  neutral: 'text-[var(--lkv-text-primary)]',
  positive: 'text-[var(--lkv-success)]',
  warning: 'text-[var(--lkv-warning-dark)]',
  critical: 'text-[var(--lkv-danger-dark)]',
};

export function AdventureHubSection({
  view,
  sections = DEFAULT_HUB_QUICK_LINKS,
  onSelectSection,
  onDecide,
  onOpenCockpit,
  pendingSyncCount = 0,
  className = '',
}: AdventureHubSectionProps) {
  const reduceMotion = useReducedMotion();
  const pendingDecisions = view.priorityActions.filter((action) => action.kind === 'decide');

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={`space-y-3 rounded-[var(--lkv-radius-card)] bg-[var(--lkv-surface-card)] p-4 shadow-sm ${className}`}
      aria-label="Cockpit de l’aventure"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-semibold text-[var(--lkv-text-primary)]">
            Cockpit aventure
          </h2>
          <p className="mt-0.5 truncate text-[12px] text-[var(--lkv-text-secondary)]">
            {view.hero.title} · {view.hero.status}
          </p>
        </div>
        {onOpenCockpit && (
          <button
            type="button"
            onClick={onOpenCockpit}
            className="min-h-[44px] shrink-0 rounded-full bg-[var(--lkv-primary)] px-4 text-[13px] font-semibold text-white active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
          >
            Ouvrir
          </button>
        )}
      </header>

      <div aria-label="État global">
        {view.indicators.length === 0 ? (
          <p
            role="status"
            className="rounded-2xl bg-[var(--lkv-surface)] px-3 py-3 text-[13px] text-[var(--lkv-text-secondary)]"
          >
            Aucune donnée disponible pour le moment.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {view.indicators.map((indicator) => (
              <li key={indicator.id} className="rounded-2xl bg-[var(--lkv-surface)] px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-muted)]">
                  {indicator.label}
                </p>
                <p
                  className={`mt-1 text-[16px] font-semibold tabular-nums ${TONE_TEXT_CLASSES[indicator.tone]}`}
                >
                  {indicator.value}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <section aria-label="Décisions requises">
        <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]">
          Décisions requises
        </h3>
        {pendingDecisions.length === 0 ? (
          <p role="status" className="mt-1 text-[13px] text-[var(--lkv-text-secondary)]">
            Aucune décision en attente.
          </p>
        ) : (
          <ul className="mt-1 space-y-2">
            {pendingDecisions.map((decision) => (
              <li key={decision.id}>
                <button
                  type="button"
                  onClick={() => onDecide?.(decision.id)}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-2xl bg-[var(--lkv-surface)] px-3 text-left text-[14px] font-medium text-[var(--lkv-text-primary)] active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
                >
                  <Icon
                    name="check-circle"
                    size={16}
                    className="shrink-0 text-[var(--lkv-secondary)]"
                    aria-hidden="true"
                  />
                  <span className="flex-1">{decision.label}</span>
                  <Icon
                    name="chevron-right"
                    size={14}
                    className="shrink-0 text-[var(--lkv-text-muted)]"
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav aria-label="Sections du hub">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {sections.map((section) => (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => onSelectSection?.(section.id)}
                className="flex min-h-[64px] w-full flex-col items-start justify-center gap-1 rounded-2xl bg-[var(--lkv-surface)] px-3 py-2 text-left active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
              >
                <Icon
                  name={section.icon}
                  size={16}
                  className="text-[var(--lkv-secondary)]"
                  aria-hidden="true"
                />
                <span className="text-[13px] font-medium text-[var(--lkv-text-primary)]">
                  {section.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <OfflineBanner offline={view.offline} pendingCount={pendingSyncCount} />
    </motion.section>
  );
}

export default AdventureHubSection;
