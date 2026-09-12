'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useReducedMotion } from 'framer-motion';
import { DepartHeroCard } from './hero/DepartHeroCard';
import { DepartAlertsBanner } from './DepartAlertsBanner';
import { DepartSacSection } from './DepartSacSection';
import { DepartTerrainSection } from './DepartTerrainSection';
import { DepartEquipmentHub } from './DepartEquipmentHub';
import { DepartEquipeSection } from './DepartEquipeSection';
import { DepartureSheetModal } from './DepartureSheetModal';
import { resolveDepartIdentity } from '@/features/materiel/domain/departIdentity';
import { useDepartAlerts } from '@/features/materiel/hooks/useDepartAlerts';
import { useDepartOfflineCache } from '@/features/materiel/hooks/useDepartOfflineCache';
import {
  generateSmartPrompts,
  type ActionableAlert,
} from '@/features/materiel/services/generateSmartPrompts';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';
import type { WeatherForecast } from '@/features/materiel/services/getWeather';
import type { InventoryItem } from '@/features/materiel/services/getInventory';
import type { LoanItem } from '@/features/materiel/services/getLoans';
import type { ProductSuggestion } from '@/features/materiel/services/getProductSuggestions';

const SHOWCASE_IDS = new Set(['tmb-4j', 'vercors-ultra', 'belledonne-winter', 'none']);

export interface DepartCockpitProps {
  depart: DepartDetail;
  weather: WeatherForecast | null;
  kits: { id: string; name: string }[];
  inventory?: InventoryItem[];
  loans?: LoanItem[];
  products?: ProductSuggestion[];
}

export function DepartDesktopView({
  depart,
  weather,
  kits,
  inventory = [],
  loans = [],
  products = [],
}: DepartCockpitProps) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [sheetOpen, setSheetOpen] = useState(false);

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
  const { alerts: visibleAlerts, dismiss: dismissAlert } = useDepartAlerts(smartAlerts);
  useDepartOfflineCache(depart, weather);

  const handleAlertAction = (alert: ActionableAlert) => {
    if (alert.actionType === 'edit_emergency') {
      setSheetOpen(true);
      return;
    }
    document.getElementById('depart-checklist-heading')?.scrollIntoView({
      behavior: shouldReduceMotion ? 'auto' : 'smooth',
    });
  };

  const handleAlertDismiss = (alert: ActionableAlert) => {
    dismissAlert(alert.id);
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
      router.push(`/hub/depart?id=${kitId}`);
    }
  };

  return (
    <div data-testid="depart-cockpit" className="flex min-w-0 flex-col gap-5 pb-4">
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

      <div className="grid gap-5 xl:grid-cols-2">
        <DepartSacSection
          depart={depart}
          kitItems={depart.assignedKit.items}
          isRealKit={isRealKit}
        />
        <DepartTerrainSection trail={depart.trail} weather={weather} updatedAt={depart.updatedAt} />
      </div>

      <section className="glass rounded-[1.75rem] p-4" aria-label="Équipement">
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
      </section>

      <DepartEquipeSection depart={depart} onOpenSheet={() => setSheetOpen(true)} />

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
