'use client';

/**
 * A5 — Carte de signalement (calme, iOS) avec 3 réponses rapides.
 * Un utilisateur ne compte qu'une fois côté serveur ; l'UI ne montre jamais
 * l'identité d'un contributeur.
 */
import Icon from '@/components/ui/Icon';
import type { TerrainConfirmation } from '@/features/adventure-intelligence/schemas/live.schema';
import {
  SEVERITY_COLORS,
  categoryDisplay,
  relativeAgeFr,
} from '../lib/terrainDisplay';
import type { TerrainLiveReport } from '../lib/terrainDisplay';

export interface TerrainReportCardProps {
  report: TerrainLiveReport;
  onConfirm: (confirmation: TerrainConfirmation) => void;
  busy?: boolean;
}

const CONFIRM_ACTIONS: { value: TerrainConfirmation; label: string }[] = [
  { value: 'present', label: 'Toujours là' },
  { value: 'gone', label: 'Disparu' },
  { value: 'unknown', label: 'Je ne sais pas' },
];

export default function TerrainReportCard({
  report,
  onConfirm,
  busy = false,
}: TerrainReportCardProps) {
  const display = categoryDisplay(report.category);
  const color = SEVERITY_COLORS[report.severity] ?? SEVERITY_COLORS.warning;
  const corroboration =
    report.reportCount > 1
      ? ` · signalé ${report.reportCount} fois`
      : report.presentCount > 0
        ? ` · confirmé par ${report.presentCount} personne${report.presentCount > 1 ? 's' : ''}`
        : '';

  return (
    <article
      className="rounded-2xl bg-[var(--lkv-surface-raised,#FFFFFF)] p-4 shadow-sm"
      aria-label={`Signalement ${display.label}`}
    >
      <header className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}1A`, color }}
          aria-hidden="true"
        >
          <Icon name={display.icon} size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-[var(--lkv-text-primary,#0B1F17)]">
            {display.label}
          </h3>
          <p className="mt-0.5 text-[12px] text-[var(--lkv-text-secondary,#4A5D52)]">
            {relativeAgeFr(report.createdAt)}
            {corroboration}
            {report.distanceM >= 0 ? ` · à ${Math.round(report.distanceM)} m` : ''}
          </p>
          {report.description ? (
            <p className="mt-1 line-clamp-2 text-[13px] text-[var(--lkv-text-secondary,#4A5D52)]">
              {report.description}
            </p>
          ) : null}
        </div>
      </header>

      <div className="mt-3 flex gap-2" role="group" aria-label="Confirmer ce signalement">
        {CONFIRM_ACTIONS.map((action) => (
          <button
            key={action.value}
            type="button"
            disabled={busy}
            onClick={() => onConfirm(action.value)}
            className="min-h-[44px] flex-1 rounded-xl bg-[var(--lkv-surface,#FBFAF6)] px-2 text-[13px] font-medium text-[var(--lkv-text-primary,#0B1F17)] active:opacity-70 disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
      </div>
    </article>
  );
}
