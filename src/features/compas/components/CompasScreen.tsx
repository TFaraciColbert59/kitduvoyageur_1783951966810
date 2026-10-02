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
import { activityLabel, formatHours } from '../engine/format';
import type { CompasData } from '../server/getCompasData';
import { KitCard, NousCard, OuCard, ResaCard, VerdictCard } from './CompasCards';
import { CompasMap } from './CompasMap';
import { CompasAccessory } from './CompasAccessory';
import { tripHours } from './CompasRuler';
import { CompasSheet, type Detent } from './CompasSheet';
import { SheetContent, sheetTitle } from './CompasSheets';
import type { ActionResult, CompasCtl, SheetState, StepFlow } from './compasTypes';

const DISPLAY_KEY = 'lkdv.compas.affichage';

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
export function CompasScreen({
  data,
  initialStep,
}: {
  data: CompasData;
  /** Étape ouverte à l'arrivée (lien `?etape=`) ; sinon la prochaine décision. */
  initialStep?: CompasStepId;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState<CompasStepId>(
    () => initialStep ?? data.model.nextDecision?.step ?? 'ou'
  );
  const [mapBig, setMapBig] = useState(false);
  const [display, setDisplay] = useState<{ outdoor: boolean; glass: number }>({
    outdoor: false,
    glass: 0.19,
  });
  const [popover, setPopover] = useState(false);
  const [stack, setStack] = useState<Array<{ sheet: SheetState; detent: Detent }>>([]);
  const [packed, setPacked] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; tone?: 'bad' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { model } = data;

  // Réglage d'affichage : préférence personnelle, jamais indispensable.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DISPLAY_KEY);
      if (raw) {
        const v = JSON.parse(raw) as { outdoor?: unknown; glass?: unknown };
        setDisplay({
          outdoor: v.outdoor === true,
          glass: typeof v.glass === 'number' && v.glass >= 0.05 && v.glass <= 0.7 ? v.glass : 0.19,
        });
      }
    } catch {
      /* stockage indisponible : réglage par défaut */
    }
  }, []);
  const updateDisplay = (next: { outdoor: boolean; glass: number }) => {
    setDisplay(next);
    try {
      window.localStorage.setItem(DISPLAY_KEY, JSON.stringify(next));
    } catch {
      /* sans effet */
    }
  };

  // Les données fraîches du serveur remplacent l'état optimiste.
  useEffect(() => setPacked({}), [data]);

  const notify = useCallback((message: string, tone?: 'bad') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const run = useCallback(
    async (success: string, action: () => Promise<ActionResult>) => {
      setRunning(true);
      try {
        const res = await action();
        if (!res.success) {
          notify(res.error ?? 'Action impossible', 'bad');
          return false;
        }
        notify(success);
        startTransition(() => router.refresh());
        return true;
      } catch {
        notify('Connexion perdue : réessaie.', 'bad');
        return false;
      } finally {
        setRunning(false);
      }
    },
    [notify, router]
  );

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
    notify,
  };

  const decision = model.nextDecision;
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
  const stepIndex = COMPAS_STEPS.findIndex((s) => s.id === step);

  const hours = tripHours(model);
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
      <div className="cp-top">
        <div className="cp-headrow">
          <nav className="cp-steps cp-glass" aria-label="Étapes du Compas">
            <span
              className="cp-steps__lens"
              aria-hidden="true"
              style={{ transform: `translateX(${stepIndex * 100}%)` }}
            />
            {COMPAS_STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="cp-step"
                aria-current={step === s.id ? 'step' : undefined}
                onClick={() => {
                  setStep(s.id);
                  setStack([]);
                  setMapBig(false);
                }}
              >
                <Icon name={s.icon} size={20} />
                <span className="cp-step__l">{s.label}</span>
                {alerts[s.id] && (
                  <i className="cp-step__dot" data-tone={alerts[s.id]} aria-hidden="true" />
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
        onToggleBig={() => {
          setMapBig((v) => !v);
          setStack([]);
          setPopover(false);
        }}
      >
        {decision && !mapBig && (
          <button type="button" className="cp-decision cp-glass" onClick={followDecision}>
            <span
              className="cp-decision__i"
              data-tone={model.verdict.level === 'bloque' ? 'bad' : undefined}
            >
              <Icon name="compass" size={17} />
            </span>
            <span className="cp-decision__t">
              <b>{decision.label}</b>
              <span>{decision.detail}</span>
            </span>
            <Icon name="chevron-right" size={14} />
          </button>
        )}
        {model.route.stepsCount > 0 && (
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

      {toast && (
        <div className="cp-toast" role="status" data-tone={toast.tone}>
          {toast.message}
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
