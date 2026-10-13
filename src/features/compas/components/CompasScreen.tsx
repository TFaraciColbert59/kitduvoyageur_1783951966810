'use client';

import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from 'react';
import Icon from '@/components/ui/Icon';
import { togglePackedAction } from '@/app/voyages/kit-actions';
import { COMPAS_STEPS, type CompasKitLine, type CompasStepId } from '../engine/compasModel';
import { activityLabel, formatHours, formatMoney } from '../engine/format';
import { NIGHT_LABEL } from '../engine/autofill';
import { waitForOutcome } from '../engine/outcomePoll';
import { travelDigest } from '../engine/travel';
import {
  compasAutofillOutcomeAction,
  compasAutofillStartAction,
  compasAutofillStopAction,
  compasUndoAutofillAction,
  compasRefreshAutofillAction,
  type CompasAutofillSummary,
} from '../server/autofillActions';
import type { CompasData } from '../server/getCompasData';
import { KitCard, NousCard, OuCard, ResaCard, VerdictCard } from './CompasCards';
import { TrialNote } from './TrialNote';
import { CompasMap } from './CompasMap';
import { CompasAccessory } from './CompasAccessory';
import { DecisionCapsule } from './CompasDecision';
import { planDecisionApply } from '../engine/decisionApply';
import { ALL_LAYERS, parseLayers, type LayerState } from '../engine/mapLayers';
import { DEFAULT_BASE, calloutOf, parseBase, type MapBase } from '../engine/mapStyle';
import { poiLabel, type RoutePoi } from '../engine/routePois';
import { mergeStagePois } from '../engine/stagePois';
import { compasStagePoisAction } from '../server/poiActions';
import { tripHours } from './CompasRuler';
import { buildCompasSnapshot, snapshotFingerprint, warmOfflinePage } from '../offline/snapshot';
import { CompasSheet, type Detent } from './CompasSheet';
import { SheetContent, sheetTitle } from './CompasSheets';
import type { ActionResult, CompasCtl, SheetState, StepFlow } from './compasTypes';
import { CompasPrep, type PrepState } from './CompasPrep';
import { planApplication } from '../engine/intent';
import { applyCurrent, runOps } from './compasApply';
import { compasClearStartSayAction, compasInterpretAction } from '../server/compasActions';
import { browserTimeZone } from '../engine/zone';
import { coarsePosition } from '../engine/privacy';

const DISPLAY_KEY = 'lkdv.compas.affichage';
const LAYERS_KEY = 'lkdv.compas.calques';
const BASE_KEY = 'lkdv.compas.fond';

const STEP_TITLES: Record<CompasStepId, string> = {
  ou: 'Préparer',
  nous: 'Nous',
  resa: 'Mes réservations',
  verdict: 'Verdict',
  kit: 'Kit',
};

/** Tiroir ouvert par ≡ pour chaque étape. */
function defaultFlow(step: CompasStepId, data: CompasData): StepFlow {
  switch (step) {
    case 'ou':
      return data.model.dates.start ? 'parcours' : 'quand';
    case 'nous':
      return 'equipe';
    case 'resa':
      return data.bookings.length ? 'reservations' : 'offres';
    case 'verdict':
      return 'raisons';
    case 'kit':
      return data.model.kit.toAcquire.length ? 'trouver' : 'emballer';
  }
}

/** Parcours de tiroir correspondant à la prochaine décision du moteur. */
const DECISION_FLOWS: Record<string, { step: CompasStepId; flow: StepFlow }> = {
  manques: { step: 'kit', flow: 'trouver' },
  quand: { step: 'ou', flow: 'quand' },
  parcours: { step: 'ou', flow: 'parcours' },
  sacs: { step: 'kit', flow: 'sacs' },
  choix: { step: 'resa', flow: 'reservations' },
  budget: { step: 'nous', flow: 'budget' },
};

/**
 * Compas — écran unique du préparateur ultime (maquette v8), branché sur les
 * données réelles.
 *
 * Haut : capsule d'étapes (même matériau que la barre d'onglets) + ≡ (tiroir
 * de l'étape) + ☀ (affichage), puis la carte de l'étape.
 * Bas : la carte du parcours, pleine largeur, sous la barre d'onglets
 * flottante ; la prochaine décision y flotte en haut, l'accessoire en bas.
 * Les tiroirs s'empilent au-dessus de la zone haute sans déborder sur la carte,
 * ou en grand.
 */
/** Intensité du verre par défaut : texte lisible (WCAG AA, audit du
 *  2026-10-06) même sur une carte sombre. Le curseur ☀ reste réglable. */
const DEFAULT_GLASS = 0.6;
/** Version du réglage d'affichage : 2 = verre accessible (WCAG AA). */
const DISPLAY_VERSION = 2;
/**
 * Durée (en secondes) des annonces qu'il faut avoir le temps de lire ou d'agir
 * dessus : « Annuler », erreurs, détails (WCAG 2.2.1). Réglable dans « Affichage ».
 */
const UNDO_CHOICES = [8, 15, 30] as const;
const DEFAULT_UNDO_S = 15;
/** Une simple confirmation (« emballé ») disparaît vite : rien à lire ni à défaire. */
const QUICK_TOAST_MS = 3800;

/** Durée maximale d'une préparation côté serveur (300 s) et une marge. */
const AUTOFILL_MAX_MS = 310_000;

