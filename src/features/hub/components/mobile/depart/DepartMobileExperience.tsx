'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useReducedMotion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Package, Weight } from 'lucide-react';
import { GlassDrawer } from '@/components/ui/GlassDrawer';
import { DepartHeroCard } from '@/features/materiel/components/depart/hero/DepartHeroCard';
import { DepartAlertsBanner } from '@/features/materiel/components/depart/DepartAlertsBanner';
import { DepartTerrainSection } from '@/features/materiel/components/depart/DepartTerrainSection';
import { DepartEquipmentHub } from '@/features/materiel/components/depart/DepartEquipmentHub';
import { DepartEquipeSection } from '@/features/materiel/components/depart/DepartEquipeSection';
import { DepartChecklist } from '@/features/materiel/components/depart/DepartChecklist';
import { DepartureSheetModal } from '@/features/materiel/components/depart/DepartureSheetModal';
import { resolveDepartIdentity } from '@/features/materiel/domain/departIdentity';
import { formatWeight } from '@/features/materiel/domain/departCalculations';
import { HUB_DEPART_HREF } from '@/features/hub/registry/hubSectionRegistry';
import {
  generateSmartPrompts,
  type ActionableAlert,
} from '@/features/materiel/services/generateSmartPrompts';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { DepartCockpitProps } from '@/features/materiel/components/depart/DepartDesktopView';
import type { WeatherForecast } from '@/features/materiel/services/getWeather';
import { GroupeChipsRow, type GroupeChipDef } from '../groupe/GroupeChipsRow';
import { GroupeDrawer } from '../groupe/GroupeDrawer';
import { GroupeRail } from '../groupe/GroupeRail';

const SHOWCASE_IDS = new Set(['tmb-4j', 'vercors-ultra', 'belledonne-winter', 'none']);

export type DepartMobileExperienceProps = DepartCockpitProps & { weather: WeatherForecast | null };

