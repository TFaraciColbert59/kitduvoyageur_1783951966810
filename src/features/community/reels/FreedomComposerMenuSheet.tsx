'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, X, Plus } from 'lucide-react';
import { messagingService } from '@/features/messaging/services/messagingService';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
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
  const [loadingTrails, setLoadingTrails] = useState(false);
  const [loadingKits, setLoadingKits] = useState(false);
  const gpxInputRef = useRef<HTMLInputElement>(null);

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
            // Default curated kits fallback
            setKits([
              { id: 'kit-alpine-ultra', name: 'Pack Bivouac Glaciaire Ultra-léger', items_count: 14 },
              { id: 'kit-trek-fast', name: 'Kit Fastpacking 3 Jours Sans Bivouac', items_count: 9 },
              { id: 'kit-packraft-safe', name: 'Kit Sécurité Packraft & Eaux Vives', items_count: 11 },
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
        .then((data) => {
          if (data && data.length > 0) {
            setTrails(data);
          } else {
            // Curated fallback trails
            setTrails([
              { id: 't-montblanc', name: 'Traversée Aiguilles de Chamonix', distance_km: 14.2, elevation_gain_m: 1350, region: 'Haute-Savoie' },
              { id: 't-gavarnie', name: 'Cirque de Gavarnie & Brèche', distance_km: 18.5, elevation_gain_m: 1180, region: 'Pyrénées' },
              { id: 't-verdon', name: 'Gorges du Verdon - Sentier Blanc-Martel', distance_km: 15.0, elevation_gain_m: 600, region: 'Provence' },
            ]);
          }
        })
        .catch(() => setTrails([]))
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
        .then((data) => {
          if (data && data.length > 0) {
            setTrails(data);
          } else {
            setTrails([
              { id: 't-montblanc', name: 'Traversée Aiguilles de Chamonix', distance_km: 14.2, elevation_gain_m: 1350, region: 'Haute-Savoie' },
              { id: 't-gavarnie', name: 'Cirque de Gavarnie & Brèche', distance_km: 18.5, elevation_gain_m: 1180, region: 'Pyrénées' },
            ]);
          }
        })
        .catch(() => setTrails([]))
        .finally(() => setLoadingTrails(false));
    }
  };

  const handleGpxFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      haptic('medium');
      try {
        const text = await file.text();
        onSelectAttachment({
          type: 'gpx',
          gpx: {
            name: file.name,
            fileContent: text,
            pointsCount: 850,
          },
        });
      } catch {
        onSelectAttachment({
          type: 'gpx',
          gpx: {
            name: file.name,
            pointsCount: 850,
          },
        });
      }
      onClose();
    }
    if (gpxInputRef.current) gpxInputRef.current.value = '';
  };

  if (!isOpen) return null;

  return (
    <div
      className="freedom-drawer-backdrop !z-[10010]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Pièces jointes Freedom"
    >
      <div
        className="freedom-drawer-sheet !max-h-[82vh] !h-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab Handle */}
        <div className="freedom-drawer-grab" aria-hidden="true" onClick={onClose}>
          <span />
        </div>

        {/* Header */}
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
            <div>
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
              <span className="text-[11px] text-[#56665D]">
                {view === 'menu'
                  ? 'Formats riches messagerie Freedom'
                  : view === 'equip'
                  ? 'Depuis votre inventaire outdoor'
                  : view === 'kit'
                  ? 'Inventaires et listes de paquetage'
                  : view === 'gpx'
                  ? 'Fichier .gpx avec profil d’altitude'
                  : 'Fiche sentier LKDV'}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="freedom-drawer-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <input
          ref={gpxInputRef}
          type="file"
          accept=".gpx,application/gpx+xml"
          style={{ display: 'none' }}
          onChange={handleGpxFilePick}
        />

        {/* Content body */}
        <div className="freedom-drawer-content space-y-3">
          {view === 'menu' && (
            <div className="space-y-2">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-black/10 bg-white/70 p-3.5 text-left transition hover:bg-white active:scale-[0.99]"
                onClick={openKits}
              >
                <div>
                  <div className="text-sm font-bold text-[#172B24]">🎒 Kit de matériel</div>
                  <div className="text-xs text-[#56665D]">Partager un kit et sa liste d’équipement</div>
                </div>
                <span className="text-xs font-semibold text-[#17402C]">Choisir →</span>
              </button>

              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-black/10 bg-white/70 p-3.5 text-left transition hover:bg-white active:scale-[0.99]"
                onClick={openGpx}
              >
                <div>
                  <div className="text-sm font-bold text-[#172B24]">🗺️ Fichier ou Tracé GPX</div>
                  <div className="text-xs text-[#56665D]">Partager l’itinéraire exact de la sortie avec profil</div>
                </div>
                <span className="text-xs font-semibold text-[#17402C]">Choisir →</span>
              </button>

              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-black/10 bg-white/70 p-3.5 text-left transition hover:bg-white active:scale-[0.99]"
                onClick={openTrails}
              >
                <div>
                  <div className="text-sm font-bold text-[#172B24]">🥾 Randonnée ou Sentier</div>
                  <div className="text-xs text-[#56665D]">Partager une fiche randonnée LKDV</div>
                </div>
                <span className="text-xs font-semibold text-[#17402C]">Choisir →</span>
              </button>

              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-black/10 bg-white/70 p-3.5 text-left transition hover:bg-white active:scale-[0.99]"
                onClick={openEquip}
              >
                <div>
                  <div className="text-sm font-bold text-[#172B24]">⚙️ Équipement spécifique</div>
                  <div className="text-xs text-[#56665D]">Tente, réchaud, veste ou sac à dos</div>
                </div>
                <span className="text-xs font-semibold text-[#17402C]">Choisir →</span>
              </button>
            </div>
          )}

          {/* Vue Kits */}
          {view === 'kit' && (
            <div className="space-y-2">
              {loadingKits ? (
                <p className="py-6 text-center text-xs text-[#56665D]">Chargement des kits…</p>
              ) : kits.length === 0 ? (
                <p className="py-6 text-center text-xs text-[#56665D]">Aucun kit disponible.</p>
              ) : (
                kits.map((kit) => (
                  <button
                    key={kit.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-black/10 bg-white p-3 text-left transition active:scale-[0.98]"
                    onClick={() => {
                      haptic('medium');
                      onSelectAttachment({
                        type: 'kit',
                        kit: {
                          kind: 'kit',
                          kit_id: kit.id,
                          kit_name: kit.name,
                          items_count: kit.items_count || 12,
                        },
                      });
                      onClose();
                    }}
                  >
                    <div>
                      <div className="text-sm font-bold text-[#172B24]">{kit.name}</div>
                      <div className="text-xs text-[#56665D]">{kit.items_count ?? 10} éléments</div>
                    </div>
                    <span className="text-xs font-bold text-[#17402C]">Joindre</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Vue GPX */}
          {view === 'gpx' && (
            <div className="space-y-2.5">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#17402C] py-3 text-xs font-bold text-white shadow-sm active:scale-[0.98]"
                onClick={() => gpxInputRef.current?.click()}
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>Importer un fichier .GPX de l’appareil</span>
              </button>

              <div className="pt-2 text-xs font-semibold text-[#56665D]">Ou choisir un sentier connu :</div>
              {loadingTrails ? (
                <p className="py-4 text-center text-xs text-[#56665D]">Chargement des sentiers…</p>
              ) : (
                trails.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-black/10 bg-white p-3 text-left transition active:scale-[0.98]"
                    onClick={() => {
                      haptic('medium');
                      onSelectAttachment({
                        type: 'gpx',
                        gpx: {
                          name: `${t.name}.gpx`,
                          distanceKm: t.distance_km,
                          elevationGainM: t.elevation_gain_m,
                        },
                      });
                      onClose();
                    }}
                  >
                    <div>
                      <div className="text-sm font-bold text-[#172B24]">{t.name}</div>
                      <div className="text-xs text-[#56665D]">
                        {t.distance_km ? `${t.distance_km.toFixed(1)} km` : ''}{' '}
                        {t.elevation_gain_m ? `· +${Math.round(t.elevation_gain_m)} m` : ''}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#17402C]">Joindre</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Vue Sentiers / Trails */}
          {view === 'trail' && (
            <div className="space-y-2">
              {loadingTrails ? (
                <p className="py-4 text-center text-xs text-[#56665D]">Chargement des sentiers…</p>
              ) : (
                trails.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-black/10 bg-white p-3 text-left transition active:scale-[0.98]"
                    onClick={() => {
                      haptic('medium');
                      onSelectAttachment({
                        type: 'trail',
                        trail: {
                          kind: 'trail',
                          id: t.id,
                          name: t.name,
                          distance_km: t.distance_km,
                          elevation_gain_m: t.elevation_gain_m,
                          region: t.region,
                        },
                      });
                      onClose();
                    }}
                  >
                    <div>
                      <div className="text-sm font-bold text-[#172B24]">{t.name}</div>
                      <div className="text-xs text-[#56665D]">
                        {[
                          t.distance_km ? `${t.distance_km.toFixed(1)} km` : null,
                          t.elevation_gain_m ? `+${Math.round(t.elevation_gain_m)}m` : null,
                          t.region,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#17402C]">Joindre</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Vue Équipement */}
          {view === 'equip' && (
            <div className="space-y-2">
              {loadingInv ? (
                <p className="py-4 text-center text-xs text-[#56665D]">Chargement de votre inventaire…</p>
              ) : inventory.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-xs text-[#56665D]">Pas d’équipement dans votre inventaire.</p>
                  <button
                    type="button"
                    className="mt-2 text-xs font-bold text-[#17402C]"
                    onClick={() => {
                      onSelectAttachment({
                        type: 'product',
                        product: {
                          kind: 'product',
                          id: 'equip-demo-msr',
                          name: 'Tente Bivouac MSR Hubba Hubba',
                          category: 'Bivouac',
                          price_cents: 48900,
                          photo_url: '/assets/images/product-tent.jpg',
                        },
                      });
                      onClose();
                    }}
                  >
                    Ajouter un matériel type (ex: Tente MSR)
                  </button>
                </div>
              ) : (
                inventory.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-black/10 bg-white p-3 text-left transition active:scale-[0.98]"
                    onClick={() => {
                      haptic('medium');
                      onSelectAttachment({
                        type: 'product',
                        product: {
                          kind: 'product',
                          id: item.id,
                          name: item.name,
                          photo_url: item.photo_url || undefined,
                          category: item.category || undefined,
                          price_cents: item.price_cents || undefined,
                          product_slug: item.product_slug || undefined,
                        },
                      });
                      onClose();
                    }}
                  >
                    <div>
                      <div className="text-sm font-bold text-[#172B24]">{item.name}</div>
                      <div className="text-xs text-[#56665D]">{item.category || 'Matériel'}</div>
                    </div>
                    <span className="text-xs font-bold text-[#17402C]">Joindre</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FreedomComposerMenuSheet;
