'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Binoculars,
  CheckCircle2,
  Compass,
  Feather,
  Flower2,
  Lock,
  MapPin,
  Mountain,
  Sparkles,
} from 'lucide-react';
import type { CarnetDetail, CarnetMomentItem } from '@/features/carnet/detail/types';
import { AnimatedNumber, CARNET_SPRING, StaggerCard, StaggerList } from './CarnetDrawerMotion';

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
    id: 'aigle',
    name: 'Aigle royal',
    latin: 'Aquila chrysaetos',
    kingdom: 'faune',
    rarity: 'Rare',
    altitudeRange: '1 200 – 3 500 m',
    bestTime: '10 h – 16 h',
    habitat: 'Crêtes & vallons ouverts',
    description:
      'Plane sans effort le long des crêtes pour scruter marmottes et lagopèdes.',
    stats: { rarete: 78, discretion: 70, altitude: 90 },
    keywords: /aigle|aquila/i,
  },
  {
    dexNumber: '#006',
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
    dexNumber: '#007',
    id: 'gentiane',
    name: 'Gentiane acaule',
    latin: 'Gentiana acaulis',
    kingdom: 'flore',
    rarity: 'Commun',
    altitudeRange: '1 200 – 2 700 m',
    bestTime: 'Mai – Juillet',
    habitat: 'Prairies subalpines',
    description:
      'Trompette d’un bleu cobalt électrique qui s’ouvre face au soleil.',
    stats: { rarete: 30, discretion: 20, altitude: 65 },
    keywords: /gentiane|fleur|flore/i,
  },
  {
    dexNumber: '#008',
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
  {
    dexNumber: '#009',
    id: 'lac-glaciaire',
    name: 'Lac d’altitude',
    latin: 'Milieu lacustre alpin',
    kingdom: 'geologie',
    rarity: 'Commun',
    altitudeRange: '1 700 – 2 800 m',
    bestTime: 'Lever du jour (miroir)',
    habitat: 'Cuvettes morainiques',
    description:
      'Eaux turquoise ou miroir parfait reflétant les sommets sans un souffle de vent.',
    stats: { rarete: 40, discretion: 15, altitude: 76 },
    keywords: /lac|combal|chécrouit|checrouit|miroir/i,
  },
  {
    dexNumber: '#010',
    id: 'col-alpin',
    name: 'Col d’altitude',
    latin: 'Passage de crête > 2300 m',
    kingdom: 'geologie',
    rarity: 'Peu commun',
    altitudeRange: '2 300 – 3 000 m',
    bestTime: 'Matinée',
    habitat: 'Ligne de partage des eaux',
    description:
      'Fenêtre minérale reliant deux vallées et offrant une bascule panoramique.',
    stats: { rarete: 45, discretion: 10, altitude: 88 },
    keywords: /col\s|bonhomme|seigne|croix/i,
  },
];

const RARITY_STYLES: Record<PokedexRarity, { bg: string; color: string; border: string }> = {
  Commun: { bg: 'rgba(27, 67, 50, 0.1)', color: '#1b4332', border: 'rgba(27, 67, 50, 0.16)' },
  'Peu commun': { bg: 'rgba(37, 99, 235, 0.1)', color: '#1d4ed8', border: 'rgba(37, 99, 235, 0.24)' },
  Rare: { bg: 'rgba(180, 83, 9, 0.12)', color: '#b45309', border: 'rgba(217, 119, 6, 0.3)' },
  Mythique: {
    bg: 'linear-gradient(135deg, rgba(217, 119, 6, 0.18), rgba(147, 51, 234, 0.16))',
    color: '#7e22ce',
    border: 'rgba(147, 51, 234, 0.35)',
  },
};

function kingdomIcon(kingdom: PokedexKingdom, size = 12) {
  if (kingdom === 'faune') return <Feather size={size} aria-hidden="true" />;
  if (kingdom === 'flore') return <Flower2 size={size} aria-hidden="true" />;
  return <Mountain size={size} aria-hidden="true" />;
}

interface CarnetPokedexDrawerBodyProps {
  detail: CarnetDetail;
  lensId: string;
}

