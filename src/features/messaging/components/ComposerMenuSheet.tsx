"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import type { ProductMessageMeta, TrailMessageMeta } from '../types/messaging.types';
import { messagingService } from '../services/messagingService';
import { MobileSheet } from './MobileSheet';
import { Route, MapPin, ArrowLeft, Mountain } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

type InventoryItem = {
  id: string;
  name: string;
  photo_url: string | null;
  category: string | null;
  price_cents: number | null;
  product_slug: string | null;
};

type TrailItem = {
  id: string;
  name: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  region: string | null;
};

interface ComposerMenuSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onSendGpx: (file: File) => void;
  onSendProduct: (meta: ProductMessageMeta) => void;
  onSendTrail: (meta: TrailMessageMeta) => void;
}

export const ComposerMenuSheet: React.FC<ComposerMenuSheetProps> = ({
  isOpen,
  onClose,
  currentUserId,
  onSendGpx,
  onSendProduct,
  onSendTrail,
}) => {
  const { haptic } = useHapticFeedback();
  const [view, setView] = useState<'menu' | 'equip' | 'trail'>('menu');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [trails, setTrails] = useState<TrailItem[]>([]);
  const [loadingInv, setLoadingInv] = useState(false);
  const [loadingTrails, setLoadingTrails] = useState(false);
  const gpxInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) setView('menu');
  }, [isOpen]);

  const openEquip = () => {
    haptic('light');
    setView('equip');
    if (inventory.length === 0) {
      setLoadingInv(true);
      messagingService
        .getShareableInventory(currentUserId)
        .then(setInventory)
        .catch(() => setInventory([]))
        .finally(() => setLoadingInv(false));
    }
  };

  const openTrails = () => {
    haptic('light');
    setView('trail');
    if (trails.length === 0) {
      setLoadingTrails(true);
      messagingService
        .getShareableTrails()
        .then(setTrails)
        .catch(() => setTrails([]))
        .finally(() => setLoadingTrails(false));
    }
  };

  const handleGpxPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      haptic('medium');
      onSendGpx(file);
      onClose();
    }
    if (gpxInputRef.current) gpxInputRef.current.value = '';
  };

  const itemClass =
    'w-full p-3.5 rounded-2xl bg-white/70 hover:bg-[#17402C]/10 border border-stone-200/50 flex items-center gap-3 text-[15px] font-semibold text-[#17402C] transition-colors min-h-[52px]';

  return (
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title={view === 'menu' ? 'Partager dans le chat' : view === 'equip' ? 'Équipement' : 'Randonnée'}
    >
      <input
        ref={gpxInputRef}
        type="file"
        accept=".gpx,application/gpx+xml"
        className="hidden"
        onChange={handleGpxPick}
      />

      {view === 'menu' && (
        <div className="space-y-2">
          <button type="button" onClick={() => gpxInputRef.current?.click()} className={itemClass}>
            <Route className="w-5 h-5 text-[#2D6B4A]" />
            Carte GPX — partager un itinéraire
            <span className="ml-auto text-[13px] font-medium text-[#5A574E]">.gpx</span>
          </button>
          <button type="button" onClick={openEquip} className={itemClass}>
            <MapPin className="w-5 h-5 text-[#2D6B4A]" />
            Équipement — depuis mon inventaire
          </button>
          <button type="button" onClick={openTrails} className={itemClass}>
            <Mountain className="w-5 h-5 text-[#2D6B4A]" />
            Partager une randonnée
          </button>
        </div>
      )}

      {view === 'equip' && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setView('menu')}
            className="flex items-center gap-2 px-2 py-1 text-[13px] font-semibold text-[#5A574E] hover:text-[#17402C]"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          {loadingInv ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-stone-100/80 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : inventory.length === 0 ? (
            <p className="text-center text-[14px] text-[#5A574E] py-6">
              Aucun équipement dans votre inventaire.
            </p>
          ) : (
            inventory.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  haptic('light');
                  onSendProduct({
                    kind: 'product',
                    id: item.id,
                    name: item.name,
                    photo_url: item.photo_url,
                    category: item.category,
                    price_cents: item.price_cents,
                    product_slug: item.product_slug,
                  });
                  onClose();
                }}
                className="w-full text-left p-3 rounded-2xl bg-white/70 hover:bg-[#17402C]/10 border border-stone-200/60 flex items-center gap-3 active:scale-[0.98] min-h-[60px]"
              >
                <div className="w-10 h-10 rounded-xl overflow-hidden relative ring-1 ring-white/80 shrink-0 bg-stone-100">
                  <Image
                    src={item.photo_url || '/assets/images/no_image.png'}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="40px"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="font-semibold text-[15px] text-[#17402C] truncate">{item.name}</p>
                  <p className="text-[13px] text-[#5A574E] truncate">
                    {item.category || 'Équipement'}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {view === 'trail' && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setView('menu')}
            className="flex items-center gap-2 px-2 py-1 text-[13px] font-semibold text-[#5A574E] hover:text-[#17402C]"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          {loadingTrails ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-stone-100/80 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : trails.length === 0 ? (
            <p className="text-center text-[14px] text-[#5A574E] py-6">
              Aucune randonnée disponible.
            </p>
          ) : (
            trails.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  haptic('light');
                  onSendTrail({
                    kind: 'trail',
                    id: t.id,
                    name: t.name,
                    distance_km: t.distance_km,
                    elevation_gain_m: t.elevation_gain_m,
                    region: t.region,
                  });
                  onClose();
                }}
                className="w-full text-left p-3.5 rounded-2xl bg-white/70 hover:bg-[#17402C]/10 border border-stone-200/60 flex items-center gap-3 active:scale-[0.98] min-h-[60px]"
              >
                <div className="w-10 h-10 rounded-full bg-[#17402C]/10 text-[#17402C] flex items-center justify-center shrink-0">
                  <Mountain className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="font-semibold text-[15px] text-[#17402C] truncate">{t.name}</p>
                  <p className="text-[13px] text-[#5A574E] truncate">
                    {[t.distance_km != null ? `${t.distance_km} km` : null, t.region].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </MobileSheet>
  );
};