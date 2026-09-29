'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Button } from '@/components/ui';
import {
  ACTIVITY_CATEGORIES,
  activityById,
  activityTemplateLabel,
  primaryCandidates,
  rankActivitiesByBrief,
  searchActivities,
} from '../catalog';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import type { ActivityCategoryId, ActivityDef, ActivitySelection } from '../types';
import type { PrepSheetId } from './PrepSheets';

export interface ActivityPickerScreenProps {
  onOpenSheet: (sheet: PrepSheetId, focusStepId?: string | null) => void;
}

const RECENT_STORAGE_KEY = 'lkdv_prep_recent_activities_v1';
const RECENT_MAX = 6;

interface RecentStore {
  ids: readonly string[];
}

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

function writeRecentIds(ids: readonly string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: RecentStore = { ids: ids.slice(0, RECENT_MAX) };
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    //
  }
}

/*
 * Le catalogue ne publie plus de duree : `durationLabel` affichait « 6 h
 * environ » sur chaque carte, une valeur qu'aucune sortie n'a jamais produite.
 * Elle cede la place a `activityTemplateLabel()`, qui donne la FORME du sejour
 * (« Gabarit : journée ») sans chiffre. La duree reste une donnee de travail
 * du catalogue, jamais un texte d'ecran.
 */

function selectionCountLabel(count: number): string {
  return `${count} ${count > 1 ? 'activités retenues' : 'activité retenue'}`;
}

function slotFor(activity: ActivityDef): 'extra' | 'nights' {
  return activity.canBePrimary ? 'extra' : 'nights';
}

function withoutId(ids: readonly string[], id: string): readonly string[] {
  return ids.filter((value) => value !== id);
}

function toggleComplement(
  selection: ActivitySelection,
  activity: ActivityDef,
): ActivitySelection {
  const slot = slotFor(activity);
  const current = selection[slot];
  return current.includes(activity.id)
    ? { ...selection, [slot]: withoutId(current, activity.id) }
    : { ...selection, [slot]: [...current, activity.id] };
}

function removeComplement(selection: ActivitySelection, id: string): ActivitySelection {
  return {
    ...selection,
    extra: withoutId(selection.extra, id),
    nights: withoutId(selection.nights, id),
  };
}

interface ActivityRowProps {
  activity: ActivityDef;
  selected: boolean;
  stateLabel?: string;
  onToggle: (activity: ActivityDef) => void;
}

function ActivityRow({ activity, selected, stateLabel, onToggle }: ActivityRowProps) {
  return (
    <li style={{ listStyle: 'none' }}>
      <button
        type="button"
        className="prep-act"
        style={{ width: '100%' }}
        aria-pressed={selected}
        onClick={() => onToggle(activity)}
      >
        <span className="prep-act__icon" aria-hidden="true">
          <Icon name={activity.icon} size={22} />
        </span>
        <span className="prep-act__body">
          <span className="prep-act__name" style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip' }}>
            {activity.label}
          </span>
          <span className="prep-act__hint">{activityTemplateLabel(activity.id)}</span>
        </span>
        <span className="prep-act__check" aria-hidden="true">
          {selected ? <Icon name="check" size={20} /> : null}
        </span>
        {stateLabel ? <span className="prep-visually-hidden">{stateLabel}</span> : null}
      </button>
    </li>
  );
}

interface KeptPillProps {
  activity: ActivityDef;
  onRemove: (id: string) => void;
}

function KeptPill({ activity, onRemove }: KeptPillProps) {
  return (
    <button
      type="button"
      className="prep-pill"
      onClick={() => onRemove(activity.id)}
      aria-label={`Retirer ${activity.label}`}
    >
      <Icon name={activity.icon} size={16} aria-hidden="true" />
      {activity.label}
      <Icon name="x" size={14} aria-hidden="true" />
    </button>
  );
}

