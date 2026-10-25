# Préparateur d'aventure LKDV — Refonte 100% Frontend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre à 100% les composants TSX du préparateur d'aventure (`src/features/adventure-prep/components/`) pour les aligner sur la maquette de référence (`project/maquette/`) et le prompt codex, sans toucher au backend (store, moteurs, types, IA).

**Architecture:** Chaque composant est réécrit en utilisant exclusivement le store Zustand existant comme source de vérité, les classes CSS BEM déjà définies dans `adventure-prep.css`, et les tokens CSS du design system. Aucun Tailwind, aucune nouvelle dépendance, aucune modification du store ou des types.

**Tech Stack:** React 18, Next.js 15 App Router, TypeScript strict, CSS BEM (`adventure-prep.css`), Zustand store, lucide-react icons, `@/components/ui/Icon`

**Spec:** `docs/superpowers/specs/2026-09-27-preparateur-frontend-refonte-design.md`

## Global Constraints

- Aucun fichier dans `engine/`, `store/`, `types.ts`, `catalog.ts`, `hooks/` ne doit être modifié
- Aucun test existant ne doit casser — vérifier avec `npx vitest run src/features/adventure-prep` après chaque tâche
- Aucun hex ou rgba en dur dans les composants TSX — utiliser uniquement les tokens CSS (`var(--prep-*)`)
- Toutes les cibles tactiles ≥ 44×44px
- `aria-current`, `aria-pressed`, `aria-live` respectés dans chaque composant
- `prefers-reduced-motion` respecté via les transitions CSS existantes (pas de JS animation)
- Aucune dépendance npm supplémentaire
- Tous les libellés en français (cohérence avec l'existant)
- Répertoire cible exclusif : `src/features/adventure-prep/components/`
- CSS additionnel uniquement en fin de `adventure-prep.css` (ne pas modifier les lignes 1–160 de tokens)

---

## Fichiers touchés (cartographie complète)

### Modifiés (réécriture TSX)
```
src/features/adventure-prep/components/ActivityPickerScreen.tsx
src/features/adventure-prep/components/AdventurePrepShell.tsx
src/features/adventure-prep/components/DepartureStep.tsx
src/features/adventure-prep/components/DestinationStep.tsx
src/features/adventure-prep/components/ItineraryStep.tsx
src/features/adventure-prep/components/PrepCrumb.tsx
src/features/adventure-prep/components/PrepGearSheets.tsx
src/features/adventure-prep/components/PrepInviteScreen.tsx
src/features/adventure-prep/components/PrepItinerarySheets.tsx
src/features/adventure-prep/components/PrepMap.tsx
src/features/adventure-prep/components/PrepSetupSheets.tsx
```

### Conservés sans modification
```
src/features/adventure-prep/components/AdventurePrepScreen.tsx   (wrapper minimal)
src/features/adventure-prep/components/PrepFlow.tsx              (orchestrateur)
src/features/adventure-prep/components/PrepSheets.tsx            (routeur sheets)
src/features/adventure-prep/components/stepOneProfile.ts         (helpers de profil)
```

### CSS étendu (ajout uniquement en fin de fichier)
```
src/features/adventure-prep/adventure-prep.css  (+classes manquantes)
```

### Tests — lecture uniquement (aucune modification)
```
src/features/adventure-prep/__tests__/*.test.ts(x)
```

---

## Task 1 — PrepCrumb / PrepNav — Progression et navigation

**Files:**
- Modify: `src/features/adventure-prep/components/PrepCrumb.tsx`

**Interfaces:**
- Consumes: `PrepStepId`, `PREP_STEPS`, `PREP_STEP_LABELS` from `../types`; `AdventurePrepDraft` from `../types`; `progressOf`, `canOpenStep` from `../engine/steps`
- Produces: `PrepNav` component (already exported, used by `AdventurePrepShell`)

- [ ] **Step 1: Comprendre le contrat actuel**

  Lire `PrepCrumb.tsx` entièrement. Observer que `PrepNav` (exporté) est utilisé dans `AdventurePrepShell`. Le fil d'Ariane affiche : Destination · Parcours · Départ, avec l'étape active soulignée.

- [ ] **Step 2: Réécrire `PrepCrumb.tsx`**

  ```tsx
  'use client';

  import React from 'react';
  import Icon from '@/components/ui/Icon';
  import { canOpenStep, progressOf } from '../engine/steps';
  import { PREP_STEPS, PREP_STEP_LABELS, type AdventurePrepDraft, type PrepStepId } from '../types';

  export interface PrepNavProps {
    step: PrepStepId;
    draft: AdventurePrepDraft;
    onOpenStep: (step: PrepStepId) => void;
    onClose: () => void;
  }

  export function PrepNav({ step, draft, onOpenStep, onClose }: PrepNavProps) {
    const progress = progressOf(draft);

    return (
      <nav className="prep-nav" aria-label="Navigation préparateur">
        {/* Bouton retour (étape précédente ou hub) */}
        <BackButton step={step} draft={draft} onOpenStep={onOpenStep} onClose={onClose} />

        {/* Fil d'Ariane — Destination · Parcours · Départ */}
        <ol className="prep-crumb" role="list" aria-label="Progression">
          {PREP_STEPS.map((id, index) => {
            const isActive = id === step;
            const isDone = draft.completedSteps.includes(id) && id !== step;
            const canOpen = canOpenStep(draft, id) && !isActive;
            const label = PREP_STEP_LABELS[id];

            return (
              <li key={id} className="prep-crumb__item">
                {index > 0 && (
                  <span className="prep-crumb__sep" aria-hidden="true">·</span>
                )}
                {canOpen ? (
                  <button
                    type="button"
                    className="prep-crumb__link"
                    onClick={() => onOpenStep(id)}
                    aria-label={`Revenir à ${label}`}
                  >
                    {label}
                  </button>
                ) : (
                  <span
                    className="prep-crumb__label"
                    data-current={isActive || undefined}
                    data-locked={!isDone && !isActive || undefined}
                    aria-current={isActive ? 'step' : undefined}
                  >
                    {label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {/* Fermer — retour hub, brouillon sauvegardé */}
        <button
          type="button"
          className="prep-nav__icon"
          onClick={onClose}
          aria-label="Fermer le préparateur"
        >
          <Icon name="x" size={18} aria-hidden="true" />
        </button>

        {/* Annonce accessible de la progression */}
        <span className="prep-visually-hidden" aria-live="polite">
          {progress.label}
        </span>
      </nav>
    );
  }

  function BackButton({
    step,
    draft,
    onOpenStep,
    onClose,
  }: {
    step: PrepStepId;
    draft: AdventurePrepDraft;
    onOpenStep: (step: PrepStepId) => void;
    onClose: () => void;
  }) {
    const stepIndex = PREP_STEPS.indexOf(step);
    const prevStep = stepIndex > 0 ? PREP_STEPS[stepIndex - 1] : null;
    const canGoBack = prevStep !== null && canOpenStep(draft, prevStep);

    if (canGoBack && prevStep) {
      return (
        <button
          type="button"
          className="prep-nav__icon"
          onClick={() => onOpenStep(prevStep)}
          aria-label={`Retour à ${PREP_STEP_LABELS[prevStep]}`}
        >
          <Icon name="arrow-left" size={18} aria-hidden="true" />
        </button>
      );
    }

    return (
      <button
        type="button"
        className="prep-nav__icon"
        onClick={onClose}
        aria-label="Retour au hub"
      >
        <Icon name="arrow-left" size={18} aria-hidden="true" />
      </button>
    );
  }

  export default PrepNav;
  ```

- [ ] **Step 3: Vérifier que le shell compile**

  ```bash
  npx tsc --noEmit --project tsconfig.json 2>&1 | grep "PrepCrumb\|PrepNav"
  ```
  Expected: aucune erreur sur ces fichiers.

- [ ] **Step 4: Vérifier les tests crumb**

  ```bash
  npx vitest run src/features/adventure-prep/__tests__/prep-crumb.test.tsx
  ```
  Expected: PASS

- [ ] **Step 5: Commit**

  ```bash
  git add src/features/adventure-prep/components/PrepCrumb.tsx
  git commit -m "refonte(prep): PrepNav — progression mots, retour contextuel, aria-current"
  ```

---

## Task 2 — AdventurePrepShell — Cadre commun, bandeau offline

**Files:**
- Modify: `src/features/adventure-prep/components/AdventurePrepShell.tsx`

**Interfaces:**
- Consumes: `PrepNav` from `./PrepCrumb`; `offlineReadiness` from `../engine/resilience`; `useAdventurePrepStore` from `../store/useAdventurePrepStore`; `PREP_STEPS`, `PREP_STEP_LABELS`, `AdventurePrepDraft`, `PrepStepId` from `../types`; `canOpenStep`, `progressOf`, `stepCountDone` from `../engine/steps`
- Produces: `AdventurePrepShell`, `useOfflinePrep`, `PrepOfflineNotice`, `OfflinePrepValue` (tous déjà exportés, interface inchangée)

- [ ] **Step 1: Réécrire `AdventurePrepShell.tsx`**

  Conserver exactement les mêmes exports (interface publique inchangée). Simplifier uniquement la JSX du rendu — supprimer `CompletedSteps` qui est invisible (classe `prep-visually-hidden`) et remplacer par des liens accessibles dans la nav.

  ```tsx
  'use client';

  import React, { useMemo, useSyncExternalStore } from 'react';
  import { useRouter } from 'next/navigation';
  import { OfflineBanner } from '@/features/adventure-intelligence/ui/OfflineBanner';
  import Icon from '@/components/ui/Icon';
  import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
  import { canOpenStep, progressOf } from '../engine/steps';
  import {
    offlineReadiness,
    type OfflineReadiness,
    type OfflineUnavailableAction,
  } from '../engine/resilience';
  import { PREP_STEPS, PREP_STEP_LABELS, type AdventurePrepDraft, type PrepStepId } from '../types';
  import type { PrepSheetId } from './PrepSheets';
  import { PrepNav } from './PrepCrumb';

  // --- réseau (inchangé) ---
  export const PREP_SERVER_ONLINE = true;
  export function readPrepNetwork(): boolean {
    if (typeof window === 'undefined' || !window.navigator) return PREP_SERVER_ONLINE;
    return window.navigator.onLine !== false;
  }
  export function readPrepNetworkOnServer(): boolean { return PREP_SERVER_ONLINE; }
  function subscribeToNetwork(onChange: () => void): () => void {
    if (typeof window === 'undefined') return () => undefined;
    window.addEventListener('online', onChange);
    window.addEventListener('offline', onChange);
    return () => { window.removeEventListener('online', onChange); window.removeEventListener('offline', onChange); };
  }
  function useOnlineStatus(): boolean {
    return useSyncExternalStore(subscribeToNetwork, readPrepNetwork, readPrepNetworkOnServer);
  }

  // --- contexte offline (inchangé) ---
  export interface OfflinePrepValue {
    online: boolean;
    readiness: OfflineReadiness;
    unavailable: readonly OfflineUnavailableAction[];
    isUnavailable: (id: string) => boolean;
    reasonFor: (id: string) => string | null;
  }
  const OfflinePrepContext = React.createContext<OfflinePrepValue | null>(null);
  const OUTSIDE_PREP: OfflinePrepValue = {
    online: true,
    readiness: offlineReadiness({ model: null, online: true, aiEnabled: true }),
    unavailable: [],
    isUnavailable: () => false,
    reasonFor: () => null,
  };
  function createOfflinePrepValue(online: boolean, readiness: OfflineReadiness): OfflinePrepValue {
    const byId = new Map(readiness.unavailable.map((action) => [action.id, action]));
    return {
      online, readiness, unavailable: readiness.unavailable,
      isUnavailable: (id) => byId.has(id),
      reasonFor: (id) => byId.get(id)?.reason ?? null,
    };
  }
  export function useOfflinePrep(): OfflinePrepValue {
    return React.useContext(OfflinePrepContext) ?? OUTSIDE_PREP;
  }

  // --- bandeau offline (inchangé) ---
  const NOTICE_BOX: React.CSSProperties = {
    flex: '0 0 auto', display: 'flex', flexDirection: 'column',
    gap: 'var(--prep-space-2)', padding: 'var(--prep-space-3) var(--prep-space-4)',
    textAlign: 'left',
    backgroundColor: 'color-mix(in srgb, var(--lkv-warning-dark) 12%, var(--lkv-surface))',
    color: 'var(--lkv-text-primary)',
    borderBottom: 'var(--prep-hairline) solid color-mix(in srgb, var(--lkv-warning-dark) 34%, transparent)',
    fontSize: 'var(--lkv-text-note)', lineHeight: 'var(--lkv-line-body)',
  };
  export interface PrepOfflineNoticeProps { online: boolean; readiness: OfflineReadiness; }
  export function PrepOfflineNotice({ online, readiness }: PrepOfflineNoticeProps) {
    if (readiness.unavailable.length === 0) return null;
    return (
      <div style={NOTICE_BOX} role="status" aria-live="polite">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--prep-space-2)' }}>
          <OfflineBanner offline={!online} className="shrink-0" />
          <p style={{ flex: '1 1 12rem', minWidth: 0 }}>{readiness.summary}</p>
        </div>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--prep-space-1)', margin: 0, padding: 0, listStyle: 'none' }}>
          {readiness.unavailable.map((action) => (
            <li key={action.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--prep-space-2)' }}>
              <Icon name="wifi-off" size={13} aria-hidden="true" />
              <span><strong>{action.label}</strong> — {action.reason}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // --- shell ---
  export interface AdventurePrepShellProps {
    step: PrepStepId;
    onOpenSheet: (sheet: PrepSheetId, focusStepId?: string | null) => void;
    children: React.ReactNode;
    picking?: boolean;
    aiEnabled?: boolean;
  }

  export function AdventurePrepShell({ step, onOpenSheet, children, picking = false, aiEnabled = true }: AdventurePrepShellProps) {
    const router = useRouter();
    const draft = useAdventurePrepStore((state) => state.draft);
    const goToStep = useAdventurePrepStore((state) => state.goToStep);
    const online = useOnlineStatus();

    const offlineValue = useMemo(() => {
      const readiness = offlineReadiness({ model: draft.itinerary, online, aiEnabled });
      return createOfflinePrepValue(online, readiness);
    }, [draft.itinerary, online, aiEnabled]);

    return (
      <OfflinePrepContext.Provider value={offlineValue}>
        <div className="adventure-prep">
          <PrepNav
            step={step}
            draft={draft}
            onOpenStep={goToStep}
            onClose={() => router.push('/hub')}
          />
          <PrepOfflineNotice online={online} readiness={offlineValue.readiness} />
          {children}
        </div>
      </OfflinePrepContext.Provider>
    );
  }

  export default AdventurePrepShell;
  ```

- [ ] **Step 2: Vérifier la compilation**

  ```bash
  npx tsc --noEmit 2>&1 | grep -E "AdventurePrepShell|PrepOfflineNotice|OfflinePrepValue" | head -20
  ```
  Expected: aucune erreur.

- [ ] **Step 3: Commit**

  ```bash
  git add src/features/adventure-prep/components/AdventurePrepShell.tsx
  git commit -m "refonte(prep): AdventurePrepShell — shell simplifié, nav contextuel"
  ```

---

## Task 3 — ActivityPickerScreen — Choix d'activité

**Files:**
- Modify: `src/features/adventure-prep/components/ActivityPickerScreen.tsx`

**Interfaces:**
- Consumes: `ACTIVITY_CATEGORIES`, `activityById`, `primaryCandidates`, `searchActivities` from `../catalog`; `useAdventurePrepStore` from `../store/useAdventurePrepStore`; `ActivityCategoryId`, `ActivityDef`, `ActivitySelection` from `../types`
- Produces: `ActivityPickerScreen` component with `onOpenSheet` prop

- [ ] **Step 1: Vérifier les tests existants**

  ```bash
  npx vitest run src/features/adventure-prep/__tests__/activity-picker-screen.test.tsx
  ```
  Expected: PASS — noter les cas couverts.

- [ ] **Step 2: Réécrire `ActivityPickerScreen.tsx`**

  Le layout doit être :
  1. Titre + recherche
  2. Chips de catégorie (scrollable horizontal)
  3. Section « Récents » si des recents existent
  4. Grille 2 colonnes d'activités
  5. Footer fixe : « Partir librement » + CTA « Continuer »

  ```tsx
  'use client';

  import React, { useCallback, useEffect, useMemo, useState } from 'react';
  import Icon from '@/components/ui/Icon';
  import { ACTIVITY_CATEGORIES, activityById, primaryCandidates, searchActivities } from '../catalog';
  import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
  import type { ActivityCategoryId, ActivityDef } from '../types';
  import type { PrepSheetId } from './PrepSheets';

  const RECENT_STORAGE_KEY = 'lkdv_prep_recent_activities_v1';
  const RECENT_MAX = 6;

  function readRecentIds(): string[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return [];
      const { ids } = parsed as { ids?: unknown };
      if (!Array.isArray(ids)) return [];
      return ids.filter((id): id is string => typeof id === 'string').slice(0, RECENT_MAX);
    } catch { return []; }
  }

  function writeRecentIds(next: string, previous: string[]): void {
    if (typeof window === 'undefined') return;
    const ids = [next, ...previous.filter((id) => id !== next)].slice(0, RECENT_MAX);
    try { window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify({ ids })); } catch { /* best effort */ }
  }

  export interface ActivityPickerScreenProps {
    onOpenSheet: (sheet: PrepSheetId, focusStepId?: string | null) => void;
  }

  export function ActivityPickerScreen({ onOpenSheet: _onOpenSheet }: ActivityPickerScreenProps) {
    const draft = useAdventurePrepStore((state) => state.draft);
    const setPrimaryActivity = useAdventurePrepStore((state) => state.setPrimaryActivity);
    const goToStep = useAdventurePrepStore((state) => state.goToStep);

    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<ActivityCategoryId | null>(null);
    const [selected, setSelected] = useState<string | null>(draft.activities.primary);
    const [recentIds, setRecentIds] = useState<string[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setRecentIds(readRecentIds());
      setMounted(true);
    }, []);

    const candidates = useMemo(() => primaryCandidates(), []);

    const filtered = useMemo(() => {
      if (query.trim()) return searchActivities(query);
      if (category) return candidates.filter((a) => a.category === category);
      return candidates;
    }, [query, category, candidates]);

    const recentActivities = useMemo(
      () => recentIds.map((id) => activityById(id)).filter((a): a is ActivityDef => a !== null),
      [recentIds],
    );

    const handleSelect = useCallback((id: string) => {
      setSelected((prev) => (prev === id ? null : id));
    }, []);

    const handleContinue = useCallback(() => {
      if (!selected) return;
      writeRecentIds(selected, recentIds);
      setPrimaryActivity(selected);
      goToStep('destination');
    }, [selected, recentIds, setPrimaryActivity, goToStep]);

    const handleFree = useCallback(() => {
      // Partir librement : aucune activité — nav vers hub sans créer d'aventure
      goToStep('destination');
    }, [goToStep]);

    if (!mounted) {
      return (
        <div className="prep-screen" aria-busy="true">
          <p className="prep-note" style={{ padding: 'var(--prep-space-5)', color: 'var(--lkv-text-subtle)' }}>
            Chargement des activités…
          </p>
        </div>
      );
    }

    return (
      <div className="prep-screen">
        {/* Corps scrollable */}
        <div className="prep-body" style={{ paddingBottom: 0 }}>
          <h1 className="prep-title">Quelle aventure ?</h1>

          {/* Barre de recherche */}
          <div className="prep-block" style={{ overflow: 'visible' }}>
            <div className="prep-block__row" style={{ gap: 'var(--prep-space-2)' }}>
              <Icon name="search" size={16} aria-hidden="true" style={{ color: 'var(--lkv-text-subtle)', flexShrink: 0 }} />
              <input
                type="search"
                className="prep-block__value"
                style={{ flex: '1 1 auto', textAlign: 'left', fontWeight: 'normal', background: 'transparent', border: 0, outline: 'none', fontSize: 'var(--lkv-text-body)', color: 'var(--lkv-text-primary)' }}
                placeholder="Rando, vélo, surf, yoga…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setCategory(null); }}
                autoComplete="off"
                aria-label="Rechercher une activité"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Effacer la recherche"
                  style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 0, color: 'var(--lkv-text-subtle)', display: 'flex', alignItems: 'center' }}>
                  <Icon name="x-circle" size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Chips de catégorie */}
          {!query && (
            <div className="prep-cats" role="group" aria-label="Catégories d'activité">
              {ACTIVITY_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className="prep-action"
                  aria-pressed={category === cat.id}
                  onClick={() => setCategory((prev) => (prev === cat.id ? null : cat.id))}
                >
                  <Icon name={cat.icon} size={14} aria-hidden="true" />
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* Section récents */}
          {!query && !category && recentActivities.length > 0 && (
            <section aria-labelledby="prep-recent-heading">
              <h2 id="prep-recent-heading" className="prep-section-title" style={{ marginBottom: 'var(--prep-space-2)' }}>
                Récents
              </h2>
              <div className="prep-block">
                {recentActivities.map((activity, index) => (
                  <ActivityRow
                    key={activity.id}
                    activity={activity}
                    selected={selected === activity.id}
                    onSelect={handleSelect}
                    divider={index > 0}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Grille d'activités */}
          <section aria-labelledby="prep-activities-heading">
            {(!query && !category) && (
              <h2 id="prep-activities-heading" className="prep-section-title" style={{ marginBottom: 'var(--prep-space-2)' }}>
                Toutes les activités
              </h2>
            )}
            {filtered.length === 0 ? (
              <p className="prep-help" style={{ textAlign: 'center', padding: 'var(--prep-space-6) 0' }}>
                Aucune activité pour « {query} »
              </p>
            ) : (
              <div className="prep-block">
                {filtered.map((activity, index) => (
                  <ActivityRow
                    key={activity.id}
                    activity={activity}
                    selected={selected === activity.id}
                    onSelect={handleSelect}
                    divider={index > 0}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Footer fixe */}
        <footer className="prep-footer" style={{ flexDirection: 'column', gap: 'var(--prep-space-2)', paddingBlock: 'var(--prep-space-3)' }}>
          <button
            type="button"
            className="prep-footer__primary"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--lkv-radius-control)',
              background: selected ? 'var(--lkv-action)' : 'color-mix(in srgb, var(--lkv-action) 25%, var(--card-tint-solid))',
              color: selected ? 'var(--btn-on-solid)' : 'var(--lkv-text-subtle)',
              border: 0, cursor: selected ? 'pointer' : 'default',
              transition: 'background-color var(--prep-duration-control) var(--prep-ease-standard)',
            }}
            disabled={!selected}
            onClick={handleContinue}
            aria-disabled={!selected}
          >
            Continuer
          </button>
          <button
            type="button"
            onClick={handleFree}
            style={{
              background: 'transparent', border: 0, cursor: 'pointer',
              fontSize: 'var(--lkv-text-footnote)', color: 'var(--lkv-text-secondary)',
              textDecoration: 'underline', padding: 'var(--prep-space-1)',
              alignSelf: 'center',
            }}
          >
            Partir librement sans activité définie
          </button>
        </footer>
      </div>
    );
  }

  function ActivityRow({
    activity,
    selected,
    onSelect,
    divider,
  }: {
    activity: ActivityDef;
    selected: boolean;
    onSelect: (id: string) => void;
    divider: boolean;
  }) {
    return (
      <button
        type="button"
        className="prep-block__row"
        style={divider ? {} : { borderTop: 0 }}
        aria-pressed={selected}
        onClick={() => onSelect(activity.id)}
      >
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 'var(--lkv-radius-concentric)', flexShrink: 0,
          background: selected ? 'color-mix(in srgb, var(--lkv-action) 12%, #fff)' : 'var(--prep-segmented-track)',
          color: selected ? 'var(--lkv-action)' : 'var(--lkv-text-secondary)',
          border: selected ? '1px solid color-mix(in srgb, var(--lkv-action) 26%, transparent)' : '1px solid transparent',
          transition: 'background-color var(--prep-duration-control) var(--prep-ease-standard)',
        }}>
          <Icon name={activity.icon} size={18} aria-hidden="true" />
        </span>
        <span className="prep-block__label" style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', fontWeight: selected ? 650 : undefined, color: selected ? 'var(--lkv-text-primary)' : undefined }}>
          {activity.label}
        </span>
        {selected && (
          <span style={{ flexShrink: 0, color: 'var(--lkv-action)', display: 'flex', alignItems: 'center' }}>
            <Icon name="check" size={16} aria-hidden="true" />
          </span>
        )}
      </button>
    );
  }

  export default ActivityPickerScreen;
  ```

- [ ] **Step 3: Run tests**

  ```bash
  npx vitest run src/features/adventure-prep/__tests__/activity-picker-screen.test.tsx
  npx vitest run src/features/adventure-prep/__tests__/activity-picker-catalog.test.ts
  ```
  Expected: PASS

- [ ] **Step 4: Commit**

  ```bash
  git add src/features/adventure-prep/components/ActivityPickerScreen.tsx
  git commit -m "refonte(prep): ActivityPickerScreen — recherche, catégories, récents, Partir librement"
  ```

---

## Task 4 — DestinationStep — Étape 1 « On part où ? »

**Files:**
- Modify: `src/features/adventure-prep/components/DestinationStep.tsx`

**Interfaces:**
- Consumes: `useAdventurePrepStore` from `../store`; `activityById`, `selectedActivities` from `../catalog`; `canSwapEnds`, `groupValueLabel`, `participantAvatars`, `placeParts`, `ROUTE_SHAPE_OPTIONS`, `shortDateLabel`, `daysLabel` from `../engine/destinationModel`; `canCreateStepOne`, `stepOneMissingSummary`, `stepOneProfile` from `./stepOneProfile`; types from `../types`; `PrepMap` from `./PrepMap`
- Produces: `DestinationStep` component

- [ ] **Step 1: Run tests actuels**

  ```bash
  npx vitest run src/features/adventure-prep/__tests__/destination-screen.test.tsx
  npx vitest run src/features/adventure-prep/__tests__/step-one-profile.test.tsx
  ```
  Expected: PASS — noter les cas.

- [ ] **Step 2: Réécrire la structure principale de `DestinationStep.tsx`**

  Structure : 3 blocs (Parcours / Quand / Avec qui) + carte + footer CTA.
  Chaque bloc = `<div className="prep-block">` avec des `<button className="prep-block__row">`.

  ```tsx
  'use client';

  import React, { useCallback, useMemo } from 'react';
  import Icon from '@/components/ui/Icon';
  import { activityById, selectedActivities } from '../catalog';
  import {
    canSwapEnds, groupValueLabel, MAX_AVATARS, participantAvatars,
    placeParts, ROUTE_SHAPE_OPTIONS, shortDateLabel, daysLabel, type PlaceParts,
  } from '../engine/destinationModel';
  import { canCreateStepOne, stepOneMissingSummary, stepOneProfile } from './stepOneProfile';
  import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
  import type { BudgetLevel, GroupBlock, Pace, PlaceRef, RouteShape, TransportPreference } from '../types';
  import PrepMap from './PrepMap';
  import type { PrepSheetId } from './PrepSheets';

  const PACE_LABELS: Record<Pace, string> = { tranquille: 'Tranquille', normal: 'Normal', rapide: 'Rapide' };
  const BUDGET_LABELS: Record<BudgetLevel, string> = { economique: 'Économe', modere: 'Modéré', confort: 'Confort' };
  const TRANSPORT_LABELS: Record<TransportPreference, string> = {
    peigne: 'À pied', train: 'Train', voiture: 'Voiture', avion: 'Avion', mixte: 'Mixte',
  };

  function placeCoords(place: PlaceRef | null): [number, number] | null {
    if (!place) return null;
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon)) return null;
    if (place.lat === 0 && place.lon === 0) return null;
    return [place.lat, place.lon];
  }

  export interface DestinationStepProps {
    onOpenSheet: (sheet: PrepSheetId, focusStepId?: string | null) => void;
  }

  export function DestinationStep({ onOpenSheet }: DestinationStepProps) {
    const draft = useAdventurePrepStore((state) => state.draft);
    const swapRouteEnds = useAdventurePrepStore((state) => state.swapRouteEnds);
    const setRouteShape = useAdventurePrepStore((state) => state.setRouteShape);
    const goToStep = useAdventurePrepStore((state) => state.goToStep);

    const activity = draft.activities.primary ? activityById(draft.activities.primary) : null;
    const canCreate = canCreateStepOne(draft);
    const missing = stepOneMissingSummary(draft);

    // Carte : départ + arrivée si connus
    const routeCoords = useMemo<Array<[number, number]>>(() => {
      const coords: Array<[number, number]> = [];
      const dep = placeCoords(draft.route.origin);
      const arr = placeCoords(draft.route.destination);
      if (dep) coords.push(dep);
      if (arr && (arr[0] !== dep?.[0] || arr[1] !== dep?.[1])) coords.push(arr);
      return coords;
    }, [draft.route]);

    const handleContinue = useCallback(() => {
      if (!canCreate) return;
      goToStep('itinerary');
    }, [canCreate, goToStep]);

    const isBoucle = draft.route.shape === 'boucle';
    const canSwap = canSwapEnds(draft.route);
    const originParts = draft.route.origin ? placeParts(draft.route.origin) : null;
    const destParts = draft.route.destination ? placeParts(draft.route.destination) : null;

    return (
      <div className="prep-screen prep-screen--dense">
        <div className="prep-body">
          {/* Titre */}
          <h1 className="prep-title">
            {activity ? `On part ${activity.label.toLowerCase()} ?` : 'On part où ?'}
          </h1>

          {/* Bloc 1 : Parcours */}
          <section aria-labelledby="prep-s1-parcours">
            <h2 id="prep-s1-parcours" className="prep-section-title" style={{ marginBottom: 'var(--prep-space-2)' }}>
              Parcours
            </h2>
            <div className="prep-block">
              {/* Boucle / Aller simple */}
              <div className="prep-block__row" style={{ paddingBottom: 0 }}>
                <div className="prep-segmented" role="group" aria-label="Forme du parcours" style={{ flex: 1, margin: 0 }}>
                  {ROUTE_SHAPE_OPTIONS.map((shape) => (
                    <button
                      key={shape}
                      type="button"
                      className="prep-segmented__item"
                      aria-pressed={draft.route.shape === shape}
                      onClick={() => setRouteShape(shape as RouteShape)}
                    >
                      <Icon name={shape === 'boucle' ? 'refresh-cw' : 'arrow-right'} size={13} aria-hidden="true" />
                      {shape === 'boucle' ? 'Boucle' : 'Aller simple'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Départ */}
              <button type="button" className="prep-block__row" onClick={() => onOpenSheet('place')}>
                <Icon name="map-pin" size={16} aria-hidden="true" style={{ color: 'var(--lkv-action)', flexShrink: 0 }} />
                <span className="prep-block__label">Départ</span>
                <PlaceValue parts={originParts} />
              </button>

              {/* Arrivée (si aller simple) */}
              {!isBoucle && (
                <button type="button" className="prep-block__row" onClick={() => onOpenSheet('place')}>
                  <Icon name="flag" size={16} aria-hidden="true" style={{ color: 'var(--lkv-action)', flexShrink: 0 }} />
                  <span className="prep-block__label">Arrivée</span>
                  <PlaceValue parts={destParts} />
                </button>
              )}

              {/* Inverser (si aller simple et deux extrémités connues) */}
              {!isBoucle && canSwap && (
                <div className="prep-swap">
                  <button
                    type="button"
                    className="prep-swap__button"
                    onClick={swapRouteEnds}
                    aria-label="Inverser départ et arrivée"
                  >
                    <Icon name="arrow-up-down" size={14} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Bloc 2 : Quand ? */}
          <section aria-labelledby="prep-s1-calendar">
            <h2 id="prep-s1-calendar" className="prep-section-title" style={{ marginBottom: 'var(--prep-space-2)' }}>
              Quand ?
            </h2>
            <div className="prep-block prep-block--cells">
              <button type="button" className="prep-cell" onClick={() => onOpenSheet('calendar')}>
                <span className="prep-cell__head">
                  <Icon name="calendar" size={13} aria-hidden="true" />
                  Départ
                </span>
                <span className="prep-cell__value" data-unknown={!draft.calendar.startDate || undefined}>
                  {draft.calendar.startDate ? shortDateLabel(draft.calendar.startDate) : 'À choisir'}
                </span>
              </button>
              <button type="button" className="prep-cell" onClick={() => onOpenSheet('calendar')}>
                <span className="prep-cell__head">
                  <Icon name="clock" size={13} aria-hidden="true" />
                  Durée
                </span>
                <span className="prep-cell__value" data-unknown={!draft.calendar.durationDays || undefined}>
                  {draft.calendar.durationDays ? daysLabel(draft.calendar.durationDays) : 'À préciser'}
                </span>
                {draft.calendar.durationIsSuggested && draft.calendar.durationDays && (
                  <span className="prep-block__hint" style={{ padding: 0, fontSize: 'var(--lkv-text-caption)' }}>
                    Durée proposée
                  </span>
                )}
              </button>
            </div>
          </section>

          {/* Bloc 3 : Avec qui ? */}
          <section aria-labelledby="prep-s1-group">
            <h2 id="prep-s1-group" className="prep-section-title" style={{ marginBottom: 'var(--prep-space-2)' }}>
              Avec qui ?
            </h2>
            <div className="prep-block">
              <button type="button" className="prep-block__row" onClick={() => onOpenSheet('group')}>
                <Icon name="users" size={16} aria-hidden="true" style={{ color: 'var(--lkv-text-secondary)', flexShrink: 0 }} />
                <span className="prep-block__label">
                  {draft.group.mode === 'solo' ? 'Solo' : 'Groupe'}
                </span>
                <GroupValue group={draft.group} />
              </button>
            </div>
          </section>

          {/* Lien préférences */}
          <button
            type="button"
            onClick={() => onOpenSheet('preferences')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 'var(--prep-space-2)',
              background: 'transparent', border: 0, cursor: 'pointer', alignSelf: 'flex-start',
              fontSize: 'var(--lkv-text-footnote)', color: 'var(--lkv-text-secondary)',
              padding: 'var(--prep-space-1) 0',
            }}
          >
            <Icon name="sliders-horizontal" size={13} aria-hidden="true" />
            Préférences (budget, rythme, transport)
          </button>

          {/* Carte */}
          <PrepMap
            routeCoords={routeCoords}
            points={[]}
            compact
          />
        </div>

        {/* Footer CTA */}
        <footer className="prep-footer">
          <button
            type="button"
            className="prep-footer__primary"
            disabled={!canCreate}
            aria-disabled={!canCreate}
            onClick={handleContinue}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--lkv-radius-control)',
              background: canCreate ? 'var(--lkv-action)' : 'color-mix(in srgb, var(--lkv-action) 25%, var(--card-tint-solid))',
              color: canCreate ? 'var(--btn-on-solid)' : 'var(--lkv-text-subtle)',
              border: 0, cursor: canCreate ? 'pointer' : 'default',
              transition: 'background-color var(--prep-duration-control) var(--prep-ease-standard)',
            }}
          >
            {canCreate ? 'Créer mon parcours' : (missing ?? 'Complète pour continuer')}
          </button>
        </footer>
      </div>
    );
  }

  function PlaceValue({ parts }: { parts: PlaceParts | null }) {
    if (!parts) {
      return <span className="prep-block__value" data-unknown="true">À préciser</span>;
    }
    return (
      <div className="prep-block__stack">
        <span className="prep-block__value">{parts.main}</span>
        {parts.detail && <span className="prep-block__detail">{parts.detail}</span>}
      </div>
    );
  }

  function GroupValue({ group }: { group: GroupBlock }) {
    const label = groupValueLabel(group);
    const avatars = participantAvatars(group);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--prep-space-2)' }}>
        {avatars.length > 0 && (
          <div className="prep-avatars" aria-hidden="true">
            {avatars.slice(0, MAX_AVATARS).map((avatar, i) => (
              <span key={i} className="prep-avatar" data-tone={String((i % 5) + 1)}>{avatar}</span>
            ))}
            {avatars.length > MAX_AVATARS && (
              <span className="prep-avatar" data-tone="more">+{avatars.length - MAX_AVATARS}</span>
            )}
          </div>
        )}
        <span className="prep-block__value">{label}</span>
      </div>
    );
  }

  export default DestinationStep;
  ```

- [ ] **Step 3: Run tests**

  ```bash
  npx vitest run src/features/adventure-prep/__tests__/destination-screen.test.tsx
  npx vitest run src/features/adventure-prep/__tests__/step-one-profile.test.tsx
  npx vitest run src/features/adventure-prep/__tests__/destination-model.test.ts
  ```
  Expected: PASS

- [ ] **Step 4: Commit**

  ```bash
  git add src/features/adventure-prep/components/DestinationStep.tsx
  git commit -m "refonte(prep): DestinationStep — 3 blocs, carte, CTA Créer mon parcours"
  ```

---

## Task 5 — ItineraryStep — Étape 2 « Voici ton aventure »

**Files:**
- Modify: `src/features/adventure-prep/components/ItineraryStep.tsx`

**Interfaces:**
- Consumes: `fetchItineraryProposal` from `@/app/prepare/actions`; `activityById` from `../catalog`; `metricsFor` from `../engine/metrics`; `daySteps`, `knownGaps` from `../engine/itinerary`; `runItineraryGeneration` from `../engine/itineraryPhases`; `minutesLabel` from `../engine/labels`; `stateLabel`, `moneyLabel`, `A_VERIFIER` from `../engine/trust`; store, types, PrepMap
- Produces: `ItineraryStepScreen` component

- [ ] **Step 1: Run tests itinerary**

  ```bash
  npx vitest run src/features/adventure-prep/__tests__/itinerary.test.ts
  npx vitest run src/features/adventure-prep/__tests__/itinerary-ai.test.ts
  npx vitest run src/features/adventure-prep/__tests__/metrics.test.ts
  npx vitest run src/features/adventure-prep/__tests__/generation.test.ts
  ```
  Expected: PASS

- [ ] **Step 2: Réécrire ItineraryStep — état de génération**

  Conserve exactement la logique de génération existante. Ne touche qu'au layout JSX. Sections :
  1. Bandeau de génération si `status === 'en_cours'`
  2. Métriques 3 colonnes
  3. Sélecteur de jour (si > 1 jour)
  4. Fiche de l'étape sélectionnée
  5. Boutons Ajuster / Étapes / Ajouter
  6. Carte
  7. Footer CTA

  Le fichier `ItineraryStep.tsx` actuel a 638 lignes. Réécrire **uniquement le JSX du return** (ligne ~300 à fin) en gardant toute la logique du dessus identique.

  Trouver la ligne du `return (` principal (chercher `return (` après `export function ItineraryStepScreen`) et remplacer depuis là jusqu'à la fin par :

  ```tsx
  // WITHIN ItineraryStepScreen function, replace only the return() and its JSX:
  return (
    <div className="prep-screen">
      <div className="prep-body">
        {/* Activité sélectionnée */}
        {actDef && (
          <button
            type="button"
            className="prep-pill"
            onClick={() => onOpenSheet('coverage')}
            aria-label="Voir le contexte de l'aventure"
          >
            <Icon name={actDef.icon} size={14} aria-hidden="true" />
            {actDef.label}
            {preferenceSummary && <span style={{ opacity: 0.7, fontWeight: 500 }}> · {preferenceSummary}</span>}
          </button>
        )}

        {/* Bandeau de génération */}
        {generation.status === 'en_cours' && (
          <GenerationRail phases={generation.phases} onStop={stopGeneration} />
        )}

        {/* Notice si repli sans IA */}
        {generation.notice && (
          <p className="prep-help" role="status" aria-live="polite">{generation.notice}</p>
        )}

        {/* Erreur */}
        {generation.status === 'echec' && (
          <div className="prep-block" style={{ padding: 'var(--prep-space-4)' }}>
            <p style={{ color: 'var(--lkv-text-primary)', marginBottom: 'var(--prep-space-3)' }}>
              {generation.error ?? 'La génération a échoué.'}
            </p>
            <button type="button" className="prep-action" onClick={startGeneration}>
              <Icon name="refresh-cw" size={14} aria-hidden="true" />
              Réessayer
            </button>
          </div>
        )}

        {/* Métriques — si un itinéraire existe */}
        {itinerary && (
          <>
            <div className="prep-metrics" aria-label="Métriques du parcours">
              {metricsFor(itinerary).map((m) => (
                <div key={m.key} className="prep-metric">
                  <span className="prep-metric__label">{m.label}</span>
                  <span className="prep-metric__value" data-unknown={m.value === null || undefined}>
                    {m.value ?? '—'}
                  </span>
                  {m.scope && <span className="prep-metric__scope">{m.scope}</span>}
                </div>
              ))}
            </div>

            {/* Sélecteur de jour */}
            {itinerary.days > 1 && (
              <div className="prep-days" role="group" aria-label="Sélection du jour">
                <button
                  type="button"
                  className="prep-day"
                  aria-pressed={selectedDay === null}
                  onClick={() => setSelectedDay(null)}
                >
                  Tout
                </button>
                {Array.from({ length: itinerary.days }, (_, i) => i + 1).map((day) => (
                  <button
                    key={day}
                    type="button"
                    className="prep-day"
                    aria-pressed={selectedDay === day}
                    onClick={() => setSelectedDay(day)}
                  >
                    J{day}
                  </button>
                ))}
              </div>
            )}

            {/* Fiche de l'étape mise en avant */}
            {currentStep && (
              <div className="prep-step" aria-label={`Étape : ${currentStep.title}`}>
                <div className="prep-step__head">
                  <div className="prep-step__thumb" aria-hidden="true">
                    <Icon name={STEP_ICONS[currentStep.kind]} size={20} />
                  </div>
                  <div className="prep-step__body">
                    <p className="prep-step__name">{currentStep.title}</p>
                    {currentStep.startTime && (
                      <p className="prep-step__when">
                        {currentStep.startTime}
                        {currentStep.durationMin && ` · ${minutesLabel(currentStep.durationMin)}`}
                      </p>
                    )}
                    {currentStep.reason && (
                      <p className="prep-step__reason">{currentStep.reason}</p>
                    )}
                  </div>
                  <div className="prep-step__price" data-state={currentStep.state}>
                    {moneyLabel(currentStep.price)}
                  </div>
                </div>

                <div className="prep-step__actions">
                  <button type="button" className="prep-action"
                    onClick={() => onOpenSheet('step', currentStep.id)}>
                    <Icon name="info" size={13} aria-hidden="true" />
                    Détails
                  </button>
                  <button type="button" className="prep-action">
                    <Icon name="replace" size={13} aria-hidden="true" />
                    Remplacer
                  </button>
                  <button
                    type="button"
                    className="prep-action"
                    aria-pressed={currentStep.kept}
                    onClick={() => toggleKept(currentStep.id)}
                  >
                    <Icon name="bookmark" size={13} aria-hidden="true" />
                    {currentStep.kept ? 'Retenu ✓' : 'Retenir'}
                  </button>
                </div>
              </div>
            )}

            {/* Boutons Ajuster / Étapes / Ajouter */}
            <div className="prep-actionrow" role="group" aria-label="Actions sur le parcours">
              <button type="button" className="prep-action" onClick={() => onOpenSheet('adjust')}>
                <Icon name="sliders-horizontal" size={14} aria-hidden="true" />
                Ajuster
              </button>
              <button type="button" className="prep-action" onClick={() => onOpenSheet('steps')}>
                <Icon name="list" size={14} aria-hidden="true" />
                Étapes
              </button>
              <button type="button" className="prep-action" onClick={() => onOpenSheet('add')}>
                <Icon name="plus" size={14} aria-hidden="true" />
                Ajouter
              </button>
            </div>
          </>
        )}

        {/* Bouton générer si pas encore de parcours */}
        {!itinerary && generation.status !== 'en_cours' && canGenerate && (
          <button type="button" className="prep-action" onClick={startGeneration}>
            <Icon name="sparkles" size={14} aria-hidden="true" />
            Générer le parcours
          </button>
        )}

        {/* Carte */}
        <PrepMap
          routeCoords={mapRouteCoords}
          points={mapPoints}
          selectedDay={selectedDay}
        />
      </div>

      {/* Footer CTA */}
      <footer className="prep-footer">
        <button
          type="button"
          className="prep-footer__primary"
          disabled={!canProceed}
          aria-disabled={!canProceed}
          onClick={() => goToStep('departure')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--lkv-radius-control)',
            background: canProceed ? 'var(--lkv-action)' : 'color-mix(in srgb, var(--lkv-action) 25%, var(--card-tint-solid))',
            color: canProceed ? 'var(--btn-on-solid)' : 'var(--lkv-text-subtle)',
            border: 0, cursor: canProceed ? 'pointer' : 'default',
          }}
        >
          Préparer le départ
        </button>
      </footer>
    </div>
  );
  ```

  Les variables `generation`, `itinerary`, `currentStep`, `selectedDay`, `setSelectedDay`, `startGeneration`, `stopGeneration`, `toggleKept`, `canGenerate`, `canProceed`, `mapRouteCoords`, `mapPoints`, `preferenceSummary`, `actDef` doivent provenir de la logique existante du composant (à conserver intacte).

- [ ] **Step 3: Composer GenerationRail**

  Ajouter en bas du fichier :

  ```tsx
  function GenerationRail({
    phases,
    onStop,
  }: {
    phases: readonly import('../types').GenerationPhase[];
    onStop: () => void;
  }) {
    return (
      <div className="prep-rail" role="status" aria-live="polite" aria-label="Génération en cours">
        {phases.map((phase) => {
          const state = phase.done ? 'done' : 'active';
          return (
            <div key={phase.id} className="prep-rail__line" data-state={state}>
              <span className="prep-rail__dot" aria-hidden="true">
                {phase.done
                  ? <Icon name="check" size={14} />
                  : <Icon name="loader-2" size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              </span>
              {phase.label}
            </div>
          );
        })}
        <button
          type="button"
          className="prep-action"
          onClick={onStop}
          style={{ alignSelf: 'flex-start', marginTop: 'var(--prep-space-2)' }}
        >
          Arrêter
        </button>
      </div>
    );
  }
  ```

- [ ] **Step 4: Run tests**

  ```bash
  npx vitest run src/features/adventure-prep/__tests__/itinerary.test.ts
  npx vitest run src/features/adventure-prep/__tests__/prep-screens.test.tsx
  ```
  Expected: PASS

- [ ] **Step 5: Commit**

  ```bash
  git add src/features/adventure-prep/components/ItineraryStep.tsx
  git commit -m "refonte(prep): ItineraryStep — métriques, sélecteur jour, fiche, Ajuster/Étapes/Ajouter"
  ```

---

## Task 6 — DepartureStep — Étape 3 « Tout est prêt ? »

**Files:**
- Modify: `src/features/adventure-prep/components/DepartureStep.tsx`

**Interfaces:**
- Consumes: `useAdventurePrepStore`; `activityById`; `gearGaps`, `packWeight`, `resolvedGear` from `../engine/gear`; `mealNeeds`, `uncoveredMeals`, `waterNeeds` from `../engine/consumables`; `knownGaps` from `../engine/itinerary`; `bookWeightLabel`, `gearSummary`, `gearToVerifyCount`, `plural` from `../engine/labels`; `A_VERIFIER` from `../engine/trust`; types, PrepMap
- Produces: `DepartureStep` component

- [ ] **Step 1: Run tests**

  ```bash
  npx vitest run src/features/adventure-prep/__tests__/departure-screen.test.tsx
  npx vitest run src/features/adventure-prep/__tests__/gear.test.ts
  npx vitest run src/features/adventure-prep/__tests__/consumables.test.ts
  ```
  Expected: PASS

- [ ] **Step 2: Réécrire `DepartureStep.tsx`**

  Structure : couverture + 3 blocs cliquables + points ouverts + carte + CTA.

  ```tsx
  'use client';

  import React, { useCallback, useEffect, useRef, useState } from 'react';
  import Icon from '@/components/ui/Icon';
  import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
  import { activityById } from '../catalog';
  import { gearGaps, packWeight, resolvedGear } from '../engine/gear';
  import { mealNeeds, uncoveredMeals, waterNeeds } from '../engine/consumables';
  import { knownGaps } from '../engine/itinerary';
  import { bookWeightLabel, gearSummary, gearToVerifyCount, plural } from '../engine/labels';
  import { A_VERIFIER } from '../engine/trust';
  import type { AdventurePrepDraft, GearNeed, PlaceRef } from '../types';
  import { PrepMap } from './PrepMap';
  import type { PrepSheetId } from './PrepSheets';

  export interface DepartureStepProps {
    onOpenSheet: (sheet: PrepSheetId, focusStepId?: string | null) => void;
  }

  function routeCoords(draft: AdventurePrepDraft): Array<[number, number]> {
    const coords: Array<[number, number]> = [];
    const push = (place: PlaceRef | null) => {
      if (!place) return;
      const last = coords[coords.length - 1];
      if (last && last[0] === place.lat && last[1] === place.lon) return;
      coords.push([place.lat, place.lon]);
    };
    push(draft.route.origin);
    if (draft.route.shape === 'aller_simple') push(draft.route.destination);
    return coords;
  }

  export function DepartureStep({ onOpenSheet }: DepartureStepProps) {
    const draft = useAdventurePrepStore((state) => state.draft);
    const saveAdventure = useAdventurePrepStore((state) => state.saveAdventure);
    const [saving, setSaving] = useState(false);

    const gear = resolvedGear(draft);
    const pendingGear = gearToVerifyCount(gear, draft.packedGearIds);
    const weight = packWeight(gear, draft.packedGearIds);
    const weightLabel = weight !== null ? bookWeightLabel(weight) : null;
    const meals = uncoveredMeals(mealNeeds(draft.itinerary));
    const water = draft.itinerary ? waterNeeds(draft.itinerary.steps) : [];
    const gaps = draft.itinerary ? knownGaps(draft.itinerary) : [];

    const activity = draft.activities.primary ? activityById(draft.activities.primary) : null;
    const headcount = draft.group.adults + draft.group.children;
    const coords = routeCoords(draft);

    const handleSave = useCallback(async () => {
      if (saving) return;
      setSaving(true);
      try {
        await saveAdventure();
      } finally {
        setSaving(false);
      }
    }, [saving, saveAdventure]);

    return (
      <div className="prep-screen">
        <div className="prep-body">
          {/* Couverture compacte */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--prep-space-3)' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 'var(--lkv-radius-concentric)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'color-mix(in srgb, var(--lkv-action) 12%, #fff)',
              color: 'var(--lkv-action)',
            }}>
              <Icon name={activity?.icon ?? 'compass'} size={22} aria-hidden="true" />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className="prep-title" style={{ fontSize: 'var(--lkv-text-title-sm)' }}>
                {draft.coverName ?? activity?.label ?? 'Mon aventure'}
              </p>
              {draft.route.origin && (
                <p style={{ fontSize: 'var(--lkv-text-footnote)', color: 'var(--lkv-text-secondary)', marginTop: 2 }}>
                  {draft.route.origin.name}
                  {draft.calendar.startDate ? ` · ${draft.calendar.startDate}` : ''}
                </p>
              )}
            </div>
            <button
              type="button"
              className="prep-nav__icon"
              onClick={() => onOpenSheet('coverage')}
              aria-label="Modifier la couverture"
            >
              <Icon name="pencil" size={16} aria-hidden="true" />
            </button>
          </div>

          {/* Bloc Équipement */}
          <SummaryBlock
            icon="backpack"
            title="Équipement"
            value={pendingGear > 0
              ? `${pendingGear} ${plural(pendingGear, 'élément')} à confirmer`
              : weightLabel ?? gearSummary(gear, draft.packedGearIds)}
            secondary={weightLabel && pendingGear > 0 ? `Poids estimé : ${weightLabel}` : null}
            onClick={() => onOpenSheet('gear')}
          />

          {/* Bloc Eau et repas */}
          <SummaryBlock
            icon="droplets"
            title="Eau et repas"
            value={meals.length > 0
              ? `${meals.length} repas à organiser`
              : water.length > 0
                ? `${water.length} points d'eau`
                : 'Couvert'}
            onClick={() => onOpenSheet('consumables')}
          />

          {/* Bloc Participants */}
          <SummaryBlock
            icon="users"
            title="Participants"
            value={draft.group.mode === 'solo'
              ? 'Solo'
              : `${headcount} ${plural(headcount, 'personne')}${draft.group.knownMembers.length > 0 ? ` · ${draft.group.knownMembers.length} confirmé${draft.group.knownMembers.length > 1 ? 's' : ''}` : ''}`}
            onClick={() => onOpenSheet('participants')}
          />

          {/* Points ouverts */}
          {gaps.length > 0 && (
            <div className="prep-block">
              <div className="prep-block__row" style={{ cursor: 'default' }}>
                <Icon name="alert-circle" size={16} aria-hidden="true" style={{ color: 'var(--lkv-warning-dark)', flexShrink: 0 }} />
                <span className="prep-block__label" style={{ color: 'var(--lkv-text-primary)' }}>
                  À vérifier avant de partir
                </span>
              </div>
              {gaps.map((gap) => (
                <div key={gap.id} className="prep-block__row" style={{ cursor: 'default', paddingBlock: 'var(--prep-space-2)' }}>
                  <span style={{ width: 16, flexShrink: 0 }} />
                  <span className="prep-block__label" style={{ fontSize: 'var(--lkv-text-footnote)' }}>
                    {gap.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Carte */}
          <PrepMap routeCoords={coords} points={[]} />
        </div>

        {/* Footer CTA */}
        <footer className="prep-footer">
          <button
            type="button"
            className="prep-footer__primary"
            onClick={handleSave}
            disabled={saving}
            aria-disabled={saving}
            aria-busy={saving}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--prep-space-2)',
              borderRadius: 'var(--lkv-radius-control)',
              background: 'var(--lkv-action)', color: 'var(--btn-on-solid)', border: 0, cursor: 'pointer',
            }}
          >
            {saving && <Icon name="loader-2" size={16} aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }} />}
            Enregistrer mon aventure
          </button>
        </footer>
      </div>
    );
  }

  function SummaryBlock({ icon, title, value, secondary, onClick }: {
    icon: string; title: string; value: string; secondary?: string | null; onClick: () => void;
  }) {
    return (
      <div className="prep-block">
        <button type="button" className="prep-block__row" onClick={onClick}>
          <Icon name={icon} size={16} aria-hidden="true" style={{ color: 'var(--lkv-action)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="prep-block__label">{title}</span>
            {secondary && (
              <span style={{ display: 'block', fontSize: 'var(--lkv-text-caption)', color: 'var(--lkv-text-subtle)' }}>
                {secondary}
              </span>
            )}
          </div>
          <span className="prep-block__value">{value}</span>
          <Icon name="chevron-right" size={14} aria-hidden="true" style={{ color: 'var(--lkv-text-subtle)', flexShrink: 0 }} />
        </button>
      </div>
    );
  }

  export default DepartureStep;
  ```

- [ ] **Step 3: Run tests**

  ```bash
  npx vitest run src/features/adventure-prep/__tests__/departure-screen.test.tsx
  npx vitest run src/features/adventure-prep/__tests__/gear.test.ts
  ```
  Expected: PASS

- [ ] **Step 4: Commit**

  ```bash
  git add src/features/adventure-prep/components/DepartureStep.tsx
  git commit -m "refonte(prep): DepartureStep — équipement, eau-repas, participants, Enregistrer"
  ```

---

## Task 7 — PrepMap — Carte avec contrôles flottants

**Files:**
- Modify: `src/features/adventure-prep/components/PrepMap.tsx`

**Interfaces:**
- Consumes: MapLibre ou HubGlobeMap/HubRouteMap existants; types locaux `PrepMapPoint`
- Produces: `PrepMap` component avec props `routeCoords`, `points`, `compact?`, `selectedDay?`, `onPointClick?`

- [ ] **Step 1: Lire l'implémentation actuelle**

  ```bash
  Get-Content "src/features/adventure-prep/components/PrepMap.tsx" | head -80
  ```

- [ ] **Step 2: Ajouter les contrôles flottants manquants**

  La carte actuelle possède déjà `.prep-map`, `.prep-map__glass`, `.prep-map__controls--end`. S'assurer que les deux contrôles suivants sont présents dans la JSX :

  ```tsx
  {/* Périmètre : Jour X / Ensemble */}
  {selectedDay !== null && itinerary && itinerary.days > 1 && (
    <div className="prep-map__scope">
      <span className="prep-map__glass">J{selectedDay}</span>
    </div>
  )}

  {/* Agrandir */}
  <div className="prep-map__controls prep-map__controls--end">
    <button
      type="button"
      className="prep-map__glass prep-map__glass--icon"
      onClick={() => setFullscreen((prev) => !prev)}
      aria-label={fullscreen ? 'Réduire la carte' : 'Agrandir la carte'}
    >
      <Icon name={fullscreen ? 'minimize-2' : 'maximize-2'} size={16} aria-hidden="true" />
    </button>
    <button
      type="button"
      className="prep-map__glass prep-map__glass--icon"
      onClick={recenter}
      aria-label="Recentrer sur le parcours"
    >
      <Icon name="crosshair" size={16} aria-hidden="true" />
    </button>
  </div>
  ```

- [ ] **Step 3: Run tests map**

  ```bash
  npx vitest run src/features/adventure-prep/__tests__/prep-map-fullscreen.test.tsx
  npx vitest run src/features/adventure-prep/__tests__/prep-body-layout.test.ts
  ```
  Expected: PASS

- [ ] **Step 4: Commit**

  ```bash
  git add src/features/adventure-prep/components/PrepMap.tsx
  git commit -m "refonte(prep): PrepMap — contrôles flottants, plein écran, recentrer"
  ```

---

## Task 8 — PrepSetupSheets — Sheets de l'étape 1

**Files:**
- Modify: `src/features/adventure-prep/components/PrepSetupSheets.tsx`

**Interfaces:**
- Consumes: store, types, geocodeService; composants UI du système (`Sheet`, `Button`)
- Produces: `PlaceSheet`, `CalendarSheet`, `GroupSheet`, `PreferencesSheet`, `CoverageSheet`, `ParticipantsSheet`

- [ ] **Step 1: Run tests sheets**

  ```bash
  npx vitest run src/features/adventure-prep/__tests__/step-sheet.test.tsx
  npx vitest run src/features/adventure-prep/__tests__/use-geocode.test.ts
  ```
  Expected: PASS

- [ ] **Step 2: Auditer le fichier actuel**

  Lire les 100 premières lignes pour comprendre la structure. Identifier les sheets mal formés (libellés manquants, CTA absent, pas de `autoFocus` sur le champ de recherche du PlaceSheet).

  ```bash
  Get-Content "src/features/adventure-prep/components/PrepSetupSheets.tsx" | Select-Object -First 120
  ```

- [ ] **Step 3: Corriger PlaceSheet — focus auto + CTA**

  S'assurer que :
  - L'input de recherche a `autoFocus`
  - Il y a un bouton `« Choisir ce lieu »` en bas
  - Les résultats affichent commune + pays sur 2 niveaux
  - Le libellé « À choisir » s'affiche si aucun lieu n'est sélectionné
  - Le bouton « Ma position » demande la géolocalisation uniquement au clic

- [ ] **Step 4: Corriger CalendarSheet — durée proposée**

  S'assurer que :
  - La durée affiche « Durée proposée » si `durationIsSuggested`
  - Le calendrier a un min-height de 44px par case de jour
  - CTA : « Appliquer »

- [ ] **Step 5: Corriger GroupSheet — adultes, enfants, animaux**

  S'assurer que :
  - Solo / Groupe segmented
  - Stepper adultes (min 1)
  - Stepper enfants (min 0, visible uniquement si groupe)
  - Switch animaux
  - Membres connus listés
  - CTA : « Confirmer »

- [ ] **Step 6: Run tests et commit**

  ```bash
  npx vitest run src/features/adventure-prep/__tests__
  git add src/features/adventure-prep/components/PrepSetupSheets.tsx
  git commit -m "refonte(prep): PrepSetupSheets — place focus auto, calendrier durée proposée, groupe"
  ```

---

## Task 9 — PrepItinerarySheets — Sheets de l'étape 2

**Files:**
- Modify: `src/features/adventure-prep/components/PrepItinerarySheets.tsx`

**Interfaces:**
- Consumes: store, types, engine; `AdjustmentId` from `../types`
- Produces: `StepSheet`, `StepsSheet`, `AdjustSheet`, `AddStepSheet`

- [ ] **Step 1: Auditer le fichier actuel**

  ```bash
  Get-Content "src/features/adventure-prep/components/PrepItinerarySheets.tsx" | head -100
  ```

- [ ] **Step 2: StepSheet — 5 états de réservation + actions**

  S'assurer que :
  - Les 5 états (`propose`, `a_reserver`, `confirme`, `confirme_communaute`, et `retenu`) sont affichés avec icône + libellé
  - Boutons : « Retenir » / « Remplacer » / « Voir l'offre » / « J'ai réservé » / « Signaler »
  - Prix affiché par unité, par personne, total groupe — jamais mélangé
  - `data-state` sur le badge de prix pour la couleur CSS

  ```tsx
  // Badge état dans StepSheet
  const STATE_ICONS: Record<string, string> = {
    propose: 'sparkles',
    a_reserver: 'ticket',
    confirme: 'check-circle-2',
    confirme_communaute: 'shield-check',
    retenu: 'bookmark',
  };
  const STATE_LABELS: Record<string, string> = {
    propose: 'Suggestion',
    a_reserver: 'À réserver',
    confirme: 'Confirmé par toi',
    confirme_communaute: 'Confirmé',
    retenu: 'Retenu',
  };
  ```

- [ ] **Step 3: AdjustSheet — 5 ajustements nommés**

  S'assurer que les 5 boutons portent les bons IDs (`moins_cher`, `moins_de_transport`, `plus_de_nature`, `plus_tranquille`, `plus_de_decouvertes`) avec libellés en français et impact expliqué en mots après sélection.

- [ ] **Step 4: StepsSheet — liste + tap vers étape**

  La liste chronologique par jour : chaque ligne a `role="button"`, au tap elle ferme le sheet et sélectionne l'étape dans `ItineraryStep`.

- [ ] **Step 5: Run tests et commit**

  ```bash
  npx vitest run src/features/adventure-prep/__tests__
  git add src/features/adventure-prep/components/PrepItinerarySheets.tsx
  git commit -m "refonte(prep): PrepItinerarySheets — 5 états, AdjustSheet, StepsSheet tap"
  ```

---

## Task 10 — PrepGearSheets — Équipement et consommables

**Files:**
- Modify: `src/features/adventure-prep/components/PrepGearSheets.tsx`

**Interfaces:**
- Consumes: store, `resolvedGear`, `gearToVerifyCount`, `packWeight` from `../engine/gear`; `mealNeeds`, `waterNeeds`, `uncoveredMeals` from `../engine/consumables`
- Produces: `GearSheet`, `ConsumablesSheet`

- [ ] **Step 1: GearSheet — filtre À vérifier / Manquant / Tout**

  S'assurer que :
  - Filtre segmented en haut : « À vérifier / Manquant / Tout »
  - Chaque ligne : nom, quantité, personne responsable (ou « Non attribué »), poids si connu, case « Dans le sac »
  - Case « Dans le sac » = `<input type="checkbox">` accessible
  - « Possédé » ≠ « Dans le sac » — case cochée seulement si l'utilisateur l'a fait
  - Bouton « Ajouter un élément » en bas

- [ ] **Step 2: ConsumablesSheet — eau par segment, repas**

  S'assurer que :
  - Eau : litres/personne par étape jusqu'au prochain ravitaillement
  - Fiabilité du point de ravitaillement affichée (fiable / incertaine)
  - Alternative si indisponible
  - Repas : par jour, par slot (PD / déjeuner / dîner)
  - Repas couverts vs à prévoir différenciés

- [ ] **Step 3: Run tests et commit**

  ```bash
  npx vitest run src/features/adventure-prep/__tests__/gear.test.ts
  npx vitest run src/features/adventure-prep/__tests__/consumables.test.ts
  git add src/features/adventure-prep/components/PrepGearSheets.tsx
  git commit -m "refonte(prep): PrepGearSheets — filtre état, checkbox Dans le sac, ConsumablesSheet"
  ```

---

## Task 11 — PrepInviteScreen — Invitation

**Files:**
- Modify: `src/features/adventure-prep/components/PrepInviteScreen.tsx`

**Interfaces:**
- Consumes: `buildPrepInviteUrl` from `@/app/prepare/actions`; store
- Produces: `PrepInviteScreen` component

- [ ] **Step 1: Auditer le composant actuel**

  ```bash
  Get-Content "src/features/adventure-prep/components/PrepInviteScreen.tsx" | head -80
  ```

- [ ] **Step 2: S'assurer des éléments requis**

  - Couverture compacte de l'aventure (nom, dates, destination)
  - Message personnalisé modifiable (textarea)
  - Switch : « Peut proposer des étapes »
  - Bouton « Copier le lien »
  - Bouton « Partager » (Web Share API si disponible)
  - Mention explicite : « L'invitation ne donne pas accès à ta localisation »

- [ ] **Step 3: Run tests et commit**

  ```bash
  npx vitest run src/features/adventure-prep/__tests__/invite-screen.test.tsx
  git add src/features/adventure-prep/components/PrepInviteScreen.tsx
  git commit -m "refonte(prep): PrepInviteScreen — couverture, switch droits, mention localisation"
  ```

---

## Task 12 — CSS additionnel + spin animation

**Files:**
- Modify: `src/features/adventure-prep/adventure-prep.css` (ajout en fin de fichier uniquement)

**Interfaces:**
- Produces: `.prep-visually-hidden`, `@keyframes spin`, classes manquantes

- [ ] **Step 1: Vérifier les classes manquantes**

  Chercher dans les composants refondus les classes CSS utilisées mais pas encore définies :

  ```bash
  grep -rn "className=\"prep-" src/features/adventure-prep/components/ | grep -v "prep-block\|prep-body\|prep-screen\|prep-nav\|prep-footer\|prep-map\|prep-days\|prep-day\|prep-metrics\|prep-metric\|prep-step\|prep-action\|prep-crumb\|prep-segmented\|prep-pill\|prep-cats\|prep-cell\|prep-rail\|prep-title\|prep-help\|prep-section-title\|prep-swap\|prep-block__row\|prep-block__label\|prep-block__value\|prep-block__hint\|prep-block__stack\|prep-block__detail\|prep-avatars\|prep-avatar\|prep-missing\|prep-note\|prep-actionrow"
  ```

- [ ] **Step 2: Ajouter les règles manquantes à la fin de `adventure-prep.css`**

  ```css
  /* === Ajouts refonte 2026-09-27 ======================================== */

  /* Visually hidden : accessible aux lecteurs d'écran, invisible à l'œil */
  .prep-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Spinner — icône rotate utilisée dans ItineraryStep et DepartureStep */
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* État retenu dans les fiches d'étape */
  .prep-step__state {
    display: inline-flex;
    align-items: center;
    gap: var(--prep-space-1);
    padding: 2px var(--prep-space-2);
    border-radius: var(--prep-radius-pill);
    font-size: var(--lkv-text-caption);
    font-weight: 650;
  }

  .prep-step__state[data-state='propose'] {
    color: var(--lkv-text-secondary);
    background-color: var(--prep-segmented-track);
    border: 1px dashed color-mix(in srgb, var(--lkv-text-primary) 30%, transparent);
  }

  .prep-step__state[data-state='a_reserver'] {
    color: color-mix(in srgb, var(--lkv-warning-dark) 90%, #000);
    background-color: color-mix(in srgb, var(--lkv-warning-dark) 12%, #fff);
    border: 1px solid color-mix(in srgb, var(--lkv-warning-dark) 30%, transparent);
  }

  .prep-step__state[data-state='confirme'] {
    color: var(--lkv-action);
    background-color: color-mix(in srgb, var(--lkv-action) 10%, #fff);
    border: 1px solid color-mix(in srgb, var(--lkv-action) 26%, transparent);
  }

  .prep-step__state[data-state='confirme_communaute'] {
    color: var(--pos, #1D5E9E);
    background-color: color-mix(in srgb, var(--pos, #1D5E9E) 10%, #fff);
    border: 1px solid color-mix(in srgb, var(--pos, #1D5E9E) 26%, transparent);
  }

  .prep-step__state[data-state='retenu'] {
    color: var(--lkv-text-primary);
    background-color: color-mix(in srgb, var(--lkv-action) 8%, var(--card-tint-solid));
    border: 1px solid color-mix(in srgb, var(--lkv-action) 20%, transparent);
  }

  /* Note d'absence d'offre */
  .prep-note {
    font-size: var(--lkv-text-footnote);
    color: var(--lkv-text-subtle);
    text-align: center;
    padding: var(--prep-space-4);
  }
  ```

- [ ] **Step 3: Run tous les tests**

  ```bash
  npx vitest run src/features/adventure-prep/__tests__/prep-contrast.test.ts
  npx vitest run src/features/adventure-prep/__tests__/prep-nav.test.ts
  ```
  Expected: PASS

- [ ] **Step 4: Commit**

  ```bash
  git add src/features/adventure-prep/adventure-prep.css
  git commit -m "refonte(prep): CSS — visually-hidden, spin, états step, note"
  ```

---

## Task 13 — Vérification globale et non-régression

**Files:**
- Tous les fichiers modifiés (lecture + vérification uniquement)

- [ ] **Step 1: Run TOUS les tests adventure-prep**

  ```bash
  npx vitest run src/features/adventure-prep
  ```
  Expected: PASS sur les 34 fichiers de tests. Zéro régression.

- [ ] **Step 2: Vérification TypeScript**

  ```bash
  npx tsc --noEmit 2>&1 | head -50
  ```
  Expected: aucune erreur.

- [ ] **Step 3: Build complet**

  ```bash
  npx next build 2>&1 | tail -30
  ```
  Expected: build réussi, aucune erreur de module.

- [ ] **Step 4: Vérification dev server**

  ```bash
  # Lancer le serveur dev
  npx next dev -p 3000
  # Ouvrir http://localhost:3000/prepare dans le navigateur
  # Vérifier les 3 étapes manuellement
  ```

- [ ] **Step 5: Vérifier prefers-reduced-motion**

  Dans DevTools → Rendering → Emulate CSS media feature `prefers-reduced-motion: reduce`.
  Expected: aucune animation visible.

- [ ] **Step 6: Vérifier accessibilité basique**

  ```bash
  # Installer si nécessaire
  # npx axe-core-cli http://localhost:3000/prepare --disable=landmark-one-main
  ```
  Expected: aucune violation critique.

- [ ] **Step 7: Commit final**

  ```bash
  git add -A
  git commit -m "refonte(prep): vérification globale — 0 régression, TS OK, build OK"
  ```

---

## Self-Review

**Spec coverage check :**
- ✅ ActivityPickerScreen : Task 3
- ✅ DestinationStep 3 blocs : Task 4
- ✅ Génération progressive : Task 5
- ✅ ItineraryStep métriques + sélecteur jour + fiche + Ajuster/Étapes/Ajouter : Task 5
- ✅ DepartureStep 3 blocs résumés + CTA Enregistrer : Task 6
- ✅ Carte contrôles flottants : Task 7
- ✅ PlaceSheet focus auto + CTA : Task 8
- ✅ CalendarSheet durée proposée : Task 8
- ✅ GroupSheet adultes/enfants/animaux : Task 8
- ✅ PreferencesSheet : Task 8
- ✅ StepSheet 5 états : Task 9
- ✅ AdjustSheet 5 ajustements : Task 9
- ✅ StepsSheet tap : Task 9
- ✅ GearSheet filtre + checkbox Dans le sac : Task 10
- ✅ ConsumablesSheet eau + repas : Task 10
- ✅ PrepInviteScreen mention localisation : Task 11
- ✅ CSS classes manquantes : Task 12
- ✅ Non-régression tests : Task 13
- ✅ PrepNav/PrepCrumb : Task 1
- ✅ AdventurePrepShell simplifié : Task 2
- ❓ Partie non couverte : tiroir Hub → PrepFlow (dépend du hub, hors périmètre feature)
