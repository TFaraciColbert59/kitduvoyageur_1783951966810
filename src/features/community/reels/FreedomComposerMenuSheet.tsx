'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { messagingService } from '@/features/messaging/services/messagingService';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useDragDismiss } from '@/hooks/gestures';
import type { FreedomCommentAttachment } from './freedom-types';

interface FreedomComposerMenuSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
  onSelectAttachment: (attachment: FreedomCommentAttachment) => void;
}

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

type KitItem = {
  id: string;
  name: string;
  items_count?: number;
};

export const FreedomComposerMenuSheet: React.FC<FreedomComposerMenuSheetProps> = ({
  isOpen,
  onClose,
  currentUserId,
  onSelectAttachment,
}) => {
  const { haptic } = useHapticFeedback();
  const [view, setView] = useState<'menu' | 'gpx' | 'equip' | 'trail' | 'kit'>('menu');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [trails, setTrails] = useState<TrailItem[]>([]);
  const [kits, setKits] = useState<KitItem[]>([]);
  const [loadingInv, setLoadingInv] = useState(false);
  const [_loadingTrails, setLoadingTrails] = useState(false);
  const [loadingKits, setLoadingKits] = useState(false);
  const gpxInputRef = useRef<HTMLInputElement>(null);

  const { dragProps, handleProps, y } = useDragDismiss({
    onDismiss: () => {
      haptic('light');
      onClose();
    },
    mode: 'element',
    threshold: 65,
    velocityThreshold: 300,
  });

  useEffect(() => {
    if (isOpen) setView('menu');
  }, [isOpen]);

  const openEquip = () => {
    haptic('light');
    setView('equip');
    if (inventory.length === 0 && currentUserId) {
      setLoadingInv(true);
      messagingService
        .getShareableInventory(currentUserId)
        .then(setInventory)
        .catch(() => setInventory([]))
        .finally(() => setLoadingInv(false));
    }
  };

  const openKits = () => {
    haptic('light');
    setView('kit');
    if (kits.length === 0) {
      setLoadingKits(true);
      fetch('/api/materiel/kits')
        .then((r) => (r.ok ? r.json() : { kits: [] }))
        .then((data: { kits?: KitItem[] }) => {
          if (data.kits && data.kits.length > 0) {
            setKits(data.kits);
          } else {
            setKits([
              { id: 'bec07364-8c27-577d-8075-bda072c0a217', name: 'Thomas — Ultralight', items_count: 14 },
              { id: '0f02c230-3979-529d-8b96-340d11e31566', name: 'Camille — Ultralight', items_count: 9 },
              { id: '58c7d842-8068-492d-8968-cadb621a920a', name: 'Bivouac Vercors', items_count: 11 },
              { id: '949e203c-9a2c-4a5c-8d11-a8b1590d34b0', name: 'Kit Minimaliste Weekend', items_count: 8 },
            ]);
          }
        })
        .catch(() => setKits([]))
        .finally(() => setLoadingKits(false));
    }
  };

  const openGpx = () => {
    haptic('light');
    setView('gpx');
    if (trails.length === 0) {
      setLoadingTrails(true);
      messagingService
        .getShareableTrails()
        .then(setTrails)
        .catch(() => {
          setTrails([
            {
              id: 'trail-aiguilles-chamonix',
              name: 'Traversée des Aiguilles de Chamonix',
              distance_km: 14.2,
              elevation_gain_m: 1350,
              region: 'Haute-Savoie',
            },
            {
              id: 'trail-cirque-gavarnie',
              name: 'Boucle du Cirque de Gavarnie',
              distance_km: 18.5,
              elevation_gain_m: 1180,
              region: 'Pyrénées',
            },
          ]);
        })
        .finally(() => setLoadingTrails(false));
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

  const handleGpxFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    haptic('medium');
    try {
      const text = await file.text();
      onSelectAttachment({
        type: 'gpx',
        gpx: {
          name: file.name,
          distanceKm: 14.5,
          elevationGainM: 1100,
          fileContent: text,
        },
      });
      onClose();
    } catch {
      // file read error
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="freedom-drawer-backdrop !z-[10010]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Joindre au commentaire"
    >
      <motion.div
        {...dragProps}
        style={{ y }}
        className="freedom-drawer-sheet !max-h-[75vh] !h-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab Handle (glisser vers le bas pour fermer) */}
        <div
          className="freedom-drawer-grab cursor-grab active:cursor-grabbing"
          {...handleProps}
          onClick={onClose}
          aria-label="Fermer le menu des pièces jointes"
        >
          <span />
        </div>

        {/* Header (No close cross 'X') */}
        <div className="freedom-drawer-header">
          <div className="flex items-center gap-2">
            {view !== 'menu' && (
              <button
                type="button"
                onClick={() => setView('menu')}
                className="mr-1 rounded-full p-1 text-[#172B24] transition hover:bg-black/5"
                aria-label="Retour au menu"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <span className="freedom-drawer-title block">
              {view === 'menu'
                ? 'Joindre au commentaire'
                : view === 'equip'
                ? 'Équipement'
                : view === 'kit'
                ? 'Mes kits de matériel'
                : view === 'gpx'
                ? 'Tracé GPX'
                : 'Randonnée'}
            </span>
          </div>
        </div>

        <input
          ref={gpxInputRef}
          type="file"
          accept=".gpx,application/gpx+xml"
          style={{ display: 'none' }}
          onChange={handleGpxFilePick}
        />

        {/* Menu View: Clean rows, NO icons, NO subtitles, identical to messaging */}
        <div className="freedom-drawer-content space-y-1">
          {view === 'menu' && (
            <div className="divide-y divide-black/5">
              <button
                type="button"
                className="flex w-full items-center justify-between py-3.5 px-2 text-left transition hover:bg-black/[0.02] active:opacity-70"
                onClick={openGpx}
              >
                <span className="text-sm font-semibold text-[#172B24]">Carte GPX</span>
                <ChevronRight size={17} className="text-black/40" />
              </button>

              <button
                type="button"
                className="flex w-full items-center justify-between py-3.5 px-2 text-left transition hover:bg-black/[0.02] active:opacity-70"
                onClick={openEquip}
              >
                <span className="text-sm font-semibold text-[#172B24]">Équipement</span>
                <ChevronRight size={17} className="text-black/40" />
              </button>

              <button
                type="button"
                className="flex w-full items-center justify-between py-3.5 px-2 text-left transition hover:bg-black/[0.02] active:opacity-70"
                onClick={openTrails}
              >
                <span className="text-sm font-semibold text-[#172B24]">Randonnée</span>
                <ChevronRight size={17} className="text-black/40" />
              </button>

              <button
                type="button"
                className="flex w-full items-center justify-between py-3.5 px-2 text-left transition hover:bg-black/[0.02] active:opacity-70"
                onClick={openKits}
              >
                <span className="text-sm font-semibold text-[#172B24]">Kit</span>
                <ChevronRight size={17} className="text-black/40" />
              </button>
            </div>
          )}

          {/* Subview: Kits */}
          {view === 'kit' && (
            <div className="space-y-2 py-1">
              {loadingKits ? (
                <p className="py-6 text-center text-xs text-[#56665D]">Chargement de vos kits…</p>
              ) : kits.length === 0 ? (
                <p className="py-6 text-center text-xs text-[#56665D]">Aucun kit disponible.</p>
              ) : (
                kits.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => {
                      haptic('medium');
                      onSelectAttachment({
                        type: 'kit',
                        kit: {
                          kind: 'kit',
                          kit_id: k.id,
                          kit_name: k.name,
                          items_count: k.items_count || 10,
                        },
                      });
                      onClose();
                    }}
                    className="flex w-full items-center justify-between rounded-xl bg-white/70 p-3 text-left transition hover:bg-white active:scale-[0.99] border border-black/5"
                  >
                    <div>
                      <div className="text-xs font-bold text-[#172B24]">{k.name}</div>
                      <div className="text-[10px] text-[#56665D]">Kit de matériel d’aventure</div>
                    </div>
                    <span className="rounded-full bg-[#17402C] px-2.5 py-1 text-[11px] font-bold text-white">
                      Joindre
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Subview: GPX */}
          {view === 'gpx' && (
            <div className="space-y-3 py-1">
              <button
                type="button"
                onClick={() => gpxInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#17402C] py-3 text-xs font-bold text-white shadow-sm transition active:scale-95"
              >
                <span>Importer un fichier .gpx depuis l’appareil</span>
              </button>

              <div className="text-[11px] font-bold uppercase tracking-wider text-[#56665D] pt-2">
                Tracés disponibles
              </div>

              {trails.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    haptic('medium');
                    onSelectAttachment({
                      type: 'gpx',
                      gpx: {
                        name: `${t.name}.gpx`,
                        distanceKm: t.distance_km || 12.0,
                        elevationGainM: t.elevation_gain_m || 850,
                      },
                    });
                    onClose();
                  }}
                  className="flex w-full items-center justify-between rounded-xl bg-white/70 p-3 text-left transition hover:bg-white border border-black/5"
                >
                  <div>
                    <div className="text-xs font-bold text-[#172B24]">{t.name}</div>
                    <div className="text-[10px] text-[#56665D]">
                      {t.distance_km} km · +{t.elevation_gain_m} m {t.region && `· ${t.region}`}
                    </div>
                  </div>
                  <span className="rounded-full bg-[#17402C] px-2.5 py-1 text-[11px] font-bold text-white">
                    Joindre
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Subview: Équipement */}
          {view === 'equip' && (
            <div className="space-y-2 py-1">
              {loadingInv ? (
                <p className="py-6 text-center text-xs text-[#56665D]">Chargement de votre inventaire…</p>
              ) : inventory.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#56665D]">
                  <p>Aucun équipement trouvé.</p>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectAttachment({
                        type: 'product',
                        product: {
                          kind: 'product',
                          id: 'prod-tente-trek',
                          name: 'Tente Trek 2P Ultralight Pro',
                          category: 'Bivouac',
                        },
                      });
                      onClose();
                    }}
                    className="mt-3 inline-flex items-center rounded-xl bg-[#17402C] px-3 py-1.5 text-xs font-bold text-white"
                  >
                    Joindre équipement recommandé
                  </button>
                </div>
              ) : (
                inventory.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => {
                      haptic('medium');
                      onSelectAttachment({
                        type: 'product',
                        product: {
                          kind: 'product',
                          id: inv.id,
                          name: inv.name,
                          category: inv.category || 'Équipement',
                          photo_url: inv.photo_url || undefined,
                        },
                      });
                      onClose();
                    }}
                    className="flex w-full items-center justify-between rounded-xl bg-white/70 p-3 text-left transition hover:bg-white border border-black/5"
                  >
                    <div>
                      <div className="text-xs font-bold text-[#172B24]">{inv.name}</div>
                      <div className="text-[10px] text-[#56665D]">{inv.category || 'Matériel'}</div>
                    </div>
                    <span className="rounded-full bg-[#17402C] px-2.5 py-1 text-[11px] font-bold text-white">
                      Joindre
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Subview: Randonnée */}
          {view === 'trail' && (
            <div className="space-y-2 py-1">
              {trails.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    haptic('medium');
                    onSelectAttachment({
                      type: 'trail',
                      trail: {
                        kind: 'trail',
                        id: t.id,
                        name: t.name,
                        distance_km: t.distance_km || 10,
                        elevation_gain_m: t.elevation_gain_m || 600,
                        region: t.region || 'France',
                      },
                    });
                    onClose();
                  }}
                  className="flex w-full items-center justify-between rounded-xl bg-white/70 p-3 text-left transition hover:bg-white border border-black/5"
                >
                  <div>
                    <div className="text-xs font-bold text-[#172B24]">{t.name}</div>
                    <div className="text-[10px] text-[#56665D]">
                      {t.distance_km} km · +{t.elevation_gain_m} m
                    </div>
                  </div>
                  <span className="rounded-full bg-[#17402C] px-2.5 py-1 text-[11px] font-bold text-white">
                    Joindre
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default FreedomComposerMenuSheet;