export function ActivityPickerScreen({ onOpenSheet: _onOpenSheet }: ActivityPickerScreenProps) {
  const draft = useAdventurePrepStore((state) => state.draft);
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<ActivitySelection>(() => ({
    primary: draft.activities.primary,
    extra: draft.activities.extra,
    nights: draft.activities.nights,
  }));
  const [recentIds, setRecentIds] = useState<readonly string[]>([]);
  const [categoryId, setCategoryId] = useState<ActivityCategoryId>(() => {
    const kept = activityById(draft.activities.primary);
    return kept ? kept.category : ACTIVITY_CATEGORIES[0].id;
  });

  useEffect(() => {
    setRecentIds(readRecentIds());
  }, []);

  const selectableIds = useMemo(
    () => new Set(primaryCandidates().map((activity) => activity.id)),
    [],
  );

  /**
   * Ce que la liste affiche.
   *
   * Un mot recherche dans le catalogue l emporte : la recherche est une
   * intention plus precise que la phrase. Sinon, c est l invite libre qui
   * classe le catalogue REEL. Les deux ne proposes jamais une activite qui
   * n existe pas dans le catalogue.
   */
  const visible = useMemo(() => {
    const brief = (draft.brief ?? '').trim();
    const pool =
      query.trim().length > 0
        ? searchActivities(query, categoryId)
        : brief.length > 0
          ? rankActivitiesByBrief(brief).filter((activity) => activity.category === categoryId)
          : searchActivities('', categoryId);
    return pool.filter((activity) => selectableIds.has(activity.id));
  }, [query, categoryId, selectableIds, draft.brief]);

  const recentActivities = useMemo(
    () =>
      recentIds
        .map((id) => activityById(id))
        .filter(
          (activity): activity is ActivityDef => activity !== null && selectableIds.has(activity.id),
        ),
    [recentIds, selectableIds],
  );

  const isQueryActive = query.trim().length > 0;
  const showRecents = !isQueryActive && recentActivities.length > 0;

  const category = ACTIVITY_CATEGORIES.find((item) => item.id === categoryId) ?? ACTIVITY_CATEGORIES[0];
  const selected =
    selection.primary && selectableIds.has(selection.primary)
      ? activityById(selection.primary)
      : null;

  const complements = useMemo(() => {
    if (!selection.primary) return [];
    const kept = new Set([selection.primary, ...selection.extra, ...selection.nights]);
    return searchActivities(query, 'all').filter(
      (activity) => activity.combinable && !kept.has(activity.id),
    );
  }, [selection, query]);

  const keptComplements = useMemo(
    () =>
      [...selection.extra, ...selection.nights]
        .map((id) => activityById(id))
        .filter((activity): activity is ActivityDef => activity !== null),
    [selection.extra, selection.nights],
  );

  const toggle = useCallback((activity: ActivityDef) => {
    setSelection((current) => ({
      ...current,
      primary: current.primary === activity.id ? null : activity.id,
    }));
  }, []);

  /** Invite libre : elle part dans le store, elle atteint la generation IA. */
  const onBriefChange = useCallback((value: string) => {
    useAdventurePrepStore.getState().setBrief(value);
  }, []);

  const toggleExtra = useCallback((activity: ActivityDef) => {
    setSelection((current) => toggleComplement(current, activity));
  }, []);

  const removeExtra = useCallback((id: string) => {
    setSelection((current) => removeComplement(current, id));
  }, []);

  // L invite IA est l ENTREE PRINCIPALE de cet ecran : elle est posee en
  // haut, et son libelle promet que l IA en tient compte pour tout generer.
  // Le gate ne regardait que `selected`, donc un brief seul laissait le CTA
  // principal mort et ne laissait que le lien secondaire « Partir
  // librement ». Les deux moities de l ecran se contredisaient, et c est
  // toujours le gate qui avait tort : l invite a ete ajoutee apres lui.
  //
  // Sans activite choisi, on ne force donc AUCUNE activite : le brief part
  // tel quel vers le moteur (qui lit deja `activity?.label ?? 'activite
  // libre'`), et le catalogue se replie comme sous « Partir librement ».
  const canContinue = selected !== null || (draft.brief ?? '').trim().length > 0;

  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    const { setActivities, goToStep, dismissPicker } = useAdventurePrepStore.getState();
    if (!selected) {
      dismissPicker();
      return;
    }
    setActivities({ primary: selected.id, extra: selection.extra, nights: selection.nights });
    goToStep('destination');
    const next = [selected.id, ...recentIds.filter((id) => id !== selected.id)].slice(0, RECENT_MAX);
    writeRecentIds(next);
    setRecentIds(next);
  }, [canContinue, selected, selection.extra, selection.nights, recentIds]);

  const handleSkip = useCallback(() => {
    // Partir librement ne choisit pas d activite : sans cela le catalogue
    // restait affiche, puisque le routeur ne s eclipse sur une activite.
    const { dismissPicker } = useAdventurePrepStore.getState();
    dismissPicker();
  }, []);

  const retainedCount = (selected ? 1 : 0) + selection.extra.length + selection.nights.length;

  return (
    <div className="prep-screen" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}>
      <div className="prep-body">
        <h1 className="prep-title" style={{ fontSize: 28, fontWeight: 700, margin: 0, color: 'var(--lkv-text-primary)' }}>
          Quelle aventure&nbsp;?
        </h1>

        <div className="prep-block prep-brief">
          <label className="prep-brief__label" htmlFor="prep-picker-brief">
            <Icon name="sparkles" size={16} aria-hidden="true" />
            <span>Qu’est-ce que tu as en tête ?</span>
          </label>
          <textarea
            id="prep-picker-brief"
            className="prep-brief__input"
            value={draft.brief ?? ''}
            onChange={(event) => onBriefChange(event.target.value)}
            placeholder="Écris ce que tu imagines, l’IA s’en charge…"
            rows={3}
            maxLength={400}
            enterKeyHint="done"
            spellCheck={false}
          />
          <p className="prep-brief__hint">
            L’IA en tient compte pour tout générer. Tu peux aussi partir d’une
            activité du catalogue ci-dessous.
          </p>
        </div>

        <div className="prep-block prep-search">
          <Icon name="search" size={20} color="var(--lkv-text-secondary)" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une activité"
            aria-label="Rechercher une activité"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery('')}
              style={{ color: 'var(--lkv-text-secondary)', background: 'transparent', border: 0, cursor: 'pointer', display: 'grid', placeItems: 'center' }}
            >
              <Icon name="x" size={20} />
            </button>
          )}
        </div>

        {retainedCount > 1 && (
          <p className="prep-note" role="status" style={{ fontSize: 14, color: 'var(--lkv-text-secondary)' }}>
            {selectionCountLabel(retainedCount)}
          </p>
        )}

        {showRecents && (
          <section aria-labelledby="prep-recents" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 id="prep-recents" className="prep-section-title" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
              Reprends où tu en étais
            </h2>
            <ul className="prep-acts">
              {recentActivities.map((activity) => (
                <ActivityRow
                  key={`recent-${activity.id}`}
                  activity={activity}
                  selected={selection.primary === activity.id}
                  stateLabel={selection.primary === activity.id ? 'Sélectionnée' : ''}
                  onToggle={toggle}
                />
              ))}
            </ul>
          </section>
        )}

        {!isQueryActive && (
          <div
            className="prep-cats"
            role="group"
            aria-label="Familles d'activité"
            data-scrollable="horizontal"
          >
            {ACTIVITY_CATEGORIES.map((item) => {
              const active = item.id === categoryId;
              return (
                <button
                  key={item.id}
                  className="prep-action"
                  aria-pressed={active}
                  onClick={() => setCategoryId(item.id)}
                >
                  <Icon name={item.icon} size={16} />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}

        {visible.length > 0 ? (
          <ul className="prep-acts" aria-label={`Activités — ${category.label}`}>
            {visible.map((activity) => (
              <ActivityRow
                key={activity.id}
                activity={activity}
                selected={selection.primary === activity.id}
                stateLabel={selection.primary === activity.id ? 'Sélectionnée' : ''}
                onToggle={toggle}
              />
            ))}
          </ul>
        ) : (
          <p className="prep-note" style={{ fontSize: 14, color: 'var(--lkv-text-secondary)' }}>
            {query.trim().length > 0
              ? 'Aucune activité ne correspond à cette recherche. Essaie un autre mot ou une autre catégorie.'
              : 'Aucune activité du catalogue ne répond à cette description. Change de catégorie, ou pars librement : l’IA s’en charge.'}
          </p>
        )}

        {selected && (
          <section aria-labelledby="prep-complements" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 id="prep-complements" className="prep-section-title" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
              Ajouter une activité
            </h2>
            <p className="prep-block__hint" style={{ fontSize: 14, color: 'var(--lkv-text-secondary)', margin: 0 }}>
              Une aventure peut en contenir plusieurs : le parcours tiendra compte de toutes.
            </p>
            {keptComplements.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {keptComplements.map((activity) => (
                  <KeptPill
                    key={`kept-${activity.id}`}
                    activity={activity}
                    onRemove={removeExtra}
                  />
                ))}
              </div>
            )}
            {complements.length > 0 && (
              <ul className="prep-acts" aria-label="Activités à ajouter">
                {complements.map((activity) => (
                  <ActivityRow
                    key={`extra-${activity.id}`}
                    activity={activity}
                    selected={false}
                    stateLabel="À ajouter"
                    onToggle={toggleExtra}
                  />
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <div className="prep-footer">
        <Button
          variant="primary"
          size="lg"
          style={{ height: 52, borderRadius: 16, fontSize: 17, fontWeight: 600 }}
          disabled={!canContinue}
          onClick={handleContinue}
        >
          Continuer
        </Button>
        <button
          type="button"
          className="prep-footer-link"
          onClick={handleSkip}
        >
          Partir librement
        </button>
      </div>
    </div>
  );
}

export default ActivityPickerScreen;
