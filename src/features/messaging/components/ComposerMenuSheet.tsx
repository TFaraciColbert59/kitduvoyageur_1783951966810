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
  onPickPhoto?: () => void;
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
  onPickPhoto,
}) => {
  const { haptic } = useHapticFeedback();
  const [view, setView] = useState<'menu' | 'gpx' | 'equip' | 'trail' | 'kit'>('menu');
  const [preview, setPreview] = useState<
    | { type: 'kit'; item: KitItem }
    | { type: 'product'; item: InventoryItem }
    | { type: 'trail'; item: TrailItem }
    | { type: 'gpx'; file: File }
    | null
  >(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [trails, setTrails] = useState<TrailItem[]>([]);
  const [kits, setKits] = useState<KitItem[]>([]);
  const [loadingInv, setLoadingInv] = useState(false);
  const [loadingTrails, setLoadingTrails] = useState(false);
  const [loadingKits, setLoadingKits] = useState(false);
  const gpxInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setView('menu');
      setPreview(null);
    }
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
      haptic('light');
      setPreview({ type: 'gpx', file });
    }
    if (gpxInputRef.current) gpxInputRef.current.value = '';
  };

  const backToMenu = () => {
    if (preview) {
      setPreview(null);
      return;
    }
    setView('menu');
  };

  const confirmSend = () => {
    if (!preview) return;
    haptic('medium');
    if (preview.type === 'kit') {
      onSendKit({ kind: 'kit', kit_id: preview.item.id, kit_name: preview.item.name });
    } else if (preview.type === 'product') {
      onSendProduct({
        kind: 'product',
        id: preview.item.id,
        name: preview.item.name,
        photo_url: preview.item.photo_url,
        category: preview.item.category,
        price_cents: preview.item.price_cents,
        product_slug: preview.item.product_slug,
      });
    } else if (preview.type === 'trail') {
      onSendTrail({
        kind: 'trail',
        id: preview.item.id,
        name: preview.item.name,
        distance_km: preview.item.distance_km,
        elevation_gain_m: preview.item.elevation_gain_m,
        region: preview.item.region,
      });
    } else if (preview.type === 'gpx') {
      onSendGpx(preview.file);
    }
    setPreview(null);
    onClose();
  };

  return (
    <AccountDrawerHost
      variant="card"
      open={isOpen}
      hideHeader
      headerAction={
        !preview && view === 'gpx' ? (
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
        preview
          ? 'Vérifier la pièce jointe'
          : view === 'menu'
            ? 'Partager dans le chat'
            : view === 'equip'
              ? 'Équipement'
              : view === 'kit'
                ? 'Mes kits'
                : 'Randonnée'
      }
      subtitle={
        preview
          ? 'Confirmez avant l’envoi'
          : view === 'menu'
            ? 'GPX, équipement, randonnée, kit'
            : view === 'equip'
              ? 'Depuis votre inventaire'
              : view === 'kit'
                ? 'Vos kits de matériel'
                : 'Vos randonnées enregistrées'
      }
      onClose={onClose}
      onBack={preview ? () => setPreview(null) : view === 'menu' ? undefined : backToMenu}
    >
      <input
        ref={gpxInputRef}
        type="file"
        accept=".gpx,application/gpx+xml"
        style={{ display: 'none' }}
        onChange={handleGpxPick}
      />

      <div className="msheet-body" style={{ position: 'relative', height: '100%' }}>
      {preview ? (
        <div
          style={{
            padding: '24px 16px 60px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            boxSizing: 'border-box',
            textAlign: 'center',
          }}
        >
          {preview.type === 'product' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  position: 'relative',
                  width: 120,
                  height: 120,
                  borderRadius: 20,
                  overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(23, 43, 36, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.9)',
                }}
              >
                <Image
                  src={preview.item.photo_url || '/assets/images/no_image.png'}
                  alt=""
                  fill
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <div>
                <b style={{ display: 'block', fontSize: 17, color: '#17402C', lineHeight: 1.3 }}>
                  {preview.item.name}
                </b>
                <span style={{ fontSize: 12, color: '#56665D', marginTop: 4, display: 'inline-block' }}>
                  {preview.item.category || 'Équipement d’aventure'}
                </span>
              </div>
            </div>
          )}

          {preview.type === 'trail' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 24,
                  background: 'linear-gradient(135deg, #275d3f, #17402c)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  boxShadow: '0 8px 24px rgba(23, 43, 36, 0.2)',
                }}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3 18 6-10 4 6 2-3 4 7H3Z" />
                </svg>
              </div>
              <div>
                <b style={{ display: 'block', fontSize: 17, color: '#17402C', lineHeight: 1.3 }}>
                  {preview.item.name}
                </b>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#275d3f',
                    background: 'rgba(39, 93, 63, 0.1)',
                    padding: '3px 12px',
                    borderRadius: 999,
                    marginTop: 6,
                  }}
                >
                  {[preview.item.distance_km != null ? `${preview.item.distance_km} km` : null, preview.item.elevation_gain_m != null ? `+${preview.item.elevation_gain_m} m D+` : null, preview.item.region]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
            </div>
          )}

          {preview.type === 'kit' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 24,
                  background: 'linear-gradient(135deg, #275d3f, #17402c)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  boxShadow: '0 8px 24px rgba(23, 43, 36, 0.2)',
                }}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 8V6a5 5 0 0 1 10 0v2" />
                  <rect x="5" y="8" width="14" height="12" rx="3" />
                  <path d="M9 13h6" />
                </svg>
              </div>
              <div>
                <b style={{ display: 'block', fontSize: 17, color: '#17402C', lineHeight: 1.3 }}>
                  {preview.item.name}
                </b>
                <span style={{ fontSize: 12, color: '#56665D', marginTop: 4, display: 'inline-block' }}>
                  Kit de matériel complet vérifié
                </span>
              </div>
            </div>
          )}

          {preview.type === 'gpx' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 24,
                  background: 'linear-gradient(135deg, #1e3a5f, #0f2440)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  boxShadow: '0 8px 24px rgba(15, 36, 64, 0.2)',
                }}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div>
                <b style={{ display: 'block', fontSize: 16, color: '#17402C', lineHeight: 1.3 }}>
                  {preview.file.name}
                </b>
                <span style={{ fontSize: 12, color: '#56665D', marginTop: 4, display: 'inline-block' }}>
                  Tracé GPX · {(preview.file.size / 1024).toFixed(1)} Ko
                </span>
              </div>
            </div>
          )}

          {/* 4. Pillule Envoyer flottante en bas à droite */}
          <button
            type="button"
            className="mbtn p"
            style={{
              position: 'absolute',
              right: 14,
              bottom: 14,
              zIndex: 40,
              height: 38,
              padding: '0 20px',
              borderRadius: 999,
              background: 'linear-gradient(180deg, #275d3f, #17402c)',
              color: '#ffffff',
              font: '600 13px var(--sf)',
              boxShadow: '0 4px 14px rgba(23, 64, 44, 0.35)',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
            onClick={confirmSend}
          >
            <span>Envoyer</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      ) : view === 'menu' ? (
        <div>
          {onPickPhoto ? (
            <div className="li nt">
              <div>
                <div className="ttl">Photo</div>
                <div className="s2">Depuis votre galerie</div>
              </div>
              <button
                type="button"
                className="mbtn-arrow"
                aria-label="Envoyer une photo"
                onClick={() => {
                  haptic('light');
                  onClose();
                  onPickPhoto();
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          ) : null}

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
          <div className="msk-list" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div className="msk-row" key={i}>
                <span className="msk-ico" />
                <span className="msk-lines">
                  <span className="msk-line w70" />
                  <span className="msk-line w45" />
                </span>
              </div>
            ))}
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
                  aria-label={`Prévisualiser le kit ${kit.name}`}
                  onClick={() => {
                    haptic('light');
                    setPreview({ type: 'kit', item: kit });
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
          <div className="msk-list" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div className="msk-row" key={i}>
                <span className="msk-ico" />
                <span className="msk-lines">
                  <span className="msk-line w70" />
                  <span className="msk-line w45" />
                </span>
              </div>
            ))}
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
                  aria-label={`Prévisualiser l’équipement ${item.name}`}
                  onClick={() => {
                    haptic('light');
                    setPreview({ type: 'product', item });
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

      {view === 'trail' || view === 'gpx' ? (
        loadingTrails ? (
          <div className="msk-list" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div className="msk-row" key={i}>
                <span className="msk-ico" />
                <span className="msk-lines">
                  <span className="msk-line w70" />
                  <span className="msk-line w45" />
                </span>
              </div>
            ))}
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
                  aria-label={`Prévisualiser la randonnée ${t.name}`}
                  onClick={() => {
                    haptic('light');
                    setPreview({ type: 'trail', item: t });
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
      </div>
    </AccountDrawerHost>
  );
};
