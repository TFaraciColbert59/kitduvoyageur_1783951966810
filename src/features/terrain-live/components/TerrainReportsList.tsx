'use client';

/**
 * A5 — Liste verticale des conditions Terrain Live.
 * États vides/chargement/erreur soignés ; skeleton sans CLS ; jamais d'écran blanc.
 */
import Icon from '@/components/ui/Icon';
import type { TerrainConfirmation } from '@/features/adventure-intelligence/schemas/live.schema';
import TerrainReportCard from './TerrainReportCard';
import type { TerrainLiveReport } from '../lib/terrainDisplay';

export interface TerrainReportsListProps {
  reports: TerrainLiveReport[];
  loading: boolean;
  error: string | null;
  onConfirm: (reportId: string, confirmation: TerrainConfirmation) => void;
  onRefresh?: () => void;
  confirmingId?: string | null;
}

function ReportSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl bg-[var(--lkv-surface-raised,#FFFFFF)] p-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-[var(--lkv-surface,#FBFAF6)]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 rounded bg-[var(--lkv-surface,#FBFAF6)]" />
          <div className="h-3 w-2/3 rounded bg-[var(--lkv-surface,#FBFAF6)]" />
        </div>
      </div>
      <div className="mt-3 h-11 rounded-xl bg-[var(--lkv-surface,#FBFAF6)]" />
    </div>
  );
}

export default function TerrainReportsList({
  reports,
  loading,
  error,
  onConfirm,
  onRefresh,
  confirmingId = null,
}: TerrainReportsListProps) {
  if (loading && reports.length === 0) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Chargement des conditions">
        <ReportSkeleton />
        <ReportSkeleton />
      </div>
    );
  }

  if (!loading && reports.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-[var(--lkv-surface-raised,#FFFFFF)] px-6 py-8 text-center">
        <Icon name="check-circle" size={22} className="text-[var(--lkv-secondary,#17402C)]" aria-hidden="true" />
        <p className="text-[15px] font-medium text-[var(--lkv-text-primary,#0B1F17)]">
          Aucun signalement récent
        </p>
        <p className="text-[13px] text-[var(--lkv-text-secondary,#4A5D52)]">
          Le sentier est calme autour de vous.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl bg-[var(--lkv-surface,#FBFAF6)] px-3 py-2 text-[12px] text-[var(--lkv-text-secondary,#4A5D52)]"
        >
          <span>Connexion instable — dernières données connues.</span>
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              className="min-h-[44px] px-2 font-medium text-[var(--lkv-secondary,#17402C)]"
            >
              Réessayer
            </button>
          ) : null}
        </div>
      ) : null}

      <ul className="space-y-3" aria-live="polite">
        {reports.map((report) => (
          <li key={report.id}>
            <TerrainReportCard
              report={report}
              busy={confirmingId === report.id}
              onConfirm={(confirmation) => onConfirm(report.id, confirmation)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
