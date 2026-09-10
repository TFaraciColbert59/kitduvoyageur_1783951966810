import { MomentStatCard } from '../MomentStatCard';
import { daysUntilFrom } from '../../../mobile/mobileHubEngine';
import { hubSectionHref, type HubAdventureRef } from '../../../registry/hubSectionRegistry';
import type { MaterielSummary } from '@/features/materiel/services/getMaterielSummary';

function ForestRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center gap-2 text-[11.5px]">
      <span className="shrink-0 font-medium text-white/70">{label}</span>
      <span className="ml-auto min-w-0 truncate font-bold text-white">{value}</span>
    </li>
  );
}

export function PossessionMoment({ summary }: { summary: MaterielSummary }) {
  const ref: HubAdventureRef = { nature: 'possession' };
  const departHref = hubSectionHref(ref, 'depart');
  const planned = summary.depart.destination !== 'Aucun départ planifié';
  const estimated = Boolean(summary.depart.isEstimated);
  const days = daysUntilFrom(summary.depart.startsAt);
  const dateLabel =
    planned && !estimated
      ? new Date(summary.depart.startsAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
      : null;

  return (
    <MomentStatCard
      eyebrow="Prochain départ"
      badge={planned && !estimated && days != null && days >= 0 ? `J-${days}` : null}
      cta={{ href: departHref, label: planned ? 'Ouvrir le départ' : 'Planifier un départ' }}
    >
      {planned ? (
        <>
          <p className="font-display text-xl font-extrabold leading-tight text-white">
            {summary.depart.destination}
          </p>
          {dateLabel ? (
            <p className="mt-0.5 text-xs font-medium text-white/80">Départ {dateLabel}</p>
          ) : (
            <p className="mt-0.5 text-xs font-medium text-white/80">
              Aucune date planifiée — préparez le sac pour ce kit.
            </p>
          )}

          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-white/80">Préparation du sac</span>
              <span>{summary.depart.readinessPct}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: `${Math.min(100, Math.max(0, summary.depart.readinessPct))}%` }}
              />
            </div>
          </div>

          <ul className="mt-3 space-y-1.5">
            {summary.depart.itemsCount ? (
              <ForestRow label="Objets" value={String(summary.depart.itemsCount)} />
            ) : null}
            {summary.depart.totalWeightKg ? (
              <ForestRow label="Poids" value={`${summary.depart.totalWeightKg.toFixed(1)} kg`} />
            ) : null}
            {summary.forget.forgetRemaining > 0 ? (
              <ForestRow label="Oublis" value={`${summary.forget.forgetRemaining} à cocher`} />
            ) : null}
          </ul>
        </>
      ) : (
        <p className="text-sm font-medium text-white/85">
          Aucun départ planifié — préparez votre sac pour votre prochaine aventure.
        </p>
      )}
    </MomentStatCard>
  );
}

export default PossessionMoment;