export function DepartMobileExperience({
  depart,
  weather,
  kits,
  inventory = [],
  loans = [],
  products = [],
}: DepartMobileExperienceProps) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const { triggerHaptic } = useHapticFeedback();
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);

  const isRealKit = !SHOWCASE_IDS.has(depart?.id);

  const identity = resolveDepartIdentity({ destination: depart.destination });

  const alertInput = {
    items: (depart?.assignedKit?.items || []).map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      weight_g: i.weight_g,
      is_checked: i.is_checked,
      is_worn: i.is_worn,
      is_consumable: i.is_consumable,
      is_vital: i.is_vital,
      quantity: i.quantity,
      photoUrl: i.photoUrl,
      productHref: i.productHref,
    })),
    weather,
    participants: depart?.participants || [],
    emergencyContact: depart?.emergencyContact || null,
    trailDistanceKm: depart?.trail?.distance_km ?? null,
    activityType: depart?.activityType || 'trekking',
  };

  const smartAlerts = generateSmartPrompts(alertInput);
  const visibleAlerts = smartAlerts.filter((alert) => !dismissedAlertIds.includes(alert.id));

  const handleAlertAction = (alert: ActionableAlert) => {
    if (alert.actionType === 'edit_emergency') {
      setSheetOpen(true);
      return;
    }
    setChecklistOpen(true);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        document.getElementById('depart-checklist-heading')?.scrollIntoView({
          behavior: shouldReduceMotion ? 'auto' : 'smooth',
        });
      }, 150);
    }
  };

  const handleAlertDismiss = (alert: ActionableAlert) => {
    setDismissedAlertIds((prev) => [...prev, alert.id]);
  };

  const handleShare = () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (navigator.share) {
      navigator
        .share({ title: identity.title, text: `Fiche de départ : ${identity.title}`, url })
        .catch(() => {});
      return;
    }
    navigator.clipboard?.writeText(url);
  };

  const handleSelectKit = (kitId: string) => {
    if (kitId !== depart.id) {
      router.push(`${HUB_DEPART_HREF}?id=${kitId}`);
    }
  };

  const totalPackWeightG = depart?.totalPackWeightG ?? 0;
  const missingCount = (depart?.checklistItems ?? []).filter((item) => !item.done).length;
  const readinessPct = Math.round(depart?.readinessScore?.percentage ?? depart?.checklistPct ?? 0);

  const openChecklist = () => setChecklistOpen(true);

  const handleOpenEquipment = () => {
    triggerHaptic('light');
    setEquipmentOpen(true);
  };

  const chips: GroupeChipDef[] = [
    {
      key: 'poids',
      icon: Weight,
      value: `${(totalPackWeightG / 1000).toFixed(1)} kg`,
      label: 'Poids porté',
      tone: totalPackWeightG > 15000 ? 'warn' : 'default',
      onClick: openChecklist,
    },
    {
      key: 'manquants',
      icon: AlertTriangle,
      value: String(missingCount),
      label: 'À compléter',
      tone: missingCount ? 'warn' : 'accent',
      onClick: openChecklist,
    },
    {
      key: 'pret',
      icon: CheckCircle2,
      value: `${readinessPct} %`,
      label: 'Prêt',
      tone: 'accent',
      onClick: () => setSheetOpen(true),
    },
  ];

  const kitItemByName = new Map((depart?.assignedKit?.items ?? []).map((item) => [item.name, item]));
  const pendingItems = (depart?.checklistItems ?? []).filter((item) => !item.done).slice(0, 8);
  const weightBreakdown = (depart?.weightBreakdown ?? []).slice(0, 8);

  return (
    <div data-testid="depart-mobile-experience" className="flex min-w-0 flex-col gap-5 pb-1">
      <DepartHeroCard
        depart={depart}
        identity={identity}
        kits={kits}
        onOpenSheet={() => setSheetOpen(true)}
        onShare={handleShare}
        onSelectKit={handleSelectKit}
      />

      <DepartAlertsBanner
        alerts={visibleAlerts}
        onAction={handleAlertAction}
        onDismiss={handleAlertDismiss}
      />

      <GroupeChipsRow chips={chips} />

      <GroupeRail
        title="Prochains articles"
        subtitle={`${missingCount} restant(s)`}
        actionLabel="Tout voir"
        onAction={openChecklist}
        ariaLabel="Prochains articles"
      >
        {pendingItems.length === 0 ? (
          <li className="shrink-0 snap-start">
            <div className="glass-sub-card flex h-[8.5rem] w-[10.5rem] flex-col justify-center gap-1 rounded-[1.4rem] p-3">
              <span className="text-sm font-bold text-[var(--lkv-text-primary)]">Sac prêt</span>
              <span className="text-xs font-medium text-[var(--lkv-text-primary)]/70">
                Tous les articles sont cochés.
              </span>
            </div>
          </li>
        ) : (
          pendingItems.map((item) => {
            const kitItem = kitItemByName.get(item.name);
            return (
              <li
                key={item.id ?? item.name}
                className="glass flex h-[8.5rem] w-[10.5rem] shrink-0 snap-start flex-col rounded-[1.4rem] p-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--lkv-warning)]/15 text-[var(--lkv-warning)]">
                  <Package size={15} aria-hidden="true" />
                </span>
                <p className="mt-2 line-clamp-2 text-[12.5px] font-bold leading-snug text-[var(--lkv-text-primary)]">
                  {item.name}
                </p>
                <span className="mt-auto flex items-center justify-between gap-1 pt-1">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--lkv-text-primary)]/55">
                    À préparer
                  </span>
                  {kitItem && (
                    <span className="shrink-0 text-[10px] font-bold tabular-nums text-[var(--lkv-text-primary)]/70">
                      {formatWeight(kitItem.weight_g)}
                    </span>
                  )}
                </span>
              </li>
            );
          })
        )}
      </GroupeRail>

      <DepartTerrainSection trail={depart.trail} weather={weather} updatedAt={depart.updatedAt} />

      <GroupeRail title="Poids par catégorie" ariaLabel="Poids par catégorie">
        {weightBreakdown.length === 0 ? (
          <li className="shrink-0 snap-start">
            <div className="glass-sub-card flex h-[6.75rem] w-[9.5rem] flex-col justify-center gap-1 rounded-[1.4rem] p-3">
              <span className="text-sm font-bold text-[var(--lkv-text-primary)]">Poids à venir</span>
              <span className="text-xs font-medium text-[var(--lkv-text-primary)]/70">
                Aucune catégorie pesée.
              </span>
            </div>
          </li>
        ) : (
          weightBreakdown.map((category) => {
            const pct =
              totalPackWeightG > 0
                ? Math.round((category.value / totalPackWeightG) * 100)
                : 0;
            return (
              <li
                key={category.category}
                className="glass flex h-[6.75rem] w-[9.5rem] shrink-0 snap-start flex-col rounded-[1.4rem] p-3"
              >
                <span className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
                  {category.category}
                </span>
                <span className="mt-1 font-display text-lg font-extrabold tabular-nums text-[var(--lkv-text-primary)]">
                  {formatWeight(category.value)}
                </span>
                <span className="mt-auto block">
                  <span className="block h-1.5 w-full overflow-hidden rounded-full bg-[var(--lkv-forest-100)]">
                    <span
                      className="block h-full rounded-full bg-[var(--lkv-primary)]"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="mt-1 block text-[9.5px] font-semibold tabular-nums text-[var(--lkv-text-primary)]/55">
                    {pct} %
                  </span>
                </span>
              </li>
            );
          })
        )}
      </GroupeRail>

      <section className="glass rounded-[1.75rem] p-4" aria-label="Équipement">
        <button
          type="button"
          onClick={handleOpenEquipment}
          className="glass-capsule-btn primary min-h-[44px] w-full !py-3 text-sm font-bold"
        >
          Gérer le matériel
        </button>
      </section>

      <DepartEquipeSection depart={depart} onOpenSheet={() => setSheetOpen(true)} />

      <GroupeDrawer
        open={checklistOpen}
        onOpenChange={setChecklistOpen}
        title="Checklist du sac"
        width={460}
      >
        <DepartChecklist
          items={depart.assignedKit.items}
          consumables={depart.consumables}
          participants={depart.participants}
          kitId={depart.id || 'kit-default'}
          isRealKit={isRealKit}
        />
      </GroupeDrawer>

      <GlassDrawer
        open={equipmentOpen}
        onOpenChange={setEquipmentOpen}
        title="Parc matériel"
        width={720}
      >
        <DepartEquipmentHub
          inventory={inventory}
          loans={loans}
          products={products}
          kitItems={depart.assignedKit.items}
          consumables={depart.consumables}
          participants={depart.participants}
          weightBreakdown={depart.weightBreakdown}
          baseWeightG={depart.baseWeightG}
          wornWeightG={depart.wornWeightG}
          consumablesWeightG={depart.consumablesWeightG}
          comparableTripName={depart.comparableTrip?.name}
          kitId={depart.id || 'kit-default'}
          isRealKit={isRealKit}
        />
      </GlassDrawer>

      <DepartureSheetModal
        depart={depart}
        weather={weather}
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        isRealKit={isRealKit}
      />
    </div>
  );
}

export default DepartMobileExperience;
