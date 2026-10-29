'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Compass,
  Check,
  Share2,
  Bookmark,
  ShieldCheck,
  Scale,
  Sparkles,
} from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { KitSheetData } from '@/features/kits/types';

export interface FreedomKitDrawerProps {
  isOpen: boolean;
  kitId: string;
  initialName?: string;
  onClose: () => void;
}

interface EquipmentItem {
  id: string;
  name: string;
  category: string;
  weightG: number;
  essential: boolean;
  checked: boolean;
}

const PRESET_EQUIPMENT: Record<string, EquipmentItem[]> = {
  'kit-alpine-ultra': [
    { id: '1', name: 'Tente dôme 4 saisons géodésique', category: 'Bivouac', weightG: 1250, essential: true, checked: true },
    { id: '2', name: 'Duvet Valandré Shocking Blue (-15°C)', category: 'Couchage', weightG: 1380, essential: true, checked: true },
    { id: '3', name: 'Matelas Therm-a-Rest NeoAir XTherm', category: 'Couchage', weightG: 430, essential: true, checked: true },
    { id: '4', name: 'Réchaud à gaz MSR WindBurner Duo', category: 'Cuisine', weightG: 430, essential: true, checked: true },
    { id: '5', name: 'Piolet Petzl Glacier Literide', category: 'Alpinisme', weightG: 350, essential: true, checked: true },
    { id: '6', name: 'Crampons Petzl Vasak Leverlock', category: 'Alpinisme', weightG: 790, essential: true, checked: true },
    { id: '7', name: 'Trousse de premiers secours grand froid', category: 'Sécurité', weightG: 220, essential: true, checked: true },
  ],
  'kit-trek-fast': [
    { id: '1', name: 'Sac à dos Fastpacking 28L Dyneema', category: 'Portage', weightG: 490, essential: true, checked: true },
    { id: '2', name: 'Drap de soie ultra-léger thermique', category: 'Couchage', weightG: 120, essential: true, checked: true },
    { id: '3', name: 'Veste imperméable Shakedry Gore-Tex', category: 'Vêtements', weightG: 150, essential: true, checked: true },
    { id: '4', name: 'Gourde filtrante Katadyn BeFree 1.0L', category: 'Hydratation', weightG: 110, essential: true, checked: true },
    { id: '5', name: 'Bâtons Black Diamond Distance Carbon Z', category: 'Marche', weightG: 280, essential: false, checked: true },
    { id: '6', name: 'Lampe frontale Petzl Bindi 200 lm', category: 'Sécurité', weightG: 75, essential: true, checked: true },
    { id: '7', name: 'Trousse d’urgence trail & ampoules', category: 'Sécurité', weightG: 180, essential: true, checked: true },
  ],
  'kit-packraft-safe': [
    { id: '1', name: 'Gilet de sauvetage 70N eaux vives certifié', category: 'Sécurité', weightG: 850, essential: true, checked: true },
    { id: '2', name: 'Combinaison étanche latex respirante', category: 'Vêtements', weightG: 1150, essential: true, checked: true },
    { id: '3', name: 'Casque homologué sports d’eaux vives', category: 'Sécurité', weightG: 420, essential: true, checked: true },
    { id: '4', name: 'Corde de sécurité flottante largable 20m', category: 'Sécurité', weightG: 620, essential: true, checked: true },
    { id: '5', name: 'Pagaie carbone démontable 4 brins', category: 'Navigation', weightG: 890, essential: true, checked: true },
    { id: '6', name: 'Couteau rivière à bout rond avec sifflet', category: 'Sécurité', weightG: 120, essential: true, checked: true },
  ],
  'kit-bikepack-ultra': [
    { id: '1', name: 'Sacoche de selle étanche Apidura 14L', category: 'Bagagerie', weightG: 380, essential: true, checked: true },
    { id: '2', name: 'Sacoche de guidon roll-top 9L', category: 'Bagagerie', weightG: 320, essential: true, checked: true },
    { id: '3', name: 'Tarp Silnylon ultralight 3x3m avec haubans', category: 'Bivouac', weightG: 490, essential: true, checked: true },
    { id: '4', name: 'Bivy respirant déperlant Outdoor Research', category: 'Bivouac', weightG: 240, essential: true, checked: true },
    { id: '5', name: 'Multitool vélo Crankbrothers 19 fonctions', category: 'Outillage', weightG: 190, essential: true, checked: true },
    { id: '6', name: 'Pompe haute pression compacte & cartouches CO2', category: 'Outillage', weightG: 190, essential: true, checked: true },
  ],
};

