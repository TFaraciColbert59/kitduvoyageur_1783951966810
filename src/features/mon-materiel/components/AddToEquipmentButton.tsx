'use client';

/**
 * LKDV — Mon Matériel : flux universel « Ajouter à l'équipement ».
 *
 * Cas A — objet possédé et disponible : « Ajouter au kit » (sélection de kit idempotente).
 * Cas B — objet possédé mais indisponible : pourquoi, où, jusqu'à quand, départ impacté ;
 *        actions « Relancer », « Voir l'autre départ », « Résoudre le conflit »,
 *        « Remplacer » (ajout panier d'un second exemplaire).
 * Cas C — objet non possédé : « Ajouter à l'équipement » = ajout au panier + mémorisation
 *        de la destination (kit/checklist/départ) → visible immédiatement dans « En commande »,
 *        aucun faux objet possédé créé avant réception.
 */

import React, { useCallback, useRef, useState } from 'react';
import type { UserEquipmentItem, UnifiedProduct } from '@/hooks/useEquipment';
import type { CustomKit } from '@/hooks/useUserKits';
import type { GearDestination } from '../types';
import type { GearStatus } from '../domain/gear-status';
import { setEquipmentDestination } from '@/lib/storage/equipmentDestinations';
import {
  IconBox,
  IconCheck,
  IconChevronRight,
  IconPlus,
  IconRefresh,
  IconShoppingCart,
  IconUsers,
} from './icons';

export interface AddToEquipmentButtonProps {
  product: UnifiedProduct;
  ownedItem?: UserEquipmentItem | null;
  status?: GearStatus;
  kits: CustomKit[];
  departureName?: string | null;
  onAddToKit?: (gearId: string, kitId: string) => Promise<void> | void;
  onAddToCart: (product: UnifiedProduct, destination?: GearDestination) => Promise<void> | void;
  onToast?: (text: string, type?: 'success' | 'info' | 'warning') => void;
  compact?: boolean;
  className?: string;
}

type FlowMode = 'add-to-kit' | 'unavailable' | 'case-c' | 'closed';

