'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GearPhotoCarousel } from './GearPhotoCarousel';
import { GearInfoSlider } from './GearInfoSlider';
import { MemberBagResources } from './MemberBagResources';
import { MissingItemsDrawer } from './MissingItemsDrawer';
import { MissingSideTrigger } from './MissingSideTrigger';
import { GearItemPanel } from './GearItemPanel';
import {
  addRecommendedItemAction,
  setPurchaseStateAction,
  togglePackedAction,
} from '@/app/voyages/kit-actions';
import { addToCart } from '@/lib/cart';
import {
  missingProgressPct,
  nextPurchaseState,
  type GearCardData,
  type GearInfoCard,
  type MemberResource,
  type MissingRow,
} from '../../../mobile/gearEngine';

export interface GearMobileExperienceProps {
  tripId: string;
  tripSlug: string;
  cards: GearCardData[];
  infoCards: GearInfoCard[];
  members: MemberResource[];
  missing: MissingRow[];
  isSolo: boolean;
}

export function GearMobileExperience({
  tripId,
  tripSlug,
  cards,
  infoCards,
  members,
  missing,
  isSolo,
}: GearMobileExperienceProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<GearCardData | null>(null);
  const [missingOpen, setMissingOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 3200);
    return () => clearTimeout(timer);
  }, [error]);

  const togglePacked = (card: GearCardData) =>
    startTransition(async () => {
      setError(null);
      const res = await togglePackedAction(card.id, !card.isPacked, tripSlug);
      if (!res.success) {
        setError(res.error ?? 'Erreur');
        return;
      }
      setSelected((current) =>
        current && current.id === card.id ? { ...current, isPacked: !card.isPacked } : current,
      );
      router.refresh();
    });

  const advanceMissing = (row: MissingRow) =>
    startTransition(async () => {
      setError(null);
      if (!row.tripItemId) {
        if (!row.recommendation) {
          setError('Fiche produit indisponible');
          return;
        }
        const res = await addRecommendedItemAction(tripId, tripSlug, row.recommendation);
        if (!res.success) {
          setError(res.error ?? 'Erreur');
          return;
        }
        setToast('Ajouté au sac');
        router.refresh();
        return;
      }

      const next = nextPurchaseState(row.state);
      if (next === 'in_cart' && !row.productId) {
        setError('Fiche produit indisponible — ajout au panier impossible');
        return;
      }

      const res = await setPurchaseStateAction(row.tripItemId, next, tripSlug);
      if (!res.success) {
        setError(res.error ?? 'Erreur');
        return;
      }

      if (next === 'in_cart' && row.productId) {
        addToCart({
          id: row.productId,
          slug: row.productSlug ?? row.productId,
          name: row.name,
          brand: row.brand ?? '',
          priceEur: row.priceEur ?? 0,
          weightG: row.weightGrams ?? 0,
          image: row.imageUrl ?? '',
          imageAlt: row.name,
          category: 'misc',
        });
        setToast('Ajouté au panier');
      } else if (next === 'shipping') {
        setToast('En cours de livraison');
      } else if (next === 'needed') {
        setToast('Retiré de la liste');
      }
      router.refresh();
    });

  const resetMissing = (row: MissingRow) =>
    startTransition(async () => {
      if (!row.tripItemId) return;
      setError(null);
      const res = await setPurchaseStateAction(row.tripItemId, 'needed', tripSlug);
      if (!res.success) {
        setError(res.error ?? 'Erreur');
        return;
      }
      router.refresh();
    });

  const scrollToList = () =>
    document.getElementById('gear-full-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="space-y-4">
      <GearPhotoCarousel cards={cards} onSelect={setSelected} />
      <GearInfoSlider
        cards={infoCards}
        onOpenMissing={() => setMissingOpen(true)}
        onOpenList={scrollToList}
      />
      {!isSolo && <MemberBagResources members={members} />}

      <MissingSideTrigger
        progressPct={missingProgressPct(missing)}
        missingCount={missing.filter((row) => row.state === 'needed').length}
        onOpen={() => setMissingOpen(true)}
      />

      <MissingItemsDrawer
        open={missingOpen}
        onOpenChange={setMissingOpen}
        rows={missing}
        busy={pending}
        onAdvance={advanceMissing}
        onReset={resetMissing}
      />

      <GearItemPanel
        card={selected}
        tripSlug={tripSlug}
        open={selected !== null}
        onOpenChange={(value) => {
          if (!value) setSelected(null);
        }}
        busy={pending}
        onTogglePacked={togglePacked}
      />

      {toast && (
        <p className="fixed bottom-[calc(var(--bottom-nav-height,52px)+16px)] left-1/2 z-[950] -translate-x-1/2 rounded-full bg-[var(--lkv-primary)] px-4 py-2 text-xs font-bold text-white shadow-lg">
          {toast}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="fixed bottom-[calc(var(--bottom-nav-height,52px)+16px)] left-1/2 z-[950] -translate-x-1/2 rounded-full bg-[var(--lkv-danger)] px-4 py-2 text-xs font-bold text-white shadow-lg"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default GearMobileExperience;
