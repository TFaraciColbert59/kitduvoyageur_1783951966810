'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Button, EmptyState, ListItem, Skeleton } from '@/components/ui';
import type {
  ProductMessageMeta,
  TrailMessageMeta,
  KitMessageMeta,
} from '../types/messaging.types';
import { messagingService } from '../services/messagingService';
import { MobileSheet } from './MobileSheet';
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

type KitItem = {
  id: string;
  name: string;
};

interface ComposerMenuSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onSendGpx: (file: File) => void;
  onSendProduct: (meta: ProductMessageMeta) => void;
  onSendTrail: (meta: TrailMessageMeta) => void;
  onSendKit: (meta: KitMessageMeta) => void;
}

export const ComposerMenuSheet: React.FC<ComposerMenuSheetProps> = ({
  isOpen,
  onClose,
  currentUserId,
  onSendGpx,
  onSendProduct,
  onSendTrail,
  onSendKit,
}) => {
  const { haptic } = useHapticFeedback();
  const [view, setView] = useState<'menu' | 'equip' | 'trail' | 'kit'>('menu');
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
    if (inventory.length === 0) {
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
        .then((data: { kits?: KitItem[] }) => setKits(data.kits ?? []))
        .catch(() => setKits([]))
        .finally(() => setLoadingKits(false));
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

  const backButton = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => setView('menu')}
      icon={<Icon name="arrow-left" className="size-4" aria-hidden="true" />}
    >
      Retour
    </Button>
  );

  const loadingRows = (
    <div className="space-y-[var(--space-2)]">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-14 w-full rounded-[var(--lkv-radius-md)]" />
      ))}
    </div>
  );

  return (
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        view === 'menu'
          ? 'Partager dans le chat'
          : view === 'equip'
            ? 'Équipement'
            : view === 'kit'
              ? 'Mes kits'
              : 'Randonnée'
      }
    >
      <input
        ref={gpxInputRef}
        type="file"
        accept=".gpx,application/gpx+xml"
        className="hidden"
        onChange={handleGpxPick}
      />

      {view === 'menu' && (
        <div className="space-y-[var(--space-2)]">
          <ListItem
            as="div"
            onClick={() => gpxInputRef.current?.click()}
            className="min-h-[52px]"
            leading={<Icon name="route" className="size-5 text-[color:var(--lkv-forest-700)]" aria-hidden="true" />}
            title="Carte GPX — partager un itinéraire"
            metadata={<span className="font-medium text-[color:var(--lkv-text-secondary)]">.gpx</span>}
          />
          <ListItem
            as="div"
            onClick={openEquip}
            className="min-h-[52px]"
            leading={<Icon name="map-pin" className="size-5 text-[color:var(--lkv-forest-700)]" aria-hidden="true" />}
            title="Équipement — depuis mon inventaire"
          />
          <ListItem
            as="div"
            onClick={openTrails}
            className="min-h-[52px]"
            leading={<Icon name="mountain" className="size-5 text-[color:var(--lkv-forest-700)]" aria-hidden="true" />}
            title="Partager une randonnée"
          />
          <ListItem
            as="div"
            onClick={openKits}
            className="min-h-[52px]"
            leading={<Icon name="backpack" className="size-5 text-[color:var(--lkv-forest-700)]" aria-hidden="true" />}
            title="Partager un kit — lignée"
          />
        </div>
      )}

      {view === 'kit' && (
        <div className="space-y-[var(--space-2)]">
          {backButton}
          {loadingKits ? (
            loadingRows
          ) : kits.length === 0 ? (
            <EmptyState compact title="Aucun kit à partager" />
          ) : (
            kits.map((kit) => (
              <ListItem
                key={kit.id}
                as="div"
                onClick={() => {
                  haptic('light');
                  onSendKit({ kind: 'kit', kit_id: kit.id, kit_name: kit.name });
                  onClose();
                }}
                className="min-h-[60px]"
                leading={
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--lkv-radius-sm)] bg-[color:var(--glass-bg-medium)] ring-1 ring-[color:var(--lkv-secondary)]/50">
                    <Icon name="backpack" className="size-5 text-[color:var(--lkv-text-primary)]" aria-hidden="true" />
                  </span>
                }
                title={kit.name}
              />
            ))
          )}
        </div>
      )}

      {view === 'equip' && (
        <div className="space-y-[var(--space-2)]">
          {backButton}
          {loadingInv ? (
            loadingRows
          ) : inventory.length === 0 ? (
            <EmptyState compact title="Aucun équipement dans votre inventaire" />
          ) : (
            inventory.map((item) => (
              <ListItem
                key={item.id}
                as="div"
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
                className="min-h-[60px]"
                leading={
                  <span className="relative size-10 shrink-0 overflow-hidden rounded-[var(--lkv-radius-sm)] bg-[color:var(--glass-bg-medium)] ring-1 ring-[color:var(--glass-border)]">
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
                  </span>
                }
                title={item.name}
                subtitle={item.category || 'Équipement'}
              />
            ))
          )}
        </div>
      )}

      {view === 'trail' && (
        <div className="space-y-[var(--space-2)]">
          {backButton}
          {loadingTrails ? (
            loadingRows
          ) : trails.length === 0 ? (
            <EmptyState compact title="Aucune randonnée disponible" />
          ) : (
            trails.map((t) => (
              <ListItem
                key={t.id}
                as="div"
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
                className="min-h-[60px]"
                leading={
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)]">
                    <Icon name="mountain" className="size-5" aria-hidden="true" />
                  </span>
                }
                title={t.name}
                subtitle={[t.distance_km != null ? `${t.distance_km} km` : null, t.region]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ))
          )}
        </div>
      )}
    </MobileSheet>
  );
};
