'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  Binoculars,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Feather,
  Flower2,
  Lock,
  MapPin,
  Mountain,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import type { PokedexApiSpecies } from '@/app/api/pokedex/species/route';
import {
  ALPINE_DEX_CATALOG,
  type PokedexEntry,
  type PokedexKingdom,
  type PokedexRarity,
} from '@/components/carnet/v2/CarnetPokedexDrawerBody';
import { AnimatedNumber, CARNET_SPRING, StaggerList } from '@/components/carnet/v2/CarnetDrawerMotion';
import {
  CarnetSpeciesCreatePane,
  type DiscoveredSpeciesItem,
} from '@/components/carnet/v2/CarnetSpeciesCreatePane';
import type { ClubMapPokedexItem } from '../map/clubMapTypes';
import type {
  ClubItemData,
  ClubMemberData,
  ClubOutingData,
  ClubToastPayload,
} from './ClubDrawerTypes';

export interface ClubPokedexEntry extends PokedexEntry {
  clubSightings: ClubMapPokedexItem[];
}

const RARITY_STYLES: Record<PokedexRarity, { bg: string; color: string; border: string; holo: boolean }> = {
  Commun: {
    bg: 'rgba(27, 67, 50, 0.1)',
    color: '#1b4332',
    border: 'rgba(27, 67, 50, 0.16)',
    holo: false,
  },
  'Peu commun': {
    bg: 'rgba(37, 99, 235, 0.1)',
    color: '#1d4ed8',
    border: 'rgba(37, 99, 235, 0.26)',
    holo: false,
  },
  Rare: {
    bg: 'rgba(180, 83, 9, 0.12)',
    color: '#b45309',
    border: 'rgba(217, 119, 6, 0.34)',
    holo: true,
  },
  Mythique: {
    bg: 'linear-gradient(135deg, rgba(217, 119, 6, 0.18), rgba(147, 51, 234, 0.16))',
    color: '#7e22ce',
    border: 'rgba(147, 51, 234, 0.38)',
    holo: true,
  },
};

function kingdomIcon(kingdom: PokedexKingdom, size = 12) {
  if (kingdom === 'faune') return <Feather size={size} aria-hidden="true" />;
  if (kingdom === 'flore') return <Flower2 size={size} aria-hidden="true" />;
  return <Mountain size={size} aria-hidden="true" />;
}