export function CompasScreen({
  data: rawData,
  initialStep,
}: {
  data: CompasData;
  /** Étape ouverte à l'arrivée (lien `?etape=`) ; sinon la prochaine décision. */
  initialStep?: CompasStepId;
}) {
  // Points utiles autour des étapes (restos, commerces, santé, eau…) : chargés
  // après l'affichage, pour tout itinéraire, puis mêlés aux points du tracé.
  const [stagePois, setStagePois] = useState<RoutePoi[]>([]);
  const [stagePoisDone, setStagePoisDone] = useState(false);
  const poiKey = useMemo(
    () =>
      rawData.points
        .filter((p) => p.kind === 'step')
        .map((p) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`)
        .join('|'),
    [rawData.points]
  );
  useEffect(() => {
    if (!poiKey || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    let alive = true;
    setStagePoisDone(false);
    // Chaque appel cherche deux nouveaux lieux au plus (les connus reviennent
    // du cache) : les points s'ajoutent au fil des appels. Un appel en échec
    // n'arrête pas les suivants ; 8 appels au plus (8 lieux d'étape).
    void (async () => {
      let failures = 0;
      for (let round = 0; round < 8 && alive; round += 1) {
        const res = await compasStagePoisAction({ tripId: rawData.model.tripId }).catch(() => null);
        if (!alive) return;
        if (res?.success) {
          if (res.pois.length) setStagePois(res.pois);
          if (!res.partial) break;
        } else if (++failures >= 2) break;
      }
      if (alive) setStagePoisDone(true);
    })();
    return () => {
      alive = false;
    };
  }, [poiKey, rawData.model.tripId]);
  const data = useMemo<CompasData>(() => {
    if (!stagePois.length) return { ...rawData, stagePoisDone };
    return {
      ...rawData,
      stagePoisDone,
      ...mergeStagePois(rawData.routePois, rawData.points, stagePois, poiLabel),
    };
  }, [rawData, stagePois, stagePoisDone]);

  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState<CompasStepId>(
    () => initialStep ?? data.model.nextDecision?.step ?? 'ou'
  );
  const [mapBig, setMapBig] = useState(false);
  const [display, setDisplay] = useState<{ outdoor: boolean; glass: number; undoS: number }>({
    outdoor: false,
    glass: DEFAULT_GLASS,
    undoS: DEFAULT_UNDO_S,
  });
  const [popover, setPopover] = useState(false);
  const [stack, setStack] = useState<Array<{ sheet: SheetState; detent: Detent }>>([]);
  const [packed, setPacked] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{
    message: string;
    tone?: 'bad';
    undo?: () => void;
    sub?: string;
  } | null>(null);
  /** Dernière écriture annulable (Ctrl/⌘+Z), le temps que l'annonce reste. */
  const undoRef = useRef<(() => void) | null>(null);

  // Hors ligne : l'aventure affichée est gardée sur l'appareil (IndexedDB) pour
  // être relue sans réseau sur /hors-ligne. Écrite seulement si elle change.
  const [offlineSavedAt, setOfflineSavedAt] = useState<string | null>(null);
  const offlinePrint = useRef<string | null>(null);
  useEffect(() => {
    const userId = data.viewerId;
    if (!userId || typeof indexedDB === 'undefined') return;
    const timer = window.setTimeout(() => {
      const snap = buildCompasSnapshot({
        userId,
        model: data.model,
        countryCode: data.countryCode,
        itinerary: data.itinerary,
        weatherSource: data.weather?.source ?? null,
      });
      const print = snapshotFingerprint(snap);
      if (print === offlinePrint.current) return;
      void import('@/lib/offlineStorage')
        .then((m) => m.saveCompasSnapshot(snap))
        .then(() => {
          offlinePrint.current = print;
          setOfflineSavedAt(snap.savedAt);
          void warmOfflinePage();
        })
        .catch(() => undefined);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [data.viewerId, data.model, data.countryCode, data.itinerary, data.weather]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { model } = data;

  // Calques de la carte : préférence personnelle, jamais indispensable.
  const [layers, setLayers] = useState<LayerState>(ALL_LAYERS);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LAYERS_KEY);
      if (raw) setLayers(parseLayers(JSON.parse(raw)));
    } catch {
      /* stockage indisponible : tout affiché */
    }
  }, []);
  // Fond de carte (Relief, Clair, Satellite) : préférence personnelle, jamais indispensable.
  const [base, setBase] = useState<MapBase>(DEFAULT_BASE);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(BASE_KEY);
      if (raw) setBase(parseBase(raw));
    } catch {
      /* stockage indisponible : Relief */
    }
  }, []);
  const updateBase = (next: MapBase) => {
    setBase(next);
    try {
      window.localStorage.setItem(BASE_KEY, next);
    } catch {
      /* sans effet */
    }
  };
  const updateLayers = (next: LayerState) => {
    setLayers(next);
    try {
      window.localStorage.setItem(LAYERS_KEY, JSON.stringify(next));
    } catch {
      /* sans effet */
    }
  };

  // Réglage d'affichage : préférence personnelle, jamais indispensable.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DISPLAY_KEY);
      if (raw) {
        const v = JSON.parse(raw) as {
          outdoor?: unknown;
          glass?: unknown;
          undoS?: unknown;
          v?: unknown;
        };
        // Un réglage d'avant DISPLAY_VERSION garde l'ancien verre peu lisible : on le remplace.
        const current = v.v === DISPLAY_VERSION;
        setDisplay({
          outdoor: v.outdoor === true,
          glass:
            current && typeof v.glass === 'number' && v.glass >= 0.05 && v.glass <= 0.7 ? v.glass : DEFAULT_GLASS,
          undoS: UNDO_CHOICES.find((c) => c === v.undoS) ?? DEFAULT_UNDO_S,
        });
      }
    } catch {
      /* stockage indisponible : réglage par défaut */
    }
  }, []);
  const updateDisplay = (next: { outdoor: boolean; glass: number; undoS: number }) => {
    setDisplay(next);
    try {
      window.localStorage.setItem(DISPLAY_KEY, JSON.stringify({ ...next, v: DISPLAY_VERSION }));
    } catch {
      /* sans effet */
    }
  };

  // Les données fraîches du serveur remplacent l'état optimiste.
  useEffect(() => setPacked({}), [data]);

  // Durée choisie (« Affichage ») lue à l'armement : le minuteur ne se recrée pas à chaque rendu.
  const toastMs = useRef(DEFAULT_UNDO_S * 1000);
  toastMs.current = display.undoS * 1000;
  /** Annonce à lire ou à défaire (« Annuler », erreur, détail) : durée réglable, suspendue au survol et au focus. */
  const toastLong = useRef(false);
  const armToast = useCallback((long: boolean) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastLong.current = long;
    toastTimer.current = setTimeout(
      () => {
        undoRef.current = null;
        setToast(null);
      },
      long ? toastMs.current : QUICK_TOAST_MS
    );
  }, []);
  const holdToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = null;
  }, []);

  const notify = useCallback(
    (message: string, tone?: 'bad', undo?: () => void, sub?: string) => {
      undoRef.current = undo ?? null;
      setToast({ message, tone, undo, sub });
      // Ce qu'on peut défaire, ou qu'il faut lire en entier (erreur, détail), reste
      // assez longtemps pour se raviser (WCAG 2.2.1) ; une confirmation passe vite.
      armToast(Boolean(undo || sub || tone === 'bad'));
    },
    [armToast]
  );

  const run = useCallback(
    async (
      success: string,
      action: () => Promise<ActionResult>,
      undo?: () => Promise<ActionResult>
    ): Promise<boolean> => {
      setRunning(true);
      // Retour immédiat : l'îlot annonce le geste sans attendre le serveur.
      // La réponse ne fait que compléter l'annonce (« Annuler ») ou la
      // remplacer par l'erreur.
      notify(success);
      try {
        const res = await action();
        if (!res.success) {
          notify(res.error ?? 'Action impossible', 'bad');
          startTransition(() => router.refresh());
          return false;
        }
        if (undo) {
          const doUndo = () => void runRef.current?.(`Annulé : ${success}`, undo);
          undoRef.current = doUndo;
          setToast((t) => (t && t.message === success ? { ...t, undo: doUndo } : t));
          // Une annonce annulable reste le temps de se raviser (durée réglable).
          armToast(true);
        }
        startTransition(() => router.refresh());
        return true;
      } catch {
        notify('Connexion perdue : réessaie.', 'bad');
        return false;
      } finally {
        setRunning(false);
      }
    },
    [armToast, notify, router]
  );
  const runRef = useRef(run);
  runRef.current = run;

  // Préremplissage : dès que le lieu et les dates sont connus, une seule fois
  // par voyage. Il écrit directement ; l'îlot montre l'avancée puis propose
  // « Annuler » (aussi dans « Où » ensuite). Annulé, il ne se relance pas seul.
  const autofillRunning = useRef(false);
  /** Une reprise automatique après une coupure (réseau, limite serveur), pas plus. */
  const autofillRetried = useRef(false);
  /** Une relance différée après la limite de fréquence, pas plus. */
  const autofillDeferred = useRef(false);
  // Préparation pilotée depuis la demande (« Où ») : un panneau montre chaque
  // étape. « Arrêter » garde ce qui est fait et n'enchaîne pas la suite.
  const [prep, setPrepState] = useState<PrepState | null>(null);
  const prepRef = useRef<PrepState | null>(null);
  const setPrep = useCallback((next: PrepState | null) => {
    prepRef.current = next;
    setPrepState(next);
  }, []);
  /** Étape en cours, pour dire où une erreur ou un arrêt a eu lieu. */
  const prepAt = () => {
    const st = prepRef.current?.stage;
    return st === 'understand' || st === 'itinerary' || st === 'rest' ? st : prepRef.current?.at;
  };
  const prepFail = useCallback(
    (message: string) => {
      if (prepRef.current && prepRef.current.stage !== 'stopped')
        setPrep({ stage: 'error', at: prepAt(), message });
    },
    [setPrep]
  );
  const stopped = useRef(false);
  /** Réveille le suivi de la préparation quand « Arrêter » est pressé (onglet caché ou hors ligne compris). */
  const pollAbort = useRef<AbortController | null>(null);
  // Minuteurs de relance (reprise après une coupure, limite de fréquence, relectures différées) :
  // tous retenus ici pour être annulés quand l'écran est quitté. Sans cela, une relance programmée
  // relançait la préparation (ou relisait la page) pour un écran qui n'existe plus. `unmounted` couvre
  // aussi une réponse qui arrive APRÈS le démontage et voudrait en armer un nouveau.
  const retryTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const unmounted = useRef(false);
  const later = useCallback((fn: () => void, ms: number) => {
    if (unmounted.current) return;
    const id = setTimeout(() => {
      retryTimers.current.delete(id);
      if (!unmounted.current) fn();
    }, ms);
    retryTimers.current.add(id);
  }, []);
  const autofill = useCallback((redo?: { label: string; kept: string[] }) => {
    if (autofillRunning.current) return;
    autofillRunning.current = true;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (prepRef.current) setPrep({ stage: 'itinerary' });
    else
      setToast(
        redo
          ? { message: 'Je réadapte ton aventure…', sub: redo.label }
          : { message: 'Je prépare ton aventure…', sub: 'Nuits, trajet, kit et budget' }
      );
    setRunning(true);
    const startedAt = Date.now();
    const position = new Promise<{ lat: number; lon: number } | null>((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
      // Le délai du navigateur ne court qu'APRÈS l'accord : une demande
      // d'autorisation laissée sans réponse bloquerait tout. Notre minuteur
      // tranche à 8 s : on prépare sans la position (trajet à préciser).
      const guard = setTimeout(() => resolve(null), 8000);
      navigator.geolocation.getCurrentPosition(
        (p) => {
          clearTimeout(guard);
          // Plan 2.10 : la position exacte ne quitte pas l'appareil, 0,01° (~1 km) dès la lecture.
          resolve(coarsePosition({ lat: p.coords.latitude, lon: p.coords.longitude }));
        },
        () => {
          clearTimeout(guard);
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 600_000 }
      );
    });
    void Promise.resolve()
      .then(async () => {
        // Une seule passe côté serveur (jusqu'à 300 s) : itinéraire, nuits, trajet,
        // kit et budget. Pendant ce temps, l'écran se relit quand le voyage change :
        // la carte se dessine dès que l'itinéraire est écrit.
        // La position sert au trajet d'approche et au départ d'une sortie sans lieu.
        const from = await position;
        // Lancée, la préparation tourne côté serveur sans tenir de requête
        // ouverte (un réseau mobile coupe une longue requête muette) : l'écran
        // demande son issue à un rythme qui ralentit (3 s, puis jusqu'à 10 s),
        // s'arrête onglet caché ou hors ligne et reprend à la reprise, et ne
        // se relit (carte, étapes) que si le voyage a changé (plan 1.2 et 2.8).
        // Fuseau du navigateur : « aujourd'hui » du voyageur côté serveur.
        const started = await compasAutofillStartAction({
          tripId: model.tripId,
          tripSlug: model.slug,
          from,
          phase: 'all',
          timeZone: browserTimeZone() ?? undefined,
        });
        if (!started.success) return started;
        const watch = new AbortController();
        pollAbort.current = watch;
        const followed = await waitForOutcome({
          poll: () => compasAutofillOutcomeAction({ tripId: model.tripId, token: started.token, since: started.at }),
          onStamp: () => startTransition(() => router.refresh()),
          maxMs: AUTOFILL_MAX_MS - (Date.now() - startedAt),
          signal: watch.signal,
          isStopped: () => stopped.current,
        });
        if (pollAbort.current === watch) pollAbort.current = null;
        if (followed.kind === 'stopped') return null;
        if (followed.kind === 'timeout') throw new Error('préparation sans réponse');
        return followed.outcome;
      })
      .then((res) => {
        if (!res) return;
        if (!res.success) {
          // Limite de fréquence : l'aventure n'est pas laissée vide, la
          // préparation repart seule à la fin de la fenêtre (une fois). C'est
          // une attente annoncée, pas une interruption.
          if (res.retryInS && !autofillDeferred.current) {
            autofillDeferred.current = true;
            if (prepRef.current && prepRef.current.stage !== 'stopped')
              setPrep({ stage: prepAt() ?? 'itinerary', message: res.error });
            later(() => !stopped.current && autofillRef.current?.(redo), res.retryInS * 1000 + 2000);
            return notify(res.error);
          }
          prepFail(res.error);
          return notify(res.error, 'bad');
        }
        if (!('summary' in res)) {
          if (prepRef.current)
            setPrep({
              stage: 'stopped',
              at: 'rest',
              message: 'Une autre préparation de cette aventure est en cours (autre onglet) : la page se mettra à jour seule.',
            });
          // Une autre préparation du même voyage est en cours (autre onglet,
          // écran remonté) : on relit le voyage quand elle aura écrit.
          for (const wait of [20_000, 45_000, 90_000]) later(() => startTransition(() => router.refresh()), wait);
          return;
        }
        const undo = () =>
          void runRef.current?.('Préparation annulée', () =>
            compasUndoAutofillAction({ tripId: model.tripId, tripSlug: model.slug })
          );
        const done = redo ? redo.label : 'Aventure préparée';
        if (prepRef.current && prepRef.current.stage !== 'stopped')
          setPrep({
            stage: 'done',
            total: res.summary.total > 0 ? `Budget ${formatMoney(res.summary.total, 'EUR')}` : null,
            digest: autofillDigest(res.summary),
            // L'IA a produit quelque chose (conseils, étapes) : la mention reste à la fin (PLAN-100 5.3).
            usedAi: res.summary.usedAi,
          });
        notify(
          res.summary.total > 0 ? `${done} · ${formatMoney(res.summary.total, 'EUR')}` : done,
          undefined,
          undo,
          redo?.kept.length ? `Gardé : ${redo.kept.join(' · ')}` : autofillDigest(res.summary)
        );
        startTransition(() => router.refresh());
      })
      .catch(() => {
        prepFail(
          autofillRetried.current
            ? 'Connexion perdue : ce qui est fait est gardé. Reprends quand tu veux.'
            : 'Préparation coupée : je reprends dans une minute, ce qui est fait est gardé.'
        );
        if (autofillRetried.current) return notify('Connexion perdue : préparation interrompue.', 'bad');
        // Le serveur a coupé (limite de temps) ou le réseau a sauté : ce qui est
        // écrit reste, on reprend une fois là où ça s'est arrêté.
        autofillRetried.current = true;
        notify('Préparation interrompue · je reprends dans une minute…');
        later(() => !stopped.current && autofillRef.current?.(redo), 66_000);
      })
      .finally(() => {
        autofillRunning.current = false;
        setRunning(false);
      });
  }, [model.tripId, model.slug, notify, router, setPrep, prepFail, later]);
  const autofillRef = useRef(autofill);
  autofillRef.current = autofill;

  // Quitter l'écran (navigation, fermeture de l'onglet) met fin au suivi de la
  // préparation : elle continue côté serveur et sera relue à la prochaine visite.
  // Sans cela, la relecture tournerait encore jusqu'à 5 minutes pour un écran
  // qui n'existe plus (plan 1.2, coût de calcul). Seul le contrôleur du suivi est
  // réveillé, pas `stopped` : un remontage (mode strict) ne bloquerait pas « Reprendre ».
  // Les minuteurs de relance sont annulés avec lui. `unmounted` repasse à faux à chaque
  // montage : le mode strict (montage, nettoyage, remontage) ne bloque pas les relances de l'écran vivant.
  useEffect(() => {
    unmounted.current = false;
    const timers = retryTimers.current;
    return () => {
      unmounted.current = true;
      pollAbort.current?.abort();
      for (const id of timers) clearTimeout(id);
      timers.clear();
    };
  }, []);


  // Réadaptation : un changement (durée, lieu, activité, nuits, personnes…)
  // rend une partie du préremplissage caduque. Seules ces parties sont
  // refaites ; ce que tu as retouché est gardé. Une fois par changement.
  const refreshedFor = useRef<string | null>(null);
  useEffect(() => {
    const stale = data.autofillStale ?? [];
    // Plus rien de caduc : le prochain changement (même liste de parties, ex. un autre
    // départ) doit être réadapté à son tour.
    if (data.autofill === 'done' && !stale.length) refreshedFor.current = null;
    if (data.autofill !== 'done' || !data.canEdit || !stale.length) return;
    const key = `${model.tripId}:${stale.join(',')}:${JSON.stringify(data.context?.scope)}:${model.dates.days}:${model.destination}`;
    if (refreshedFor.current === key || autofillRunning.current) return;
    refreshedFor.current = key;
    void compasRefreshAutofillAction({ tripId: model.tripId, tripSlug: model.slug })
      .then((res) => {
        if (!res.success) return notify(res.error, 'bad');
        if (res.parts.length) autofill({ label: res.label, kept: res.kept });
      })
      .catch(() => notify('Connexion perdue : réadaptation interrompue.', 'bad'));
  }, [data, model, autofill, notify]);

  const autofillStarted = useRef<string | null>(null);
  useEffect(() => {
    if (data.autofill !== 'none' || !data.canEdit) return;
    if (!(model.dates.start || data.plannedDays)) return;
    // Sans lieu dit, seule une demande en cours de préparation ou un départ dit part quand
    // même : le serveur prépare alors autour du départ dit, sinon de la position partagée
    // (« près de chez toi »).
    if (
      !(model.destination || data.anchorName || data.itinerary.length || data.origin || data.originSaid) &&
      data.context?.scope !== 'sortie' &&
      !prepRef.current
    )
      return;
    if (autofillStarted.current === model.tripId || stopped.current) return;
    autofillStarted.current = model.tripId;
    autofill();
  }, [data, model, autofill]);

  // Ctrl/⌘+Z annule la dernière écriture annulable, hors champ de saisie
  // (où il garde son sens habituel).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
      const t = e.target;
      if (t instanceof Element && t.closest('input, textarea, select, [contenteditable="true"]'))
        return;
      const undo = undoRef.current;
      if (!undo) return;
      e.preventDefault();
      undoRef.current = null;
      undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Maquette finale : deux doigts glissés vers la gauche annulent aussi.
  useEffect(() => {
    let start: number | null = null;
    const mid = (t: TouchList) => (t[0].clientX + t[1].clientX) / 2;
    const onStart = (e: TouchEvent) => {
      start = e.touches.length === 2 ? mid(e.touches) : null;
    };
    const onMove = (e: TouchEvent) => {
      if (start == null || e.touches.length !== 2) return;
      if (mid(e.touches) - start < -60) {
        start = null;
        const undo = undoRef.current;
        if (!undo) return;
        undoRef.current = null;
        undo();
      }
    };
    const onEnd = () => {
      start = null;
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);

  const lines = useMemo<CompasKitLine[]>(
    () => model.kit.lines.map((l) => (l.id in packed ? { ...l, packed: packed[l.id] } : l)),
    [model.kit.lines, packed]
  );
  const members = useMemo(
    () => new Map(model.crew.loads.map((m) => [m.userId, m.name])),
    [model.crew.loads]
  );
  const products = useMemo(() => new Map(data.shop.map((p) => [p.id, p])), [data.shop]);

  const open = useCallback((sheet: SheetState, detent: Detent = 'medium') => {
    setPopover(false);
    setMapBig(false);
    setStack((s) => [...s, { sheet, detent }]);
  }, []);
  const replace = useCallback((sheet: SheetState) => {
    setStack((s) =>
      s.length ? [...s.slice(0, -1), { ...s[s.length - 1], sheet }] : [{ sheet, detent: 'medium' }]
    );
  }, []);
  const back = useCallback(() => setStack((s) => s.slice(0, -1)), []);

  // La demande (« Où ») : gardée sur le voyage tant qu'elle n'est pas
  // appliquée. Comprise ici, appliquée d'un geste, puis la préparation suit
  // (panneau visible). Partie avant d'être appliquée, elle est reprise à la
  // prochaine visite.
  const startSaid = useRef<string | null>(null);
  const startSay = data.canEdit ? (data.startSay ?? null) : null;
  const ctlRef = useRef<CompasCtl | null>(null);
  const understand = useCallback(
    async (say: string) => {
      stopped.current = false;
      setPrep({ stage: 'understand' });
      try {
        const res = await compasInterpretAction({
          tripId: model.tripId,
          text: say,
          timeZone: browserTimeZone() ?? undefined,
        });
        if (stopped.current) return;
        if (!res.success) return prepFail(res.error);
        const ctl = ctlRef.current;
        if (!ctl) return prepFail('Écran pas encore prêt : réessaie.');
        // Tout ce qui est compris et valide est appliqué ; le parcours du
        // catalogue est choisi par la préparation (pas de tiroir à ouvrir).
        const actions = res.proposals.filter((p) => p.ok && p.action.type !== 'search_route').map((p) => p.action);
        const planned = planApplication(actions, applyCurrent(ctl)).filter((o) => o.op !== 'route');
        const ops = planned.filter((o) => o.op !== 'origin');
        // « Arrêter » peut être pressé pendant chaque écriture : l'arrêt est relu après chacune,
        // sans quoi la suite le remplaçait par « itinéraire » et le panneau restait bloqué.
        // La phrase reste alors sur le voyage : « Reprendre » (ou la prochaine visite) la rejoue.
        if (ops.length) {
          const done = await runOps(ctl, ops);
          if (stopped.current) return;
          if (!done.success) return prepFail(done.error ?? 'Ta demande n’a pas pu être appliquée : réessaie.');
        }
        // Le lieu de départ n'arrête pas la préparation : introuvable ou refusé, elle continue
        // sans lui (trajet à préciser), et l'échec est dit.
        const origin = planned.filter((o) => o.op === 'origin');
        if (origin.length) {
          const said = await runOps(ctl, origin);
          if (stopped.current) return;
          if (!said.success) notify(`Départ non retenu · ${said.error ?? 'réessaie'}`);
        }
        await compasClearStartSayAction({ tripId: model.tripId }).catch(() => undefined);
        if (stopped.current) return;
        setPrep({ stage: 'itinerary' });
        startTransition(() => router.refresh());
      } catch {
        prepFail('Connexion perdue : ta demande est gardée, reprends quand tu veux.');
      }
    },
    [model.tripId, router, setPrep, prepFail, notify]
  );
  useEffect(() => {
    if (!startSay || startSaid.current === model.tripId) return;
    startSaid.current = model.tripId;
    void understand(startSay);
  }, [understand, startSay, model.tripId]);

  // Progression réelle : l'itinéraire est coché dès que ses étapes sont écrites.
  useEffect(() => {
    if (prep?.stage === 'itinerary' && autofillRunning.current && data.itinerary.length > 0) setPrep({ stage: 'rest' });
  }, [prep?.stage, data.itinerary.length, setPrep]);

  // Demande comprise mais incomplète : la préparation ne peut pas partir, on le dit.
  useEffect(() => {
    if (prep?.stage !== 'itinerary' || startSay || autofillRunning.current || data.autofill !== 'none') return;
    if (!(model.dates.start || data.plannedDays))
      return prepFail('Il me manque la durée : dis « 3 jours » ou choisis des dates.');
  }, [prep?.stage, startSay, data, model.dates.start, model.destination, prepFail]);

  const close = useCallback(() => setStack([]), []);
  const enlarge = useCallback(
    () => setStack((s) => s.map((x, i) => (i === s.length - 1 ? { ...x, detent: 'large' } : x))),
    []
  );

  const togglePacked = useCallback(
    (line: CompasKitLine) => {
      const next = !line.packed;
      setPacked((p) => ({ ...p, [line.id]: next }));
      void (async () => {
        const res = await togglePackedAction(line.id, next, model.slug).catch(() => ({
          success: false,
          error: 'Connexion perdue',
        }));
        if (!res.success) {
          setPacked((p) => ({ ...p, [line.id]: line.packed }));
          notify(res.error ?? 'Action impossible', 'bad');
        } else {
          startTransition(() => router.refresh());
        }
      })();
    },
    [model.slug, notify, router]
  );

  const ctl: CompasCtl = {
    data,
    lines,
    busy: running || pending,
    open,
    replace,
    back,
    close,
    enlarge,
    run,
    togglePacked,
    memberName: (id) => (id ? (members.get(id) ?? 'Membre') : 'Personne'),
    product: (id) => (id ? products.get(id) : undefined),
    notify: (message, tone, sub) => notify(message, tone, undefined, sub),
    autofill,
  };
  ctlRef.current = ctl;

  const decision = model.nextDecision;
  // Ce que « Appliquer » ferait, calculé par le moteur ; null : la décision demande un choix, « Voir » seulement.
  const decisionApply = useMemo(() => planDecisionApply(model, data.canEdit), [model, data.canEdit]);
  const followDecision = () => {
    if (!decision) return;
    const target = DECISION_FLOWS[decision.flow] ?? {
      step: decision.step,
      flow: defaultFlow(decision.step, data),
    };
    setStep(target.step);
    setStack([]);
    open({ kind: 'step', step: target.step, flow: target.flow });
  };

  const alerts: Partial<Record<CompasStepId, 'bad' | 'warn'>> = {
    ou: !model.dates.start ? 'warn' : undefined,
    nous: model.budget.overTarget ? 'warn' : undefined,
    resa: model.bookings.pending ? 'warn' : undefined,
    verdict:
      model.verdict.level === 'bloque' ? 'bad' : model.verdict.level === 'go' ? undefined : 'warn',
    kit: model.kit.vitalMissing.length
      ? 'bad'
      : model.kit.toAcquire.length || model.crew.unassignedShared.length
        ? 'warn'
        : undefined,
  };
  /** Ce que dit la pastille, pour qui ne la voit pas (WCAG 1.1.1, 1.4.1) : sa cause en mots. */
  const alertText: Partial<Record<CompasStepId, string>> = {
    ou: alerts.ou ? 'dates à choisir' : undefined,
    nous: alerts.nous ? 'budget au-dessus de l’objectif' : undefined,
    resa: alerts.resa ? 'réservations en attente' : undefined,
    verdict: alerts.verdict
      ? alerts.verdict === 'bad'
        ? 'voyage bloqué'
        : 'points à vérifier'
      : undefined,
    kit: alerts.kit
      ? alerts.kit === 'bad'
        ? 'objet vital à trouver'
        : 'objets à trouver ou à confier'
      : undefined,
  };
  const stepIndex = COMPAS_STEPS.findIndex((s) => s.id === step);
  const [lensX, setLensX] = useState<number | null>(null);
  const lensDrag = useRef<{ x: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const selectStep = (id: CompasStepId) => {
    setStep(id);
    setStack([]);
    setMapBig(false);
  };

  const hours = tripHours(model, data.plannedDays);
  const miniLine = [
    activityLabel(model.activity),
    hours != null ? formatHours(hours) : null,
    model.dates.label,
  ]
    .filter(Boolean)
    .join(' · ');

  const top = stack[stack.length - 1];
  const style = (display.outdoor ? {} : { ['--cp-ga' as string]: display.glass }) as CSSProperties;

  return (
    <div
      className="compas"
      data-map={mapBig ? 'big' : undefined}
      data-sheet={top?.detent}
      data-outdoor={display.outdoor ? '1' : undefined}
      style={style}
    >
      <div className="cp-bg" aria-hidden="true" />
      {/* Titre de page pour les lecteurs d'écran (WCAG 2.4.6) ; l'en-tête
          visible est porté par la capsule d'étapes et la carte « Où ». */}
      <h1 className="sr-only">Compas · {model.title}</h1>
      <div className="cp-top">
        <div className="cp-headrow">
          <nav
            className="cp-steps cp-glass"
            aria-label="Étapes du Compas"
            data-drag={lensX != null ? '' : undefined}
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse' && e.button !== 0) return;
              lensDrag.current = { x: e.clientX, moved: false };
            }}
            onPointerMove={(e) => {
              const d = lensDrag.current;
              if (!d) return;
              if (!d.moved && Math.abs(e.clientX - d.x) < 8) return;
              if (!d.moved) {
                d.moved = true;
                e.currentTarget.setPointerCapture?.(e.pointerId);
              }
              const r = e.currentTarget.getBoundingClientRect();
              const n = COMPAS_STEPS.length;
              const x = r.width > 0 ? ((e.clientX - r.left) / r.width) * n - 0.5 : stepIndex;
              if (Number.isFinite(x)) setLensX(Math.min(n - 1, Math.max(0, x)));
            }}
            onPointerUp={() => {
              const d = lensDrag.current;
              lensDrag.current = null;
              if (d?.moved && lensX != null) {
                // Le clic qui suit le relâchement ne doit pas choisir une
                // autre étape que celle sous la lentille.
                suppressClick.current = true;
                selectStep(COMPAS_STEPS[Math.round(lensX)].id);
              }
              setLensX(null);
            }}
            onPointerCancel={() => {
              lensDrag.current = null;
              setLensX(null);
            }}
            onClickCapture={(e) => {
              if (!suppressClick.current) return;
              suppressClick.current = false;
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {/* Maquette finale : la lentille suit le doigt (maintenir et
                glisser), l'étape sous la lentille est choisie au relâchement. */}
            <span
              className="cp-steps__lens"
              aria-hidden="true"
              style={{ transform: `translateX(${(lensX ?? stepIndex) * 100}%)` }}
            />
            {COMPAS_STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="cp-step"
                aria-current={step === s.id ? 'step' : undefined}
                onClick={() => selectStep(s.id)}
              >
                <Icon name={s.icon} size={20} aria-hidden="true" />
                <span className="cp-step__l">{s.label}</span>
                {alerts[s.id] && (
                  <>
                    <i className="cp-step__dot" data-tone={alerts[s.id]} aria-hidden="true" />
                    {/* La pastille est décorative ; sa cause est dans le nom du bouton. */}
                    <span className="sr-only">, alerte : {alertText[s.id]}</span>
                  </>
                )}
              </button>
            ))}
          </nav>
          <button
            type="button"
            className="cp-gbtn cp-glass"
            aria-label={`Détails : ${STEP_TITLES[step]}`}
            onClick={() => open({ kind: 'step', step, flow: defaultFlow(step, data) })}
          >
            <LinesGlyph />
          </button>
          <button
            type="button"
            className="cp-gbtn cp-glass"
            aria-label="Affichage : plein soleil et transparence du verre"
            aria-expanded={popover}
            onClick={() => setPopover((v) => !v)}
          >
            <Icon name="sun" size={18} />
          </button>
        </div>

        <section className="cp-card cp-sheet-glass" aria-label={STEP_TITLES[step]}>
          {step === 'ou' && <OuCard ctl={ctl} onKit={() => setStep('kit')} />}
          {step === 'nous' && <NousCard ctl={ctl} />}
          {step === 'resa' && <ResaCard ctl={ctl} />}
          {step === 'verdict' && <VerdictCard ctl={ctl} />}
          {step === 'kit' && <KitCard ctl={ctl} />}
        </section>
        {data.keepTrial === true && <TrialNote />}

        <button
          type="button"
          className="cp-mini cp-sheet-glass"
          onClick={() => setMapBig(false)}
          aria-label="Réduire la carte"
        >
          <span className="cp-mini__t">
            <b>{model.title}</b>
            <span>{miniLine}</span>
          </span>
          <Icon name="chevron-down" size={16} />
        </button>
      </div>

      <CompasMap
        name={model.title}
        coords={model.route.coords}
        routeGeojson={data.routeGeojson}
        points={data.points}
        big={mapBig}
        layers={layers}
        onLayers={updateLayers}
        base={base}
        onBase={updateBase}
        withAccessory={model.route.stepsCount > 0 && layers.profil}
        describe={(p) =>
          calloutOf(
            p,
            p.kind === 'step' ? data.itinerary.find((st) => `s-${st.id}` === p.id) : null
          )
        }
        onOpenStep={() => open({ kind: 'step', step: 'ou', flow: 'parcours' })}
        onToggleBig={() => {
          setMapBig((v) => !v);
          setStack([]);
          setPopover(false);
        }}
      >
        {decision && !mapBig && (
          <DecisionCapsule
            ctl={ctl}
            decision={decision}
            apply={decisionApply}
            blocked={model.verdict.level === 'bloque'}
            withAccessory={model.route.stepsCount > 0 && layers.profil}
            inert={stack.length > 0}
            onView={followDecision}
          />
        )}
        {model.route.stepsCount > 0 && layers.profil && (
          <CompasAccessory
            profile={data.elevation}
            gainM={model.route.elevationGainM}
            distanceKm={model.route.distanceKm}
            days={model.route.days}
            stepsCount={model.route.stepsCount}
          />
        )}
      </CompasMap>

      {popover && (
        <div className="cp-popv cp-sheet-glass" role="dialog" aria-label="Affichage">
          <div className="cp-popv__r">
            <span>Plein soleil</span>
            <button
              type="button"
              className="cp-switch"
              role="switch"
              aria-checked={display.outdoor}
              aria-label="Mode plein soleil"
              onClick={() => updateDisplay({ ...display, outdoor: !display.outdoor })}
            />
          </div>
          <label className="cp-popv__col">
            <span>Transparence du verre</span>
            <input
              type="range"
              min={5}
              max={70}
              value={Math.round(display.glass * 100)}
              disabled={display.outdoor}
              onChange={(e) => updateDisplay({ ...display, glass: Number(e.target.value) / 100 })}
            />
            <span className="cp-popv__lbl">
              <span>Transparent</span>
              <span>Opaque</span>
            </span>
          </label>
          <label className="cp-popv__col">
            <span>Durée de « Annuler » et des erreurs</span>
            <select
              className="cp-popv__sel"
              value={display.undoS}
              onChange={(e) => updateDisplay({ ...display, undoS: Number(e.target.value) })}
            >
              {UNDO_CHOICES.map((c) => (
                <option key={c} value={c}>
                  {c} secondes{c === DEFAULT_UNDO_S ? ' (par défaut)' : ''}
                </option>
              ))}
            </select>
          </label>
          <p className="cp-popv__note">
            {offlineSavedAt ? (
              <>
                Disponible hors ligne sur cet appareil ·{' '}
                <a href="/hors-ligne">voir la version hors ligne</a>
              </>
            ) : (
              'Préparation de la version hors ligne…'
            )}
          </p>
        </div>
      )}

      {top && (
        <CompasSheet
          key={stack.length}
          title={sheetTitle(top.sheet, ctl)}
          detent={top.detent}
          onDetent={(d) =>
            setStack((s) => s.map((x, i) => (i === s.length - 1 ? { ...x, detent: d } : x)))
          }
          onClose={close}
          onBack={stack.length > 1 ? back : undefined}
        >
          <SheetContent sheet={top.sheet} ctl={ctl} />
        </CompasSheet>
      )}

      {prep && (
        <CompasPrep
          prep={prep}
          aiOn={data.aiOn === true}
          onStop={() => {
            stopped.current = true;
            pollAbort.current?.abort();
            // Le serveur aussi : la préparation en arrière-plan saute ce qui reste à écrire.
            void compasAutofillStopAction({ tripId: model.tripId }).catch(() => undefined);
            setPrep({ stage: 'stopped', at: prepAt(), message: 'Ce qui est fait est gardé. Reprends quand tu veux.' });
          }}
          onClose={() => setPrep(null)}
          onRetry={() => {
            const at = prepRef.current?.at;
            stopped.current = false;
            if (at === 'understand' && startSay) return void understand(startSay);
            autofillRetried.current = false;
            setPrep({ stage: 'itinerary' });
            autofill();
          }}
          onEditRequest={() => {
            setPrep(null);
            setStep('ou');
            setStack([]);
            open({ kind: 'step', step: 'ou', flow: 'activite', ...(startSay ? { hint: { say: startSay, start: true } } : {}) });
          }}
        />
      )}

      {toast && (
        <div
          className="cp-island"
          // Une erreur interrompt (alert) ; le reste s'annonce poliment (status).
          role={toast.tone === 'bad' ? 'alert' : 'status'}
          aria-live={toast.tone === 'bad' ? undefined : 'polite'}
          data-tone={toast.tone}
          // Le délai est suspendu tant qu'on lit, vise ou tabule dans l'annonce.
          onPointerEnter={holdToast}
          onPointerLeave={() => armToast(toastLong.current)}
          onFocus={holdToast}
          onBlur={() => armToast(toastLong.current)}
          onClick={(e) => {
            // Toucher l'îlot le referme (maquette) ; ses boutons gardent leur rôle.
            if ((e.target as Element).closest('button')) return;
            undoRef.current = null;
            setToast(null);
          }}
        >
          <span className="cp-island__t">
            <b>{toast.message}</b>
            {toast.sub && <span>{toast.sub}</span>}
          </span>
          {toast.undo && (
            <button
              type="button"
              className="cp-island__btn"
              disabled={running}
              title="Ctrl/⌘ + Z"
              aria-keyshortcuts="Control+Z Meta+Z"
              onClick={() => {
                const undo = toast.undo;
                undoRef.current = null;
                setToast(null);
                undo?.();
              }}
            >
              Annuler
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Trois traits (≡) : aucun glyphe du registre ne le dessine. */
function LinesGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

/** Une ligne pour l'îlot : nuits, trajet, kit. */
function autofillDigest(s: CompasAutofillSummary): string {
  const parts: string[] = [];
  if (s.nights.length) {
    const count = new Map<string, number>();
    for (const n of s.nights) count.set(NIGHT_LABEL[n.type], (count.get(NIGHT_LABEL[n.type]) ?? 0) + 1);
    parts.push(
      [...count].map(([k, v]) => `${v} ${k.toLowerCase()}${v > 1 ? 's' : ''}`).join(', ')
    );
  }
  // Le trajet (d'où, entre quels aéroports), ou « Trajet non chiffré : point de départ inconnu » (engine/travel.ts).
  const travel = travelDigest(s.transport, s.originUnknown);
  if (travel) parts.push(travel);
  const kit = s.kit.inventaire + s.kit.pret + s.kit.location + s.kit.achat + s.kit.a_trouver;
  if (kit) parts.push(`${kit} objet${kit > 1 ? 's' : ''} au kit`);
  return parts.join(' · ') || 'Budget posé';
}
