import { MomentStatCard } from '../MomentStatCard';
import { hubSectionHref, type HubAdventureRef } from '../../../registry/hubSectionRegistry';
import type { GroupeMenuSummary } from '../../../server/getGroupeMenu';

function ForestRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center gap-2 text-[11.5px]">
      <span className="shrink-0 font-medium text-white/70">{label}</span>
      <span className="ml-auto min-w-0 truncate font-bold text-white">{value}</span>
    </li>
  );
}

export interface CollectifMomentProps {
  summary: GroupeMenuSummary;
}

export function CollectifMoment({ summary }: CollectifMomentProps) {
  const ref: HubAdventureRef = { nature: 'collectif' };
  const groupeHref = hubSectionHref(ref, 'groupe');
  const discussionHref = `${groupeHref}?onglet=discussion`;

  return (
    <MomentStatCard
      eyebrow="Vie du groupe"
      badge={`${summary.progression}%`}
      cta={{ href: discussionHref, label: 'Ouvrir la discussion' }}
    >
      {summary.lastMessage ? (
        <p className="line-clamp-2 font-serif-lkv text-[15px] italic leading-snug text-white/90">
          « {summary.lastMessage} »
        </p>
      ) : (
        <p className="text-sm font-medium text-white/85">Lancez la conversation du groupe.</p>
      )}

      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <span className="text-white/80">Préparation collective</span>
          <span>{summary.progression}%</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white"
            style={{ width: `${Math.min(100, Math.max(0, summary.progression))}%` }}
          />
        </div>
      </div>

      <ul className="mt-3 space-y-1.5">
        {summary.tasksOpen > 0 && (
          <ForestRow
            label="Tâches ouvertes"
            value={String(summary.tasksOpen)}
          />
        )}
        {summary.pollsOpen > 0 && <ForestRow label="Votes ouverts" value={String(summary.pollsOpen)} />}
        {summary.departureLabel && <ForestRow label="Départ" value={summary.departureLabel} />}
        {summary.tasksOpen === 0 && summary.pollsOpen === 0 && !summary.departureLabel && (
          <ForestRow label="Membres" value={String(summary.members)} />
        )}
      </ul>
    </MomentStatCard>
  );
}

export default CollectifMoment;
