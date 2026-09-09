import Link from 'next/link';
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
import { getWeatherIcon } from '../weather/getWeatherIcon';
import { weatherLabel } from '@/features/materiel/services/getWeather';
import HubMiniMap from '@/components/hub/HubMiniMap';
import { getTripDuration } from '@/features/trips/hooks/useTripDuration';
import { getKitCounters } from '@/features/trips/hooks/useKitCounters';
import { getTripDistance } from '@/features/trips/hooks/useTripDistance';
import { getCanonicalTripSteps } from '@/features/trips/hooks/useTripCounters';
import type { TripFull, TripStats } from '@/features/trips/types/trip.types';
import { calculateBudgetSummary } from '@/features/trips/engine/budgetEngine';
import type { HubHikingContext, HubChecklistItem } from '../../server/getHubAdventureData';
import type { TripItemImage } from '../../server/getTripItemImages';
import type { TripPhase } from '@/features/trips/engine/temporalPhaseEngine';

export interface SortieMenuProps {
  trip: TripFull;
  stats: TripStats;
  pendingInvites: number;
  daysUntil: number | null;
  phase: TripPhase;
  hiking?: HubHikingContext | null;
  /** Items réels de la checklist (trip_checklist_items) — carte + fil d'action. */
  checklist: HubChecklistItem[];
  /** Images du kit (shop_products.image → product_ownership.photo_url), résolues côté serveur. */
  itemImages?: TripItemImage[];
  /** Index du jour en cours (1-based, phase live) — journal & sécurité. */
  dayIndex?: number | null;
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
    ['docs', 3], ['safety', 3], ['journal', 3], ['context', 3],
  ],
  live: [
    ['cockpit', 8], ['safety', 4], ['itinerary', 8], ['gear', 4],
    ['journal', 4], ['team', 4], ['budget', 4],
    ['checklist', 3], ['docs', 3], ['context', 3],
  ],
  recount: [
    ['raconter', 8], ['context', 4], ['itinerary', 8], ['gear', 4],
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
  prepare: ['safety', 'journal', 'docs', 'context'],
  live: ['checklist', 'docs', 'context'],
  recount: ['docs', 'safety', 'checklist'],
};

const PHASE_LABELS: Record<TripPhase, string> = {
  prepare: 'Préparer',
  live: 'En cours',
  recount: 'Raconter',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Facile',
  moderate: 'Modéré',
  hard: 'Difficile',
  expert: 'Expert',
};

function fmtAmount(n: number): string {
  const abs = Math.abs(Math.round(n * 100) / 100);
  return Number.isInteger(abs) ? String(abs) : abs.toFixed(2);
}

/**
 * Hub V4 — MENU d'une SORTIE en disposition BENTO (racine /hub).
 * 1. Fil d'action (prochaine action déterministe) · 2. Bandeau d'identité ·
 * 3. Bento contextualisé par phase (desktop complet / mobile + « Plus de
 * sections ») · 4. SOS flottant si phase live.
 */
