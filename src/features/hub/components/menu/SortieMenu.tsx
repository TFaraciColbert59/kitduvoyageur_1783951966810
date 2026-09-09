import {
  Calendar,
  CheckSquare,
  CreditCard,
  Navigation,
} from 'lucide-react';
import { hubSectionHref, HUB_HOME_HREF, type HubAdventureRef } from '../../registry/hubSectionRegistry';
import { MenuCard } from './MenuCard';
import { QuickActions, type QuickAction } from './QuickActions';
import { NumberStat } from '@/components/ui-layouts/number-stat';
import { ChecklistCardBody } from './ChecklistCardBody';
import { ActivityIdentityBar } from './ActivityIdentityBar';
import { NextActionCard, type NextActionSignal } from './NextActionCard';
import { MoreSectionsGrid } from './MoreSectionsGrid';
import { SosFloatingButton } from './SosFloatingButton';
import { BudgetDonut } from './BudgetDonut';
import { WeatherStrip } from '../weather/WeatherStrip';
import HubMiniMap from '@/components/hub/HubMiniMap';
import { getTripDuration } from '@/features/trips/hooks/useTripDuration';
import { getKitCounters } from '@/features/trips/hooks/useKitCounters';
import { getTripDistance } from '@/features/trips/hooks/useTripDistance';
import { getCanonicalTripSteps } from '@/features/trips/hooks/useTripCounters';
import type { TripFull, TripStats } from '@/features/trips/types/trip.types';
import type { HubCrewBlock, HubHikingContext } from '../../server/getHubAdventureData';
import type { TripPhase } from '@/features/trips/engine/temporalPhaseEngine';

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

function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Ordre + spans des cartes par phase (contextualisation V3 plein écran). */
const ORDER: Record<TripPhase, Array<[string, 3 | 4 | 6 | 8]>> = {
  prepare: [
    ['itinerary', 8], ['gear', 4], ['budget', 4], ['team', 4], ['checklist', 4],
    ['docs', 3], ['safety', 3], ['journal', 3], ['export', 3],
  ],
  live: [
    ['cockpit', 8], ['safety', 4], ['itinerary', 8], ['gear', 4],
    ['journal', 4], ['team', 4], ['budget', 4],
    ['checklist', 3], ['docs', 3], ['export', 3],
  ],
  recount: [
    ['raconter', 8], ['export', 4], ['itinerary', 8], ['gear', 4],
    ['journal', 4], ['team', 4], ['budget', 4],
    ['checklist', 3], ['docs', 3], ['safety', 3],
  ],
};

/** Lignes proportionnelles (hub plein écran sans scroll, desktop). */
const FIT_ROWS: Record<TripPhase, string> = {
  prepare: '200px minmax(0,1.2fr) minmax(0,1fr)',
  live: 'minmax(0,1fr) 200px minmax(0,1.05fr) minmax(0,1fr)',
  recount: 'minmax(0,1fr) 200px minmax(0,1.05fr) minmax(0,1fr)',
};

/** Cartes secondaires : hors bento mobile, regroupées dans « Plus de sections ». */
const MOBILE_SECONDARY: Record<TripPhase, string[]> = {
  prepare: ['safety', 'journal', 'docs', 'export'],
  live: ['checklist', 'docs', 'export'],
  recount: ['docs', 'safety', 'checklist'],
};

const PHASE_LABELS: Record<TripPhase, string> = {
  prepare: 'Préparer',
  live: 'En cours',
  recount: 'Raconter',
};

