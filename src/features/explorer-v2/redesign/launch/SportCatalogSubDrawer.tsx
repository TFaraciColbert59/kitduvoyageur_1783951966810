'use client';

import React, { useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { Lock, Search, X } from 'lucide-react';
import {
  listActivityProfiles,
  listSportFamilies,
} from '../../specs/resolveActivityProfile';
import type { ActivityProfileSpec, SportFamilyId } from '../../specs/activityProfileSpec.types';
import { ExplorerNestedSubDrawer } from '../primitives/ExplorerNestedSubDrawer';
import { getProfileSubtitleFr, renderSportIcon } from '../primitives/IosGlassControls';

export interface SportCatalogSubDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectProfile: (profile: ActivityProfileSpec) => void;
}

/**
 * Sous-tiroir Expert Catalogue (49 activités · 10 familles · Recherche instantanée `cmdk`).
 * Grille 2 colonnes pleine largeur, icônes sport colorées dans des squircles Liquid Glass,
 * zéro jargon technique snake_case.
 */
export function SportCatalogSubDrawer({
  open,
  onOpenChange,
  onSelectProfile,
}: SportCatalogSubDrawerProps) {
  const [selectedFamily, setSelectedFamily] = useState<SportFamilyId | 'all'>('all');
  const [search, setSearch] = useState('');
  const families = useMemo(() => listSportFamilies(), []);
  const profiles = useMemo(
    () =>
      listActivityProfiles(
        selectedFamily === 'all' ? undefined : { familyId: selectedFamily },
      ),
    [selectedFamily],
  );

  return (
    <ExplorerNestedSubDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Toutes les activités"
      subtitle={`${profiles.length} activités · 10 familles · Import GPX & FIT`}
    >
      <Command label="Rechercher une activité" shouldFilter>
        {/* Barre de recherche Liquid Glass */}
        <div
          className="mb-3 flex items-center gap-2.5 px-3.5"
          style={{
            minHeight: 46,
            borderRadius: 16,
            background: '#FFFFFF',
            border: '0.5px solid rgba(23, 64, 44, 0.14)',
            boxShadow: 'inset 0 1px 2px rgba(16, 32, 25, 0.04)',
          }}
        >
          <Search size={16} aria-hidden="true" style={{ color: '#56665D', flexShrink: 0 }} />
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Rechercher : trail, ski, natation, muscu, vélo…"
            className="w-full bg-transparent text-[14.5px] font-medium outline-none"
            style={{ color: '#172B24' }}
          />
          {search ? (
            <button
              type="button"
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
              }}
            >
              <X size={13} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {/* 10 familles en capsules horizontales tactiles */}
        <div
          className="mb-3.5 flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'none' }}
          data-base-ui-swipe-ignore="x"
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
              height: 36,
              padding: '0 14px',
              borderRadius: 999,
              flexShrink: 0,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              border:
                selectedFamily === 'all'
                  ? '0.5px solid rgba(23, 64, 44, 0.35)'
                  : '0.5px solid rgba(23, 64, 44, 0.12)',
              background:
                selectedFamily === 'all'
                  ? 'linear-gradient(180deg, #1f543a, #17402c)'
                  : 'rgba(255, 255, 255, 0.9)',
              color: selectedFamily === 'all' ? '#FBFAF6' : '#172B24',
              boxShadow:
                selectedFamily === 'all' ? '0 4px 12px rgba(23, 64, 44, 0.22)' : 'none',
            }}
          >
            Toutes (49)
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
                  height: 36,
                  padding: '0 14px',
                  borderRadius: 999,
                  flexShrink: 0,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  border: active
                    ? '0.5px solid rgba(23, 64, 44, 0.35)'
                    : '0.5px solid rgba(23, 64, 44, 0.12)',
                  background: active
                    ? 'linear-gradient(180deg, #1f543a, #17402c)'
                    : 'rgba(255, 255, 255, 0.9)',
                  color: active ? '#FBFAF6' : '#172B24',
                  boxShadow: active ? '0 4px 12px rgba(23, 64, 44, 0.22)' : 'none',
                }}
              >
                {fam.shortLabelFr}
              </button>
            );
          })}
        </div>

        {/* Liste cmdk : le grid 2 colonnes est sur le conteneur INTERNE (pas sur Command.List) */}
        <Command.List className="pb-4">
          <Command.Empty
            className="py-8 text-center text-[13.5px] font-medium"
            style={{ color: '#56665D' }}
          >
            Aucune activité trouvée — essayez « Saisie manuelle &amp; Import ».
          </Command.Empty>
          <div className="grid grid-cols-2 gap-2.5">
            {profiles.map((profile) => {
              const isArt9 = profile.privacyAndCompliance.rgpdArt9SensitiveHealth;
              return (
                <Command.Item
                  key={profile.identity.slugId}
                  className="xp20-card-press"
                  value={`${profile.identity.labelFr} ${profile.identity.shortLabelFr} ${profile.identity.legacySlugAliases.join(' ')}`}
                  onSelect={() => {
                    onSelectProfile(profile);
                    onOpenChange(false);
                  }}
                  style={{
                    minHeight: 68,
                    padding: '10px 11px',
                    borderRadius: 18,
                    background: 'rgba(255, 255, 255, 0.92)',
                    border: '0.5px solid rgba(23, 64, 44, 0.11)',
                    boxShadow:
                      'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 4px 12px rgba(16, 32, 25, 0.045)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    minWidth: 0,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      background: `${profile.identity.accentHex}18`,
                      color: profile.identity.accentHex,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {renderSportIcon(profile.identity.familyId, profile.identity.slugId, 17)}
                  </span>
                  <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 800,
                        color: '#172B24',
                        lineHeight: 1.2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {profile.identity.shortLabelFr}
                    </div>
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#56665D',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isArt9 ? <Lock size={10} aria-hidden="true" /> : null}
                      <span>{getProfileSubtitleFr(profile)}</span>
                    </div>
                  </div>
                </Command.Item>
              );
            })}
          </div>
        </Command.List>
      </Command>
    </ExplorerNestedSubDrawer>
  );
}