export function CarnetPokedexDrawerBody({ detail, lensId }: CarnetPokedexDrawerBodyProps) {
  const [kingdomFilter, setKingdomFilter] = useState<'all' | PokedexKingdom>('all');
  const [selectedEntry, setSelectedEntry] = useState<PokedexEntry | null>(null);

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
    const catalogEntries: PokedexEntry[] = ALPINE_DEX_CATALOG.map((item) => {
      const match = natureMoments.find((m) =>
        item.keywords.test(`${m.quote ?? ''} ${m.place ?? ''}`),
      );
      if (match) usedMomentIds.add(match.id);
      return {
        ...item,
        discovered: Boolean(match),
        moment: match,
        imageUrl: match?.imageUrl ?? null,
      };
    });

    // Add any extra nature moments not matched by catalog as custom field discoveries
    const extras: PokedexEntry[] = natureMoments
      .filter((m) => !usedMomentIds.has(m.id))
      .map((m, idx) => ({
        dexNumber: `#${String(catalogEntries.length + idx + 1).padStart(3, '0')}`,
        id: `custom-${m.id}`,
        name: m.place?.trim() || 'Observation terrain',
        latin: 'Spécimen du carnet',
        kingdom: 'faune',
        rarity: 'Peu commun',
        altitudeRange: 'En chemin',
        bestTime: m.time || 'Journée',
        habitat: m.place || 'Milieu alpin',
        description: m.quote || 'Observation naturelle enregistrée pendant la sortie.',
        stats: { rarete: 60, discretion: 50, altitude: 75 },
        keywords: /.^/,
        discovered: true,
        moment: m,
        imageUrl: m.imageUrl ?? null,
      }));

    const merged = [...catalogEntries, ...extras];
    return merged.sort((a, b) => Number(b.discovered) - Number(a.discovered));
  }, [detail.moments]);

  const discoveredCount = useMemo(
    () => entries.filter((e) => e.discovered).length,
    [entries],
  );
  const progressPct = Math.round((discoveredCount / Math.max(1, entries.length)) * 100);
  const rankLabel =
    discoveredCount >= 7
      ? 'Naturaliste Alpin'
      : discoveredCount >= 4
        ? 'Pisteur Confirmé'
        : discoveredCount >= 1
          ? 'Explorateur Curieux'
          : 'Apprenti';

  const visibleEntries = useMemo(() => {
    let base = entries;
    if (lensId === 'faune') base = entries.filter((e) => e.kingdom === 'faune');
    else if (lensId === 'flore') base = entries.filter((e) => e.kingdom !== 'faune');
    else if (kingdomFilter !== 'all') base = entries.filter((e) => e.kingdom === kingdomFilter);
    return base;
  }, [entries, lensId, kingdomFilter]);

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

          {selectedEntry.discovered && selectedEntry.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selectedEntry.imageUrl}
              alt={selectedEntry.name}
              className="lkdv-carnet-pokedex-hero-img"
            />
          ) : (
            <div className="lkdv-carnet-pokedex-silhouette">
              {selectedEntry.discovered ? (
                kingdomIcon(selectedEntry.kingdom, 36)
              ) : (
                <Lock size={28} />
              )}
              <span>{selectedEntry.discovered ? 'Observé sans photo' : 'Espèce non encore repérée'}</span>
            </div>
          )}

          <div className="lkdv-carnet-pokedex-title">
            <b>{selectedEntry.name}</b>
            <i>{selectedEntry.latin}</i>
          </div>
          <p className="lkdv-carnet-pokedex-desc">{selectedEntry.description}</p>
        </div>

        <div className="lkdv-carnet-kpi-grid-3">
          <div className="lkdv-carnet-kpi-mini">
            <small>Altitude</small>
            <b style={{ fontSize: 12 }}>{selectedEntry.altitudeRange}</b>
          </div>
          <div className="lkdv-carnet-kpi-mini">
            <small>Habitat</small>
            <b style={{ fontSize: 12 }}>{selectedEntry.habitat}</b>
          </div>
          <div className="lkdv-carnet-kpi-mini">
            <small>Créneau</small>
            <b style={{ fontSize: 12 }}>{selectedEntry.bestTime}</b>
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
              <span className="lkdv-carnet-chip-dark">Observé · J{selectedEntry.moment.dayNumber}</span>
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
    <div className="lkdv-carnet-drawer-pane">
      <div className="lkdv-carnet-pokedex-banner">
        <div className="lkdv-carnet-pokedex-banner-top">
          <div className="lkdv-carnet-pokedex-rank">
            <Binoculars size={15} aria-hidden="true" />
            <span>{rankLabel}</span>
          </div>
          <b className="lkdv-carnet-pokedex-score">
            <AnimatedNumber value={discoveredCount} /> / {entries.length}
          </b>
        </div>
        <div className="lkdv-carnet-pokedex-progress-track">
          <motion.div
            className="lkdv-carnet-pokedex-progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={CARNET_SPRING}
          />
        </div>
        <small>
          Pokédex de la nature · {progressPct} % du massif répertorié dans ce carnet
        </small>
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
        {visibleEntries.map((entry) => {
          const rStyle = RARITY_STYLES[entry.rarity];
          return (
            <StaggerCard
              key={entry.id}
              asButton
              className={`lkdv-carnet-pokedex-card${entry.discovered ? ' is-discovered' : ' is-locked'}`}
              style={{ borderColor: entry.discovered ? rStyle.border : undefined }}
              onClick={() => setSelectedEntry(entry)}
            >
              <div className="lkdv-carnet-pokedex-card-head">
                <span className="lkdv-carnet-pokedex-num">{entry.dexNumber}</span>
                {entry.discovered ? (
                  <CheckCircle2 size={14} color="#1b4332" aria-label="Découvert" />
                ) : (
                  <Lock size={12} color="#6b7280" aria-label="Non découvert" />
                )}
              </div>

              <div className="lkdv-carnet-pokedex-thumb">
                {entry.discovered && entry.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.imageUrl} alt={entry.name} loading="lazy" />
                ) : (
                  <span className="lkdv-carnet-pokedex-thumb-icon">
                    {kingdomIcon(entry.kingdom, 22)}
                  </span>
                )}
              </div>

              <div className="lkdv-carnet-pokedex-card-body">
                <b>{entry.discovered ? entry.name : `${entry.name}`}</b>
                <small>{entry.latin}</small>
                <span
                  className="lkdv-carnet-pokedex-rarity"
                  style={{ background: rStyle.bg, color: rStyle.color }}
                >
                  {entry.rarity}
                </span>
              </div>
            </StaggerCard>
          );
        })}
      </StaggerList>
    </div>
  );
}
