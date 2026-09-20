'use client';

/**
 * A5 — Liste verticale des conditions Terrain Live.
 * États vides/chargement/erreur soignés ; skeleton sans CLS ; jamais d'écran blanc.
 */
import Icon from '@/components/ui/Icon';
import type { TerrainConfirmation } from '@/features/adventure-intelligence/schemas/live.schema';
import { Button, Card, EmptyState, Skeleton } from '@/components/ui';
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
    <Card variant="compact" className="p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3 rounded" />
          <Skeleton className="h-3 w-2/3 rounded" />
        </div>
      </div>
      <Skeleton className="mt-3 h-11 rounded-[var(--lkv-radius-md)]" />
    </Card>
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
      <Card variant="compact" className="px-6 py-8">
        <EmptyState
          compact
          icon={<Icon name="check-circle" size={22} className="text-[color:var(--lkv-primary)]" aria-hidden="true" />}
          title="Aucun signalement récent"
          description="Le sentier est calme autour de vous."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <Card
          variant="compact"
          role="status"
          className="flex items-center justify-between px-3 py-2 text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-secondary)]"
        >
          <span>Connexion instable — dernières données connues.</span>
          {onRefresh ? (
            <Button variant="ghost" size="sm" onClick={onRefresh}>
              Réessayer
            </Button>
          ) : null}
        </Card>
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