/**
 * Hub V4 — MENU d'une SORTIE en disposition BENTO (racine /hub).
 * 1. Fil d'action (prochaine action déterministe) · 2. Bandeau d'identité ·
 * 3. Bento contextualisé par phase (desktop complet / mobile + « Plus de
 * sections ») · 4. SOS flottant si phase live.
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
  const currency = trip.budget_currency || 'EUR';
  const crewCount = crew?.memberCount ?? 0;
  const collabs = trip.collaborators ?? [];
  const collabCount = collabs.length;
  const pendingList = (trip.safety_checkpoints ?? []).filter((c) => c.status === 'pending');
  const pendingSafety = pendingList.length;
  const nextCheckpoint =
    [...pendingList].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0] ?? null;
  const exp = soonestExpiry(trip.documents);
  const notes = [...(trip.notes ?? [])].sort(
    (a, b) => (b.day_number ?? 0) - (a.day_number ?? 0) || b.created_at.localeCompare(a.created_at),
  );
  const lastNote = notes[0] ?? null;
  const weatherCtx = hiking?.weather ?? null;
  const catTotals = new Map<string, number>();
  for (const e of trip.expenses ?? []) {
    catTotals.set(e.category ?? 'Autre', (catTotals.get(e.category ?? 'Autre') ?? 0) + Number(e.amount || 0));
  }
  const topCats = [...catTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);

  // ── FIL D'ACTION (règles déterministes, ordonnées par priorité) ──
  const nextActions: NextActionSignal[] = [];
  if (phase === 'live') {
    nextActions.push({
      kind: 'cockpit',
      href: `${HUB_HOME_HREF}?phase=live`,
      title: `Cockpit terrain${daysUntil != null && daysUntil < 0 ? ` — jour ${Math.abs(daysUntil) + 1}` : ''}`,
      description: 'Étape du jour, secours 112, dépense express.',
    });
  }
  if (pendingSafety > 0 && nextCheckpoint) {
    nextActions.push({
      kind: 'safety',
      href: hubSectionHref(ref, 'safety'),
      title: `Point de contrôle : ${nextCheckpoint.label}`,
      description: `Prévu le ${shortDate(nextCheckpoint.scheduled_at)} — à confirmer.`,
    });
  }
  if (daysUntil != null && daysUntil >= 0 && daysUntil <= 14) {
    nextActions.push({
      kind: 'checklist',
      href: hubSectionHref(ref, 'checklist'),
      title: 'Terminer la checklist de départ',
      description: `J-${daysUntil} — les essentiels J-7/J-1 se débloquent.`,
    });
  }
  if (exp && exp.inDays <= 30) {
    nextActions.push({
      kind: 'documents',
      href: hubSectionHref(ref, 'docs'),
      title: `${exp.label} expire dans ${exp.inDays} j`,
      description: 'Vérifiez ou renouvelez ce document.',
    });
  }
  nextActions.push({
    kind: 'all-clear',
    href: hubSectionHref(ref, 'journal'),
    title: 'Tout est à jour',
    description: 'Profite — ou raconte le voyage dans le journal.',
  });

  const actions: QuickAction[] = [
    { href: hubSectionHref(ref, 'itinerary'), label: 'Itinéraire', icon: Navigation },
    { href: hubSectionHref(ref, 'budget'), label: 'Budget', icon: CreditCard },
    { href: hubSectionHref(ref, 'checklist'), label: 'Checklist', icon: CheckSquare },
    { href: hubSectionHref(ref, 'journal'), label: 'Journal', icon: Calendar },
  ];

  // ── CELLULES PAR CLÉ (contenus enrichis) ──
  const byKey: Record<string, { span: 3 | 4 | 6 | 8; node: React.ReactNode }> = {
    cockpit: {
      span: 6,
      node: (
        <MenuCard href={`${HUB_HOME_HREF}?phase=live`} label="Cockpit terrain" tone="accent">
          <p className="text-xs text-[var(--lkv-text-secondary)] mt-0.5">Jour en cours, secours 112, dépense express.</p>
        </MenuCard>
      ),
    },
    raconter: {
      span: 6,
      node: (
        <MenuCard href={`${HUB_HOME_HREF}?phase=recount`} label="Raconter" tone="accent">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[var(--lkv-primary)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--lkv-primary)]">Carnet</span>
            <span className="rounded-full bg-[var(--lkv-primary)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--lkv-primary)]">Bilan</span>
            <span className="rounded-full bg-[var(--lkv-primary)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--lkv-primary)]">Partage</span>
          </div>
          <p className="mt-1.5 text-xs text-[var(--lkv-text-secondary)]">Bilan, carnet de bord et partage d&apos;équipage.</p>
        </MenuCard>
      ),
    },
    itinerary: {
      span: 8,
      node: (
        <MenuCard
          href={hubSectionHref(ref, 'itinerary')}
          label="Itinéraire"
          media={
            <div className="relative h-full w-full">
              <HubMiniMap
                steps={steps}
                distanceKm={dist.totalKm}
                reserveBottom={weatherCtx ? 78 : 0}
              />
              {weatherCtx && (
                <div className="absolute bottom-2.5 right-2.5 z-20 w-[210px]">
                  <WeatherStrip
                    current={weatherCtx.current}
                    days={weatherCtx.days}
                    locationLabel={weatherCtx.locationLabel}
                    variant="capsule"
                  />
                </div>
              )}
            </div>
          }
        >
          <p className="text-2xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
            <NumberStat value={duration.durationDays} /> j ·{' '}
            <NumberStat value={dist.totalKm} decimals={dist.totalKm % 1 === 0 ? 0 : 1} suffix=" km" />
          </p>
          <p className="text-[10px] text-[var(--lkv-text-secondary)] font-mono leading-tight">
            {steps.length} étapes · +{dist.dPlus}m / -{dist.dMinus}m
          </p>
          {steps.length > 0 && (
            <ul className="mt-1 space-y-0.5 border-l-2 border-[var(--lkv-secondary)]/30 ml-1 pl-2">
              {steps.slice(0, 4).map((s) => (
                <li key={s.id} className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-mono text-[var(--lkv-text-muted)] shrink-0">J{s.day_number}</span>
                  <span className="truncate text-[var(--lkv-text-primary)] font-medium">{s.title}</span>
                </li>
              ))}
            </ul>
          )}
        </MenuCard>
      ),
    },
    gear: {
      span: 4,
      node: (
        <MenuCard href={hubSectionHref(ref, 'gear')} label="Équipement">
          <p className="text-2xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
            <NumberStat value={packedPercent} suffix="%" />
            <span className="ml-1.5 text-[10px] font-semibold text-[var(--lkv-text-secondary)]">
              {kit.ready}/{kit.total} · {weightKg.toFixed(1)} kg
            </span>
          </p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
            <div className="h-full rounded-full bg-gradient-to-r from-[var(--lkv-secondary)] to-[var(--lkv-primary)]" style={{ width: `${packedPercent}%` }} />
          </div>
        </MenuCard>
      ),
    },
    budget: {
      span: 4,
      node: (
        <MenuCard href={hubSectionHref(ref, 'budget')} label="Budget">
          <div className="mt-1 flex items-center gap-3">
            <div className="relative shrink-0" style={{ width: 64, height: 64 }}>
              <BudgetDonut
                categories={topCats.map(([label, value]) => ({ label, value }))}
                size={64}
                stroke={8}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
                  {Math.round(stats.total_spent)}
                </span>
                <span className="text-[8px] font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)]">
                  {currency}
                </span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold text-[var(--lkv-text-secondary)] leading-tight">
                {stats.estimated_budget > 0 ? `sur ${stats.estimated_budget} ${currency} · ${budgetPct}%` : 'estimation non définie'}
              </p>
              {topCats.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {topCats.map(([cat, sum], i) => (
                    <li key={cat} className="flex items-center gap-1.5 text-[11px]">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: i === 0 ? 'var(--lkv-primary)' : 'var(--lkv-secondary)' }}
                      />
                      <span className="truncate text-[var(--lkv-text-secondary)]">{cat}</span>
                      <span className="font-bold text-[var(--lkv-text-primary)] ml-auto shrink-0">{Math.round(sum)} {currency}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {topCats.length === 0 && budgetPct !== null && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/5">
              <div className={`h-full rounded-full ${budgetPct > 100 ? 'bg-[var(--lkv-danger)]' : 'bg-gradient-to-r from-[var(--lkv-secondary)] to-[var(--lkv-primary)]'}`} style={{ width: `${Math.min(100, budgetPct)}%` }} />
            </div>
          )}
        </MenuCard>
      ),
    },
    team: {
      span: 4,
      node: (
        <MenuCard href={hubSectionHref(ref, 'team')} label="Équipage & compagnons">
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
            <NumberStat value={collabCount + crewCount} />
            <span className="ml-2 text-xs font-semibold text-[var(--lkv-text-secondary)]">
              compagnon{(collabCount + crewCount) > 1 ? 's' : ''}
              {pendingInvites > 0 ? ` · ${pendingInvites} invitation(s)` : ''}
            </span>
          </p>
          {collabs.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {collabs.slice(0, 3).map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--lkv-surface-raised)] text-[10px] font-bold text-[var(--lkv-text-secondary)] shrink-0">
                    {(c.profile?.full_name ?? '?').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate text-xs font-medium text-[var(--lkv-text-primary)]">
                    {c.profile?.full_name ?? 'Compagnon'}
                  </span>
                  <span className="ml-auto text-[10px] font-mono uppercase text-[var(--lkv-text-muted)] shrink-0">{c.role}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-[var(--lkv-text-secondary)]">Sortie en solo — invitez un compagnon.</p>
          )}
        </MenuCard>
      ),
    },
    checklist: {
      span: 4,
      node: (
        <MenuCard href={hubSectionHref(ref, 'checklist')} label="Checklist">
          <ChecklistCardBody tripId={trip.id} daysUntil={daysUntil} countryCode={trip.destination_country_code} />
        </MenuCard>
      ),
    },
    docs: {
      span: 3,
      node: (
        <MenuCard href={hubSectionHref(ref, 'docs')} label="Documents">
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
            <NumberStat value={trip.documents?.length ?? 0} />
          </p>
          {(trip.documents ?? []).length > 0 ? (
            <ul className="mt-1.5 space-y-1">
              {(trip.documents ?? []).slice(0, 3).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-[var(--lkv-text-primary)] font-medium">{d.title}</span>
                  {d.expires_at && (
                    <span className="shrink-0 rounded-full bg-[var(--lkv-danger)]/10 px-1.5 py-0.5 text-[10px] font-bold text-[var(--lkv-danger)]">
                      exp. {shortDate(d.expires_at)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-[var(--lkv-text-secondary)]">Aucun document.</p>
          )}
          {exp && (
            <p className="mt-1 text-xs font-semibold text-[var(--lkv-danger)]">
              {exp.label} — expire dans {exp.inDays} j
            </p>
          )}
        </MenuCard>
      ),
    },
    safety: {
      span: 3,
      node: (
        <MenuCard href={hubSectionHref(ref, 'safety')} label="Sécurité">
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
            <NumberStat value={pendingSafety} />
            <span className="ml-2 text-xs font-semibold text-[var(--lkv-text-secondary)]">point{pendingSafety > 1 ? 's' : ''} en attente</span>
          </p>
          {nextCheckpoint ? (
            <p className="mt-1 text-xs text-[var(--lkv-text-primary)] truncate font-medium">
              {nextCheckpoint.label}
              <span className="ml-1.5 font-mono text-[var(--lkv-text-muted)]">{shortDate(nextCheckpoint.scheduled_at)}</span>
            </p>
          ) : (
            <p className="mt-1 text-xs text-[var(--lkv-text-secondary)]">Aucun point programmé.</p>
          )}
        </MenuCard>
      ),
    },
    journal: {
      span: 3,
      node: (
        <MenuCard href={hubSectionHref(ref, 'journal')} label="Journal">
          {lastNote ? (
            <div className="mt-1">
              {lastNote.day_number != null && (
                <span className="text-[10px] font-mono uppercase text-[var(--lkv-text-muted)]">Jour {lastNote.day_number}</span>
              )}
              <p className="truncate text-sm font-semibold text-[var(--lkv-text-primary)]">{lastNote.title || 'Sans titre'}</p>
              <p className="line-clamp-2 text-xs text-[var(--lkv-text-secondary)]">{lastNote.content}</p>
              <p className="mt-1 text-[11px] font-mono text-[var(--lkv-text-muted)]">{notes.length} note{notes.length > 1 ? 's' : ''}</p>
            </div>
          ) : (
            <p className="mt-1 text-xs text-[var(--lkv-text-secondary)]">Aucune note encore.</p>
          )}
        </MenuCard>
      ),
    },
    export: {
      span: 3,
      node: (
        <MenuCard href={hubSectionHref(ref, 'export')} label="Export">
          <div className="mt-2 flex gap-2">
            <span className="rounded-full bg-[var(--lkv-primary)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--lkv-primary)]">GPX</span>
            <span className="rounded-full bg-[var(--lkv-primary)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--lkv-primary)]">Feuille de route</span>
          </div>
          <p className="mt-1.5 text-xs text-[var(--lkv-text-secondary)]">Trace + document prêts à partager.</p>
        </MenuCard>
      ),
    },
  };

  const orderedCells = ORDER[phase]
    .filter(([key]) => byKey[key])
    .map(([key, span]) => ({ key, span, node: byKey[key].node }));
  const secondaryKeys = MOBILE_SECONDARY[phase];
  const primaryCells = orderedCells.filter((c) => !secondaryKeys.includes(c.key ?? ''));
  const secondaryCells = orderedCells.filter((c) => secondaryKeys.includes(c.key ?? ''));

  return (
    <div className="h-[calc(100%-24px)] min-h-[680px] flex flex-col gap-3 overflow-hidden">
      <ActivityIdentityBar
        nature="sortie"
        name={trip.title}
        phaseLabel={PHASE_LABELS[phase]}
        daysUntil={daysUntil}
      />
      <NextActionCard
        actions={nextActions}
        checklist={{ tripId: trip.id, daysUntil, countryCode: trip.destination_country_code }}
      />
      <QuickActions actions={actions} />
      <div className="flex-1 min-h-0">
        <MoreSectionsGrid cells={primaryCells} moreCells={secondaryCells} fitRows={FIT_ROWS[phase]} />
      </div>
      {phase === 'live' && <SosFloatingButton safetyHref={hubSectionHref(ref, 'safety')} />}
    </div>
  );
}

export default SortieMenu;