function formatGrams(g: number): string {
  if (g >= 1000) {
    return `${(g / 1000).toFixed(2).replace('.', ',')} kg`;
  }
  return `${g} g`;
}

export const FreedomKitDrawer: React.FC<FreedomKitDrawerProps> = ({
  isOpen,
  kitId,
  initialName,
  onClose,
}) => {
  const router = useRouter();
  const { haptic } = useHapticFeedback();

  const [kitData, setKitData] = useState<KitSheetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [savedToCarnet, setSavedToCarnet] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Load presets immediately so user never waits
    const preset = PRESET_EQUIPMENT[kitId] || [
      { id: '1', name: 'Abri bivouac ultraléger & haubans', category: 'Bivouac', weightG: 980, essential: true, checked: true },
      { id: '2', name: 'Sac de couchage thermique 800 Cuin', category: 'Couchage', weightG: 820, essential: true, checked: true },
      { id: '3', name: 'Système d’hydratation filtrant rapide', category: 'Hydratation', weightG: 140, essential: true, checked: true },
      { id: '4', name: 'Réchaud titane compact & popote', category: 'Cuisine', weightG: 165, essential: true, checked: true },
      { id: '5', name: 'Trousse de premiers secours & balise GPS', category: 'Sécurité', weightG: 260, essential: true, checked: true },
    ];
    setItems(preset);

    setLoading(true);
    fetch(`/api/kits/${kitId}/sheet`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setKitData(data);
        }
      })
      .catch((err) => {
        console.warn('[FreedomKitDrawer] Error fetching kit sheet:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, kitId]);

  if (!isOpen) return null;

  const kitName = kitData?.kit?.name || initialName || 'Kit Aventure LKDV';
  const totalWeightG = items.reduce((acc, it) => (it.checked ? acc + it.weightG : acc), 0);
  const checkedCount = items.filter((it) => it.checked).length;

  const handleToggleItem = (itemId: string) => {
    haptic('selection');
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, checked: !item.checked } : item)),
    );
  };

  const handleEmporter = () => {
    haptic('medium');
    onClose();
    router.push(`/explorer?kitId=${encodeURIComponent(kitId)}`);
  };

  const handleSaveToCarnet = () => {
    haptic('success');
    setSavedToCarnet(true);
    try {
      const savedKits = JSON.parse(localStorage.getItem('lkdv_saved_kits') || '[]');
      if (!savedKits.includes(kitId)) {
        savedKits.push(kitId);
        localStorage.setItem('lkdv_saved_kits', JSON.stringify(savedKits));
      }
    } catch {
      // localStorage may fail in restricted iframes
    }
    setTimeout(() => setSavedToCarnet(false), 2400);
  };

  const handleShare = async () => {
    haptic('light');
    const shareUrl = `${window.location.origin}/communaute/reels?kit=${kitId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: kitName,
          text: `Découvre le ${kitName} sur Le Kit du Voyageur !`,
          url: shareUrl,
        });
        return;
      } catch {
        // user cancelled or unsupported
      }
    }
    await navigator.clipboard?.writeText(shareUrl).catch(() => {});
    setShareSuccess(true);
    setTimeout(() => setShareSuccess(false), 2000);
  };

  return (
    <div
      className="freedom-drawer-container"
      role="dialog"
      aria-modal="true"
      aria-label={`Détails du kit ${kitName}`}
    >
      {/* Background Scrim */}
      <div
        className="freedom-drawer-scrim"
        onClick={() => {
          haptic('light');
          onClose();
        }}
      />

      {/* Drawer Card */}
      <div className="freedom-drawer-card flex flex-col max-h-[82dvh] overflow-hidden">
        {/* Pull Indicator Handle */}
        <div className="freedom-drawer-handle" aria-hidden="true" />

        {/* Drawer Header */}
        <div className="freedom-drawer-header shrink-0 border-b border-black/5 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-[#17402C]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#17402C]">
                  <Sparkles size={11} className="text-[#17402C]" />
                  Lignée Matériel Outdoor
                </span>
                {kitData?.trust?.endurance_score && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                    <ShieldCheck size={11} />
                    {kitData.trust.endurance_score}/10
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-[#172B24] leading-snug truncate">
                {kitName}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => {
                haptic('light');
                onClose();
              }}
              className="grid size-8 place-items-center rounded-full bg-black/5 text-[#172B24] transition active:scale-90"
              aria-label="Fermer la liste du kit"
            >
              <X size={18} />
            </button>
          </div>

          {/* Weight & Stats summary bar */}
          <div className="mt-3 flex items-center justify-between rounded-xl bg-white/70 border border-black/5 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-[#17402C] text-white">
                <Scale size={16} />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#172B24]/60">
                  Poids calculé
                </div>
                <div className="text-sm font-extrabold text-[#172B24]">
                  {formatGrams(totalWeightG)}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#172B24]/60">
                Éléments
              </div>
              <div className="text-xs font-bold text-[#17402C]">
                {checkedCount} / {items.length} sélectionnés
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="shrink-0 grid grid-cols-3 gap-2 px-4 py-2.5 bg-black/[0.02] border-b border-black/5">
          <button
            type="button"
            onClick={handleEmporter}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-[#17402C] px-2 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95"
          >
            <Compass size={14} />
            <span>Emporter</span>
          </button>

          <button
            type="button"
            onClick={handleSaveToCarnet}
            className={`flex items-center justify-center gap-1.5 rounded-xl border border-black/10 px-2 py-2 text-xs font-semibold transition active:scale-95 ${
              savedToCarnet ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-white/80 text-[#172B24]'
            }`}
          >
            {savedToCarnet ? <Check size={14} /> : <Bookmark size={14} />}
            <span>{savedToCarnet ? 'Ajouté !' : 'Carnet'}</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white/80 px-2 py-2 text-xs font-semibold text-[#172B24] transition active:scale-95"
          >
            <Share2 size={14} />
            <span>{shareSuccess ? 'Copié !' : 'Partager'}</span>
          </button>
        </div>

        {/* Gear Checklist List */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#172B24]/60 pt-1 pb-0.5">
            Équipement inclus dans cette trace
          </div>

          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => handleToggleItem(item.id)}
              className={`flex items-center justify-between rounded-xl p-2.5 transition cursor-pointer ${
                item.checked
                  ? 'bg-white border border-black/5 shadow-xs'
                  : 'bg-black/[0.02] opacity-50'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div
                  className={`grid size-5 shrink-0 place-items-center rounded-md border text-white transition ${
                    item.checked
                      ? 'border-[#17402C] bg-[#17402C]'
                      : 'border-black/30 bg-white'
                  }`}
                >
                  {item.checked && <Check size={12} strokeWidth={3} />}
                </div>

                <div className="min-w-0">
                  <div className={`text-xs font-semibold truncate ${item.checked ? 'text-[#172B24]' : 'line-through text-black/50'}`}>
                    {item.name}
                  </div>
                  <div className="text-[10px] text-black/50">
                    {item.category} {item.essential && '· Recommandé'}
                  </div>
                </div>
              </div>

              <span className="shrink-0 rounded-md bg-black/5 px-1.5 py-0.5 text-[10px] font-mono font-bold text-[#172B24]">
                {formatGrams(item.weightG)}
              </span>
            </div>
          ))}

          {loading && (
            <div className="py-2 text-center text-xs text-black/40">
              Mise à jour de la lignée…
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FreedomKitDrawer;