export function SortieMenu({
  trip,
  stats,
  pendingInvites,
  daysUntil,
  phase,
  hiking,
  checklist,
  itemImages = [],
  dayIndex = null,
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
  const collabs = trip.collaborators ?? [];
  const teamCount = collabs.length + 1;
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
    if (e.is_planned) continue;
    catTotals.set(e.category ?? 'Autre', (catTotals.get(e.category ?? 'Autre') ?? 0) + Number(e.amount || 0));
  }
  const topCats = [...catTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 1);
  const budgetSummary = calculateBudgetSummary(trip, trip.expenses ?? [], collabs);
  const balanceRows = budgetSummary.balances
    .filter((b) => Math.abs(b.net) >= 0.01)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  const showBalances = collabs.length > 0 && balanceRows.length > 0;
  const hiddenBalances = balanceRows.length - Math.min(2, balanceRows.length);
  const maxDPlusM = (trip.steps ?? []).reduce((m, s) => Math.max(m, s.elevation_gain_m ?? 0), 0);
  const contextCountry = trip.destination_country_code
    ? `${trip.destination_country_code.toUpperCase()}${trip.destination_name ? ` · ${trip.destination_name}` : ''}`
    : trip.destination_name ?? null;

  // ── Miniatures du kit (images réelles : boutique puis inventaire photographié) ──
  const urlByItemId = new Map(itemImages.map((i) => [i.itemId, i.url] as const));
  const kitThumbs: Array<{ key: string; url: string | null; initial: string; name: string }> = [];
  const seenThumbUrls = new Set<string>();
  const sortedKitItems = [...(trip.items ?? [])].sort(
    (a, b) => Number(b.is_packed) - Number(a.is_packed),
  );
  for (const item of sortedKitItems) {
    const url = urlByItemId.get(item.id) ?? null;
    if (url && seenThumbUrls.has(url)) continue;
    if (url) seenThumbUrls.add(url);
    kitThumbs.push({
      key: item.id,
      url,
      initial: (item.item_name || '?').slice(0, 1).toUpperCase(),
      name: item.item_name,
    });
    if (kitThumbs.length >= 10) break;
  }

  // ── Dépense du jour (somme réelle des dépenses datées d'aujourd'hui) ──
  const nowD = new Date();
  const todayIso = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}-${String(nowD.getDate()).padStart(2, '0')}`;
  const todaySpend = (trip.expenses ?? [])
    .filter((e) => e.expense_date === todayIso && !e.is_planned)
    .reduce((s, e) => s + Number(e.amount || 0), 0);
  const todayLabel = nowD.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  // ── Documents : non validés d'abord (expirés, puis expirant ≤ 30 j) ──
  const nowMs = Date.now();
  const docRows = (trip.documents ?? []).map((d) => ({
    doc: d,
    days: d.expires_at ? Math.round((new Date(d.expires_at).getTime() - nowMs) / 86400000) : null,
  }));
  const attentionDocs = docRows
    .filter((r) => r.days != null && r.days <= 30)
    .sort((a, b) => (a.days as number) - (b.days as number));
  const otherDocs = docRows.filter((r) => r.days == null || r.days > 30);
  const presentDocCats = new Set((trip.documents ?? []).map((d) => d.category));
  const missingDocSuggestions: string[] = [];
  if (!presentDocCats.has('passport')) missingDocSuggestions.push('Passeport');
  if (!presentDocCats.has('insurance')) missingDocSuggestions.push('Assurance voyage');
  const destCountry = (trip.destination_country_code ?? '').toUpperCase();
  if (destCountry === 'FR' || destCountry === 'IT') missingDocSuggestions.push('CEAM');
  const docSuggestions = (
    (trip.documents ?? []).length === 0
      ? ['Passeport', 'Assurance voyage', ...(destCountry === 'FR' || destCountry === 'IT' ? ['CEAM'] : [])]
      : missingDocSuggestions
  ).slice(0, 3);

  // ── Sécurité : points à pointer (alerte > manqué > en attente) ──
  const SAFETY_RANK: Record<string, number> = { alert_sent: 0, missed: 1, pending: 2 };
  const attentionCheckpoints = (trip.safety_checkpoints ?? [])
    .filter((c) => c.status !== 'checked')
    .sort(
      (a, b) =>
        (SAFETY_RANK[a.status] ?? 3) - (SAFETY_RANK[b.status] ?? 3) ||
        a.scheduled_at.localeCompare(b.scheduled_at),
    );
  const safetyNextDay = dayIndex != null ? dayIndex + 1 : 1;

  // ── Journal : jour courant couvert ? ──
  const hasNoteToday =
    dayIndex != null && (trip.notes ?? []).some((n) => n.day_number === dayIndex);
  const coveredDays = new Set(
    (trip.notes ?? []).map((n) => n.day_number).filter((d): d is number => d != null),
  );
  const journalDayMax = Math.max(1, duration.durationDays);
  const journalDay =
    dayIndex != null
      ? Math.min(Math.max(1, dayIndex), journalDayMax)
      : ([...Array(journalDayMax).keys()].map((i) => i + 1).find((d) => !coveredDays.has(d)) ?? journalDayMax);

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
  // ── FIL D'ACTION (règles déterministes, ordonnées par priorité) ──
  // « all-clear » : copie DÉRIVÉE des données réelles (jamais statique).
  const allClearDescription =
    phase === 'live'
      ? `Voyage en cours · ${steps.length} étapes · ${packedPercent}% équipement`
      : phase === 'recount'
        ? `${(trip.notes ?? []).length} note${(trip.notes ?? []).length === 1 ? '' : 's'} dans le journal — racontez.`
        : daysUntil != null && daysUntil >= 0
          ? `J-${daysUntil} avant le départ · ${steps.length} étapes · ${packedPercent}% préparé`
          : `${steps.length} étapes · ${packedPercent}% préparé`;
  nextActions.push({
    kind: 'all-clear',
    href: hubSectionHref(ref, 'journal'),
    title: 'Tout est à jour',
    description: allClearDescription,
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
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <span className="rounded-full bg-[var(--lkv-primary)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--lkv-primary)]">Carnet</span>
            <span className="rounded-full bg-[var(--lkv-primary)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--lkv-primary)]">Bilan</span>
            <span className="rounded-full bg-[var(--lkv-primary)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--lkv-primary)]">Partage</span>
          </div>
          <p className="mt-1.5 text-center text-xs text-[var(--lkv-text-secondary)]">Bilan, carnet de bord et partage d&apos;équipage.</p>
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
                reserveBottom={78}
              />
              <div className="absolute bottom-2.5 right-2.5 z-20 w-[210px]">
                <WeatherStrip
                  current={weatherCtx?.current ?? null}
                  days={weatherCtx?.days ?? []}
                  locationLabel={weatherCtx?.locationLabel ?? null}
                  variant="capsule"
                />
              </div>
            </div>
          }
        >
          <p className="text-2xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
            <NumberStat value={duration.durationDays} /> j ·{' '}
            <NumberStat value={dist.totalKm} decimals={dist.totalKm % 1 === 0 ? 0 : 1} suffix=" km" />
          </p>
          <p className="text-[10px] text-[var(--lkv-text-secondary)] font-medium leading-tight">
            {steps.length} étapes · +{dist.dPlus}m / -{dist.dMinus}m
          </p>
          {steps.length > 0 && (
            <ul className="mt-1 space-y-0.5 border-l-2 border-[var(--lkv-secondary)]/30 ml-1 pl-2">
              {steps.slice(0, 4).map((s) => (
                <li key={s.id} className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-bold tabular-nums text-[var(--lkv-text-muted)] shrink-0">J{s.day_number}</span>
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
          {kitThumbs.length > 0 && (
            <ul
              className="mt-2 flex min-h-0 gap-1.5 overflow-x-auto no-scrollbar"
              aria-label="Aperçu du kit"
            >
              {kitThumbs.map((t) =>
                t.url ? (
                  <li key={t.key} className="shrink-0">
                    <img
                      src={t.url}
                      alt={t.name}
                      loading="lazy"
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                  </li>
                ) : (
                  <li
                    key={t.key}
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--lkv-surface-raised)] text-xs font-bold text-[var(--lkv-text-secondary)]"
                  >
                    {t.initial}
                  </li>
                ),
              )}
            </ul>
          )}
        </MenuCard>
      ),
    },
    budget: {
      span: 4,
      node: (
        <MenuCard href={hubSectionHref(ref, 'budget')} label="Budget">
          <div className="mt-0.5 flex items-center gap-3">
            <div className="relative shrink-0" style={{ width: 44, height: 44 }}>
              <BudgetDonut
                categories={topCats.map(([label, value]) => ({ label, value }))}
                size={44}
                stroke={6}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-serif-lkv italic tracking-tight text-[var(--lkv-text-primary)]">
                  {Math.round(stats.total_spent)}
                </span>
                <span className="text-[8px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-secondary)]">
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
          {showBalances && (
            <div className="mt-1.5 min-h-0 border-t border-black/5 pt-1">
              <ul className="space-y-0.5">
                {balanceRows.slice(0, 2).map((b) => {
                  const owes = b.net < 0;
                  return (
                    <li key={b.userId} className="flex min-h-0 items-center gap-1.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--lkv-surface-raised)] text-[9px] font-bold text-[var(--lkv-text-secondary)]">
                        {b.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="truncate text-[11px] font-medium text-[var(--lkv-text-primary)]">{b.name}</span>
                      <span
                        className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          owes
                            ? 'bg-[var(--lkv-danger)]/10 text-[var(--lkv-danger)]'
                            : 'bg-[var(--sage-50)] text-[var(--sage-700)]'
                        }`}
                      >
                        {owes ? `−${fmtAmount(b.net)}` : `+${fmtAmount(b.net)}`} {currency} {owes ? 'doit' : 'reçoit'}
                      </span>
                    </li>
                  );
                })}
                {hiddenBalances > 0 && (
                  <li className="text-right text-[10px] font-semibold text-[var(--lkv-text-muted)]">
                    +{hiddenBalances}
                  </li>
                )}
              </ul>
            </div>
          )}
          <p className="mt-1 flex min-h-0 items-center gap-2 border-t border-black/5 pt-1 text-[11px]">
            <span className="truncate font-medium text-[var(--lkv-text-secondary)]">
              Dépense du jour · {todayLabel}
            </span>
            {todaySpend > 0 ? (
              <span className="ml-auto shrink-0 font-bold text-[var(--lkv-text-primary)]">
                {fmtAmount(todaySpend)} {currency}
              </span>
            ) : (
              <span className="ml-auto shrink-0 text-[var(--lkv-text-muted)]">Aucune dépense aujourd&apos;hui</span>
            )}
          </p>
        </MenuCard>
      ),
    },
    team: {
      span: 4,
      node: (
        <MenuCard href={hubSectionHref(ref, 'team')} label="Équipage & compagnons" interactiveBody>
          <p className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
            <NumberStat value={teamCount} />
            <span className="ml-2 text-xs font-semibold text-[var(--lkv-text-secondary)]">
              membre{teamCount > 1 ? 's' : ''}
              {pendingInvites > 0 ? ` · ${pendingInvites} invitation(s)` : ''}
            </span>
          </p>
          {collabs.length > 0 ? (
            <ul className="mt-1.5 flex min-h-0 flex-1 flex-col justify-center gap-1">
              <li>
                <Link
                  href={`/profil/${collabs[0].user_id}`}
                  className="-mx-1 flex min-h-[44px] items-center gap-2 rounded-lg px-1 transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
                >
                  <span className="flex shrink-0" aria-hidden="true">
                    {collabs.slice(0, 3).map((c, i) =>
                      c.profile?.avatar_url ? (
                        <img
                          key={c.id}
                          src={c.profile.avatar_url}
                          alt={c.profile?.full_name ?? 'Compagnon'}
                          loading="lazy"
                          className={`h-7 w-7 rounded-full object-cover ring-2 ring-white ${i > 0 ? '-ml-1' : ''}`}
                        />
                      ) : (
                        <span
                          key={c.id}
                          className={`flex h-7 w-7 items-center justify-center rounded-full bg-[var(--lkv-surface-raised)] text-[10px] font-bold text-[var(--lkv-text-secondary)] ring-2 ring-white ${i > 0 ? '-ml-1' : ''}`}
                        >
                          {(c.profile?.full_name ?? '?').slice(0, 1).toUpperCase()}
                        </span>
                      ),
                    )}
                  </span>
                  <span className="truncate text-xs font-medium text-[var(--lkv-text-primary)]">
                    {collabs[0].profile?.full_name ?? 'Compagnon'}
                  </span>
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--lkv-text-muted)] shrink-0">{collabs[0].role}</span>
                </Link>
              </li>
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
          <ChecklistCardBody items={checklist} daysUntil={daysUntil} />
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
              {[...attentionDocs, ...otherDocs].slice(0, 3).map((r) => (
                <li key={r.doc.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-[var(--lkv-text-primary)] font-medium">{r.doc.title}</span>
                  {r.doc.expires_at && (
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        r.days != null && r.days < 0
                          ? 'bg-[var(--lkv-danger)] text-white'
                          : r.days != null && r.days <= 30
                            ? 'bg-[var(--lkv-danger)]/10 text-[var(--lkv-danger)]'
                            : 'bg-black/5 text-[var(--lkv-text-muted)]'
                      }`}
                    >
                      {r.days != null && r.days < 0 ? 'expiré' : `exp. ${shortDate(r.doc.expires_at)}`}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-1 text-center">
              <p className="text-sm font-serif-lkv italic text-[var(--lkv-text-primary)]">Prépare tes documents</p>
              <ul className="mt-1 space-y-0.5 text-left" aria-label="Documents conseillés">
                {docSuggestions.map((s) => (
                  <li key={s} className="flex items-center gap-1.5 text-[11px] text-[var(--lkv-text-secondary)]">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--lkv-secondary)]" aria-hidden="true" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {docSuggestions.length > 0 && (trip.documents ?? []).length > 0 && (
            <p className="mt-1 text-[11px] font-medium text-[var(--lkv-text-muted)] truncate">
              À ajouter : {docSuggestions.join(' · ')}
            </p>
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
          {attentionCheckpoints.length > 0 ? (
            <ul className="mt-1.5 space-y-1">
              {attentionCheckpoints.slice(0, 2).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-[var(--lkv-text-primary)] font-medium">{c.label}</span>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      c.status === 'alert_sent'
                        ? 'bg-[var(--lkv-danger)] text-white'
                        : c.status === 'missed'
                          ? 'bg-[var(--lkv-danger)]/10 text-[var(--lkv-danger)]'
                          : 'bg-black/5 text-[var(--lkv-text-muted)]'
                    }`}
                  >
                    {c.status === 'alert_sent' ? 'alerte' : c.status === 'missed' ? 'manqué' : shortDate(c.scheduled_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-1 text-center">
              <p className="text-xs text-[var(--lkv-text-secondary)]">Aucun point à pointer.</p>
              <p className="mt-0.5 text-[11px] text-[var(--lkv-text-muted)]">
                Programme un point de contrôle pour le jour {safetyNextDay}.
              </p>
            </div>
          )}
        </MenuCard>
      ),
    },
    journal: {
      span: 3,
      node: (
        <MenuCard href={hubSectionHref(ref, 'journal')} label="Journal">
          {lastNote && (dayIndex == null || hasNoteToday) ? (
            <div className="mt-1">
              {lastNote.day_number != null && (
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]">Jour {lastNote.day_number}</span>
              )}
              <p className="truncate text-sm font-serif-lkv italic text-[var(--lkv-text-primary)]">{lastNote.title || 'Sans titre'}</p>
              <p className="line-clamp-1 text-xs text-[var(--lkv-text-secondary)]">{lastNote.content}</p>
              <p className="mt-1 text-[11px] font-medium text-[var(--lkv-text-muted)]">{notes.length} note{notes.length > 1 ? 's' : ''}</p>
            </div>
          ) : (
            <div className="mt-1 text-center">
              <p className="text-sm font-serif-lkv italic text-[var(--lkv-text-primary)]">
                Raconte le jour {journalDay}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
                {notes.length > 0
                  ? `${notes.length} note${notes.length > 1 ? 's' : ''} déjà — ajoute celle du jour.`
                  : 'Aucune note encore — commence ton carnet.'}
              </p>
            </div>
          )}
        </MenuCard>
      ),
    },
    context: {
      span: 3,
      node: (
        <MenuCard href={hubSectionHref(ref, 'overview')} label="Contexte">
          {weatherCtx?.current && (() => {
            const WeatherIcon = getWeatherIcon(weatherCtx.current.weathercode);
            return (
              <p className="flex items-center justify-between gap-2 text-xs">
                <span className="text-[var(--lkv-text-secondary)] shrink-0">Météo</span>
                <span className="flex min-w-0 items-center gap-1 truncate font-bold text-[var(--lkv-text-primary)]">
                  <WeatherIcon size={12} className="shrink-0 text-[var(--lkv-secondary)]" aria-hidden="true" />
                  <span className="truncate">{Math.round(weatherCtx.current.tempC)}°C · {weatherLabel(weatherCtx.current.weathercode)}</span>
                </span>
              </p>
            );
          })()}
          <ul className="mt-1 space-y-0.5 text-xs">
            {maxDPlusM > 0 && (
              <li className="flex items-center justify-between gap-2">
                <span className="text-[var(--lkv-text-secondary)]">D+ max</span>
                <span className="font-bold text-[var(--lkv-text-primary)]">{maxDPlusM.toLocaleString('fr-FR')} m</span>
              </li>
            )}
            <li className="flex items-center justify-between gap-2">
              <span className="text-[var(--lkv-text-secondary)]">Durée</span>
              <span className="font-bold text-[var(--lkv-text-primary)]">{duration.durationDays} j</span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="text-[var(--lkv-text-secondary)]">Difficulté</span>
              <span className="shrink-0 rounded-full bg-[var(--sage-50)] px-1.5 py-0.5 text-[10px] font-bold capitalize text-[var(--sage-700)]">
                {DIFFICULTY_LABELS[trip.difficulty] ?? trip.difficulty}
              </span>
            </li>
            {contextCountry && (
              <li className="flex items-center justify-between gap-2">
                <span className="text-[var(--lkv-text-secondary)]">Pays</span>
                <span className="truncate font-bold text-[var(--lkv-text-primary)]">{contextCountry}</span>
              </li>
            )}
          </ul>
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
        checklist={{ tripId: trip.id, items: checklist }}
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
