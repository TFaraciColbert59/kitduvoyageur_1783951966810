'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Button } from '@/components/ui';
import { useDayFocusStore } from '@/components/mobile-nav/dayFocusStore';
import { fetchItineraryProposal } from '@/app/prepare/actions';
import { activityById } from '../catalog';
import { metricsFor } from '../engine/metrics';
import { daySteps, knownGaps } from '../engine/itinerary';
import { runItineraryGeneration } from '../engine/itineraryPhases';
import { minutesLabel } from '../engine/labels';
import { A_VERIFIER, moneyLabel, stateLabel } from '../engine/trust';
import { usePrepDayFocusPublisher } from '../hooks/usePrepDayFocusPublisher';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import type {
  AdventurePrepDraft,
  GenerationPhase,
  ItineraryModel,
  ItineraryStep as ItineraryStepModel,
  ItineraryStepKind,
  PlaceRef,
} from '../types';
import { PrepMap, PREP_POINT_COLORS, type PrepMapPoint } from './PrepMap';
import type { PrepSheetId } from './PrepSheets';

export interface ItineraryStepScreenProps {
  onOpenSheet: (sheet: PrepSheetId, focusStepId?: string | null) => void;
}

/**
 * Rien a construire : la generation s'arrete sur cette phrase plutot que de
 * laisser un rail a moitie coche. Le besoin est nomme, pas suppose.
 */
const BLOCKED_MESSAGE =
  "Il manque une activité ou une durée pour construire le parcours. Tu peux arrêter ici, ou revenir à l’étape précédente.";

const STEP_ICONS: Readonly<Record<ItineraryStepKind, string>> = {
  trajet: 'route',
  arret: 'map-pin',
  repos: 'footprints',
  nuit: 'bed-double',
  ravitaillement: 'backpack',
};

/** Familles affichees par la carte : tout le parcours, sans exception. */
const MAP_CATEGORIES: readonly string[] = [
  'trajet',
  'arret',
  'repos',
  'nuit',
  'ravitaillement',
];

/** Les classes de `.prep-step` visent du texte de bloc : on leve le inline. */
const AS_BLOCK: React.CSSProperties = { display: 'block' };

/** Un `<button>` natif garde centrage et cadre navigateur : on ne reprend que ca. */
const CARD_BUTTON: React.CSSProperties = {
  textAlign: 'left',
  font: 'inherit',
  color: 'inherit',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
};

const PLAIN_LIST: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: 'var(--prep-block-gap)',
};

/* ------------------------------------------------------------------ */
/* Donnees derivees                                                    */
/* ------------------------------------------------------------------ */

/** Coordonnee exploitable : jamais de point invente sur la carte. */
function isLocatable(place: PlaceRef): boolean {
  return (
    Number.isFinite(place.lat) && Number.isFinite(place.lon) && place.lat !== 0 && place.lon !== 0
  );
}

/** Trace : le depart, puis l'arrivee si elle est bien differente. */
function routeCoords(draft: AdventurePrepDraft): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  const push = (place: PlaceRef | null) => {
    if (!place || !isLocatable(place)) return;
    const last = coords[coords.length - 1];
    if (last && last[0] === place.lat && last[1] === place.lon) return;
    coords.push([place.lat, place.lon]);
  };
  push(draft.route.origin);
  push(draft.route.destination);
  return coords;
}

/** Points du programme : une entree par etape reellement localisee. */
function mapPoints(steps: readonly ItineraryStepModel[]): PrepMapPoint[] {
  return steps.flatMap((step) => {
    if (step.lat === null || step.lon === null) return [];
    if (!Number.isFinite(step.lat) || !Number.isFinite(step.lon)) return [];
    return [
      {
        id: step.id,
        lat: step.lat,
        lon: step.lon,
        label: step.title,
        color: PREP_POINT_COLORS[step.kind],
        category: step.kind,
        stepId: step.id,
      },
    ];
  });
}

