import Icon from '@/components/ui/Icon';
import { hubSectionHref, type HubAdventureRef } from '../../registry/hubSectionRegistry';
import { BentoGrid } from '@/components/ui-layouts/bento-grid';
import { MenuCard } from './MenuCard';
import { NumberStat } from '@/components/ui-layouts/number-stat';
import { ActivityIdentityBar } from './ActivityIdentityBar';
import { NextActionCard, type NextActionSignal } from './NextActionCard';
import { MobileAdventureHub } from '../mobile/MobileAdventureHub';
import { PossessionMoment } from '../mobile/moments/PossessionMoment';
import {
  buildPossessionInfoChips,
  buildPossessionSectionTiles,
  pluralize,
} from '../../mobile/mobileHubEngine';
import type { MaterielSummary } from '@/features/materiel/services/getMaterielSummary';

export interface PossessionMenuProps {
  summary: MaterielSummary;
}

function daysLabel(date: string | null | undefined): string | null {
  if (!date) return null;
  const days = Math.round((new Date(date).getTime() - Date.now()) / 86400000);
  if (days < 0) return null;
  return `J-${days}`;
}

const shortDateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

function shortDate(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return shortDateFmt.format(d);
}

/**
 * Hub V4 — MENU POSSESSION en disposition BENTO (racine /hub).
 * [Départ 6, Alertes 6] → [Inventaire 4, Kits 4, Préparation 4] → [Dispo 6, Oublis 6].
 * Contenus enrichis au max.
 */
