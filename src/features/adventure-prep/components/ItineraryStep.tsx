'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Button } from '@/components/ui';
import { activityById } from '../catalog';
import { metricsFor } from '../engine/metrics';
import { buildItinerary, daySteps, knownGaps } from '../engine/itinerary';
import { minutesLabel } from '../engine/labels';
import { A_VERIFIER, moneyLabel, stateLabel } from '../engine/trust';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import type {
  AdventurePrepDraft,
  GenerationPhase,
  GenerationPhaseId,
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

/** Delai entre deux phases. Un travail reel, jamais une animation d'attente. */
const PHASE_DELAY = 450;

/** L'ordre execute, phase par phase. Aucune n'est cochee a la construction. */
const GENERATION_SEQUENCE: readonly GenerationPhaseId[] = [
  'recherche_parcours',
  'verification_etapes',
  'disponibilites',
  'synthese',
];

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
function mapPoints(model: ItineraryModel): PrepMapPoint[] {
  return model.steps.flatMap((step) => {
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
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [blocked, setBlocked] = useState(false);

  const runTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseIndex = useRef(0);

  const clearRun = useCallback(() => {
    if (runTimer.current !== null) {
      clearTimeout(runTimer.current);
      runTimer.current = null;
    }
  }, []);

  // Un seul minuteur, rearme apres chaque phase. Au demontage il est purge :
  // aucune ecriture d'etat n'arrive apres la disparition de l'ecran.
  useEffect(() => clearRun, [clearRun]);

  const runPhase = useCallback(
    function phase(): void {
      runTimer.current = null;
      const index = phaseIndex.current;
      const current = GENERATION_SEQUENCE[index];
      if (!current) return;

      const store = useAdventurePrepStore.getState();

      // Rien a construire : la sequence ne progresse pas et l'ecran le dit.
      if (index === 0 && !buildItinerary(store.draft)) {
        setBlocked(true);
        return;
      }

      store.markPhase(current);

      if (index === 0) {
        store.proposeItinerary();
        store.pushGenerated(store.draft.calendar.durationDays ?? 0);
      }

      if (index === GENERATION_SEQUENCE.length - 1) {
        store.endGeneration();
        store.completeStep('itinerary');
        return;
      }

      phaseIndex.current = index + 1;
      runTimer.current = setTimeout(phase, PHASE_DELAY);
    },
    [],
  );

  const startRun = useCallback(
    (mode: 'start' | 'resume') => {
      clearRun();
      phaseIndex.current = 0;
      setBlocked(false);
      const store = useAdventurePrepStore.getState();
      if (mode === 'start') store.startGenerationRun();
      else store.continueGeneration();
      runTimer.current = setTimeout(runPhase, PHASE_DELAY);
    },
    [clearRun, runPhase],
  );

  const stopRun = useCallback(() => {
    clearRun();
    phaseIndex.current = 0;
    useAdventurePrepStore.getState().stopGeneration();
  }, [clearRun]);

  const model = draft.itinerary;
  const generation = draft.generation;
  const activity = activityById(draft.activities.primary);
  const coords = useMemo(() => routeCoords(draft), [draft]);
  const points = useMemo(() => (model ? mapPoints(model) : []), [model]);
  const gaps = useMemo(() => (model ? knownGaps(model) : []), [model]);

  // `null` = Ensemble. Un jour hors borne retombe sur l'ensemble.
  const activeDay = model && selectedDay !== null && selectedDay <= model.days ? selectedDay : null;
  const metrics = useMemo(
    () =>
      model ? metricsFor(model, activeDay === null ? 'aventure' : 'jour', activeDay ?? undefined) : [],
    [model, activeDay],
  );
  const program = useMemo(() => {
    if (!model) return [];
    return activeDay === null ? allSteps(model) : daySteps(model, activeDay);
  }, [model, activeDay]);

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

  /* --- Etat 2 : la generation est en cours ---------------------------- */
  if (!model && generation.status === 'en_cours') {
    return (
      <div className="prep-screen">
        <div className="prep-body">
          <h1 className="prep-title">On construit ton parcours</h1>
          <p className="prep-help">
            Chaque étape est travaillée dans l&apos;ordre. Rien n&apos;est coché avant
            d&apos;avoir vraiment été fait.
          </p>
          <GenerationRail phases={generation.phases} />
          {blocked ? (
            <p className="prep-note" data-tone="warn" role="status">
              {A_VERIFIER} : il manque une activité ou une durée pour construire le parcours. Tu
              peux arrêter ici, ou revenir à l&apos;étape précédente.
            </p>
          ) : null}
        </div>
        <div className="prep-footer">
          <Button
            variant="secondary"
            size="lg"
            className="prep-footer__primary"
            onClick={stopRun}
            icon={<Icon name="x" size={18} aria-hidden="true" />}
          >
            Arrêter
          </Button>
        </div>
      </div>
    );
  }

  /* --- Etat 3 : interrompue ou en echec ------------------------------ */
  if (!model && (generation.status === 'interrompu' || generation.status === 'echec')) {
    const produced = generation.steps;
    return (
      <div className="prep-screen">
        <div className="prep-body">
          <h1 className="prep-title">Reprise du parcours</h1>
          <p className="prep-help">
            Rien de ce qui a été produit n&apos;est perdu. Tu peux repartir du même point ou
            continuer avec ce qui existe déjà.
          </p>
          {generation.error ? (
            <p className="prep-note" data-tone="warn" role="status">
              {generation.error}
            </p>
          ) : null}
          <GenerationRail phases={generation.phases} />
          {produced.length > 0 ? (
            <section
              aria-labelledby="prep-deja-produit"
              style={{ display: 'grid', gap: 'var(--space-3)' }}
            >
              <h2 className="prep-section-title" id="prep-deja-produit">
                Déjà produit
              </h2>
              <ul style={PLAIN_LIST}>
                {produced.map((step) => (
                  <li key={step.id}>
                    <ProducedStep step={step} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        <div className="prep-footer">
          <div className="prep-actionrow">
            <Button
              variant="secondary"
              size="md"
              onClick={() => startRun('resume')}
              icon={<Icon name="refresh-cw" size={16} aria-hidden="true" />}
            >
              Réessayer
            </Button>
            <Button
              variant="primary"
              size="lg"
              className="prep-footer__primary"
              onClick={keepWhatExists}
              iconPosition="trailing"
              icon={<Icon name="arrow-right" size={18} aria-hidden="true" />}
            >
              Continuer avec les éléments disponibles
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* --- Etat 4 : l'itineraire est pret --------------------------------- */
  if (model) {
    return (
      <div className="prep-screen">
        <div className="prep-body">
          <h1 className="prep-title">Ton parcours</h1>
          <p className="prep-help">
            {activity
              ? `${activity.label} · ${model.days} jour${model.days > 1 ? 's' : ''}`
              : 'Programme proposé · durées, lieux et prix restent à vérifier'}
          </p>

          <PrepMap
            name="Ton parcours"
            routeCoords={coords}
            points={points}
            scopeLabel="Ensemble"
            filterCategories={MAP_CATEGORIES}
          />

          <div className="prep-days" role="group" aria-label="Périmètre du programme">
            <button
              type="button"
              className="prep-day"
              aria-pressed={activeDay === null}
              onClick={() => setSelectedDay(null)}
            >
              Ensemble
            </button>
            {Array.from({ length: model.days }, (_, index) => index + 1).map((day) => (
              <button
                key={day}
                type="button"
                className="prep-day"
                aria-pressed={activeDay === day}
                onClick={() => setSelectedDay(day)}
              >
                Jour {day}
              </button>
            ))}
          </div>

          <div className="prep-metrics">
            {metrics.map((metric) => (
              <div key={metric.id} className="prep-metric">
                <span className="prep-metric__label">{metric.label}</span>
                <span
                  className="prep-metric__value"
                  data-unknown={metric.state === 'a_verifier' ? 'true' : undefined}
                >
                  {metric.formatted}
                </span>
              </div>
            ))}
          </div>

          <section aria-labelledby="prep-programme" style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <h2 className="prep-section-title" id="prep-programme">
              {activeDay === null ? 'Programme complet' : `Jour ${activeDay}`}
            </h2>
            {program.length === 0 ? (
              <p className="prep-note">Aucune étape dans ce périmètre pour l&apos;instant.</p>
            ) : (
              <ul style={PLAIN_LIST}>
                {program.map((step) => (
                  <li key={step.id}>
                    <StepCard step={step} onOpen={openStep} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {model.contingencies.length > 0 ? (
            <section aria-labelledby="prep-plans-b" style={{ display: 'grid', gap: 'var(--space-2)' }}>
              <h2 className="prep-section-title" id="prep-plans-b">
                Plans B
              </h2>
              {model.contingencies.map((contingency) => (
                <details className="prep-note" key={contingency.kind}>
                  <summary>{contingency.trigger}</summary>
                  <p style={{ margin: 'var(--space-2) 0 0' }}>{contingency.action}</p>
                </details>
              ))}
            </section>
          ) : null}

          {gaps.length > 0 ? (
            <section aria-labelledby="prep-gaps" style={{ display: 'grid', gap: 'var(--space-2)' }}>
              <h2 className="prep-section-title" id="prep-gaps">
                Ce que l&apos;app ne sait pas
              </h2>
              {gaps.map((gap) => (
                <p className="prep-note" key={gap.id}>
                  {gap.label}
                </p>
              ))}
            </section>
          ) : null}
        </div>

        <div className="prep-footer">
          <div className="prep-actionrow">
            <Button
              variant="secondary"
              size="md"
              onClick={() => onOpenSheet('adjust')}
              icon={<Icon name="refresh-cw" size={16} aria-hidden="true" />}
            >
              Ajuster
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => onOpenSheet('steps')}
              icon={<Icon name="check-square" size={16} aria-hidden="true" />}
            >
              Étapes
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => onOpenSheet('add')}
              icon={<Icon name="plus" size={16} aria-hidden="true" />}
            >
              Ajouter
            </Button>
          </div>
          <Button
            variant="primary"
            size="lg"
            className="prep-footer__primary"
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

  /* --- Etat 1 : point de depart --------------------------------------- */
  return (
    <div className="prep-screen">
      <div className="prep-body">
        <h1 className="prep-title">Voilà ton aventure</h1>
        <p className="prep-help">
          {activity
            ? `${activity.label} · départ de ${draft.route.origin?.name ?? 'point à vérifier'}`
            : 'Ton parcours se construit ici : départ, étapes, nuits et retours.'}
        </p>

        <PrepMap name="Ton parcours" routeCoords={coords} scopeLabel="Ensemble" />

        <p className="prep-note">
          Le parcours est proposé à partir de ce que tu as saisi. Les distances, les durées et
          les prix restent « À vérifier » tant qu&apos;aucune source ne les fournit.
        </p>
      </div>

      <div className="prep-footer">
        <Button
          variant="primary"
          size="lg"
          className="prep-footer__primary"
          onClick={() => startRun('start')}
          icon={<Icon name="sparkles" size={18} aria-hidden="true" />}
        >
          Générer mon parcours
        </Button>
      </div>
    </div>
  );
}

export default ItineraryStepScreen;
