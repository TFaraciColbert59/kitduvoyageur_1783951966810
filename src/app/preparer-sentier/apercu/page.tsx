import { notFound } from 'next/navigation';
import { ActivityPreparationStatus } from '@/features/hub/components/live/ActivityPreparationStatus';
import { PREPARATION_PHASES } from '@/features/hub/components/live/preparationPhases';
import {
  ActivitySectionSkeleton,
  type ActivitySectionSkeletonVariant,
} from '@/features/hub/components/live/ActivitySectionSkeleton';
import { ArrivalReveal } from '@/features/hub/components/live/ArrivalReveal';
import { PageHeader } from '@/components/ui';

/**
 * `/preparer-sentier/apercu` — page d'aperçu DEV uniquement (fixtures locales
 * pour la validation visuelle du rail, des squelettes et des reveals). Interdite
 * en production et jamais liée depuis l'UI : les captures passent par le dev
 * server (`tests/visual/preparer-live.spec.ts`).
 */
export const metadata = {
  title: 'Aperçu préparation live — dev',
  robots: { index: false, follow: false },
};

const SKELETONS: readonly ActivitySectionSkeletonVariant[] = [
  'timeline',
  'moments',
  'affiliate',
  'kit',
];

const REVEAL_ITEMS = [
  'Étape ajoutée — Refuge du col',
  'Moment ajouté — Marché du village',
  'Transport ajouté — Train de nuit',
  'Élément de kit ajouté — Réchaud',
] as const;

export default function PreparerApercuPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <div
      data-testid="preparer-apercu"
      className="min-h-screen bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] saturate-[var(--glass-sat)] lkv-rim-inset backdrop-blur-[var(--glass-blur-sm)] px-4 py-6 text-[color:var(--lkv-text-primary)]"
    >
      <PageHeader
        variant="large"
        className="mx-auto max-w-5xl"
        title="Aperçu préparation live"
        subtitle="Fixtures locales — page de validation visuelle réservée au développement."
      />

      <section className="mx-auto mt-6 max-w-5xl" aria-label="Rail par phase">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/70">
          Rail — une phase par état
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {PREPARATION_PHASES.map((phase) => (
            <ActivityPreparationStatus key={phase.key} phaseOverride={phase.key} />
          ))}
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-5xl" aria-label="Squelettes pré-formés">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/70">
          Squelettes — timeline, moments, affiliation, kit
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {SKELETONS.map((variant) => (
            <div
              key={variant}
              data-preview-skeleton={variant}
              className="rounded-[var(--lkv-radius-card)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-3"
            >
              <ActivitySectionSkeleton variant={variant} />
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-5xl pb-8" aria-label="Arrivées animées">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/70">
          Reveals — fondu + micro-translation, stagger 0,04 s
        </p>
        <ul className="mt-3 space-y-2" data-preview-reveals="">
          {REVEAL_ITEMS.map((label, index) => (
            <li key={label}>
              <ArrivalReveal
                index={index}
                className="rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset px-3 py-3"
              >
                <p className="text-sm font-bold text-[var(--lkv-text-primary)]">{label}</p>
                <p className="mt-0.5 text-[11px] font-medium text-[var(--lkv-text-secondary)]">
                  Arrivée realtime — item {index + 1}
                </p>
              </ArrivalReveal>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
