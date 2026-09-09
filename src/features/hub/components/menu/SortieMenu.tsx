import {
  Calendar,
  CheckSquare,
  CreditCard,
  FileText,
  Navigation,
  Package,
  Play,
  Share2,
  Shield,
  Users,
} from 'lucide-react';
import { hubSectionHref, type HubAdventureRef } from '../../registry/hubSectionRegistry';
import { HubMenuGrid } from './HubMenuGrid';
import { MenuCard } from './MenuCard';
import { NumberStat } from '@/components/ui-layouts/number-stat';
import { ChecklistCardBody } from './ChecklistCardBody';
import { MenuVitalsCarousel, type MenuVital } from './MenuVitalsCarousel';
import { getTripDuration } from '@/features/trips/hooks/useTripDuration';
import { getKitCounters } from '@/features/trips/hooks/useKitCounters';
import { getTripDistance } from '@/features/trips/hooks/useTripDistance';
import { getCanonicalTripSteps } from '@/features/trips/hooks/useTripCounters';
import type { TripFull, TripStats } from '@/features/trips/types/trip.types';
import type { HubCrewBlock, HubHikingContext } from '../../server/getHubAdventureData';
import type { TripPhase } from '@/features/trips/engine/temporalPhaseEngine';
import { HUB_HOME_HREF } from '../../registry/hubSectionRegistry';

export interface SortieMenuProps {
  trip: TripFull;
  stats: TripStats;
  crew: HubCrewBlock | null;
  pendingInvites: number;
  daysUntil: number | null;
  phase: TripPhase;
  hiking?: HubHikingContext | null;
}

function soonestExpiry(docs: TripFull['documents']): { label: string; inDays: number } | null {
  if (!docs || docs.length === 0) return null;
  let best: { label: string; inDays: number } | null = null;
  for (const d of docs) {
    if (!d.expires_at) continue;
    const days = Math.round((new Date(d.expires_at).getTime() - Date.now()) / 86400000);
    if (days < 0 || days > 365) continue;
    if (!best || days < best.inDays) best = { label: d.title || 'Document', inDays: days };
  }
  return best;
}

/**
 * Hub V4 — MENU d'une SORTIE (voyage/randonnée) : cartes-onglets résumées.
 * Ordre : Itinéraire (héros), Équipement, Équipage & compagnons, Budget,
 * Checklist, Documents, Sécurité, Journal, Export.
 */
