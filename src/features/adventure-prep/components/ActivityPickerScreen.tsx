'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Button, Chip, SearchField } from '@/components/ui';
import { ACTIVITY_CATEGORIES, activityById, primaryCandidates, searchActivities } from '../catalog';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import type { ActivityCategoryId, ActivityDef } from '../types';
import type { PrepSheetId } from './PrepSheets';

export interface ActivityPickerScreenProps {
  /** Ouvre une vue secondaire du preparateur. */
  onOpenSheet: (sheet: PrepSheetId, focusStepId?: string | null) => void;
}

/** Activites retenues pour la reprise, au plus 6, sans doublon. */
const RECENT_STORAGE_KEY = 'lkdv_prep_recent_activities_v1';
const RECENT_MAX = 6;

interface RecentStore {
  ids: readonly string[];
}

/**
 * Empilement titre + liste. Passe par les tokens de la feuille de feature
 * plutot que par une classe inventee ici.
 */
const STACK: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--prep-block-gap)',
};

/** Lit le bloc de reprise. Renvoie `[]` si rien n'est exploitable. */
function readRecentIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return [];
    const { ids } = parsed as Partial<RecentStore>;
    if (!Array.isArray(ids)) return [];
    return ids.filter((id): id is string => typeof id === 'string').slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

/** Ecrit le bloc de reprise : l'identifiant choisi passe en tete, sans doublon. */
function writeRecentIds(ids: readonly string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: RecentStore = { ids: ids.slice(0, RECENT_MAX) };
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Stockage indisponible (navigation privee, quota) : la reprise est un bonus.
  }
}

/** Duree indicative : une suggestion du catalogue, jamais une donnee reservee. */
function durationLabel(hours: number): string {
  if (hours < 24) return `${hours} h environ`;
  const days = Math.round(hours / 24);
  return `${days} ${days > 1 ? 'jours' : 'jour'} environ`;
}

interface ActivityRowProps {
  activity: ActivityDef;
  selected: boolean;
  onToggle: (activity: ActivityDef) => void;
}

function ActivityRow({ activity, selected, onToggle }: ActivityRowProps) {
  return (
    <li>
      <button
        type="button"
        className="prep-act"
        aria-pressed={selected}
        onClick={() => onToggle(activity)}
      >
        <span className="prep-act__icon" aria-hidden="true">
          <Icon name={activity.icon} size={22} />
        </span>
        <span className="prep-act__name">{activity.label}</span>
        <span className="prep-act__meta">{durationLabel(activity.suggestedDurationHours)}</span>
        {selected ? (
          <span className="prep-act__check">
            <Icon name="check" size={20} aria-hidden="true" />
            <span className="prep-visually-hidden">Sélectionnée</span>
          </span>
        ) : null}
      </button>
    </li>
  );
}

/**
 * A3 — l'entree du preparateur : choisir UNE activity principale.
 *
 * Le catalogue entier reste visible : les six categories d'abord, puis les
 * activites de la categorie choisie, les activites recentes en tete quand il y
 * en a. Une seule activite principale a la fois — re-toucher la deselectionne.
 * Le bivouac n'apparait jamais ici : il reste propose comme nuit a l'etape du
 * parcours, la ou il a du sens.
 */
