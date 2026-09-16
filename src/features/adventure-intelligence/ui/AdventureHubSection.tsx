'use client';

/**
 * A7 — Bloc Hub : état global, décisions requises et grille compacte vers les
 * sections existantes du Hub (ids du registre `hubSectionRegistry`, aucune
 * route nouvelle). Composant autonome, prêt à être monté en Phase 9.
 */
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
  /**
   * Task 7 — variante discrète (section itinéraire) : densité réduite et
   * décisions vides omises, sans perdre statut/indicateurs/liens/offline.
   */
  compact?: boolean;
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
  compact = false,
}: AdventureHubSectionProps) {
  const pendingDecisions = view.priorityActions.filter((action) => action.kind === 'decide');
  const showDecisions = !compact || pendingDecisions.length > 0;

  return (
    <section
      className={`lkv-appear rounded-[var(--lkv-radius-card)] bg-[var(--lkv-surface-card)] shadow-sm ${
        compact ? 'space-y-2.5 p-3' : 'space-y-3 p-4'
      } ${className}`}
      aria-label="Cockpit de l’aventure"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2
            className={`truncate font-semibold text-[var(--lkv-text-primary)] ${
              compact ? 'text-[15px]' : 'text-[17px]'
            }`}
          >
            Cockpit aventure
          </h2>
          <p
            className={`mt-0.5 truncate text-[var(--lkv-text-secondary)] ${
              compact ? 'text-[11px]' : 'text-[12px]'
            }`}
          >
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
          <ul className={`grid grid-cols-3 ${compact ? 'gap-1.5' : 'gap-2'}`}>
            {view.indicators.map((indicator) => (
              <li
                key={indicator.id}
                className={`rounded-2xl bg-[var(--lkv-surface)] ${
                  compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
                }`}
              >
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-muted)]">
                  {indicator.label}
                </p>
                <p
                  className={`mt-1 font-semibold tabular-nums ${TONE_TEXT_CLASSES[indicator.tone]} ${
                    compact ? 'text-[15px]' : 'text-[16px]'
                  }`}
                >
                  {indicator.value}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showDecisions ? (
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
      ) : null}

      <nav aria-label="Sections du hub">
        <ul className={`grid grid-cols-2 sm:grid-cols-4 ${compact ? 'gap-1.5' : 'gap-2'}`}>
          {sections.map((section) => (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => onSelectSection?.(section.id)}
                className={`flex w-full flex-col items-start justify-center gap-1 rounded-2xl bg-[var(--lkv-surface)] px-3 py-2 text-left active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] ${
                  compact ? 'min-h-[48px]' : 'min-h-[64px]'
                }`}
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
    </section>
  );
}

export default AdventureHubSection;
