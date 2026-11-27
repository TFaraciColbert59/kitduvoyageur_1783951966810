'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import {
  Backpack,
  Check,
  CheckCircle2,
  Copy,
  Package,
} from 'lucide-react';
import { KitCard, type KitProductView } from '@/components/compte/drawer/cards/KitCard';
import { CollapsibleHeroPreview } from '@/features/community/v2/create/photo/CollapsibleHeroPreview';
import type { PickerProduct } from '@/features/community/create/kit/types';
import { AnimatedNumber, ClubStaggerCard, ClubStaggerList } from '../ClubDrawerMotion';
import { ClubGearProductCard, resolveGearProductImage } from '../ClubGearProductCard';
import { mapClubStandardKitToKitEntry } from '../clubKitAdapter';
import type {
  ClubGearVaultItem,
  ClubOutingData,
  ClubStandardKit,
  ClubToastPayload,
} from '../ClubDrawerTypes';

const KitProductSheetV2 = dynamic(
  () => import('@/features/community/v2/create/kit/KitProductSheetV2').then((m) => m.KitProductSheetV2),
  { ssr: false },
);

export interface OutingGearLensProps {
  outing: ClubOutingData;
  vaultGear: ClubGearVaultItem[];
  standardKits: ClubStandardKit[];
  onRequestGearLoan?: (payload: {
    gearId: string;
    quantity?: number;
    eventId?: string | null;
    neededFrom?: string | null;
    neededUntil?: string | null;
    note?: string;
  }) => Promise<boolean> | void;
  onToggleReserveGear?: (gearId: string) => void;
  onCloneStandardKit?: (kitId: string) => void;
  onOpenVaultTab?: () => void;
  onToast?: (payload: ClubToastPayload) => void;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function OutingGearLens({
  outing,
  vaultGear,
  standardKits,
  onRequestGearLoan,
  onToggleReserveGear,
  onCloneStandardKit,
  onOpenVaultTab,
  onToast,
}: OutingGearLensProps) {
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});
  const [checklistCollapsed, setChecklistCollapsed] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    const pane = el?.closest('.lkdv-lens-pane');
    if (!pane) return;
    const onScroll = () => {
      if (pane.scrollTop > 36) setChecklistCollapsed(true);
      else if (pane.scrollTop < 8) setChecklistCollapsed(false);
    };
    pane.addEventListener('scroll', onScroll, { passive: true });
    return () => pane.removeEventListener('scroll', onScroll);
  }, []);
  const [selectedGear, setSelectedGear] = useState<ClubGearVaultItem | null>(null);
  const [selectedKitProductState, setSelectedKitProductState] = useState<{
    kitTitle: string;
    totalWeightG: number;
    products: KitProductView[];
    index: number;
  } | null>(null);

  const checklistItems = useMemo(() => {
    const raw = [
      ...(outing.safetyChecklist ?? []),
      ...(outing.requiredGear ?? []),
    ];
    const isSki = /ski/i.test(outing.sport || '') || /ski/i.test(outing.title);
    if (isSki && !raw.some((x) => /dva/i.test(x))) {
      raw.unshift('DVA + Pelle + Sonde (obligatoire ski)');
    }
    const dedup = Array.from(new Set(raw.map((x) => x.trim()).filter(Boolean)));
    if (dedup.length > 0) return dedup;
    return [
      'Chaussures de montagne crantées',
      'Veste imperméable & couche chaude',
      'Eau 2 L & ravitaillement énergétique',
      'Trousse secours & couverture de survie',
    ];
  }, [outing.requiredGear, outing.safetyChecklist, outing.sport, outing.title]);

  const checkedCount = checklistItems.filter((item) => checkedMap[item]).length;
  const readyPct = Math.round((checkedCount / Math.max(1, checklistItems.length)) * 100);

  // Best matching standard kit from the club (rendered with canonical KitCard)
  const recommendedKit = useMemo(() => {
    if (outing.standardKitId) {
      const exact = standardKits.find((k) => k.id === outing.standardKitId);
      if (exact) return exact;
    }
    if (standardKits.length === 0) return null;
    const sportNorm = norm(`${outing.sport ?? ''} ${outing.title}`);
    return (
      standardKits.find((k) => {
        const kNorm = norm(`${k.title} ${k.season}`);
        if (sportNorm.includes('ski') && (kNorm.includes('ski') || kNorm.includes('hiver'))) return true;
        if (sportNorm.includes('alpi') && kNorm.includes('alpi')) return true;
        return false;
      }) ?? standardKits[0]
    );
  }, [outing.sport, outing.standardKitId, outing.title, standardKits]);

  const clubOwnedGear = useMemo(() => {
    const owned = vaultGear
      .filter((g) => g.ownershipScope === 'club')
      .sort((a, b) => (b.quantityAvailable ?? (b.available ? 1 : 0)) - (a.quantityAvailable ?? (a.available ? 1 : 0)));
    if (owned.length > 0) return owned.slice(0, 6);
    return vaultGear.filter((g) => g.available).slice(0, 6);
  }, [vaultGear]);

  const handleBorrowItem = async (gear: ClubGearVaultItem) => {
    if (requestingId) return;
    setRequestingId(gear.id);
    try {
      if (onRequestGearLoan) {
        const ok = await onRequestGearLoan({
          gearId: gear.id,
          quantity: 1,
          eventId: outing.id,
          neededFrom: outing.startsAtIso ?? null,
          neededUntil: outing.endsAtIso ?? outing.startsAtIso ?? null,
          note: `Sortie : ${outing.title.slice(0, 60)}`,
        });
        if (ok !== false) {
          onToast?.({
            title: `${gear.name} réservé pour la sortie ✓`,
            subtitle: 'Lié au coffre matériel du club',
          });
        }
      } else if (onToggleReserveGear) {
        onToggleReserveGear(gear.id);
      }
    } finally {
      setRequestingId(null);
    }
  };

  const linkedLoans = useMemo(
    () => vaultGear.filter((g) => g.eventId === outing.id || (g.reservedByMe && g.ownershipScope === 'club')),
    [outing.id, vaultGear],
  );

  return (
    <div ref={rootRef} style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 40 }}>
      {/* 1. CHECK-LIST DÉPART EN HAUT — SE RÉTRACTE EN APERÇU AU SCROLL */}
      <CollapsibleHeroPreview
        collapsed={checklistCollapsed}
        onExpand={() => setChecklistCollapsed(false)}
        title="Check-list départ"
        subtitle={`${readyPct} % (${checkedCount}/${checklistItems.length})`}
        fallbackText="✓"
        testId="outing-gear-checklist-preview"
      >
        <div
          className="club-glass-card"
          style={{
            padding: '12px 14px',
            borderRadius: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 9,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#172b24', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Backpack size={14} color="#17402c" aria-hidden="true" />
              Check-list départ
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: readyPct === 100 ? '#15803d' : '#17402c' }}>
              <AnimatedNumber value={readyPct} /> % ({checkedCount}/{checklistItems.length})
            </span>
          </div>
          <div style={{ height: 5, borderRadius: 999, background: 'rgba(23, 64, 44, 0.1)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${readyPct}%`,
                borderRadius: 999,
                background: readyPct === 100 ? '#15803d' : '#17402c',
                transition: 'width 240ms ease',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {checklistItems.map((label) => {
              const checked = Boolean(checkedMap[label]);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setCheckedMap((prev) => ({ ...prev, [label]: !prev[label] }))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    border: 0,
                    background: 'transparent',
                    padding: '3px 0',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      border: checked ? 'none' : '1.5px solid rgba(23, 64, 44, 0.32)',
                      background: checked ? '#17402c' : 'transparent',
                      color: '#fff',
                      display: 'inline-grid',
                      placeItems: 'center',
                      flex: 'none',
                    }}
                  >
                    {checked ? <Check size={11} strokeWidth={3} /> : null}
                  </span>
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: checked ? '#56665d' : '#172b24',
                      textDecoration: checked ? 'line-through' : 'none',
                    }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </CollapsibleHeroPreview>

      {/* 2. KIT OFFICIEL DU CLUB — COMPOSANT CANONIQUE <KitCard /> */}
      {recommendedKit ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#172b24', paddingLeft: 2 }}>
            Kit conseillé par le club
          </div>
          <ClubStaggerCard style={{ position: 'relative', borderRadius: 22 }}>
            <KitCard
              kit={mapClubStandardKitToKitEntry(recommendedKit)}
              viewer="visitor"
              onSelectProduct={(_product, products, index) =>
                setSelectedKitProductState({
                  products,
                  index,
                  kitTitle: recommendedKit.title,
                  totalWeightG: recommendedKit.totalWeightG,
                })
              }
            />
            {onCloneStandardKit ? (
              <button
                type="button"
                className="lkdv-carnet-btn-soft"
                aria-label={recommendedKit.cloned ? 'Kit cloné dans votre Carnet' : 'Cloner ce kit'}
                title={recommendedKit.cloned ? 'Kit cloné' : 'Cloner ce kit'}
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  zIndex: 5,
                  width: 32,
                  height: 32,
                  padding: 0,
                  borderRadius: '50%',
                  justifyContent: 'center',
                }}
                onClick={() => {
                  onCloneStandardKit(recommendedKit.id);
                  onToast?.({
                    title: recommendedKit.cloned ? 'Kit mis à jour dans votre Carnet' : 'Kit cloné dans votre Carnet ✓',
                    subtitle: `${recommendedKit.title} (${(recommendedKit.totalWeightG / 1000).toFixed(1)} kg)`,
                  });
                }}
              >
                {recommendedKit.cloned ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              </button>
            ) : null}
          </ClubStaggerCard>
        </div>
      ) : null}

      {/* 2. MATÉRIEL DISPONIBLE AU COFFRE — GRILLE 2 COLONNES CANONIQUE <ClubGearProductCard /> */}
      {clubOwnedGear.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#172b24', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Package size={14} color="#17402c" aria-hidden="true" />
              Matériel disponible au coffre
            </span>
            {onOpenVaultTab ? (
              <button
                type="button"
                onClick={onOpenVaultTab}
                style={{ border: 0, background: 'transparent', color: '#17402c', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
              >
                Tout le coffre →
              </button>
            ) : null}
          </div>

          <ClubStaggerList
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 10,
            }}
          >
            {clubOwnedGear.map((g) => {
              const avail = g.quantityAvailable ?? (g.available ? 1 : 0);
              return (
                <ClubGearProductCard
                  key={g.id}
                  gear={g}
                  onClick={() => setSelectedGear(g)}
                  actionSlot={
                    <button
                      type="button"
                      className="lkdv-carnet-btn-soft"
                      disabled={avail === 0 || g.reservedByMe || requestingId === g.id}
                      onClick={() => void handleBorrowItem(g)}
                      style={{
                        width: '100%',
                        height: 28,
                        borderRadius: 999,
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        opacity: avail === 0 ? 0.5 : 1,
                      }}
                    >
                      {g.reservedByMe ? 'Réservé ✓' : requestingId === g.id ? '…' : 'Emprunter'}
                    </button>
                  }
                />
              );
            })}
          </ClubStaggerList>
        </div>
      ) : null}

      {linkedLoans.length > 0 ? (
        <div style={{ fontSize: 11, color: '#17402c', display: 'flex', alignItems: 'center', gap: 5, paddingLeft: 4 }}>
          <CheckCircle2 size={13} />
          <span>{linkedLoans.length} équipement(s) du coffre déjà réservé(s) sur cette sortie.</span>
        </div>
      ) : null}

      {/* FICHE PRODUIT CANONIQUE <KitProductSheetV2 /> AU CLIC SUR UN ÉQUIPEMENT DU COFFRE */}
      {selectedGear && typeof document !== 'undefined'
        ? createPortal(
            (() => {
              const product: PickerProduct = {
                key: selectedGear.id,
                source: 'inventory',
                id: selectedGear.id,
                name: selectedGear.name,
                brand: selectedGear.brand || null,
                category: selectedGear.category || null,
                weightG: selectedGear.weightG || null,
                image: resolveGearProductImage(selectedGear.name, selectedGear.category, selectedGear.imageUrl),
                wear: null,
                conditionLabel: selectedGear.condition || 'Bon état',
                description: `Équipement du coffre (${selectedGear.ownerName}) disponible pour ${outing.title}.`,
                priceLabel: selectedGear.depositCents ? `Caution ${Math.round(selectedGear.depositCents / 100)} €` : null,
                slug: null,
              };
              return (
                <KitProductSheetV2
                  open
                  product={product}
                  kitTitle={outing.title}
                  totalWeightG={selectedGear.weightG || 0}
                  onClose={() => setSelectedGear(null)}
                />
              );
            })(),
            document.body,
          )
        : null}

      {/* FICHE PRODUIT CANONIQUE <KitProductSheetV2 /> AU CLIC SUR UN ÉQUIPEMENT DU KIT */}
      {selectedKitProductState &&
      selectedKitProductState.products[selectedKitProductState.index] &&
      typeof document !== 'undefined'
        ? createPortal(
            (() => {
              const p = selectedKitProductState.products[selectedKitProductState.index];
              const product: PickerProduct = {
                key: p.id,
                source: 'inventory',
                id: p.id,
                name: p.name,
                brand: p.brand || null,
                category: p.category || null,
                weightG: p.weightG || null,
                image: p.image || null,
                wear: null,
                conditionLabel: p.condition || 'Équipement club',
                description: p.description || `Inclus dans ${selectedKitProductState.kitTitle}.`,
                priceLabel: null,
                slug: null,
              };
              return (
                <KitProductSheetV2
                  open
                  product={product}
                  kitTitle={selectedKitProductState.kitTitle}
                  totalWeightG={selectedKitProductState.totalWeightG}
                  onClose={() => setSelectedKitProductState(null)}
                />
              );
            })(),
            document.body,
          )
        : null}
    </div>
  );
}