export function SortieMenu({
  trip,
  stats,
  crew,
  pendingInvites,
  daysUntil,
  phase,
  hiking,
}: SortieMenuProps) {
  const ref: HubAdventureRef = { nature: 'sortie', slug: trip.slug };
  const duration = getTripDuration(trip);
  const kit = getKitCounters(trip.items);
  const dist = getTripDistance(trip.steps);
  const steps = getCanonicalTripSteps(trip.steps);
  const packedPercent = kit.total > 0 ? Math.round((kit.ready / kit.total) * 100) : 0;
  const weightKg = (trip.items ?? []).reduce((s, i) => s + (i.weight_grams ?? 0), 0) / 1000;
  const budgetPct =
    stats.estimated_budget > 0 ? Math.round((stats.total_spent / stats.estimated_budget) * 100) : null;
  const crewCount = crew?.memberCount ?? 0;
  const collabCount = trip.collaborators?.length ?? 0;
  const pendingSafety = trip.safety_checkpoints?.filter((c) => c.status === 'pending').length ?? 0;
  const exp = soonestExpiry(trip.documents);
  const lastNote = [...(trip.notes ?? [])]
    .sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0) || a.created_at.localeCompare(b.created_at))
    .pop();
  const weather = hiking?.weather?.current;

  const vitals: MenuVital[] = [
    { id: 'budget', label: 'Budget', value: `${stats.total_spent} ${trip.budget_currency || 'EUR'}`, sub: budgetPct !== null ? `${budgetPct}% de l'estimation` : 'non défini', href: hubSectionHref(ref, 'budget') },
    { id: 'kit', label: 'Sac', value: `${packedPercent}%`, sub: `${kit.ready}/${kit.total} prêt${weightKg ? ` · ${weightKg.toFixed(1)} kg` : ''}`, href: hubSectionHref(ref, 'gear') },
    ...(daysUntil !== null && daysUntil !== undefined ? [{ id: 'depart', label: 'Départ', value: daysUntil >= 0 ? `J-${daysUntil}` : 'En cours', sub: `${duration.durationDays} jours`, href: HUB_HOME_HREF }] : []),
    { id: 'equipage', label: 'Équipage', value: `${collabCount}`, sub: `${crewCount} équipier${crewCount > 1 ? 's' : ''}${pendingInvites ? ` · ${pendingInvites} inv.` : ''}`, href: hubSectionHref(ref, 'team') },
  ];

  return (
    <div className="space-y-4">
      <MenuVitalsCarousel vitals={vitals} />

      <HubMenuGrid>
        {phase === 'live' && (
          <MenuCard href={`${HUB_HOME_HREF}?phase=live`} icon={Play} label="Cockpit terrain" wide tone="accent">
            <p className="text-xs text-[var(--lkv-text-secondary)] mt-0.5">Jour en cours, secours 112, dépense express.</p>
          </MenuCard>
        )}
        {phase === 'recount' && (
          <MenuCard href={`${HUB_HOME_HREF}?phase=recount`} icon={Share2} label="Raconter" wide tone="accent">
            <p className="text-xs text-[var(--lkv-text-secondary)] mt-0.5">Bilan, carnet de bord et partage.</p>
          </MenuCard>
        )}

        <MenuCard href={hubSectionHref(ref, 'itinerary')} icon={Navigation} label="Itinéraire" wide>
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            {duration.durationDays} jours · {steps.length} étapes ·{' '}
            <NumberStat value={dist.totalKm} decimals={dist.totalKm % 1 === 0 ? 0 : 1} suffix=" km" />
          </p>
          <p className="text-[11px] text-[var(--lkv-text-secondary)] font-mono">
            +{dist.dPlus}m / -{dist.dMinus}m{weather ? ` · ${Math.round(weather.tempC)}°C` : ''}
          </p>
          {steps.length > 0 && (
            <p className="mt-1 text-[11px] text-[var(--lkv-text-primary)] truncate">
              {steps[0].title}
            </p>
          )}
        </MenuCard>

        <MenuCard href={hubSectionHref(ref, 'gear')} icon={Package} label="Équipement">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={packedPercent} suffix="%" /> prêt · {kit.ready}/{kit.total}
          </p>
          {weightKg > 0 && (
            <p className="text-[11px] text-[var(--lkv-text-secondary)]">
              <NumberStat value={weightKg} decimals={1} suffix=" kg" />
            </p>
          )}
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--lkv-secondary)] to-[var(--lkv-primary)]"
              style={{ width: `${packedPercent}%` }}
            />
          </div>
        </MenuCard>

        <MenuCard href={hubSectionHref(ref, 'team')} icon={Users} label="Équipage & compagnons">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            {collabCount + crewCount} compagnon{(collabCount + crewCount) > 1 ? 's' : ''}
            {pendingInvites > 0 ? ` · ${pendingInvites} invitation(s)` : ''}
          </p>
          <div className="mt-1.5 flex items-center">
            {[...(trip.collaborators ?? [])].slice(0, 4).map((c) => (
              <span
                key={c.id}
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[var(--lkv-surface-raised)] text-[10px] font-bold text-[var(--lkv-text-secondary)] -ml-1 first:ml-0"
              >
                {(c.profile?.full_name ?? '?').slice(0, 1).toUpperCase()}
              </span>
            ))}
          </div>
        </MenuCard>

        <MenuCard href={hubSectionHref(ref, 'budget')} icon={CreditCard} label="Budget">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={stats.total_spent} decimals={0} suffix={` ${trip.budget_currency || 'EUR'}`} />
            {stats.estimated_budget > 0 && (
              <span> sur {stats.estimated_budget}</span>
            )}
          </p>
          {budgetPct !== null && (
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
              <div
                className={`h-full rounded-full ${budgetPct > 100 ? 'bg-[var(--lkv-danger)]' : 'bg-gradient-to-r from-[var(--lkv-secondary)] to-[var(--lkv-primary)]'}`}
                style={{ width: `${Math.min(100, budgetPct)}%` }}
              />
            </div>
          )}
        </MenuCard>

        <MenuCard href={hubSectionHref(ref, 'checklist')} icon={CheckSquare} label="Checklist">
          <ChecklistCardBody tripId={trip.id} href={hubSectionHref(ref, 'checklist')} />
        </MenuCard>

        <MenuCard href={hubSectionHref(ref, 'docs')} icon={FileText} label="Documents">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            {trip.documents?.length ?? 0} document{(trip.documents?.length ?? 0) > 1 ? 's' : ''}
          </p>
          {exp && (
            <p className="text-[11px] text-[var(--lkv-danger)]">
              {exp.label} — exp. J{exp.inDays}
            </p>
          )}
        </MenuCard>

        <MenuCard href={hubSectionHref(ref, 'safety')} icon={Shield} label="Sécurité">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            {pendingSafety} point{pendingSafety > 1 ? 's' : ''} de contrôle en attente
          </p>
        </MenuCard>

        <MenuCard href={hubSectionHref(ref, 'journal')} icon={Calendar} label="Journal">
          {lastNote ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--lkv-text-secondary)]">
              {lastNote.title || lastNote.content}
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">Aucune note encore.</p>
          )}
        </MenuCard>

        <MenuCard href={hubSectionHref(ref, 'export')} icon={Share2} label="Export">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">GPX · Feuille de route</p>
        </MenuCard>
      </HubMenuGrid>
    </div>
  );
}

export default SortieMenu;