export function ActivityPickerScreen({ onOpenSheet: _onOpenSheet }: ActivityPickerScreenProps) {
  const draft = useAdventurePrepStore((state) => state.draft);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(draft.activities.primary);
  const [recentIds, setRecentIds] = useState<readonly string[]>([]);
  const [categoryId, setCategoryId] = useState<ActivityCategoryId>(() => {
    const kept = activityById(draft.activities.primary);
    return kept ? kept.category : ACTIVITY_CATEGORIES[0].id;
  });

  // Le stockage n'est lu qu'apres montage : le premier rendu reste identique
  // cote serveur et cote client, donc pas d'alerte d'hydratation.
  useEffect(() => {
    setRecentIds(readRecentIds());
  }, []);

  // Le tri « activite principale » vient du catalogue : le bivouac est donc
  // exclu par construction, sans liste rougee a maintenir ici.
  const selectableIds = useMemo(
    () => new Set(primaryCandidates().map((activity) => activity.id)),
    [],
  );

  // `searchActivities` compare la casse ET les accents (il normalise les deux
  // cotes) : « cafe » trouve bien « canoë », sans normalisation supplementaire.
  const visible = useMemo(
    () => searchActivities(query, categoryId).filter((activity) => selectableIds.has(activity.id)),
    [query, categoryId, selectableIds],
  );

  const recentActivities = useMemo(
    () =>
      recentIds
        .map((id) => activityById(id))
        .filter(
          (activity): activity is ActivityDef => activity !== null && selectableIds.has(activity.id),
        ),
    [recentIds, selectableIds],
  );

  // Pendant une recherche, la liste filtree EST la reponse : on masque le bloc
  // de reprise plutot que de repeter les memes lignes deux fois.
  const showRecents = query.trim().length === 0 && recentActivities.length > 0;

  const category = ACTIVITY_CATEGORIES.find((item) => item.id === categoryId) ?? ACTIVITY_CATEGORIES[0];
  const selected = selectedId && selectableIds.has(selectedId) ? activityById(selectedId) : null;

  const toggle = useCallback((activity: ActivityDef) => {
    setSelectedId((current) => (current === activity.id ? null : activity.id));
  }, []);

  const handleContinue = useCallback(() => {
    if (!selected) return;
    const { setActivities, goToStep } = useAdventurePrepStore.getState();
    setActivities({ primary: selected.id, extra: [], nights: [] });
    goToStep('destination');
    const next = [selected.id, ...recentIds.filter((id) => id !== selected.id)].slice(0, RECENT_MAX);
    writeRecentIds(next);
    setRecentIds(next);
  }, [selected, recentIds]);

  return (
    <div className="prep-screen">
      <div className="prep-body">
        <h1 className="prep-title">Quelle aventure&nbsp;?</h1>
        <p className="prep-help">
          Choisis ton activité, puis un point de départ. La date, la route et le nombre de
          personnes resteront modifiables jusqu’au départ.
        </p>

        <SearchField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery('')}
          placeholder="Rechercher une activité"
          aria-label="Rechercher une activité"
        />

        {showRecents ? (
          <section style={STACK} aria-labelledby="prep-recents">
            <h2 id="prep-recents" className="prep-section-title">
              Reprends où tu en étais
            </h2>
            <ul className="prep-acts">
              {recentActivities.map((activity) => (
                <ActivityRow
                  key={`recent-${activity.id}`}
                  activity={activity}
                  selected={selectedId === activity.id}
                  onToggle={toggle}
                />
              ))}
            </ul>
          </section>
        ) : null}

        <div className="prep-cats" role="group" aria-label="Catégories d'activité">
          {ACTIVITY_CATEGORIES.map((item) => {
            const active = item.id === categoryId;
            return (
              <Chip
                key={item.id}
                selected={active}
                onClick={() => setCategoryId(item.id)}
                className="min-h-[var(--control-height-md)]"
                icon={
                  <span className="inline-flex items-center gap-[var(--space-1)]">
                    <Icon name={item.icon} size={16} />
                    {active ? <Icon name="check" size={14} /> : null}
                  </span>
                }
              >
                {item.label}
              </Chip>
            );
          })}
        </div>

        {visible.length > 0 ? (
          <ul className="prep-acts" aria-label={`Activités — ${category.label}`}>
            {visible.map((activity) => (
              <ActivityRow
                key={activity.id}
                activity={activity}
                selected={selectedId === activity.id}
                onToggle={toggle}
              />
            ))}
          </ul>
        ) : (
          <p className="prep-note">
            Aucune activité ne correspond à cette recherche. Essaie un autre mot ou une autre
            catégorie.
          </p>
        )}
      </div>

      <div className="prep-footer">
        <Button
          variant="primary"
          size="lg"
          className="prep-footer__primary"
          disabled={!selected}
          onClick={handleContinue}
        >
          Continuer
        </Button>
      </div>
    </div>
  );
}

export default ActivityPickerScreen;
