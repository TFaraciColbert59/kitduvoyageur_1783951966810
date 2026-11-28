'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Play, Search, X } from 'lucide-react';
import { StackSlideView } from '@/components/carnet/v2/CarnetDrawerMotion';
import {
  listActivityProfiles,
  listSportFamilies,
  resolveActivityProfile,
} from '../specs/resolveActivityProfile';
import type { ActivityProfileSpec, SportFamilyId } from '../specs/activityProfileSpec.types';
import type { Sport, SportMetricKey, SportSelection } from '../state/types';
import { getProfileSubtitleFr, renderSportIcon } from './primitives/IosGlassControls';
import '@/styles/explorer-hud-extremes.css';

export interface ExplorerSportLaunchSheetProps {
  gpsReady?: boolean;
  activeRouteName?: string | null;
  lastUsedSlug?: string | null;
  favoriteSlugs?: readonly string[];
  onSelectSport: (sport: Sport, selection?: SportSelection) => void;
  onClose: () => void;
}

const DEFAULT_PINNED_FAVORITES = [
  'hiking',
  'trail_running',
  'road_cycling',
  'walking',
  'running',
  'mtb_xc',
] as const;

function toLegacySelection(profile: ActivityProfileSpec): SportSelection {
  const metrics: SportMetricKey[] =
    profile.algorithms.primarySpeedUnit === 'min_per_km'
      ? ['distance', 'duration', 'elevation', 'pace']
      : profile.algorithms.primarySpeedUnit === 'km_per_h'
        ? ['distance', 'duration', 'elevation', 'speed']
        : ['distance', 'duration', 'elevation'];
  return {
    sport: profile.identity.legacySport,
    variantId: profile.identity.legacyVariantId,
    variantLabel: profile.identity.shortLabelFr,
    catalogSlug: profile.identity.slugId,
    environment: profile.identity.environment === 'indoor' ? 'indoor' : 'outdoor',
    metrics,
  };
}

/**
 * Lanceur d'activité Liquid Glass : accès direct à la liste complète des 49 sports
 * (Hero 1-tap + recherche instantanée + filtres par famille + grille 2 colonnes).
 */