export function PossessionMenu({ summary }: PossessionMenuProps) {
  const ref: HubAdventureRef = { nature: 'possession' };
  const departDays = summary.depart.isEstimated ? null : daysLabel(summary.depart.startsAt);
  const departDate = summary.depart.isEstimated ? null : shortDate(summary.depart.startsAt);

  const mobileTiles = buildPossessionSectionTiles(ref, summary);
  const mobileChips = buildPossessionInfoChips(ref, summary);

  // ── FIL D'ACTION (règles déterministes, ordonnées par priorité) ──
  const nextActions: NextActionSignal[] = [];
  if (summary.alertes.criticalCount > 0) {
    nextActions.push({
      kind: 'safety',
      href: hubSectionHref(ref, 'alertes'),
      title: pluralize(summary.alertes.criticalCount, 'alerte critique', 'alertes critiques'),
      description: 'Équipement à vérifier avant de partir.',
    });
  }
  if (summary.forget.forgetRemaining > 0) {
    nextActions.push({
      kind: 'checklist',
      href: hubSectionHref(ref, 'oublis'),
      title: pluralize(summary.forget.forgetRemaining, 'oubli à cocher', 'oublis à cocher'),
      description: 'Finalisez la checklist de départ.',
    });
  }
  if (departDays && summary.depart.readinessPct < 100) {
    nextActions.push({
      kind: 'cockpit',
      href: hubSectionHref(ref, 'depart'),
      title: `Départ ${departDays} — ${summary.depart.readinessPct}% prêt`,
      description: 'Complétez le sac du départ.',
    });
  }
  nextActions.push({
    kind: 'all-clear',
    href: hubSectionHref(ref, 'kit'),
    title: 'Tout est à jour',
    description: `${pluralize(summary.inventaire.count, 'objet')} · ${pluralize(summary.kits.count, 'kit')} · fiabilité ${summary.alertes.reliabilityScore}%`,
  });

  const cells = [
    {
      key: 'depart',
      span: 6 as const,
      node: (
        <MenuCard
          href={hubSectionHref(ref, 'depart')}

          label={
            summary.depart.destination === 'Aucun départ planifié'
              ? 'Prochain départ'
              : summary.depart.destination
          }
          tone="accent"
        >
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
            {departDays ?? '—'}
            <span className="ml-2 text-xs font-semibold text-[var(--lkv-text-secondary)]">
              <NumberStat value={summary.depart.readinessPct} suffix="%" /> prêt
            </span>
          </p>
          <p className="text-xs text-[var(--lkv-text-secondary)]">
            {departDate ? `Départ ${departDate}` : 'Aucune date'}
            {summary.depart.itemsCount ? ` · ${summary.depart.itemsCount} objets` : ''}
            {summary.depart.totalWeightKg ? ` · ${summary.depart.totalWeightKg.toFixed(1)} kg` : ''}
          </p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--lkv-secondary)] to-[var(--lkv-primary)]"
              style={{ width: `${summary.depart.readinessPct}%` }}
            />
          </div>
        </MenuCard>
      ),
    },
    {
      key: 'alertes',
      span: 6 as const,
      node: (
        <MenuCard href={hubSectionHref(ref, 'alertes')} label="Alertes">
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
            <NumberStat value={summary.alertes.count} />
            <span className="ml-2 text-xs font-semibold text-[var(--lkv-text-secondary)]">
              alerte{summary.alertes.count > 1 ? 's' : ''}
              {summary.alertes.lastAlertLabel ? ` · ${summary.alertes.lastAlertLabel}` : ''}
            </span>
          </p>
          <p className="mt-1 text-xs text-[var(--lkv-text-secondary)]">
            {summary.alertes.criticalCount > 0 ? (
              <span className="font-bold text-[var(--lkv-danger)]">
                {pluralize(summary.alertes.criticalCount, 'critique', 'critiques')}
              </span>
            ) : (
              'Équipement sain'
            )}
            {summary.alertes.warningCount > 0 ? ` · ${summary.alertes.warningCount} vigilance` : ''}
            {` · fiabilité ${summary.alertes.reliabilityScore}%`}
          </p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--lkv-secondary)] to-[var(--lkv-primary)]"
              style={{ width: `${summary.alertes.reliabilityScore}%` }}
            />
          </div>
        </MenuCard>
      ),
    },
    {
      key: 'inventaire',
      span: 4 as const,
      node: (
        <MenuCard href={hubSectionHref(ref, 'inventaire')} label="Inventaire">
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
            <NumberStat value={summary.inventaire.count} />
            <span className="ml-2 text-xs font-semibold text-[var(--lkv-text-secondary)]">
              objet{summary.inventaire.count > 1 ? 's' : ''}
            </span>
          </p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--lkv-secondary)] to-[var(--lkv-primary)]"
              style={{ width: `${summary.inventaire.goodConditionPct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.inventaire.goodConditionPct} suffix="%" /> en bon état
            {summary.inventaire.lastAddedLabel ? ` · ${summary.inventaire.lastAddedLabel}` : ''}
          </p>
        </MenuCard>
      ),
    },
    {
      key: 'kits',
      span: 4 as const,
      node: (
        <MenuCard href={hubSectionHref(ref, 'kit')} label="Kits">
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
            <NumberStat value={summary.kits.count} />
            <span className="ml-2 text-xs font-semibold text-[var(--lkv-text-secondary)]">
              kit{summary.kits.count > 1 ? 's' : ''} ·{' '}
              <NumberStat value={summary.kits.totalWeightKg} decimals={1} suffix=" kg" />
            </span>
          </p>
          {summary.kits.topKits.length > 0 ? (
            <ul className="mt-1.5 space-y-1">
              {summary.kits.topKits.slice(0, 3).map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-[var(--lkv-text-primary)] font-medium">
                    {k.name}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-[var(--lkv-text-muted)]">
                    {k.weightKg.toFixed(1)} kg · {k.completionPct}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-[var(--lkv-text-secondary)]">
              Aucun kit — créez le premier.
            </p>
          )}
        </MenuCard>
      ),
    },
    {
      key: 'preparation',
      span: 4 as const,
      node: (
        <MenuCard href={hubSectionHref(ref, 'preparation')} label="Préparation">
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
            <NumberStat value={summary.kits.avgCompletionPct} suffix="%" />
          </p>
          <p className="text-xs text-[var(--lkv-text-secondary)]">complétion moyenne des kits</p>
          {summary.kits.topKits.length > 0 ? (
            <ul className="mt-1 space-y-1">
              {summary.kits.topKits.slice(0, 3).map((k) => (
                <li key={k.id} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-[var(--lkv-text-primary)]">
                      {k.name}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-[var(--lkv-text-muted)]">
                      {k.completionPct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--lkv-secondary)] to-[var(--lkv-primary)]"
                      style={{ width: `${k.completionPct}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-[var(--lkv-text-secondary)]">
              Aucun kit en préparation.
            </p>
          )}
        </MenuCard>
      ),
    },
    {
      key: 'disponibilite',
      span: 6 as const,
      node: (
        <MenuCard href={hubSectionHref(ref, 'disponibilite')} label="Disponibilité">
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
            <NumberStat value={summary.dispo.availableCount} />
            <span className="ml-2 text-xs font-semibold text-[var(--lkv-text-secondary)]">
              disponible{summary.dispo.availableCount > 1 ? 's' : ''} / {summary.dispo.total}
            </span>
          </p>
          <p className="mt-1 text-xs text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.dispo.unavailableCount} /> prêt
            {summary.dispo.unavailableCount > 1 ? 's' : ''} en cours
            {summary.dispo.nextReturnLabel ? ` · ${summary.dispo.nextReturnLabel}` : ''}
          </p>
        </MenuCard>
      ),
    },
    {
      key: 'oublis',
      span: 6 as const,
      node: (
        <MenuCard href={hubSectionHref(ref, 'oublis')} label="À ne pas oublier">
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--lkv-text-primary)]">
            <NumberStat value={summary.forget.forgetRemaining} />
            <span className="ml-2 text-xs font-semibold text-[var(--lkv-text-secondary)]">
              restant{summary.forget.forgetRemaining > 1 ? 's' : ''} · {summary.forget.checkedItems}
              /{summary.forget.totalItems} cochés
            </span>
          </p>
          {summary.forget.sampleItems.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {summary.forget.sampleItems.slice(0, 3).map((it, i) => (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full ${it.is_checked ? 'bg-[var(--lkv-success)] text-white' : 'bg-black/5 text-[var(--lkv-text-muted)]'}`}
                  >
                    {it.is_checked && <Icon name="check" size={10} aria-hidden="true" />}
                  </span>
                  <span
                    className={`truncate ${it.is_checked ? 'text-[var(--lkv-text-muted)] line-through' : 'text-[var(--lkv-text-primary)] font-medium'}`}
                  >
                    {it.name}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </MenuCard>
      ),
    },
  ];

  return (
    <>
      <div className="hidden lg:flex h-[calc(100%-24px)] min-h-[680px] flex-col gap-3 overflow-hidden">
        <ActivityIdentityBar nature="possession" name="Mon matériel" />
        <NextActionCard actions={nextActions} />
        <BentoGrid cells={cells} fitRows="minmax(0,1.15fr) minmax(0,1fr) minmax(0,1fr)" />
      </div>

      <MobileAdventureHub
        action={<NextActionCard actions={nextActions} variant="compact" />}
        tiles={mobileTiles}
        chips={mobileChips}
      >
        <PossessionMoment summary={summary} />
      </MobileAdventureHub>
    </>
  );
}

export default PossessionMenu;