/**
 * Trace d'une seule journee.
 *
 * Le focus jour doit repeindre la carte avec LE JOUR et rien d'autre : garder
 * le voyage entier donnerait l'impression qu'il faut refaire tout le trajet
 * alors qu'on ne regarde qu'une partie du programme. On ne conserve que les
 * etapes localisees de ce jour, dans l'ordre.
 */
function dayRouteCoords(steps: readonly ItineraryStepModel[]): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  for (const step of steps) {
    if (step.lat === null || step.lon === null) continue;
    if (!Number.isFinite(step.lat) || !Number.isFinite(step.lon)) continue;
    const last = coords[coords.length - 1];
    if (last && last[0] === step.lat && last[1] === step.lon) continue;
    coords.push([step.lat, step.lon]);
  }
  return coords;
}

/** Programme de l'ensemble : jour, puis ordre dans la journee. */
function allSteps(model: ItineraryModel): ItineraryStepModel[] {
  return [...model.steps].sort((a, b) => a.day - b.day || a.order - b.order);
}

function stepIcon(step: ItineraryStepModel): string {
  return step.icon || STEP_ICONS[step.kind];
}

function whenLabel(step: ItineraryStepModel): string {
  return `${step.startTime ?? A_VERIFIER} · ${minutesLabel(step.durationMin)}`;
}

/* ------------------------------------------------------------------ */
/* Fragments                                                           */
/* ------------------------------------------------------------------ */