function normStr(val?: string | null): string {
  return String(val ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Carte Pokédex 3D Tilt + Spotlight + Shimmer holographique (identique à Carnet,
 * enrichie avec les avatars empilés des membres découvreurs du club).
 */
function ClubPokedexHoloCard({
  entry,
  onSelect,
}: {
  entry: ClubPokedexEntry;
  onSelect: () => void;
}) {
  const cardRef = useRef<HTMLButtonElement | null>(null);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const springX = useSpring(mouseX, { stiffness: 260, damping: 24 });
  const springY = useSpring(mouseY, { stiffness: 260, damping: 24 });
  const rotateX = useTransform(springY, [0, 1], [6, -6]);
  const rotateY = useTransform(springX, [0, 1], [-6, 6]);
  const rStyle = RARITY_STYLES[entry.rarity];

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  };

  const resetPointer = () => {
    mouseX.set(0.5);
    mouseY.set(0.5);
  };

  const sightingsCount = entry.clubSightings.length;

  return (
    <motion.button
      ref={cardRef}
      type="button"
      className={`lkdv-carnet-pokedex-card${entry.discovered ? ' is-discovered' : ' is-locked'}${
        rStyle.holo && entry.discovered ? ' is-holo' : ''
      }`}
      style={{
        borderColor: entry.discovered ? rStyle.border : undefined,
        rotateX,
        rotateY,
        transformPerspective: 700,
      }}
      whileTap={{ scale: 0.965 }}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      onClick={onSelect}
    >
      {rStyle.holo && entry.discovered ? (
        <span className="lkdv-carnet-pokedex-holo-sheen" aria-hidden="true" />
      ) : null}

      <div className="lkdv-carnet-pokedex-card-head">
        <span className="lkdv-carnet-pokedex-num">{entry.dexNumber}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {entry.discoverers && entry.discoverers.length > 0 ? (
            <span
              style={{ display: 'inline-flex', alignItems: 'center' }}
              title={`Découvert par ${entry.discoverers.map((d) => d.name).join(', ')}`}
            >
              {entry.discoverers.slice(0, 3).map((d, i) =>
                d.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={d.userId}
                    src={d.avatarUrl}
                    alt={d.name}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '1.5px solid #fff',
                      marginLeft: i > 0 ? -5 : 0,
                      boxShadow: '0 1px 3px rgba(0,0,0,.18)',
                    }}
                  />
                ) : (
                  <span
                    key={d.userId}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#1b4332',
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 700,
                      display: 'inline-grid',
                      placeItems: 'center',
                      border: '1.5px solid #fff',
                      marginLeft: i > 0 ? -5 : 0,
                    }}
                  >
                    {d.name.slice(0, 1).toUpperCase()}
                  </span>
                ),
              )}
            </span>
          ) : null}
          {entry.discovered ? (
            <CheckCircle2 size={14} color="#1b4332" aria-label="Découvert par le club" />
          ) : (
            <Lock size={12} color="#6b7280" aria-label="Non encore repéré" />
          )}
        </span>
      </div>

      <div className="lkdv-carnet-pokedex-thumb">
        {entry.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.imageUrl}
            alt={entry.name}
            loading="lazy"
            className={!entry.discovered ? 'is-silhouette-photo' : undefined}
          />
        ) : (
          <span className="lkdv-carnet-pokedex-thumb-icon">
            {kingdomIcon(entry.kingdom, 22)}
          </span>
        )}
      </div>

      <div className="lkdv-carnet-pokedex-card-body">
        <b>{entry.name}</b>
        <small>{entry.latin}</small>
        <div className="lkdv-carnet-pokedex-foot">
          <span
            className="lkdv-carnet-pokedex-rarity"
            style={{ background: rStyle.bg, color: rStyle.color }}
          >
            {entry.rarity}
          </span>
          {sightingsCount > 0 ? (
            <span className="lkdv-carnet-pokedex-obs">
              {sightingsCount} obs. club
            </span>
          ) : entry.observationsCount ? (
            <span className="lkdv-carnet-pokedex-obs">{entry.observationsCount} obs.</span>
          ) : null}
        </div>
      </div>
    </motion.button>
  );
}

/**
 * Fiche détaillée d'une espèce du Pokédex Club (fidèle à Carnet + liste des observations
 * des membres sur les sorties du club avec recentrage 3D et accès direct à la fiche sortie).
 */