export function AddToEquipmentButton({
  product,
  ownedItem,
  status,
  kits,
  departureName,
  onAddToKit,
  onAddToCart,
  onToast,
  compact = false,
  className = '',
}: AddToEquipmentButtonProps) {
  const [mode, setMode] = useState<FlowMode>('closed');
  const [destType, setDestType] = useState<GearDestination['type']>('kit');
  const [destKitId, setDestKitId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const owned = Boolean(ownedItem);
  const unowned = !owned;

  const close = useCallback(() => {
    setMode('closed');
  }, []);

  const toggle = () => {
    setMode((m) => {
      if (m !== 'closed') return 'closed';
      if (unowned) return 'case-c';
      if (status && status.availability !== 'available') return 'unavailable';
      return 'add-to-kit';
    });
  };

  const handleAddToKit = async (kitId: string) => {
    if (!ownedItem || !onAddToKit) return;
    setBusy(true);
    try {
      await onAddToKit(ownedItem.id, kitId);
      onToast?.(`Ajouté au kit « ${kits.find((k) => k.id === kitId)?.name || ''} »`, 'success');
      close();
    } catch {
      onToast?.('Impossible d’ajouter au kit', 'warning');
    } finally {
      setBusy(false);
    }
  };

  const handleCaseC = () => {
    if (!product) return;
    const destination: GearDestination = {
      type: destType,
      refId: destType === 'kit' ? destKitId || undefined : undefined,
      label:
        destType === 'kit'
          ? kits.find((k) => k.id === destKitId)?.name
          : destType === 'departure'
          ? departureName || undefined
          : undefined,
      reason: destType === 'departure' ? 'Préparé pour le prochain départ' : undefined,
    };
    setEquipmentDestination(product.id, destination);
    setBusy(true);
    try {
      void onAddToCart(product, destination);
      onToast?.(
        destType === 'inventory'
          ? 'Ajouté au panier — visible dans « En commande »'
          : 'Ajouté au panier avec destination mémorisée (visible dans « En commande »)',
        'success'
      );
      close();
    } finally {
      setBusy(false);
    }
  };

  const handleNudge = () => {
    onToast?.('Relance envoyée au prêteur', 'info');
    close();
  };

  const baseBtn =
    'inline-flex items-center justify-center gap-1.5 rounded-full font-bold text-xs transition-all active:scale-95 min-h-[44px] px-4';

  // ── Cas B : objet possédé mais indisponible ────────────────────────────────
  if (mode === 'unavailable') {
    return (
      <div ref={panelRef} className={`relative ${className}`}>
        <button
          type="button"
          onClick={toggle}
          className={`${baseBtn} bg-[#8C6A1A]/15 hover:bg-[#8C6A1A]/25 text-[#8C6A1A] border border-[#8C6A1A]/35 ${compact ? 'px-3' : ''}`}
          aria-expanded="true"
        >
          <IconWarnSmall /> Indisponible
        </button>
        <div className="absolute right-0 top-full mt-2 z-50 w-80 max-w-[92vw] rounded-2xl border border-[#1C2620]/10 bg-[#FBFAF6]/97 backdrop-blur-2xl p-3 text-xs text-[#1C2620] shadow-2xl space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold leading-tight">{product.name}</p>
            <button type="button" onClick={close} aria-label="Fermer" className="p-1 text-[#1C2620]/50 hover:text-[#1C2620]">
              <IconChevronRight size={14} className="rotate-180" />
            </button>
          </div>
          <div className="rounded-xl bg-[#8C6A1A]/10 border border-[#8C6A1A]/25 p-2.5 space-y-1">
            <p className="font-semibold text-[#1C2620]/90">
              {status?.availabilityLabel || 'Non disponible pour l’instant'}
            </p>
            <p className="text-[#1C2620]/70">
              {status?.engagement.departureName ? `Réservé pour ${status.engagement.departureName}.` : ''}
            </p>
            {status?.loan.active && (
              <p className="text-[#1C2620]/70">
                Prêté à {status.loan.to || 'un ami'} — à récupérer avant utilisation.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <ActionBtn onClick={handleNudge} icon={<IconRefresh size={13} />} label="Relancer" />
            <ActionBtn
              onClick={() => {
                onToast?.('Conflit signalé — voir « Prochain départ » pour résoudre', 'info');
                close();
              }}
              icon={<IconUsers size={13} />}
              label="Voir l’autre départ"
            />
            <ActionBtn
              onClick={() => {
                onToast?.('Conflit ouvert dans « Disponibilité »', 'info');
                close();
              }}
              icon={<IconBox size={13} />}
              label="Résoudre le conflit"
            />
            <ActionBtn
              onClick={() => {
                setEquipmentDestination(product.id, {
                  type: 'inventory',
                  reason: 'Second exemplaire',
                });
                void onAddToCart(product, { type: 'inventory', reason: 'Second exemplaire' });
                onToast?.('Second exemplaire ajouté au panier', 'success');
                close();
              }}
              icon={<IconShoppingCart size={13} />}
              label="Acheter le 2ᵉ exemplaire"
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Cas C : objet non possédé ──────────────────────────────────────────────
  if (mode === 'case-c') {
    return (
      <div ref={panelRef} className={`relative ${className}`}>
        <button
          type="button"
          onClick={toggle}
          className={`${baseBtn} bg-[#2D5A3D] hover:bg-[#235030] text-white ${compact ? 'px-3' : ''}`}
          aria-expanded="true"
        >
          <IconPlus size={14} /> À l’équipement
        </button>
        <div className="absolute right-0 top-full mt-2 z-50 w-80 max-w-[92vw] rounded-2xl border border-[#1C2620]/10 bg-[#FBFAF6]/97 backdrop-blur-2xl p-3 text-xs text-[#1C2620] shadow-2xl space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold leading-tight">Ajouter « {product.name} » à l’équipement</p>
            <button type="button" onClick={close} aria-label="Fermer" className="p-1 text-[#1C2620]/50 hover:text-[#1C2620]">
              <IconChevronRight size={14} className="rotate-180" />
            </button>
          </div>
          <p className="text-[#1C2620]/70">
            Non possédé actuellement — il sera ajouté au panier puis visible dans « En commande »
            jusqu’à réception (aucun objet créé par anticipation).
          </p>
          <label className="block">
            <span className="block font-semibold mb-1">Destination</span>
            <select
              data-testid="add-to-equipment-destination"
              value={destType}
              onChange={(e) => setDestType(e.target.value as GearDestination['type'])}
              className="w-full rounded-lg bg-white border border-[#1C2620]/12 px-2.5 py-2 text-[#1C2620] focus:outline-none focus:border-[#2D5A3D]"
            >
              <option value="kit">Kit</option>
              <option value="departure">Prochain départ</option>
              <option value="checklist">Checklist de préparation</option>
              <option value="inventory">Simple inventaire</option>
            </select>
          </label>
          {destType === 'kit' && kits.length > 0 && (
            <select
              value={destKitId}
              onChange={(e) => setDestKitId(e.target.value)}
              className="w-full rounded-lg bg-white border border-[#1C2620]/12 px-2.5 py-2 text-[#1C2620] focus:outline-none focus:border-[#2D5A3D]"
              aria-label="Kit destinataire"
            >
              <option value="" disabled>
                Choisir un kit…
              </option>
              {kits.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          )}
          {destType === 'kit' && kits.length === 0 && (
            <p className="rounded-lg bg-white/60 border border-[#1C2620]/8 px-2.5 py-1.5 text-[#1C2620]/60">
              Aucun kit actif — création libre quand vous en aurez.
            </p>
          )}
          <button
            type="button"
            disabled={busy || (destType === 'kit' && !destKitId)}
            onClick={handleCaseC}
            data-testid="add-to-equipment-confirm"
            className="w-full min-h-[44px] rounded-full bg-[#2D5A3D] hover:bg-[#235030] text-white text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-40"
          >
            Ajouter au panier{destType === 'departure' && departureName ? ` (pour ${departureName})` : ''}
          </button>
        </div>
      </div>
    );
  }

  // ── Cas A : objet possédé et disponible (ou session fermée) ───────────────
  return (
    <div ref={panelRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={toggle}
        data-testid="add-to-equipment-toggle"
        className={`${baseBtn} bg-[#2D5A3D]/15 hover:bg-[#2D5A3D]/25 text-[#2D5A3D] border border-[#2D5A3D]/30 ${compact ? 'px-3' : ''}`}
        aria-expanded={mode === 'add-to-kit'}
        aria-haspopup="menu"
      >
        {owned ? <IconCheck size={14} /> : <IconPlus size={14} />}
        {owned ? (mode === 'add-to-kit' ? 'Choisir un kit' : 'Ajouter au kit') : 'À l’équipement'}
      </button>
      {mode === 'add-to-kit' && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 max-w-[92vw] rounded-2xl border border-[#1C2620]/10 bg-[#FBFAF6]/97 backdrop-blur-2xl p-2 text-xs text-[#1C2620] shadow-2xl space-y-1">
          <p className="px-2 pt-1 font-bold">{product.name}</p>
          {kits.length === 0 && (
            <p className="px-2 pb-1 text-[#1C2620]/60">Aucun kit actif.</p>
          )}
          {kits.map((k) => (
            <button
              key={k.id}
              type="button"
              disabled={busy}
              onClick={() => void handleAddToKit(k.id)}
              className="w-full text-left flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 hover:bg-[#2D5A3D]/10 transition-colors disabled:opacity-50"
            >
              <span className="font-semibold truncate">{k.name}</span>
              <IconChevronRight size={14} className="text-[#2D5A3D] shrink-0" />
            </button>
          ))}
          <button
            type="button"
            onClick={close}
            className="w-full text-left rounded-xl px-2.5 py-2 text-[#1C2620]/60 hover:bg-[#1C2620]/6"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}

function IconWarnSmall() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 9v5M12 17.5v.5" />
    </svg>
  );
}

function ActionBtn({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-xl bg-white/70 hover:bg-[#2D5A3D]/10 border border-[#1C2620]/10 px-2.5 py-2 min-h-[44px] text-left font-semibold transition-colors"
    >
      <span className="text-[#2D5A3D] shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}