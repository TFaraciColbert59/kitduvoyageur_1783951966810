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
import { TraceMap, type TraceLineString } from './TraceMap';
import { GPXEngine } from '@/features/hiking/gpx/GPXEngine';
import {
  REAL_CATALOG_TRAILS,
  fetchUserSavedTrails,
  type SharedTrailItem,
} from '../data/realTrailsData';

type InventoryItem = {
  id: string;
  name: string;
  photo_url: string | null;
  category: string | null;
  price_cents: number | null;
  product_slug: string | null;
};

type KitItem = {
  id: string;
  name: string;
};

interface ComposerMenuSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onSendGpx: (file: File, geojson?: TraceLineString | null) => void;
  onSendProduct: (meta: ProductMessageMeta) => void;
  onSendTrail: (meta: TrailMessageMeta) => void;
  onSendKit: (meta: KitMessageMeta) => void;
  onSendPhoto?: (file: File) => void;
  onPickPhoto?: () => void;
}

/** Défilement interne des listes longues : `.sh-b` ne défile pas (overflow hidden). */
const SCROLL = {
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  paddingTop: 10,
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
  onSendPhoto,
}) => {
  const { haptic } = useHapticFeedback();
  const [view, setView] = useState<'menu' | 'gpx' | 'equip' | 'trail' | 'kit'>('menu');
  const [trailTab, setTrailTab] = useState<'saved' | 'catalog'>('saved');
  const [searchQuery, setSearchQuery] = useState('');
  const [preview, setPreview] = useState<
    | { type: 'kit'; item: KitItem }
    | { type: 'product'; item: InventoryItem }
    | { type: 'trail'; item: SharedTrailItem; geojson: TraceLineString }
    | { type: 'gpx'; file: File; geojson: TraceLineString | null }
    | { type: 'photo'; file: File; url: string }
    | null
  >(null);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [savedTrails, setSavedTrails] = useState<SharedTrailItem[]>([]);
  const [catalogTrails, setCatalogTrails] = useState<SharedTrailItem[]>(REAL_CATALOG_TRAILS);
  const [kits, setKits] = useState<KitItem[]>([]);
  const [loadingInv, setLoadingInv] = useState(false);
  const [loadingTrails, setLoadingTrails] = useState(false);
  const [loadingKits, setLoadingKits] = useState(false);
  const gpxInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setView('menu');
      setPreview(null);
      setSearchQuery('');
    }
  }, [isOpen]);

  const openEquip = () => {
    haptic('light');
    setView('equip');
    setSearchQuery('');
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
    setSearchQuery('');
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
    setSearchQuery('');
    if (savedTrails.length === 0) {
      setLoadingTrails(true);
      fetchUserSavedTrails(currentUserId)
        .then(setSavedTrails)
        .catch(() => setSavedTrails([]))
        .finally(() => setLoadingTrails(false));
    }
  };

  const openTrails = () => {
    haptic('light');
    setView('trail');
    setSearchQuery('');
    if (savedTrails.length === 0) {
      setLoadingTrails(true);
      fetchUserSavedTrails(currentUserId)
        .then(setSavedTrails)
        .catch(() => setSavedTrails([]))
        .finally(() => setLoadingTrails(false));
    }
  };

  const handleGpxPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      haptic('light');
      try {
        const text = await file.text();
        const coords = GPXEngine.extractCoordinates(text);
        const geojson: TraceLineString | null = coords.length > 1 ? { type: 'LineString', coordinates: coords } : null;
        setPreview({ type: 'gpx', file, geojson });
      } catch {
        setPreview({ type: 'gpx', file, geojson: null });
      }
    }
    if (gpxInputRef.current) gpxInputRef.current.value = '';
  };

  const handlePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      haptic('light');
      const url = URL.createObjectURL(file);
      setPreview({ type: 'photo', file, url });
    }
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const backToMenu = () => {
    if (preview) {
      setPreview(null);
      return;
    }
    setView('menu');
    setSearchQuery('');
  };

  const confirmSend = () => {
    if (!preview) return;
    haptic('medium');
    if (preview.type === 'photo') {
      onSendPhoto?.(preview.file);
    } else if (preview.type === 'kit') {
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
        geojson: preview.geojson,
        coordinates: preview.geojson.coordinates,
      });
    } else if (preview.type === 'gpx') {
      onSendGpx(preview.file, preview.geojson);
    }
    setPreview(null);
    onClose();
  };

  const handleClose = () => {
    setPreview(null);
    setView('menu');
    setSearchQuery('');
    onClose();
  };

  // Filtrages de recherche
  const q = searchQuery.trim().toLowerCase();
  const filteredInventory = inventory.filter((i) => !q || i.name.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q));
  const filteredKits = kits.filter((k) => !q || k.name.toLowerCase().includes(q));
  const displayedTrails = trailTab === 'saved' ? savedTrails : catalogTrails;
  const filteredTrails = displayedTrails.filter((t) => !q || t.name.toLowerCase().includes(q) || (t.region || '').toLowerCase().includes(q));

  return (
    <AccountDrawerHost
      variant="card"
      open={isOpen}
      hideHeader={Boolean(preview)}
      hideCloseButton={false}
      headerAction={
        !preview && (view === 'gpx' || view === 'trail') ? (
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
                : 'Randonnées'
      }
      subtitle={
        preview
          ? 'Confirmez avant l’envoi'
          : view === 'menu'
            ? 'Choisissez ce que vous voulez envoyer'
            : view === 'equip'
              ? 'Sélectionnez un matériel'
              : view === 'kit'
                ? 'Sélectionnez un kit'
                : 'Sélectionnez un itinéraire'
      }
      onClose={handleClose}
      onBack={preview ? () => setPreview(null) : view !== 'menu' ? backToMenu : undefined}
    >
      <input
        ref={gpxInputRef}
        type="file"
        accept=".gpx,application/gpx+xml"
        style={{ display: 'none' }}
        onChange={handleGpxPick}
      />
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handlePhotoPick}
      />

      <div className="msheet-body" style={{ position: 'relative', height: '100%', minHeight: 340, display: 'flex', flexDirection: 'column' }}>
      {preview ? (
        <div
          className="composer-preview"
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            borderRadius: 24,
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          {preview.type === 'photo' && (
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 24, background: '#0e1210', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.url} alt="Aperçu photo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          )}

          {(preview.type === 'trail' || preview.type === 'gpx') && (
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 24, background: '#101713' }}>
              <TraceMap geojson={preview.geojson} height="100%" />
              <div style={{ position: 'absolute', top: 12, left: 54, right: 54, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', pointerEvents: 'none', gap: 8 }}>
                <div style={{ background: 'rgba(23, 43, 36, 0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: '6px 14px', borderRadius: 999, color: '#ffffff', fontSize: 13, fontWeight: 600, boxShadow: '0 2px 10px rgba(0,0,0,0.2)', maxWidth: '70%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {preview.type === 'gpx' ? preview.file.name : preview.item.name}
                </div>
                {preview.type === 'trail' && preview.item.distance_km != null && (
                  <div style={{ background: 'rgba(255, 255, 255, 0.9)', padding: '4px 10px', borderRadius: 999, color: '#17402C', fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>
                    {preview.item.distance_km} km
                  </div>
                )}
              </div>
            </div>
          )}

          {preview.type === 'product' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: '100%', padding: '24px 16px' }}>
              <div
                style={{
                  position: 'relative',
                  width: 130,
                  height: 130,
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
              <div style={{ textAlign: 'center' }}>
                <b style={{ display: 'block', fontSize: 17, color: '#17402C', lineHeight: 1.3 }}>
                  {preview.item.name}
                </b>
                <span style={{ fontSize: 12, color: '#56665D', marginTop: 4, display: 'inline-block' }}>
                  {preview.item.category || 'Équipement d’aventure'}
                </span>
              </div>
            </div>
          )}

          {preview.type === 'kit' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: '100%', padding: '24px 16px' }}>
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 24,
                  background: 'linear-gradient(135deg, #275d3f, #17402c)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  boxShadow: '0 8px 24px rgba(23, 43, 36, 0.2)',
                }}
              >
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 8V6a5 5 0 0 1 10 0v2" />
                  <rect x="5" y="8" width="14" height="12" rx="3" />
                  <path d="M9 13h6" />
                </svg>
              </div>
              <div style={{ textAlign: 'center' }}>
                <b style={{ display: 'block', fontSize: 17, color: '#17402C', lineHeight: 1.3 }}>
                  {preview.item.name}
                </b>
                <span style={{ fontSize: 12, color: '#56665D', marginTop: 4, display: 'inline-block' }}>
                  Kit de matériel complet vérifié
                </span>
              </div>
            </div>
          )}

          {/* Bouton Envoyer : icône flèche uniquement, placé tout en bas à droite */}
          <button
            type="button"
            className="mbtn p"
            style={{
              position: 'absolute',
              right: 14,
              bottom: 14,
              zIndex: 60,
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'linear-gradient(180deg, #275d3f, #17402c)',
              color: '#ffffff',
              boxShadow: '0 4px 16px rgba(23, 64, 44, 0.5)',
              border: 'none',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              padding: 0,
            }}
            onClick={confirmSend}
            aria-label="Confirmer l'envoi"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      ) : (
        <>
          {/* Barre de recherche pour les listes de pièces jointes */}
          {view !== 'menu' && (
            <div style={{ padding: '4px 6px 8px', flexShrink: 0 }}>
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.65)',
                  borderRadius: 14,
                  padding: '6px 10px',
                  boxShadow: 'inset 0 0 0 0.5px rgba(23, 43, 36, 0.1)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginRight: 6 }}>
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Rechercher une pièce jointe..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    fontSize: 13,
                    outline: 'none',
                    color: '#17402C',
                    WebkitAppearance: 'none',
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{ border: 'none', background: 'transparent', padding: 2, cursor: 'pointer', opacity: 0.5, display: 'grid', placeItems: 'center' }}
                    aria-label="Effacer la recherche"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                )}
              </div>

              {/* Sous-onglets pour la randonnée : Nos enregistrés vs Catalogue */}
              {view === 'trail' && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      haptic('light');
                      setTrailTab('saved');
                    }}
                    style={{
                      flex: 1,
                      height: 30,
                      borderRadius: 10,
                      border: 'none',
                      background: trailTab === 'saved' ? '#17402C' : 'rgba(255, 255, 255, 0.5)',
                      color: trailTab === 'saved' ? '#ffffff' : '#17402C',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Nos enregistrés ({savedTrails.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      haptic('light');
                      setTrailTab('catalog');
                    }}
                    style={{
                      flex: 1,
                      height: 30,
                      borderRadius: 10,
                      border: 'none',
                      background: trailTab === 'catalog' ? '#17402C' : 'rgba(255, 255, 255, 0.5)',
                      color: trailTab === 'catalog' ? '#ffffff' : '#17402C',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Catalogue ({catalogTrails.length})
                  </button>
                </div>
              )}
            </div>
          )}

          {view === 'menu' && (
            <div>
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
                    photoInputRef.current?.click();
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              </div>

              <div className="li nt">
                <div>
                  <div className="ttl">Carte GPX</div>
                  <div className="s2">Fichier .gpx de votre itinéraire</div>
                </div>
                <button
                  type="button"
                  className="mbtn-arrow"
                  aria-label="Voir mes fichiers GPX"
                  onClick={openGpx}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              </div>

              <div className="li nt">
                <div>
                  <div className="ttl">Randonnée</div>
                  <div className="s2">Itinéraires enregistrés et tracés réels</div>
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
          )}

          {view === 'kit' && (
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
            ) : filteredKits.length === 0 ? (
              <div className="li nt">
                <div>
                  <div className="ttl">{searchQuery ? 'Aucun résultat' : 'Aucun kit à partager'}</div>
                  <div className="s2">{searchQuery ? 'Essayez un autre mot-clé.' : 'Vos kits de matériel apparaîtront ici.'}</div>
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
                {filteredKits.map((kit) => (
                  <div className="li" key={kit.id}>
                    <span className="avi" aria-hidden="true">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          )}

          {view === 'equip' && (
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
            ) : filteredInventory.length === 0 ? (
              <div className="li nt">
                <div>
                  <div className="ttl">{searchQuery ? 'Aucun résultat' : 'Aucun équipement disponible'}</div>
                  <div className="s2">{searchQuery ? 'Essayez un autre mot-clé.' : 'Vos matériels enregistrés apparaîtront ici.'}</div>
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
                {filteredInventory.map((item) => (
                  <div className="li" key={item.id}>
                    <span className="avi" aria-hidden="true">
                      {item.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.photo_url}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
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
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                          <line x1="12" y1="22.08" x2="12" y2="12" />
                        </svg>
                      )}
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
          )}

          {view === 'trail' && (
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
            ) : filteredTrails.length === 0 ? (
              <div className="li nt">
                <div>
                  <div className="ttl">{searchQuery ? 'Aucun itinéraire trouvé' : 'Aucun tracé enregistré'}</div>
                  <div className="s2">{searchQuery ? 'Essayez une autre recherche.' : 'Vos randonnées enregistrées apparaîtront ici.'}</div>
                </div>
                <button type="button" className="mbtn" onClick={backToMenu}>
                  Retour
                </button>
              </div>
            ) : (
              <div style={SCROLL}>
                {filteredTrails.map((t) => (
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
                        setPreview({
                          type: 'trail',
                          item: t,
                          geojson: t.geojson,
                        });
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
          )}

          {view === 'gpx' && (
            <div style={SCROLL}>
              <div className="li nt" style={{ marginBottom: 12 }}>
                <div>
                  <div className="ttl">Importer un fichier GPX</div>
                  <div className="s2">Depuis vos fichiers locaux ou iCloud Drive</div>
                </div>
                <button
                  type="button"
                  className="mbtn-arrow"
                  aria-label="Choisir un fichier GPX"
                  onClick={() => gpxInputRef.current?.click()}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>

              {savedTrails.map((t) => (
                <div className="li" key={`gpx-${t.id}`}>
                  <span className="avi" aria-hidden="true">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m3 18 6-10 4 6 2-3 4 7H3Z" />
                    </svg>
                  </span>
                  <div>
                    <div className="ttl">
                      <span>{t.name}.gpx</span>
                    </div>
                    <div className="s2">{t.region || 'Tracé GPX vérifié'}</div>
                  </div>
                  <button
                    type="button"
                    className="mbtn-arrow"
                    aria-label={`Prévisualiser ${t.name}`}
                    onClick={() => {
                      haptic('light');
                      setPreview({
                        type: 'gpx',
                        file: new File([JSON.stringify(t.geojson)], `${t.name}.gpx`, { type: 'application/gpx+xml' }),
                        geojson: t.geojson,
                      });
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      </div>
    </AccountDrawerHost>
  );
};