export function ClubPokedexDetailCard({
  entry,
  outings,
  onBack,
  backLabel = '← Retour au Pokédex du club',
  onObserveSpecies,
  onFlyToCoords,
  onInspectOuting,
}: {
  entry: ClubPokedexEntry;
  outings: ClubOutingData[];
  onBack: () => void;
  backLabel?: string;
  onObserveSpecies?: (species: { name: string; latin: string }) => void;
  onFlyToCoords?: (lat: number, lng: number, zoom?: number) => void;
  onInspectOuting?: (outing: ClubOutingData) => void;
}) {
  const rStyle = RARITY_STYLES[entry.rarity];

  return (
    <motion.div
      key={entry.id}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={CARNET_SPRING}
      className="lkdv-carnet-pokedex-detail"
      data-testid="club-pokedex-detail"
    >
      <div className="lkdv-carnet-pokedex-hero" style={{ borderColor: rStyle.border }}>
        <div className="lkdv-carnet-pokedex-hero-top">
          <span className="lkdv-carnet-pokedex-num">{entry.dexNumber}</span>
          <span
            className="lkdv-carnet-pokedex-rarity"
            style={{ background: rStyle.bg, color: rStyle.color }}
          >
            <Sparkles size={10} /> {entry.rarity}
          </span>
        </div>

        {entry.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.imageUrl}
            alt={entry.name}
            className={`lkdv-carnet-pokedex-hero-img${
              !entry.discovered ? ' is-silhouette-photo' : ''
            }`}
          />
        ) : (
          <div className="lkdv-carnet-pokedex-silhouette">
            {entry.discovered ? kingdomIcon(entry.kingdom, 36) : <Lock size={28} />}
            <span>
              {entry.discovered ? 'Observé sans photo' : 'Espèce non encore repérée'}
            </span>
          </div>
        )}

        <div className="lkdv-carnet-pokedex-title">
          <b>{entry.name}</b>
          <i>{entry.latin}</i>
        </div>
        <p className="lkdv-carnet-pokedex-desc">{entry.description}</p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {entry.wikipediaUrl ? (
            <a
              href={entry.wikipediaUrl}
              target="_blank"
              rel="noreferrer"
              className="lkdv-carnet-pokedex-wiki"
            >
              <span>Fiche encyclopédique</span>
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          ) : null}

          {onObserveSpecies ? (
            <button
              type="button"
              className="lkdv-carnet-btn-soft"
              style={{
                height: 32,
                padding: '0 14px',
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background:
                  'linear-gradient(180deg, rgba(150, 186, 142, 0.28), rgba(150, 186, 142, 0.14)), linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0.66))',
                border: '0.5px solid rgba(23, 64, 44, 0.24)',
                color: '#17402c',
                boxShadow:
                  'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 2px 8px rgba(23, 43, 36, 0.08)',
              }}
              onClick={() => onObserveSpecies({ name: entry.name, latin: entry.latin })}
            >
              <Binoculars size={13} aria-hidden="true" />
              <span>J’ai observé cette espèce</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="lkdv-carnet-kpi-grid-3">
        <div className="lkdv-carnet-kpi-mini">
          <small>Zone</small>
          <b style={{ fontSize: 11.5 }}>{entry.altitudeRange}</b>
        </div>
        <div className="lkdv-carnet-kpi-mini">
          <small>Taxon</small>
          <b style={{ fontSize: 11.5 }}>{entry.habitat}</b>
        </div>
        <div className="lkdv-carnet-kpi-mini">
          <small>Obs. club</small>
          <b style={{ fontSize: 12 }}>
            {entry.clubSightings.length > 0 ? (
              <AnimatedNumber value={entry.clubSightings.length} />
            ) : entry.observationsCount ? (
              <AnimatedNumber value={entry.observationsCount} />
            ) : (
              entry.bestTime
            )}
          </b>
        </div>
      </div>

      <div className="lkdv-carnet-chart-card">
        <span className="lkdv-carnet-kit-eyebrow" style={{ marginBottom: 10, display: 'block' }}>
          Indice d’observation
        </span>
        <div className="lkdv-carnet-kit-bars">
          {(
            [
              ['Rareté', entry.stats.rarete, '#7e22ce'],
              ['Discrétion', entry.stats.discretion, '#1d4ed8'],
              ['Altitude', entry.stats.altitude, '#1b4332'],
            ] as const
          ).map(([label, val, color]) => (
            <div key={label} className="lkdv-carnet-kit-bar-row">
              <span className="lkdv-carnet-kit-bar-label">{label}</span>
              <div className="lkdv-carnet-kit-bar-track">
                <motion.div
                  className="lkdv-carnet-kit-bar-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${val}%` }}
                  transition={CARNET_SPRING}
                  style={{ background: color }}
                />
              </div>
              <span className="lkdv-carnet-kit-bar-val">{val}</span>
            </div>
          ))}
        </div>
      </div>

      {entry.clubSightings.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="lkdv-carnet-kit-eyebrow" style={{ paddingLeft: 2 }}>
            Observations du club ({entry.clubSightings.length})
          </span>
          {entry.clubSightings.map((sighting) => {
            const linkedOuting = outings.find((o) => o.id === sighting.outingId);
            return (
              <div key={sighting.id} className="lkdv-carnet-pokedex-fieldnote">
                <div className="lkdv-carnet-timeline-meta" style={{ flexWrap: 'wrap', gap: 6 }}>
                  <span className="lkdv-carnet-chip-dark">
                    {sighting.observerName} · {sighting.observedAt}
                  </span>
                  {sighting.spot ? (
                    <span className="lkdv-carnet-chip-place">
                      <MapPin size={10} /> {sighting.spot}
                    </span>
                  ) : null}
                  {sighting.confidence ? (
                    <span className="lkdv-carnet-chip-place">{sighting.confidence}</span>
                  ) : null}
                </div>
                {sighting.citation ? <p style={{ margin: '6px 0 0' }}>« {sighting.citation} »</p> : null}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {onFlyToCoords && Number.isFinite(sighting.lat) && Number.isFinite(sighting.lng) ? (
                    <button
                      type="button"
                      className="lkdv-carnet-btn-soft"
                      style={{ height: 28, padding: '0 10px', fontSize: 11 }}
                      onClick={() => onFlyToCoords(sighting.lat, sighting.lng, 13.8)}
                    >
                      <MapPin size={12} aria-hidden="true" />
                      <span>Localiser sur la carte</span>
                    </button>
                  ) : null}
                  {linkedOuting && onInspectOuting ? (
                    <button
                      type="button"
                      className="lkdv-carnet-btn-soft"
                      style={{ height: 28, padding: '0 10px', fontSize: 11 }}
                      onClick={() => onInspectOuting(linkedOuting)}
                    >
                      <Calendar size={12} aria-hidden="true" />
                      <span>{linkedOuting.title.split('(')[0].trim().slice(0, 32)}</span>
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </motion.div>
  );
}

export interface ClubPokedexDrawerBodyProps {
  activeClub: ClubItemData;
  lensId: 'pokedex' | 'faune' | 'flore';
  pokedexItems: ClubMapPokedexItem[];
  members: ClubMemberData[];
  outings: ClubOutingData[];
  currentUserId?: string | null;
  discoveredOnlyForUserId?: string | null;
  discoveredOnlyForMemberName?: string | null;
  initialPokedexId?: string | null;
  onClearInitialPokedexId?: () => void;
  kingdomFilter?: 'all' | PokedexKingdom;
  outingFilterId?: string;
  onDetailOpenChange?: (open: boolean) => void;
  onFlyToCoords?: (lat: number, lng: number, zoom?: number) => void;
  onInspectOuting?: (outing: ClubOutingData) => void;
  onObservationCreated?: (item: ClubMapPokedexItem) => void;
  onToast?: (payload: ClubToastPayload) => void;
}

export function ClubPokedexDrawerBody({
  activeClub,
  lensId,
  pokedexItems,
  members,
  outings,
  currentUserId = null,
  discoveredOnlyForUserId = null,
  discoveredOnlyForMemberName = null,
  initialPokedexId = null,
  onClearInitialPokedexId,
  kingdomFilter = 'all',
  outingFilterId = 'all',
  onDetailOpenChange,
  onFlyToCoords,
  onInspectOuting,
  onObservationCreated,
  onToast,
}: ClubPokedexDrawerBodyProps) {
  const [query, setQuery] = useState('');
  const [selectedEntryKey, setSelectedEntryKey] = useState<string | null>(null);
  const [apiSpecies, setApiSpecies] = useState<PokedexApiSpecies[]>([]);
  const [searchSpecies, setSearchSpecies] = useState<PokedexApiSpecies[]>([]);
  const [apiLoading, setApiLoading] = useState(true);
  const [sessionItems, setSessionItems] = useState<ClubMapPokedexItem[]>([]);

  // Sous-tiroir d'ajout d'observation (dupliqué de CarnetSpeciesCreatePane)
  const [createOpen, setCreateOpen] = useState(false);
  const [createPlace, setCreatePlace] = useState(activeClub.massif || activeClub.name);
  const [createCaption, setCreateCaption] = useState('');
  const [createLatin, setCreateLatin] = useState('');
  const [createNote, setCreateNote] = useState('');
  const [createOutingId, setCreateOutingId] = useState<string>(outings[0]?.id ?? '');
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const allSightings = useMemo(
    () => [...sessionItems, ...pokedexItems],
    [sessionItems, pokedexItems],
  );

  const fallbackLat =
    activeClub.lat ?? outings[0]?.lat ?? 45.8992;
  const fallbackLng =
    activeClub.lng ?? outings[0]?.lng ?? 6.1294;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (Number.isFinite(fallbackLat) && Number.isFinite(fallbackLng)) {
      params.set('lat', String(fallbackLat));
      params.set('lng', String(fallbackLng));
    }

    fetch(`/api/pokedex/species?${params.toString()}`)
      .then((res) => res.json())
      .then((data: { species?: PokedexApiSpecies[] }) => {
        if (!cancelled && Array.isArray(data.species)) {
          setApiSpecies(data.species);
        }
      })
      .catch(() => {
        // Fallback silencieux sur le catalogue alpin + observations réelles du club
      })
      .finally(() => {
        if (!cancelled) setApiLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackLat, fallbackLng]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSearchSpecies([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: trimmed });
      if (Number.isFinite(fallbackLat) && Number.isFinite(fallbackLng)) {
        params.set('lat', String(fallbackLat));
        params.set('lng', String(fallbackLng));
      }
      fetch(`/api/pokedex/species?${params.toString()}`)
        .then((res) => res.json())
        .then((data: { species?: PokedexApiSpecies[] }) => {
          if (!cancelled && Array.isArray(data.species)) {
            setSearchSpecies(data.species);
          }
        })
        .catch(() => {});
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, fallbackLat, fallbackLng]);

  const filteredSightings = useMemo(() => {
    let base = allSightings;
    if (discoveredOnlyForUserId || discoveredOnlyForMemberName) {
      const targetName = normStr(discoveredOnlyForMemberName);
      base = base.filter(
        (s) =>
          (discoveredOnlyForUserId && s.observerId === discoveredOnlyForUserId) ||
          (targetName && normStr(s.observerName) === targetName),
      );
    }
    if (outingFilterId !== 'all') {
      base = base.filter((s) => s.outingId === outingFilterId);
    }
    return base;
  }, [allSightings, discoveredOnlyForMemberName, discoveredOnlyForUserId, outingFilterId]);

  const entries = useMemo<ClubPokedexEntry[]>(() => {
    const usedSightingIds = new Set<string>();
    const byKey = new Map<string, ClubPokedexEntry>();

    const resolveDiscoverers = (matches: ClubMapPokedexItem[]) => {
      const seen = new Set<string>();
      const list: Array<{ userId: string; name: string; avatarUrl: string | null }> = [];
      for (const s of matches) {
        const uid = s.observerId || s.observerName || 'membre';
        if (seen.has(uid)) continue;
        seen.add(uid);
        const member = members.find(
          (m) =>
            (s.observerId && (m.userId === s.observerId || m.id === s.observerId)) ||
            normStr(m.name) === normStr(s.observerName),
        );
        list.push({
          userId: member?.userId || member?.id || uid,
          name: member?.name || s.observerName || 'Membre du club',
          avatarUrl: s.observerAvatarUrl ?? member?.avatarUrl ?? null,
        });
      }
      return list;
    };

    const matchSightings = (name: string, latin: string) => {
      const nName = normStr(name);
      const nLatin = normStr(latin);
      return filteredSightings.filter((s) => {
        const sName = normStr(s.commonName);
        const sLatin = normStr(s.latinName);
        if (nLatin && sLatin && (sLatin === nLatin || sLatin.includes(nLatin) || nLatin.includes(sLatin))) {
          return true;
        }
        if (nName && sName && (sName === nName || sName.includes(nName) || nName.includes(sName))) {
          return true;
        }
        return false;
      });
    };

    // 1. Catalogue iNaturalist de la zone du club (+ recherche)
    for (const sp of [...apiSpecies, ...searchSpecies]) {
      const key = normStr(sp.latin || sp.name);
      if (!key) continue;
      const matches = matchSightings(sp.name, sp.latin);
      for (const m of matches) usedSightingIds.add(m.id);
      const discoverers = resolveDiscoverers(matches);
      const firstPhoto = matches.find((m) => m.imageUrl)?.imageUrl ?? sp.imageUrl;
      byKey.set(key, {
        dexNumber: sp.dexNumber,
        id: `inat-${sp.taxonId}`,
        name: sp.name,
        latin: sp.latin,
        kingdom: sp.kingdom,
        rarity: sp.rarity,
        altitudeRange: activeClub.massif ? `Secteur ${activeClub.massif}` : 'Massif alpin',
        bestTime: 'Observations locales',
        habitat: sp.iconicTaxon,
        description:
          matches.length > 0
            ? `${matches.length} observation${matches.length > 1 ? 's' : ''} du club · ${sp.observationsCount} relevés iNaturalist dans ce massif.`
            : `${sp.observationsCount} observations vérifiées enregistrées dans cette zone sur iNaturalist.`,
        stats: {
          rarete: sp.rarity === 'Mythique' ? 95 : sp.rarity === 'Rare' ? 78 : sp.rarity === 'Peu commun' ? 52 : 28,
          discretion: sp.kingdom === 'faune' ? 68 : 25,
          altitude: 78,
        },
        keywords: /.^/,
        discovered: matches.length > 0,
        discoverers,
        observationsCount: sp.observationsCount,
        wikipediaUrl: sp.wikipediaUrl,
        imageUrl: firstPhoto,
        clubSightings: matches,
      });
    }

    // 2. Catalogue alpin de référence (Bouquetin, Marmotte, Chamois, Gypaète, Edelweiss, Glaciers)
    for (const item of ALPINE_DEX_CATALOG) {
      const key = normStr(item.latin);
      const matches = matchSightings(item.name, item.latin);
      for (const m of matches) usedSightingIds.add(m.id);
      const discoverers = resolveDiscoverers(matches);
      const existing = byKey.get(key);
      if (existing) {
        if (matches.length > 0) {
          existing.discovered = true;
          existing.discoverers = discoverers;
          existing.clubSightings = matches;
          existing.imageUrl = matches.find((m) => m.imageUrl)?.imageUrl ?? existing.imageUrl;
          existing.description = `${item.description} (${matches.length} observation${matches.length > 1 ? 's' : ''} du club).`;
        }
      } else {
        byKey.set(key, {
          ...item,
          discovered: matches.length > 0,
          discoverers,
          wikipediaUrl: matches.find((m) => m.wikipediaUrl)?.wikipediaUrl ?? null,
          imageUrl: matches.find((m) => m.imageUrl)?.imageUrl ?? null,
          clubSightings: matches,
        });
      }
    }

    // 3. Toutes les autres espèces réelles observées par le club (regroupées par espèce)
    const groupedClub = new Map<string, ClubMapPokedexItem[]>();
    for (const s of filteredSightings) {
      if (usedSightingIds.has(s.id)) continue;
      const gKey = normStr(s.latinName || s.commonName);
      if (!gKey) continue;
      const arr = groupedClub.get(gKey) ?? [];
      arr.push(s);
      groupedClub.set(gKey, arr);
    }

    for (const [gKey, group] of groupedClub.entries()) {
      const lead = group[0];
      const confNum = lead.confidence ? parseInt(lead.confidence, 10) : 90;
      const rarity: PokedexRarity =
        /loup|gypaete|tichodrome|lagopede|tetras/i.test(normStr(lead.commonName))
          ? 'Mythique'
          : confNum >= 96 || /aigle|faucon|vautour|mouflon|hermine|martin/i.test(normStr(lead.commonName))
            ? 'Rare'
            : 'Peu commun';
      const discoverers = resolveDiscoverers(group);
      byKey.set(gKey, {
        dexNumber: '#CLB',
        id: `club-${gKey.replace(/[^a-z0-9]+/g, '-')}`,
        name: lead.commonName,
        latin: lead.latinName || 'Faune sauvage alpine',
        kingdom: lead.kingdom || 'faune',
        rarity,
        altitudeRange: activeClub.massif || 'Alpes françaises',
        bestTime: lead.observedAt || 'En sortie club',
        habitat: lead.spot || lead.outingTitle,
        description:
          lead.citation ||
          `Observation réelle enregistrée par ${lead.observerName} lors de la sortie « ${lead.outingTitle} ».`,
        stats: {
          rarete: rarity === 'Mythique' ? 92 : rarity === 'Rare' ? 76 : 54,
          discretion: 70,
          altitude: 82,
        },
        keywords: /.^/,
        discovered: true,
        discoverers,
        observationsCount: group.length,
        wikipediaUrl: group.find((g) => g.wikipediaUrl)?.wikipediaUrl ?? null,
        imageUrl: group.find((g) => g.imageUrl)?.imageUrl ?? null,
        clubSightings: group,
      });
    }

    return Array.from(byKey.values())
      .sort((a, b) => {
        if (b.discovered !== a.discovered) return Number(b.discovered) - Number(a.discovered);
        return b.clubSightings.length - a.clubSightings.length;
      })
      .map((entry, idx) => ({
        ...entry,
        dexNumber: `#${String(idx + 1).padStart(3, '0')}`,
      }));
  }, [activeClub.massif, apiSpecies, filteredSightings, members, searchSpecies]);

  // Deep-link depuis un clic sur une épingle Pokédex de la carte 3D
  useEffect(() => {
    if (!initialPokedexId) return;
    const hit = entries.find((e) => e.clubSightings.some((s) => s.id === initialPokedexId));
    if (hit) {
      setSelectedEntryKey(hit.id);
      return;
    }
    const rawItem = allSightings.find((s) => s.id === initialPokedexId);
    if (rawItem) {
      const byName = entries.find(
        (e) =>
          (rawItem.latinName && normStr(e.latin) === normStr(rawItem.latinName)) ||
          normStr(e.name) === normStr(rawItem.commonName),
      );
      if (byName) setSelectedEntryKey(byName.id);
    }
  }, [allSightings, entries, initialPokedexId]);

  const selectedEntry = useMemo(
    () => (selectedEntryKey ? entries.find((e) => e.id === selectedEntryKey) ?? null : null),
    [entries, selectedEntryKey],
  );

  useEffect(() => {
    onDetailOpenChange?.(Boolean(selectedEntry || createOpen));
  }, [createOpen, onDetailOpenChange, selectedEntry]);

  const discoveredSpeciesForCreate = useMemo<DiscoveredSpeciesItem[]>(
    () =>
      entries
        .filter((e) => e.discovered)
        .map((e) => ({
          id: e.id,
          name: e.name,
          latin: e.latin,
          imageUrl: e.imageUrl ?? null,
          kingdom: e.kingdom,
          rarity: e.rarity,
        })),
    [entries],
  );

  const visibleEntries = useMemo(() => {
    let base = entries;
    if (discoveredOnlyForUserId || discoveredOnlyForMemberName || outingFilterId !== 'all') {
      base = base.filter((e) => e.discovered);
    }
    if (lensId === 'faune') base = base.filter((e) => e.kingdom === 'faune');
    else if (lensId === 'flore') base = base.filter((e) => e.kingdom !== 'faune');
    else if (kingdomFilter !== 'all') base = base.filter((e) => e.kingdom === kingdomFilter);

    const qNorm = normStr(query);
    if (qNorm) {
      base = base.filter(
        (e) =>
          normStr(e.name).includes(qNorm) ||
          normStr(e.latin).includes(qNorm) ||
          e.clubSightings.some(
            (s) => normStr(s.outingTitle).includes(qNorm) || normStr(s.observerName).includes(qNorm),
          ),
      );
    }
    return base;
  }, [
    discoveredOnlyForMemberName,
    discoveredOnlyForUserId,
    entries,
    kingdomFilter,
    lensId,
    outingFilterId,
    query,
  ]);

  const openObserveDrawer = (prefill?: { name: string; latin: string }) => {
    setCreateCaption(prefill?.name ?? '');
    setCreateLatin(prefill?.latin ?? '');
    setCreateNote('');
    setCreateFile(null);
    setCreatePlace(activeClub.massif || activeClub.name);
    if (!createOutingId && outings[0]?.id) setCreateOutingId(outings[0].id);
    setCreateOpen(true);
  };

  const handleSubmitObservation = async () => {
    const cleanName = createCaption.trim();
    if (!cleanName || submitting) return;
    setSubmitting(true);
    try {
      const targetOuting = outings.find((o) => o.id === createOutingId) ?? outings[0];
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/pokedex`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commonName: cleanName,
          latinName: createLatin.trim(),
          kingdom: lensId === 'flore' ? 'flore' : 'faune',
          spot: createPlace.trim(),
          note: createNote.trim(),
          outingId: targetOuting?.id ?? null,
        }),
      });
      const payload = (await res.json().catch(() => null)) as {
        data?: ClubMapPokedexItem;
        error?: string;
      } | null;

      if (!res.ok || !payload?.data) {
        onToast?.({
          title:
            res.status === 401
              ? 'Connexion requise pour enregistrer une espèce'
              : 'Impossible d’enregistrer l’observation',
          subtitle: payload?.error || 'Vérifie ta session et réessaie.',
        });
        setSubmitting(false);
        return;
      }

      const created: ClubMapPokedexItem = {
        ...payload.data,
        outingId: targetOuting?.id ?? payload.data.outingId ?? '',
        outingTitle: targetOuting?.title ?? activeClub.name,
        lat: targetOuting?.lat ?? fallbackLat,
        lng: targetOuting?.lng ?? fallbackLng,
        trackProgress: 0.45,
      };
      setSessionItems((prev) => [created, ...prev]);
      onObservationCreated?.(created);
      setCreateOpen(false);
      onToast?.({
        title: `${cleanName} ajouté au Pokédex du club`,
        subtitle: targetOuting ? `Rattaché à ${targetOuting.title.split('(')[0].trim()}` : undefined,
      });
    } catch {
      onToast?.({ title: 'Erreur réseau lors de l’enregistrement' });
    } finally {
      setSubmitting(false);
    }
  };

  if (createOpen) {
    return (
      <div className="lkdv-carnet-drawer-pane" style={{ paddingBottom: 64 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            marginBottom: 10,
          }}
        >
          <button
            type="button"
            className="lkdv-carnet-comment-del"
            aria-label="Fermer"
            onClick={() => setCreateOpen(false)}
          >
            <X size={14} />
          </button>
        </div>

        {outings.length > 0 ? (
          <div className="lkdv-cv2-field" style={{ marginBottom: 10 }}>
            <label htmlFor="club-pokedex-outing-select" className="lkdv-cv2-field-label">
              Sortie du club associée
            </label>
            <select
              id="club-pokedex-outing-select"
              value={createOutingId}
              onChange={(e) => setCreateOutingId(e.target.value)}
              style={{
                width: '100%',
                height: 36,
                borderRadius: 12,
                border: '1px solid rgba(23, 64, 44, 0.16)',
                background: 'rgba(255, 255, 255, 0.8)',
                padding: '0 10px',
                fontSize: 12.5,
                color: '#17402c',
              }}
            >
              {outings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <CarnetSpeciesCreatePane
          day={1}
          place={createPlace}
          onPlaceChange={setCreatePlace}
          caption={createCaption}
          onCaptionChange={setCreateCaption}
          latin={createLatin}
          onLatinChange={setCreateLatin}
          speciesFile={createFile}
          onSpeciesFileChange={setCreateFile}
          note={createNote}
          onNoteChange={setCreateNote}
          discoveredSpecies={discoveredSpeciesForCreate}
          nearbyLat={fallbackLat}
          nearbyLng={fallbackLng}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button
            type="button"
            className="lkdv-carnet-btn-primary"
            disabled={!createCaption.trim() || submitting}
            onClick={() => {
              void handleSubmitObservation();
            }}
          >
            <Binoculars size={14} aria-hidden="true" />
            <span>{submitting ? 'Enregistrement…' : 'Enregistrer dans le Pokédex'}</span>
          </button>
        </div>
      </div>
    );
  }

  if (selectedEntry) {
    return (
      <ClubPokedexDetailCard
        entry={selectedEntry}
        outings={outings}
        onBack={() => {
          setSelectedEntryKey(null);
          onClearInitialPokedexId?.();
        }}
        onObserveSpecies={(sp) => openObserveDrawer(sp)}
        onFlyToCoords={onFlyToCoords}
        onInspectOuting={onInspectOuting}
      />
    );
  }

  return (
    <div
      className="lkdv-carnet-drawer-pane"
      style={{ paddingBottom: 64 }}
      data-testid="club-pokedex-pane"
    >
      <div className="lkdv-carnet-pokedex-search">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            apiLoading
              ? 'Chargement de la zone alpine…'
              : 'Rechercher une espèce, sortie ou membre…'
          }
          aria-label="Rechercher dans le Pokédex du club"
        />
      </div>

      <StaggerList className="lkdv-carnet-pokedex-grid">
        {visibleEntries.map((entry) => (
          <ClubPokedexHoloCard
            key={entry.id}
            entry={entry}
            onSelect={() => setSelectedEntryKey(entry.id)}
          />
        ))}
      </StaggerList>

      {visibleEntries.length === 0 ? (
        <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--label2, #56665d)', marginTop: 16 }}>
          Aucune espèce trouvée pour ce filtre.
        </p>
      ) : null}
    </div>
  );
}

export default ClubPokedexDrawerBody;
