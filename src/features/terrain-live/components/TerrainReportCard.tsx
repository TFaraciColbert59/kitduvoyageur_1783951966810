'use client';

/**
 * A5 — Carte de signalement (calme, iOS) avec 3 réponses rapides.
 * Un utilisateur ne compte qu'une fois côté serveur ; l'UI ne montre jamais
 * l'identité d'un contributeur.
 */
import Icon from '@/components/ui/Icon';
import type { TerrainConfirmation } from '@/features/adventure-intelligence/schemas/live.schema';
import { Button, Card } from '@/components/ui';
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
    <Card as="article" className="p-4" aria-label={`Signalement ${display.label}`}>
      <header className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}1A`, color }}
          aria-hidden="true"
        >
          <Icon name={display.icon} size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">
            {display.label}
          </h3>
          <p className="mt-0.5 text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-secondary)]">
            {relativeAgeFr(report.createdAt)}
            {corroboration}
            {report.distanceM >= 0 ? ` · à ${Math.round(report.distanceM)} m` : ''}
          </p>
          {report.description ? (
            <p className="mt-1 line-clamp-2 text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
              {report.description}
            </p>
          ) : null}
        </div>
      </header>

      <div className="mt-3 flex gap-2" role="group" aria-label="Confirmer ce signalement">
        {CONFIRM_ACTIONS.map((action) => (
          <Button
            key={action.value}
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => onConfirm(action.value)}
            className="flex-1"
          >
            {action.label}
          </Button>
        ))}
      </div>
    </Card>
  );
}
