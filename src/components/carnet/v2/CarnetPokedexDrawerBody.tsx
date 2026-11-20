'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  Binoculars,
  CheckCircle2,
  ExternalLink,
  Feather,
  Flower2,
  Lock,
  MapPin,
  Mountain,
  Search,
  Sparkles,
} from 'lucide-react';
import type { CarnetDetail, CarnetMomentItem } from '@/features/carnet/detail/types';
import type { PokedexApiSpecies } from '@/app/api/pokedex/species/route';
import { AnimatedNumber, CARNET_SPRING, StaggerList } from './CarnetDrawerMotion';

export type PokedexKingdom = 'faune' | 'flore' | 'geologie';
export type PokedexRarity = 'Commun' | 'Peu commun' | 'Rare' | 'Mythique';

export interface PokedexEntry {
  dexNumber: string;
  id: string;
  name: string;
  latin: string;
  kingdom: PokedexKingdom;
  rarity: PokedexRarity;
  altitudeRange: string;
  bestTime: string;
  habitat: string;
  description: string;
  stats: { rarete: number; discretion: number; altitude: number };
  keywords: RegExp;
  discovered: boolean;
  observationsCount?: number;
  wikipediaUrl?: string | null;
  moment?: CarnetMomentItem;
  imageUrl?: string | null;
}

const ALPINE_DEX_CATALOG: Array<Omit<PokedexEntry, 'discovered' | 'moment' | 'imageUrl'>> = [
  {
    dexNumber: '#001',
    id: 'bouquetin',
    name: 'Bouquetin des Alpes',
    latin: 'Capra ibex',
    kingdom: 'faune',
    rarity: 'Peu commun',
    altitudeRange: '1 800 – 3 300 m',
    bestTime: 'Aube & fin d’après-midi',
    habitat: 'Crêtes rocheuses & névés',
    description:
      'Maître incontesté des parois vertigineuses, reconnaissable à ses longues cornes arquées et annelées.',
    stats: { rarete: 55, discretion: 45, altitude: 92 },
    keywords: /bouquetin|capra|ibex|harde/i,
  },
  {
    dexNumber: '#002',
    id: 'marmotte',
    name: 'Marmotte alpine',
    latin: 'Marmota marmota',
    kingdom: 'faune',
    rarity: 'Commun',
    altitudeRange: '1 400 – 2 800 m',
    bestTime: 'Matinée ensoleillée',
    habitat: 'Alpages & éboulis',
    description:
      'Sentinelle des alpages dont le sifflement strident prévient toute la colonie à l’approche d’un rapace.',
    stats: { rarete: 25, discretion: 35, altitude: 68 },
    keywords: /marmotte|marmota/i,
  },
  {
    dexNumber: '#003',
    id: 'chamois',
    name: 'Chamois des Alpes',
    latin: 'Rupicapra rupicapra',
    kingdom: 'faune',
    rarity: 'Peu commun',
    altitudeRange: '1 200 – 3 000 m',
    bestTime: 'Tôt le matin',
    habitat: 'Pentes raides & combes',
    description:
      'Agile et rapide sur les pentes enneigées grâce à ses sabots élastiques fendus.',
    stats: { rarete: 48, discretion: 75, altitude: 82 },
    keywords: /chamois|rupicapra/i,
  },
  {
    dexNumber: '#004',
    id: 'gypaete',
    name: 'Gypaète barbu',
    latin: 'Gypaetus barbatus',
    kingdom: 'faune',
    rarity: 'Mythique',
    altitudeRange: '1 500 – 3 800 m',
    bestTime: 'Thermiques de mi-journée',
    habitat: 'Hautes falaises alpines',
    description:
      'Plus grand rapace d’Europe (2,8 m d’envergure). Silhouette en losange et plumage orangé.',
    stats: { rarete: 96, discretion: 80, altitude: 98 },
    keywords: /gypaète|gypaete|rapace|vautour/i,
  },
  {
    dexNumber: '#005',
    id: 'edelweiss',
    name: 'Edelweiss',
    latin: 'Leontopodium nivale',
    kingdom: 'flore',
    rarity: 'Rare',
    altitudeRange: '1 800 – 3 000 m',
    bestTime: 'Juin – Août',
    habitat: 'Pelouses calcaires exposées',
    description:
      'Étoile d’argent laineuse protégée contre le gel et les UV d’altitude.',
    stats: { rarete: 82, discretion: 65, altitude: 84 },
    keywords: /edelweiss|leontopodium/i,
  },
  {
    dexNumber: '#006',
    id: 'glacier',
    name: 'Glacier & Séracs',
    latin: 'Cryosphère alpine',
    kingdom: 'geologie',
    rarity: 'Peu commun',
    altitudeRange: '2 200 – 4 800 m',
    bestTime: 'Toute la journée',
    habitat: 'Haute montagne',
    description:
      'Géants de glace sculptant les vallées et alimentant les torrents glaciaires.',
    stats: { rarete: 52, discretion: 10, altitude: 96 },
    keywords: /glacier|névé|neve|serac|sérac|pyramide/i,
  },
];

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

