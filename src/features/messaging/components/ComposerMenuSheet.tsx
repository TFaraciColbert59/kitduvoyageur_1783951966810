'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { AccountDrawerHost } from '@/design/account/AccountDrawerHost';
import type {
  ProductMessageMeta,
  TrailMessageMeta,
  KitMessageMeta,
} from '../types/messaging.types';
import { messagingService } from '../services/messagingService';
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

/** Défilement interne des listes longues : `.sh-b` ne défile pas (overflow hidden). */
const SCROLL = {
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  paddingTop: 40,
  /* Mêmes fondus haut et bas que la liste des discussions. */
  maskImage: 'linear-gradient(to bottom, transparent 0, #000 10px, #000 calc(100% - 10px), transparent 100%)',
  WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 10px, #000 calc(100% - 10px), transparent 100%)',
} as const;

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

  const openGpx = () => {
    haptic('light');
    setView('gpx');
    if (trails.length === 0) {
      setLoadingTrails(true);
      messagingService
        .getShareableTrails()
        .then(setTrails)
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

  const backToMenu = () => setView('menu');

  return (
    <AccountDrawerHost
      variant="card"
      open={isOpen}
      hideHeader
      headerAction={
        view === 'gpx' ? (
          <button
            type="button"
            className="lg gbtn"
            aria-label="Importer un fichier GPX"
            onClick={() => gpxInputRef.current?.click()}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        ) : null
      }
      title={
        view === 'menu'
          ? 'Partager dans le chat'
          : view === 'equip'
            ? 'Équipement'
            : view === 'kit'
              ? 'Mes kits'
              : 'Randonnée'
      }
      subtitle={
        view === 'menu'
          ? 'GPX, équipement, randonnée, kit'
          : view === 'equip'
            ? 'Depuis votre inventaire'
            : view === 'kit'
              ? 'Vos kits de matériel'
              : 'Vos randonnées enregistrées'
      }
      onClose={onClose}
      onBack={view === 'menu' ? undefined : backToMenu}
    >
      <input
        ref={gpxInputRef}
        type="file"
        accept=".gpx,application/gpx+xml"
        style={{ display: 'none' }}
        onChange={handleGpxPick}
      />

      {view === 'menu' ? (
        <div>
          <div className="li nt">
            <div>
              <div className="ttl">Carte GPX</div>
              <div className="s2">Fichier .gpx de votre itinéraire</div>
            </div>
            <button
              type="button"
              className="mbtn-arrow"
              aria-label="Voir mes tracés GPX"
              onClick={openGpx}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>

          <div className="li nt">
            <div>
              <div className="ttl">Équipement</div>
              <div className="s2">Depuis votre inventaire</div>
            </div>
            <button
              type="button"
              className="mbtn-arrow"
              aria-label="Ouvrir l’équipement"
              onClick={openEquip}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>

          <div className="li nt">
            <div>
              <div className="ttl">Randonnée</div>
              <div className="s2">Une de vos randonnées enregistrées</div>
            </div>
            <button
              type="button"
              className="mbtn-arrow"
              aria-label="Ouvrir les randonnées"
              onClick={openTrails}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>

          <div className="li nt">
            <div>
              <div className="ttl">Kit</div>
              <div className="s2">Un kit de matériel</div>
            </div>
            <button
              type="button"
              className="mbtn-arrow"
              aria-label="Ouvrir les kits"
              onClick={openKits}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      {view === 'kit' ? (
        loadingKits ? (
          <div className="s2" style={{ padding: '10px 2px' }}>
            Chargement de vos kits…
          </div>
        ) : kits.length === 0 ? (
          <div className="li nt">
            <div>
              <div className="ttl">Aucun kit à partager</div>
              <div className="s2">Vos kits de matériel apparaîtront ici.</div>
            </div>
            <button
              type="button"
              className="mbtn-arrow"
              aria-label="Retour"
              onClick={backToMenu}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        ) : (
          <div style={SCROLL}>
            {kits.map((kit) => (
              <div className="li" key={kit.id}>
                <span className="avi" aria-hidden="true">
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M7 8V6a5 5 0 0 1 10 0v2" />
                    <rect x="5" y="8" width="14" height="12" rx="3" />
                    <path d="M9 13h6" />
                  </svg>
                </span>
                <div>
                  <div className="ttl">
                    <span>{kit.name}</span>
                  </div>
                  <div className="s2">Kit de matériel</div>
                </div>
                <button
                  type="button"
                  className="mbtn-arrow"
                  aria-label={`Envoyer le kit ${kit.name}`}
                  onClick={() => {
                    haptic('light');
                    onSendKit({ kind: 'kit', kit_id: kit.id, kit_name: kit.name });
                    onClose();
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )
      ) : null}

      {view === 'equip' ? (
        loadingInv ? (
          <div className="s2" style={{ padding: '10px 2px' }}>
            Chargement de votre inventaire…
          </div>
        ) : inventory.length === 0 ? (
          <div className="li nt">
            <div>
              <div className="ttl">Aucun équipement dans votre inventaire</div>
              <div className="s2">Votre inventaire est vide.</div>
            </div>
            <button type="button" className="mbtn" onClick={backToMenu}>
              Retour
            </button>
          </div>
        ) : (
          <div style={SCROLL}>
            {inventory.map((item) => (
              <div className="li" key={item.id}>
                <span className="avi" style={{ overflow: 'hidden' }}>
                  <Image
                    src={item.photo_url || '/assets/images/no_image.png'}
                    alt=""
                    fill
                    sizes="30px"
                    style={{ objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
                    }}
                  />
                </span>
                <div>
                  <div className="ttl">
                    <span>{item.name}</span>
                  </div>
                  <div className="s2">{item.category || 'Équipement'}</div>
                </div>
                <button
                  type="button"
                  className="mbtn-arrow"
                  aria-label={`Envoyer l’équipement ${item.name}`}
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
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20.5 3.5 3.8 10.2l6.1 2.6 2.6 6.1 8-15.4Z" />
                  <path d="m9.9 12.8 4.4-4.4" />
                </svg>
                </button>
              </div>
            ))}
          </div>
        )
      ) : null}

      {view === 'trail' || view === 'gpx' ? (
        loadingTrails ? (
          <div className="s2" style={{ padding: '10px 2px' }}>
            Chargement de vos tracés…
          </div>
        ) : trails.length === 0 ? (
          <div className="li nt">
            <div>
              <div className="ttl">Aucun tracé disponible</div>
              <div className="s2">Vos tracés enregistrés apparaîtront ici.</div>
            </div>
            <button type="button" className="mbtn" onClick={backToMenu}>
              Retour
            </button>
          </div>
        ) : (
          <div style={SCROLL}>
            {trails.map((t) => (
              <div className="li" key={t.id}>
                <span className="avi" aria-hidden="true">
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m3 18 6-10 4 6 2-3 4 7H3Z" />
                  </svg>
                </span>
                <div>
                  <div className="ttl">
                    <span>{t.name}</span>
                  </div>
                  <div className="s2">
                    {[t.distance_km != null ? `${t.distance_km} km` : null, t.region]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                <button
                  type="button"
                  className="mbtn-arrow"
                  aria-label={`Envoyer la randonnée ${t.name}`}
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
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20.5 3.5 3.8 10.2l6.1 2.6 2.6 6.1 8-15.4Z" />
                    <path d="m9.9 12.8 4.4-4.4" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )
      ) : null}
    </AccountDrawerHost>
  );
};