/** Le travail reellement effectue. Jamais de pourcentage ni de jauge. */
function GenerationRail({ phases }: { phases: readonly GenerationPhase[] }) {
  return (
    <div className="prep-rail" aria-live="polite">
      {phases.map((phase) => (
        <div key={phase.id} className="prep-rail__line" data-state={phase.done ? 'done' : 'idle'}>
          <span className="prep-rail__dot" aria-hidden="true">
            <Icon name={phase.done ? 'check-circle2' : 'circle'} size={20} />
          </span>
          <span>
            {phase.label}
            <span className="prep-visually-hidden">
              {phase.done ? ' — fait' : ' — en attente'}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Une etape du programme : toute la ligne ouvre son detail. */
function StepCard({
  step,
  onOpen,
}: {
  step: ItineraryStepModel;
  onOpen: (stepId: string) => void;
}) {
  return (
    <button type="button" className="prep-step" style={CARD_BUTTON} onClick={() => onOpen(step.id)}>
      <span className="prep-step__head">
        <span className="prep-step__thumb" aria-hidden="true">
          <Icon name={stepIcon(step)} size={22} />
        </span>
        <span className="prep-step__body">
          <span className="prep-step__name" style={AS_BLOCK}>
            {step.title}
          </span>
          <span className="prep-step__when" style={AS_BLOCK}>
            {whenLabel(step)}
          </span>
          {step.placeName ? (
            <span className="prep-step__reason" style={AS_BLOCK}>
              {step.placeName}
            </span>
          ) : null}
        </span>
        <span className="prep-step__price" data-state={step.price.state}>
          {moneyLabel(step.price)}
        </span>
      </span>
      <span className="prep-step__actions">
        <span className="prep-act__meta">{stateLabel(step.state)}</span>
        {step.kept ? (
          <span className="prep-act__meta">
            <Icon name="check" size={15} /> À conserver
          </span>
        ) : null}
        <Icon name="chevron-right" size={16} aria-hidden="true" />
      </span>
    </button>
  );
}

/** Ce qui a deja ete produit avant l'interruption : jamais perdu. */
function ProducedStep({ step }: { step: ItineraryStepModel }) {
  return (
    <div className="prep-block">
      <div className="prep-block__row">
        <span className="prep-step__thumb" aria-hidden="true">
          <Icon name={stepIcon(step)} size={18} />
        </span>
        <span className="prep-block__label">{step.title}</span>
        <span
          className="prep-block__value"
          data-unknown={step.startTime === null ? 'true' : undefined}
        >
          {step.startTime ?? A_VERIFIER}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ecran                                                               */
/* ------------------------------------------------------------------ */

function FocusedStepView({
  program,
  onOpenSheet,
}: {
  program: ItineraryStepModel[];
  onOpenSheet: (sheet: PrepSheetId, focusStepId?: string | null) => void;
}) {
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: CustomEvent<{ stepId: string }>) => setFocusedId(e.detail.stepId);
    window.addEventListener('prep:focus-step', handler as any);
    return () => window.removeEventListener('prep:focus-step', handler as any);
  }, []);

  const step = program.find((s) => s.id === focusedId) || program[0];
  if (!step) return null;

  return (
    <div className="prep-step">
      <div className="prep-step__head">
        <span className="prep-step__thumb" aria-hidden="true">
          <Icon name={stepIcon(step)} size={22} />
        </span>
        <div className="prep-step__body">
          <h3 className="prep-step__name" style={AS_BLOCK}>{step.title}</h3>
          <div className="prep-step__when" style={AS_BLOCK}>{whenLabel(step)}</div>
          {step.reason && (
            <div className="prep-step__reason" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {step.reason}
            </div>
          )}
        </div>
        <div className="prep-step__price" data-state={step.price.state}>
          {moneyLabel(step.price)}
        </div>
      </div>
      <div className="prep-step__actions">
        <Button variant="secondary" size="sm" onClick={() => onOpenSheet('step', step.id)}>
          Détails
        </Button>
        <Button variant="secondary" size="sm" onClick={() => {}} icon={<Icon name="refresh-cw" size={16} />}>
          Remplacer
        </Button>
        <Button
          variant="secondary"
          size="sm"
          aria-pressed={step.kept}
          onClick={() => useAdventurePrepStore.getState().keepStep(step.id, !step.kept)}
        >
          {step.kept ? (
            <>
              <Icon name="check" size={16} /> À conserver
            </>
          ) : (
            'À conserver'
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Etape 2 — Parcours : une seule decision a l'ecran (A6).
 *
 * Quatre etats mutuellement exclusifs : point de depart, generation en
 * cours, generation interrompue, itineraire pret. Jamais de pourcentage ni
 * de score : la preparation n'a pas de note (A9). Aucune donnee n'est
 * inventee — une information absente s'affiche « À vérifier ».
 */
export function ItineraryStepScreen({ onOpenSheet }: ItineraryStepScreenProps) {
  const draft = useAdventurePrepStore((state) => state.draft);
  const [blocked, setBlocked] = useState(false);

  // Focus jour : source unique dans le store module, partage avec la bottom bar.
  // L'ecran n'invente donc jamais son propre « jour » : il lit ce que le rail
  // affiche, ce qui garantit que la carte, les metriques et le programme
  // parlent tous du meme perimetre.
  const focusDay = useDayFocusStore((state) => state.selectedDay);
  const selectFocusDay = useDayFocusStore((state) => state.selectDay);
  usePrepDayFocusPublisher(draft);

  const runAbort = useRef<AbortController | null>(null);

  // Au demontage, l'appel reseau en cours est coupe : aucune ecriture d'etat
  // n'arrive apres la disparition de l'ecran et le store n'est pas laisse
  // bloque en « en cours ».
  useEffect(
    () => () => {
      runAbort.current?.abort();
    },
    [],
  );

  /**
   * Lance la construction reelle du parcours.
   *
   * Le rail ne coche plus des phases a intervalle fixe :
   * `runItineraryGeneration` signale chaque phase APRES son propre travail
   * (appel reseau, verification, classement des reservations, assemblage).
   * Quand l'IA ne repond pas ou propose quelque chose d'incoherent, le moteur
   * replie sur les regles et l'ecran affiche pourquoi.
   */
  const startRun = useCallback(async (mode: 'start' | 'resume') => {
    runAbort.current?.abort();
    const controller = new AbortController();
    runAbort.current = controller;
    setBlocked(false);

    const store = useAdventurePrepStore.getState();
    if (mode === 'start') store.startGenerationRun();
    else store.continueGeneration();

    const outcome = await runItineraryGeneration(
      store.draft,
      controller.signal,
      (draftToBuild) => fetchItineraryProposal(draftToBuild),
      (phase) => useAdventurePrepStore.getState().markPhase(phase),
    );
    if (controller.signal.aborted) return;

    const next = useAdventurePrepStore.getState();
    if (!outcome.model) {
      setBlocked(true);
      next.failGenerationRun(BLOCKED_MESSAGE);
      return;
    }
    next.applyGenerated(outcome.model, outcome.message);
    next.completeStep('itinerary');
  }, []);

  const stopRun = useCallback(() => {
    runAbort.current?.abort();
    runAbort.current = null;
    useAdventurePrepStore.getState().stopGeneration();
  }, []);

  const model = draft.itinerary;
  const generation = draft.generation;
  const activity = activityById(draft.activities.primary);
  const gaps = useMemo(() => (model ? knownGaps(model) : []), [model]);

  // `null` = Ensemble. Un jour hors borne retombe sur l'ensemble.
  const activeDay = model && focusDay !== null && focusDay <= model.days ? focusDay : null;
  const metrics = useMemo(
    () =>
      model ? metricsFor(model, activeDay === null ? 'aventure' : 'jour', activeDay ?? undefined) : [],
    [model, activeDay],
  );
  const program = useMemo(() => {
    if (!model) return [];
    return activeDay === null ? allSteps(model) : daySteps(model, activeDay);
  }, [model, activeDay]);

  // La carte suit le focus : trace du jour seul des qu'un jour est selectionne.
  const coords = useMemo(() => {
    if (activeDay !== null && model) return dayRouteCoords(daySteps(model, activeDay));
    return routeCoords(draft);
  }, [activeDay, draft, model]);
  const points = useMemo(() => mapPoints(program), [program]);

  const goToDeparture = useCallback(() => {
    const store = useAdventurePrepStore.getState();
    store.completeStep('itinerary');
    store.goToStep('departure');
  }, []);

  const keepWhatExists = useCallback(() => {
    const store = useAdventurePrepStore.getState();
    store.proposeItinerary();
    store.completeStep('itinerary');
    store.goToStep('departure');
  }, []);

  const openStep = useCallback((stepId: string) => onOpenSheet('step', stepId), [onOpenSheet]);

  /* --- Rendering -------------------------------------------------------- */

  return (
    <div className="prep-screen">
      <div className="prep-body">
        <button type="button" className="prep-pill" onClick={() => onOpenSheet('coverage')}>
          <Icon name={activity?.icon || 'sparkles'} size={16} />
          <span style={{ marginLeft: 8 }}>{activity?.label || 'Activité inconnue'}</span>
          {model && generation.notice && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
              <Icon name="sparkles" size={16} />
              {generation.notice}
            </span>
          )}
        </button>

        {!model && (
          <p className="prep-help" style={{ textAlign: 'center', color: 'var(--lkv-text-subtle)', margin: 'var(--space-2) 0' }}>
            Distances, durées et prix restent À vérifier.
          </p>
        )}

        {!model && generation.status === 'en_cours' && (
          <div className="prep-rail" aria-live="polite">
            {generation.phases.map((phase, index, arr) => {
              const active = !phase.done && (index === 0 || arr[index - 1].done);
              return (
                <div key={phase.id} className="prep-rail__line" data-state={active ? 'active' : phase.done ? 'done' : 'pending'}>
                  <span className="prep-rail__dot" aria-hidden="true">
                    <Icon name={phase.done ? 'check' : active ? 'loader-2' : 'circle'} size={20} className={active ? 'spin' : ''} />
                  </span>
                  <span>{phase.label}</span>
                </div>
              );
            })}
            <Button variant="secondary" size="sm" onClick={stopRun} icon={<Icon name="x" size={16} />}>
              Arrêter
            </Button>
          </div>
        )}

        {!model && (generation.status === 'interrompu' || generation.status === 'echec') && (
          <div className="prep-block" style={{ padding: 'var(--space-4)' }}>
            <p className="prep-note" data-tone="warn" role="status" style={{ marginBottom: 'var(--space-3)' }}>
              {generation.error || BLOCKED_MESSAGE}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <Button variant="primary" size="md" onClick={() => startRun('resume')} icon={<Icon name="refresh-cw" size={16} />}>
                Reprise du parcours
              </Button>
              <Button variant="secondary" size="sm" onClick={() => startRun('resume')}>
                Continuer avec les éléments disponibles
              </Button>
            </div>
          </div>
        )}

        {model && (
          <>
            <div className="prep-metrics">
              {metrics.map((metric) => (
                <div key={metric.id} className="prep-metric">
                  <span className="prep-metric__label">{metric.label}</span>
                  <span className="prep-metric__value" data-unknown={metric.state === 'a_verifier' ? 'true' : undefined}>
                    {metric.formatted}
                  </span>
                </div>
              ))}
            </div>

            {model.days > 1 && (
              <div className="prep-days" role="group" aria-label="Périmètre du programme">
                <button
                  type="button"
                  className="prep-day"
                  aria-pressed={activeDay === null}
                  onClick={() => selectFocusDay(null)}
                >
                  Tout
                </button>
                {Array.from({ length: model.days }, (_, index) => index + 1).map((day) => (
                  <button
                    key={day}
                    type="button"
                    className="prep-day"
                    aria-pressed={activeDay === day}
                    onClick={() => selectFocusDay(day)}
                  >
                    Jour {day}
                  </button>
                ))}
              </div>
            )}

            <div className="prep-programme">
              <div className="prep-programme__list">
                <div style={{ fontWeight: 700, fontSize: 'var(--f-body)', color: 'var(--lkv-text-primary)', marginBottom: 8 }}>
                  {activeDay === null ? 'Jour 1' : `Jour ${activeDay}`}
                </div>
                {program.map((item) => (
                  <div key={item.id} style={{ display: 'none' }}>{item.title}</div>
                ))}
              </div>
            </div>

            {program.length > 0 && <FocusedStepView program={program} onOpenSheet={onOpenSheet} />}

            <div className="prep-actionrow">
              <Button variant="secondary" size="md" onClick={() => onOpenSheet('adjust')} icon={<Icon name="Cog6ToothIcon" size={18} />}>
                Ajuster
              </Button>
              <Button variant="secondary" size="md" onClick={() => onOpenSheet('steps')} icon={<Icon name="clipboard-list" size={18} />}>
                Étapes
              </Button>
              <Button variant="secondary" size="md" onClick={() => onOpenSheet('add')} icon={<Icon name="plus" size={18} />}>
                Ajouter
              </Button>
            </div>
          </>
        )}

        {!model && generation.status !== 'en_cours' && generation.status !== 'echec' && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-4) 0' }}>
            <Button variant="primary" size="lg" onClick={() => void startRun('start')} icon={<Icon name="sparkles" size={18} />}>
              Générer mon parcours
            </Button>
          </div>
        )}

        <PrepMap
          className="prep-map--inline"
          name="Ton parcours"
          routeCoords={coords}
          points={points}
          scopeLabel={activeDay === null ? 'Ensemble' : `Jour ${activeDay}`}
          filterCategories={MAP_CATEGORIES}
        />
      </div>

      <div className="prep-footer">
        <Button
          variant="primary"
          size="lg"
          className="prep-footer__primary"
          disabled={!model}
          onClick={goToDeparture}
          iconPosition="trailing"
          icon={<Icon name="arrow-right" size={18} aria-hidden="true" />}
        >
          Vers le départ
        </Button>
      </div>
    </div>
  );
}

export default ItineraryStepScreen;