export function ExplorerSportLaunchSheet({
  gpsReady = false,
  activeRouteName = null,
  lastUsedSlug = null,
  favoriteSlugs,
  onSelectSport,
  onClose,
}: ExplorerSportLaunchSheetProps) {
  const [selectedFamily, setSelectedFamily] = useState<SportFamilyId | 'all'>('all');
  const [search, setSearch] = useState('');

  const heroProfile = useMemo(
    () => resolveActivityProfile(lastUsedSlug ?? 'hiking'),
    [lastUsedSlug],
  );

  const families = useMemo(() => listSportFamilies(), []);
  const allProfiles = useMemo(() => listActivityProfiles(), []);

  const pinnedOrder = useMemo(() => {
    const slugs =
      favoriteSlugs && favoriteSlugs.length > 0 ? favoriteSlugs : DEFAULT_PINNED_FAVORITES;
    return new Map<string, number>(slugs.map((slug, idx) => [slug, idx]));
  }, [favoriteSlugs]);

  const visibleProfiles = useMemo(() => {
    const base =
      selectedFamily === 'all'
        ? allProfiles
        : allProfiles.filter((p) => p.identity.familyId === selectedFamily);

    const q = search.trim().toLowerCase();
    const filtered = q
      ? base.filter((p) => {
          const hay = [
            p.identity.labelFr,
            p.identity.shortLabelFr,
            p.identity.slugId.replace(/_/g, ' '),
            getProfileSubtitleFr(p),
          ]
            .join(' ')
            .toLowerCase();
          return hay.includes(q);
        })
      : base;

    if (selectedFamily !== 'all' || q) return filtered;

    // En vue « Toutes », remonter les favoris en tête de grille puis le reste du catalogue
    return [...filtered].sort((a, b) => {
      const rankA = pinnedOrder.get(a.identity.slugId) ?? 999;
      const rankB = pinnedOrder.get(b.identity.slugId) ?? 999;
      return rankA - rankB;
    });
  }, [allProfiles, selectedFamily, search, pinnedOrder]);

  const handlePick = (profile: ActivityProfileSpec) => {
    onSelectSport(profile.identity.legacySport, toLegacySelection(profile));
  };

  return (
    <StackSlideView stackKey="sport-launch">
      <div
        className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
        data-testid="xp20-sport-launch-sheet"
      >
        {/* Header Liquid Glass */}
        <div
          className="sticky top-0 z-10 flex items-center gap-2.5 px-3.5 pb-2.5 pt-1.5"
          style={{
            background: '#FAF9F5',
            borderBottom: '0.5px solid rgba(23, 64, 44, 0.08)',
          }}
        >
          <button
            type="button"
            className="xp20-close-pill xp20-tactile"
            onClick={onClose}
            aria-label="Fermer le lanceur d'activité"
            style={{ minWidth: 38, minHeight: 38 }}
          >
            <X size={16} aria-hidden="true" />
          </button>

          <div className="min-w-0 flex-1">
            <strong
              className="block text-[16px] font-extrabold leading-tight tracking-tight"
              style={{ color: '#172B24' }}
            >
              Démarrer une activité
            </strong>
            <span
              className="mt-0.5 block truncate text-[11.5px] font-medium"
              style={{ color: '#56665D' }}
            >
              {activeRouteName
                ? activeRouteName
                : `${allProfiles.length} activités disponibles · 1 tap pour démarrer`}
            </span>
          </div>

          <span
            aria-label={gpsReady ? 'GPS prêt' : 'GPS en recherche'}
            style={{
              height: 28,
              padding: '0 10px',
              borderRadius: 999,
              background: gpsReady ? 'rgba(46, 125, 79, 0.14)' : 'rgba(23, 64, 44, 0.07)',
              color: gpsReady ? '#17402C' : '#56665D',
              fontSize: 11,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
            }}
          >
            <span
              className="xp20-pulse-dot"
              aria-hidden="true"
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: gpsReady ? '#2E7D4F' : '#B98A2E',
                color: gpsReady ? '#2E7D4F' : '#B98A2E',
              }}
            />
            GPS
          </span>
        </div>

        {/* Corps scrollable avec Hero + Recherche + Familles + Liste complète directe */}
        <div
          className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3.5 py-3"
          style={{
            paddingBottom: 'calc(var(--safe-bottom, 0px) + 28px)',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
          }}
        >
          {/* Carte Héro compacte 1-tap Dernier Sport */}
          {!search.trim() ? (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.75 }}
              style={{
                borderRadius: 22,
                padding: '11px 13px',
                background:
                  'linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(244, 248, 243, 0.92))',
                border: '0.5px solid rgba(23, 64, 44, 0.13)',
                boxShadow:
                  'inset 0 1px 0 rgba(255, 255, 255, 0.96), 0 6px 18px rgba(16, 32, 25, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden="true"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    background: `${heroProfile.identity.accentHex}1A`,
                    color: heroProfile.identity.accentHex,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  {renderSportIcon(heroProfile.identity.familyId, heroProfile.identity.slugId, 19)}
                </span>
                <div className="min-w-0">
                  <span
                    className="block text-[10.5px] font-bold uppercase tracking-wider"
                    style={{ color: '#56665D' }}
                  >
                    {lastUsedSlug ? 'Dernier sport' : 'Recommandé'}
                  </span>
                  <strong
                    className="block truncate text-[15px] font-extrabold tracking-tight"
                    style={{ color: '#172B24' }}
                  >
                    {heroProfile.identity.labelFr}
                  </strong>
                  <span className="block text-[11px] font-semibold" style={{ color: '#56665D' }}>
                    {getProfileSubtitleFr(heroProfile)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="xp20-tactile"
                onClick={() => handlePick(heroProfile)}
                style={{
                  height: 40,
                  padding: '0 15px',
                  borderRadius: 999,
                  border: 0,
                  background: 'linear-gradient(180deg, #1f543a, #17402c)',
                  color: '#FBFAF6',
                  fontSize: 13,
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: '0 6px 16px rgba(23, 64, 44, 0.24)',
                }}
              >
                <Play size={13} fill="currentColor" aria-hidden="true" />
                <span>Lancer</span>
              </button>
            </motion.div>
          ) : null}

          {/* Barre de recherche instantanée directe */}
          <div
            className="flex items-center gap-2 px-3"
            style={{
              minHeight: 42,
              borderRadius: 15,
              background: '#FFFFFF',
              border: '0.5px solid rgba(23, 64, 44, 0.14)',
              boxShadow: 'inset 0 1px 2px rgba(16, 32, 25, 0.04)',
              flexShrink: 0,
            }}
          >
            <Search size={15} aria-hidden="true" style={{ color: '#56665D', flexShrink: 0 }} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher : trail, vélo, ski, natation, muscu…"
              aria-label="Rechercher une activité"
              className="w-full bg-transparent text-[13.5px] font-medium outline-none"
              style={{ color: '#172B24' }}
            />
            {search ? (
              <button
                type="button"
                className="xp20-tactile"
                onClick={() => setSearch('')}
                aria-label="Effacer la recherche"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  background: 'rgba(23, 64, 44, 0.08)',
                  color: '#172B24',
                  display: 'grid',
                  placeItems: 'center',
                  border: 0,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <X size={13} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {/* Capsules de familles horizontales tactiles */}
          <div
            className="flex gap-1.5 overflow-x-auto pb-0.5"
            style={{ scrollbarWidth: 'none', flexShrink: 0 }}
            role="tablist"
            aria-label="Familles d'activités"
          >
            <button
              type="button"
              role="tab"
              className="xp20-tactile"
              aria-selected={selectedFamily === 'all'}
              onClick={() => setSelectedFamily('all')}
              style={{
                height: 34,
                padding: '0 13px',
                borderRadius: 999,
                flexShrink: 0,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                border:
                  selectedFamily === 'all'
                    ? '0.5px solid rgba(23, 64, 44, 0.35)'
                    : '0.5px solid rgba(23, 64, 44, 0.12)',
                background:
                  selectedFamily === 'all'
                    ? 'linear-gradient(180deg, #1f543a, #17402c)'
                    : 'rgba(255, 255, 255, 0.92)',
                color: selectedFamily === 'all' ? '#FBFAF6' : '#172B24',
                boxShadow:
                  selectedFamily === 'all' ? '0 4px 10px rgba(23, 64, 44, 0.2)' : 'none',
              }}
            >
              Toutes ({allProfiles.length})
            </button>
            {families.map((fam) => {
              const active = selectedFamily === fam.id;
              return (
                <button
                  key={fam.id}
                  type="button"
                  role="tab"
                  className="xp20-tactile"
                  aria-selected={active}
                  onClick={() => setSelectedFamily(fam.id)}
                  style={{
                    height: 34,
                    padding: '0 13px',
                    borderRadius: 999,
                    flexShrink: 0,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: active
                      ? '0.5px solid rgba(23, 64, 44, 0.35)'
                      : '0.5px solid rgba(23, 64, 44, 0.12)',
                    background: active
                      ? 'linear-gradient(180deg, #1f543a, #17402c)'
                      : 'rgba(255, 255, 255, 0.92)',
                    color: active ? '#FBFAF6' : '#172B24',
                    boxShadow: active ? '0 4px 10px rgba(23, 64, 44, 0.2)' : 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fam.shortLabelFr}
                </button>
              );
            })}
          </div>

          {/* Liste directe en grille 2 colonnes de TOUTES les activités possibles */}
          {visibleProfiles.length === 0 ? (
            <div
              className="rounded-2xl py-8 text-center text-[13px] font-semibold"
              style={{
                background: 'rgba(255, 255, 255, 0.72)',
                color: '#56665D',
                border: '0.5px solid rgba(23, 64, 44, 0.1)',
              }}
            >
              Aucune activité trouvée pour « {search} ».
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {visibleProfiles.map((profile) => {
                const isArt9 = profile.privacyAndCompliance.rgpdArt9SensitiveHealth;
                return (
                  <button
                    key={profile.identity.slugId}
                    type="button"
                    className="xp20-card-press"
                    onClick={() => handlePick(profile)}
                    style={{
                      minHeight: 60,
                      padding: '9px 11px',
                      borderRadius: 18,
                      background: 'rgba(255, 255, 255, 0.92)',
                      border: '0.5px solid rgba(23, 64, 44, 0.11)',
                      boxShadow:
                        'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 4px 12px rgba(16, 32, 25, 0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      cursor: 'pointer',
                      textAlign: 'left',
                      minWidth: 0,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 11,
                        background: `${profile.identity.accentHex}18`,
                        color: profile.identity.accentHex,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {renderSportIcon(profile.identity.familyId, profile.identity.slugId, 16)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span
                          className="truncate text-[13px] font-extrabold leading-tight"
                          style={{ color: '#172B24' }}
                        >
                          {profile.identity.shortLabelFr}
                        </span>
                        {isArt9 ? (
                          <Lock
                            size={10}
                            aria-label="Données santé protégées"
                            style={{ color: '#56665D', flexShrink: 0 }}
                          />
                        ) : null}
                      </div>
                      <div
                        className="mt-0.5 truncate text-[10.5px] font-semibold"
                        style={{ color: '#56665D' }}
                      >
                        {getProfileSubtitleFr(profile)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </StackSlideView>
  );
}
