import {
  BellRing,
  CalendarCheck,
  ClipboardList,
  FlaskConical,
  Footprints,
  Package,
  Backpack,
} from 'lucide-react';
import { hubSectionHref, type HubAdventureRef } from '../../registry/hubSectionRegistry';
import { HubMenuGrid } from './HubMenuGrid';
import { MenuCard } from './MenuCard';
import { NumberStat } from '@/components/ui-layouts/number-stat';
import { MenuVitalsCarousel, type MenuVital } from './MenuVitalsCarousel';
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

/**
 * Hub V4 — MENU POSSESSION (Matériel) : cartes-onglets résumées.
 * Départ (héros), Alertes, Inventaire, Kits, Préparation, Disponibilité, Oublis.
 */
export function PossessionMenu({ summary }: PossessionMenuProps) {
  const ref: HubAdventureRef = { nature: 'possession' };
  const departDays = daysLabel(summary.depart.startsAt);

  const vitals: MenuVital[] = [
    { id: 'stock', label: 'Inventaire', value: `${summary.inventaire.count}`, sub: 'objets', href: hubSectionHref(ref, 'inventaire') },
    { id: 'alertes', label: 'Alertes', value: `${summary.alertes.count}`, sub: summary.alertes.criticalCount > 0 ? `${summary.alertes.criticalCount} critiques` : 'RAS', href: hubSectionHref(ref, 'alertes') },
    { id: 'prets', label: 'Prêts', value: `${summary.dispo.unavailableCount}`, sub: summary.dispo.nextReturnLabel ?? 'aucun en cours', href: hubSectionHref(ref, 'disponibilite') },
    ...(departDays ? [{ id: 'depart', label: 'Départ', value: departDays, sub: summary.depart.destination, href: hubSectionHref(ref, 'depart') }] : []),
  ];

  return (
    <div className="space-y-4">
      <MenuVitalsCarousel vitals={vitals} />

      <HubMenuGrid>
        <MenuCard href={hubSectionHref(ref, 'depart')} icon={Footprints} label={summary.depart.destination === 'Aucun départ planifié' ? 'Prochain départ' : summary.depart.destination} wide tone="accent">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            {departDays ?? 'À planifier'} ·{' '}
            <NumberStat value={summary.depart.readinessPct} suffix="%" /> prêt
            {summary.depart.totalWeightKg ? ` · ${summary.depart.totalWeightKg.toFixed(1)} kg` : ''}
          </p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--lkv-secondary)] to-[var(--lkv-primary)]"
              style={{ width: `${summary.depart.readinessPct}%` }}
            />
          </div>
        </MenuCard>

        <MenuCard href={hubSectionHref(ref, 'alertes')} icon={BellRing} label="Alertes">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.alertes.count} /> alerte{summary.alertes.count > 1 ? 's' : ''}
          </p>
          {summary.alertes.criticalCount > 0 && (
            <p className="text-[11px] text-[var(--lkv-danger)]">
              {summary.alertes.criticalCount} critique(s)
            </p>
          )}
        </MenuCard>

        <MenuCard href={hubSectionHref(ref, 'inventaire')} icon={Package} label="Inventaire">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.inventaire.count} /> objet{summary.inventaire.count > 1 ? 's' : ''}
          </p>
          <p className="text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.inventaire.goodConditionPct} suffix="%" /> en bon état
          </p>
        </MenuCard>

        <MenuCard href={hubSectionHref(ref, 'kit')} icon={Backpack} label="Kits">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.kits.count} /> kit{summary.kits.count > 1 ? 's' : ''}
          </p>
          {summary.kits.assignedKitName && (
            <p className="text-[11px] text-[var(--lkv-text-secondary)]">
              {summary.kits.assignedKitName} · <NumberStat value={summary.kits.avgCompletionPct} suffix="%" />
            </p>
          )}
        </MenuCard>

        <MenuCard href={hubSectionHref(ref, 'preparation')} icon={FlaskConical} label="Préparation">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">Chargement & équilibre</p>
        </MenuCard>

        <MenuCard href={hubSectionHref(ref, 'disponibilite')} icon={CalendarCheck} label="Disponibilité">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <NumberStat value={summary.dispo.unavailableCount} /> prêt{summary.dispo.unavailableCount > 1 ? 's' : ''} en cours
          </p>
          {summary.dispo.nextReturnLabel && (
            <p className="text-[11px] text-[var(--lkv-text-secondary)]">{summary.dispo.nextReturnLabel}</p>
          )}
        </MenuCard>

        <MenuCard href={hubSectionHref(ref, 'oublis')} icon={ClipboardList} label="À ne pas oublier">
          <p className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            {summary.forget.forgetRemaining} non coch{summary.forget.forgetRemaining > 1 ? 'és' : 'é'}
          </p>
        </MenuCard>
      </HubMenuGrid>
    </div>
  );
}

export default PossessionMenu;