/**
 * Carte Pokédex 3D Tilt + Spotlight + Shimmer holographique (inspirée Aceternity 3D Card / Magic UI).
 */
function PokedexHoloCard({
  entry,
  onSelect,
}: {
  entry: PokedexEntry;
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
        {entry.discovered ? (
          <CheckCircle2 size={14} color="#1b4332" aria-label="Découvert" />
        ) : (
          <Lock size={12} color="#6b7280" aria-label="Non découvert" />
        )}
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
          {entry.observationsCount ? (
            <span className="lkdv-carnet-pokedex-obs">{entry.observationsCount} obs.</span>
          ) : null}
        </div>
      </div>
    </motion.button>
  );
}

interface CarnetPokedexDrawerBodyProps {
  detail: CarnetDetail;
  lensId: string;
  onObserveSpecies?: (species: { name: string; latin: string }) => void;
}

export function CarnetPokedexDrawerBody({
  detail,
  lensId,
  onObserveSpecies,
}: CarnetPokedexDrawerBodyProps) {
  const [kingdomFilter, setKingdomFilter] = useState<'all' | PokedexKingdom>('all');
  const [query, setQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<PokedexEntry | null>(null);
  const [apiSpecies, setApiSpecies] = useState<PokedexApiSpecies[]>([]);
  const [totalInZone, setTotalInZone] = useState<number | null>(null);
  const [searchSpecies, setSearchSpecies] = useState<PokedexApiSpecies[]>([]);
  const [apiLoading, setApiLoading] = useState(true);

  const fallbackLat = detail.place?.lat ?? detail.nights?.[0]?.lat ?? null;
  const fallbackLng = detail.place?.lng ?? detail.nights?.[0]?.lng ?? null;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (
      typeof fallbackLat === 'number' &&
      typeof fallbackLng === 'number' &&
      Number.isFinite(fallbackLat) &&
      Number.isFinite(fallbackLng)
    ) {
      params.set('lat', String(fallbackLat));
      params.set('lng', String(fallbackLng));
    }

    fetch(`/api/pokedex/species?${params.toString()}`)
      .then((res) => res.json())
      .then((data: { species?: PokedexApiSpecies[]; totalResults?: number }) => {
        if (!cancelled && Array.isArray(data.species)) {
          setApiSpecies(data.species);
          if (typeof data.totalResults === 'number' && data.totalResults > 0) {
            setTotalInZone(data.totalResults);
          }
        }
      })
      .catch(() => {
        // Fallback silencieux sur le catalogue alpin local
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
      if (
        typeof fallbackLat === 'number' &&
        typeof fallbackLng === 'number' &&
        Number.isFinite(fallbackLat) &&
        Number.isFinite(fallbackLng)
      ) {
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

  const entries = useMemo<PokedexEntry[]>(() => {
    const natureMoments = detail.moments.filter(
      (m) =>
        m.source?.toLowerCase().includes('nature') ||
        m.source?.toLowerCase().includes('species') ||
        ALPINE_DEX_CATALOG.some((cat) =>
          cat.keywords.test(`${m.quote ?? ''} ${m.place ?? ''}`),
        ),
    );

    const usedMomentIds = new Set<string>();
    const byLatin = new Map<string, PokedexEntry>();

    // 1. Espèces locales réelles depuis iNaturalist (+ résultats de recherche)
    for (const sp of [...apiSpecies, ...searchSpecies]) {
      const escapedLatin = sp.latin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedName = sp.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const kw = new RegExp(`${escapedName}|${escapedLatin}`, 'i');
      const match = natureMoments.find((m) => kw.test(`${m.quote ?? ''} ${m.place ?? ''}`));
      if (match) usedMomentIds.add(match.id);

      byLatin.set(sp.latin.toLowerCase(), {
        dexNumber: sp.dexNumber,
        id: `inat-${sp.taxonId}`,
        name: sp.name,
        latin: sp.latin,
        kingdom: sp.kingdom,
        rarity: sp.rarity,
        altitudeRange: detail.place?.locality ? `Secteur ${detail.place.locality}` : 'Massif local',
        bestTime: 'Observations locales',
        habitat: sp.iconicTaxon,
        description: `${sp.observationsCount} observations vérifiées enregistrées dans cette zone sur iNaturalist.`,
        stats: {
          rarete: sp.rarity === 'Mythique' ? 95 : sp.rarity === 'Rare' ? 78 : sp.rarity === 'Peu commun' ? 52 : 28,
          discretion: sp.kingdom === 'faune' ? 68 : 25,
          altitude: 75,
        },
        keywords: kw,
        discovered: Boolean(match),
        observationsCount: sp.observationsCount,
        wikipediaUrl: sp.wikipediaUrl,
        moment: match,
        imageUrl: match?.imageUrl ?? sp.imageUrl,
      });
    }

    // 2. Catalogue alpin de référence (complète si absent d'iNaturalist)
    for (const item of ALPINE_DEX_CATALOG) {
      const key = item.latin.toLowerCase();
      const match = natureMoments.find((m) =>
        item.keywords.test(`${m.quote ?? ''} ${m.place ?? ''}`),
      );
      if (match) usedMomentIds.add(match.id);

      const existing = byLatin.get(key);
      if (existing) {
        if (match && !existing.discovered) {
          existing.discovered = true;
          existing.moment = match;
          existing.imageUrl = match.imageUrl ?? existing.imageUrl;
        }
      } else {
        byLatin.set(key, {
          ...item,
          discovered: Boolean(match),
          moment: match,
          imageUrl: match?.imageUrl ?? null,
        });
      }
    }

    // 3. Découvertes terrain supplémentaires du carnet
    let customIdx = byLatin.size;
    for (const m of natureMoments) {
      if (usedMomentIds.has(m.id)) continue;
      customIdx += 1;
      byLatin.set(`custom-${m.id}`, {
        dexNumber: `#${String(customIdx).padStart(3, '0')}`,
        id: `custom-${m.id}`,
        name: m.place?.trim() || 'Observation terrain',
        latin: 'Spécimen du carnet',
        kingdom: 'faune',
        rarity: 'Peu commun',
        altitudeRange: 'En chemin',
        bestTime: m.time || 'Journée',
        habitat: m.place || 'Milieu naturel',
        description: m.quote || 'Observation naturelle enregistrée pendant la sortie.',
        stats: { rarete: 60, discretion: 50, altitude: 75 },
        keywords: /.^/,
        discovered: true,
        moment: m,
        imageUrl: m.imageUrl ?? null,
      });
    }

    return Array.from(byLatin.values())
      .sort((a, b) => Number(b.discovered) - Number(a.discovered))
      .map((entry, idx) => ({
        ...entry,
        dexNumber: `#${String(idx + 1).padStart(3, '0')}`,
      }));
  }, [apiSpecies, searchSpecies, detail.moments, detail.place?.locality]);

  const discoveredCount = useMemo(
    () => entries.filter((e) => e.discovered).length,
    [entries],
  );
  const zoneTotal = totalInZone ?? entries.length;
  const progressPct = Math.min(
    100,
    Math.max(discoveredCount > 0 ? 4 : 0, Math.round((discoveredCount / Math.max(1, zoneTotal)) * 100)),
  );

  const visibleEntries = useMemo(() => {
    let base = entries;
    if (lensId === 'faune') base = base.filter((e) => e.kingdom === 'faune');
    else if (lensId === 'flore') base = base.filter((e) => e.kingdom !== 'faune');
    else if (kingdomFilter !== 'all') base = base.filter((e) => e.kingdom === kingdomFilter);

    const qNorm = query.trim().toLowerCase();
    if (qNorm) {
      base = base.filter(
        (e) =>
          e.name.toLowerCase().includes(qNorm) ||
          e.latin.toLowerCase().includes(qNorm),
      );
    }
    return base;
  }, [entries, lensId, kingdomFilter, query]);

  if (selectedEntry) {
    const rStyle = RARITY_STYLES[selectedEntry.rarity];
    return (
      <motion.div
        key={selectedEntry.id}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={CARNET_SPRING}
        className="lkdv-carnet-pokedex-detail"
      >
        <button
          type="button"
          className="lkdv-carnet-pokedex-back"
          onClick={() => setSelectedEntry(null)}
        >
          ← Retour au Pokédex
        </button>

        <div className="lkdv-carnet-pokedex-hero" style={{ borderColor: rStyle.border }}>
          <div className="lkdv-carnet-pokedex-hero-top">
            <span className="lkdv-carnet-pokedex-num">{selectedEntry.dexNumber}</span>
            <span
              className="lkdv-carnet-pokedex-rarity"
              style={{ background: rStyle.bg, color: rStyle.color }}
            >
              <Sparkles size={10} /> {selectedEntry.rarity}
            </span>
          </div>

          {selectedEntry.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selectedEntry.imageUrl}
              alt={selectedEntry.name}
              className={`lkdv-carnet-pokedex-hero-img${
                !selectedEntry.discovered ? ' is-silhouette-photo' : ''
              }`}
            />
          ) : (
            <div className="lkdv-carnet-pokedex-silhouette">
              {selectedEntry.discovered ? (
                kingdomIcon(selectedEntry.kingdom, 36)
              ) : (
                <Lock size={28} />
              )}
              <span>
                {selectedEntry.discovered ? 'Observé sans photo' : 'Espèce non encore repérée'}
              </span>
            </div>
          )}

          <div className="lkdv-carnet-pokedex-title">
            <b>{selectedEntry.name}</b>
            <i>{selectedEntry.latin}</i>
          </div>
          <p className="lkdv-carnet-pokedex-desc">{selectedEntry.description}</p>

          {selectedEntry.wikipediaUrl ? (
            <a
              href={selectedEntry.wikipediaUrl}
              target="_blank"
              rel="noreferrer"
              className="lkdv-carnet-pokedex-wiki"
            >
              <span>Fiche encyclopédique</span>
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          ) : null}

          {!selectedEntry.discovered && onObserveSpecies ? (
            <button
              type="button"
              className="lkdv-carnet-btn-primary"
              style={{ alignSelf: 'flex-start', marginTop: 2 }}
              onClick={() =>
                onObserveSpecies({ name: selectedEntry.name, latin: selectedEntry.latin })
              }
            >
              <Binoculars size={14} aria-hidden="true" />
              <span>J’ai observé cette espèce</span>
            </button>
          ) : null}
        </div>

        <div className="lkdv-carnet-kpi-grid-3">
          <div className="lkdv-carnet-kpi-mini">
            <small>Zone</small>
            <b style={{ fontSize: 11.5 }}>{selectedEntry.altitudeRange}</b>
          </div>
          <div className="lkdv-carnet-kpi-mini">
            <small>Taxon</small>
            <b style={{ fontSize: 11.5 }}>{selectedEntry.habitat}</b>
          </div>
          <div className="lkdv-carnet-kpi-mini">
            <small>Observations</small>
            <b style={{ fontSize: 12 }}>
              {selectedEntry.observationsCount ? (
                <AnimatedNumber value={selectedEntry.observationsCount} />
              ) : (
                selectedEntry.bestTime
              )}
            </b>
          </div>
        </div>

        <div className="lkdv-carnet-chart-card">
          <span className="lkdv-carnet-kit-eyebrow">Indice d’observation</span>
          <div className="lkdv-carnet-kit-bars">
            {(
              [
                ['Rareté', selectedEntry.stats.rarete, '#7e22ce'],
                ['Discrétion', selectedEntry.stats.discretion, '#1d4ed8'],
                ['Altitude', selectedEntry.stats.altitude, '#1b4332'],
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

        {selectedEntry.moment ? (
          <div className="lkdv-carnet-pokedex-fieldnote">
            <div className="lkdv-carnet-timeline-meta">
              <span className="lkdv-carnet-chip-dark">
                Observé · J{selectedEntry.moment.dayNumber}
              </span>
              {selectedEntry.moment.place ? (
                <span className="lkdv-carnet-chip-place">
                  <MapPin size={10} /> {selectedEntry.moment.place}
                </span>
              ) : null}
            </div>
            {selectedEntry.moment.quote ? <p>« {selectedEntry.moment.quote} »</p> : null}
          </div>
        ) : null}
      </motion.div>
    );
  }

  return (
    <div className="lkdv-carnet-drawer-pane" style={{ paddingBottom: '64px' }}>
      <div className="lkdv-carnet-pokedex-search">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            apiLoading
              ? 'Chargement de la zone…'
              : 'Rechercher une espèce (ex. Bouquetin, Chamois…)'
          }
          aria-label="Rechercher une espèce"
        />
      </div>

      {lensId === 'pokedex' ? (
        <div className="lkdv-carnet-filter-rail" role="tablist" aria-label="Filtrer par règne">
          {(
            [
              ['all', 'Tout'],
              ['faune', 'Faune'],
              ['flore', 'Flore'],
              ['geologie', 'Milieux'],
            ] as const
          ).map(([val, label]) => {
            const active = kingdomFilter === val;
            return (
              <button
                key={val}
                type="button"
                role="tab"
                aria-selected={active}
                className={`lkdv-carnet-filter-pill${active ? ' is-active' : ''}`}
                onClick={() => setKingdomFilter(val)}
              >
                {active ? (
                  <motion.span
                    layoutId="carnet-pokedex-kingdom-pill"
                    className="lkdv-carnet-filter-pill-bg"
                    transition={CARNET_SPRING}
                  />
                ) : null}
                <span className="lkdv-carnet-filter-pill-label">{label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <StaggerList className="lkdv-carnet-pokedex-grid">
        {visibleEntries.map((entry) => (
          <PokedexHoloCard
            key={entry.id}
            entry={entry}
            onSelect={() => setSelectedEntry(entry)}
          />
        ))}
      </StaggerList>

      <div
        className="lkdv-carnet-pokedex-floating-bar"
        aria-label={`${discoveredCount} espèces trouvées sur ${zoneTotal} présentes dans la zone`}
      >
        <div className="lkdv-carnet-pokedex-floating-track">
          <motion.div
            className="lkdv-carnet-pokedex-floating-fill"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={CARNET_SPRING}
          />
        </div>
        <span className="lkdv-carnet-pokedex-floating-count">
          <AnimatedNumber value={discoveredCount} /> / <AnimatedNumber value={zoneTotal} />
        </span>
      </div>
    </div>
  );
}
