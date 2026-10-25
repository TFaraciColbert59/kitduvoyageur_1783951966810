'use client';

import Icon from '@/components/ui/Icon';
import type { Locale } from '@/lib/i18n/locale';
import type { TranslationKey } from '@/lib/i18n/translate';
import {
useMemo,
useRef,
useState,
type CSSProperties
} from 'react';
import { STEP_LABEL_KEY,activityName } from '../engine/compasI18n';
import { COMPAS_STEPS,type CompasStepId } from '../engine/compasModel';
import { planDecisionApply } from '../engine/decisionApply';
import { formatHours } from '../engine/format';
import { calloutOf } from '../engine/mapStyle';
import '../motion.css';
import {
compasAutofillStopAction
} from '../server/autofillActions';
import type { CompasData } from '../server/getCompasData';
import { CompasAccessory } from './CompasAccessory';
import { KitCard,NousCard,OuCard,ResaCard,VerdictCard } from './CompasCards';
import { DecisionCapsule } from './CompasDecision';
import { CompasMap } from './CompasMap';
import { CompasPrep } from './CompasPrep';
import { tripHours } from './CompasRuler';
import { CompasSheet } from './CompasSheet';
import { SheetContent,sheetTitle } from './CompasSheets';
import {
countText,
type CompasT,
type StepFlow
} from './compasTypes';
import { InstallApp } from './InstallApp';
import { TrialNote } from './TrialNote';
import { DEFAULT_UNDO_S,UNDO_CHOICES,useCompasController } from './useCompasController';

/** Nom de l'étape : bouton ≡ (« Détails : … ») et carte de l'étape. */
const STEP_TITLES: Record<CompasStepId, { details: TranslationKey; card: TranslationKey }> = {
  ou: { details: 'compas.screen.detailsOu', card: 'compas.screen.cardOu' },
  nous: { details: 'compas.screen.detailsNous', card: 'compas.screen.cardNous' },
  resa: { details: 'compas.screen.detailsResa', card: 'compas.screen.cardResa' },
  verdict: { details: 'compas.screen.detailsVerdict', card: 'compas.screen.cardVerdict' },
  kit: { details: 'compas.screen.detailsKit', card: 'compas.screen.cardKit' },
};

/** Tiroir ouvert par ≡ pour chaque étape. */
function defaultFlow(step: CompasStepId, data: CompasData): StepFlow {
  switch (step) {
    case 'ou': // i18n-ok : identifiants
      return data.model.dates.start ? 'parcours' : 'quand'; // i18n-ok
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
  quand: { step: 'ou', flow: 'quand' }, // i18n-ok : identifiants
  parcours: { step: 'ou', flow: 'parcours' }, // i18n-ok
  sacs: { step: 'kit', flow: 'sacs' },
  choix: { step: 'resa', flow: 'reservations' },
  budget: { step: 'nous', flow: 'budget' }, // i18n-ok
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
  data: rawData,
  initialStep,
}: {
  data: CompasData;
  /** Étape ouverte à l'arrivée (lien `?etape=`) ; sinon la prochaine décision. */
  initialStep?: CompasStepId;
}) {
  const [step, setStep] = useState<CompasStepId>(
    () => initialStep ?? rawData.model.nextDecision?.step ?? 'ou' // i18n-ok : identifiant
  );
  const [mapBig, setMapBig] = useState(false);
  const [popover, setPopover] = useState(false);
  const c = useCompasController(rawData, {
    onOpen: () => {
      setPopover(false);
      setMapBig(false);
    },
  });
  const {
    data, model, t, locale, router, pending, running, display, updateDisplay, stack, setStack, toast, setToast,
    undoRef, holdToast, armToast, toastLong, offlineSavedAt, layers, updateLayers, base, updateBase, ctl, open,
    close, back, notify, run, prep, setPrep, prepAt, prepRef, stopped, pollAbort, autofill, autofillRetried, understand, startSay,
  } = c;
  void router; void run; void notify; void pending; void running;

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
    ou: alerts.ou ? t('compas.screen.alertDates') : undefined,
    nous: alerts.nous ? t('compas.screen.alertBudget') : undefined,
    resa: alerts.resa ? t('compas.screen.alertBookings') : undefined,
    verdict: alerts.verdict
      ? alerts.verdict === 'bad'
        ? t('compas.screen.alertBlocked')
        : t('compas.screen.alertCheck')
      : undefined,
    kit: alerts.kit
      ? alerts.kit === 'bad'
        ? t('compas.screen.alertVital')
        : t('compas.screen.alertItems')
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
    activityName(model.activity, locale),
    hours != null ? formatHours(hours, locale) : null,
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
            aria-label={t('compas.start.stepsNav')}
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
                <span className="cp-step__l">{t(STEP_LABEL_KEY[s.id])}</span>
                {alerts[s.id] && (
                  <>
                    <i className="cp-step__dot" data-tone={alerts[s.id]} aria-hidden="true" />
                    {/* La pastille est décorative ; sa cause est dans le nom du bouton. */}
                    <span className="sr-only">
                      {t('compas.screen.alertPrefix', { reason: alertText[s.id] ?? '' })}
                    </span>
                  </>
                )}
              </button>
            ))}
          </nav>
          <button
            type="button"
            className="cp-gbtn cp-glass"
            aria-label={t(STEP_TITLES[step].details)}
            onClick={() => open({ kind: 'step', step, flow: defaultFlow(step, data) })}
          >
            <LinesGlyph />
          </button>
          <button
            type="button"
            className="cp-gbtn cp-glass"
            aria-label={t('compas.screen.displayButton')}
            aria-expanded={popover}
            onClick={() => setPopover((v) => !v)}
          >
            <Icon name="sun" size={18} />
          </button>
        </div>

        <section className="cp-card cp-sheet-glass" aria-label={t(STEP_TITLES[step].card)}>
          {step === 'ou' && <OuCard ctl={ctl} onKit={() => setStep('kit')} />}{/* i18n-ok */}
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
          aria-label={t('compas.map.shrink')}
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
        onOpenStep={() => open({ kind: 'step', step: 'ou', flow: 'parcours' })} // i18n-ok
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
        <div className="cp-popv cp-sheet-glass" role="dialog" aria-label={t('compas.screen.display')}>
          <div className="cp-popv__r">
            <span>{t('compas.screen.fullSun')}</span>
            <button
              type="button"
              className="cp-switch"
              role="switch"
              aria-checked={display.outdoor}
              aria-label={t('compas.screen.fullSunMode')}
              onClick={() => updateDisplay({ ...display, outdoor: !display.outdoor })}
            />
          </div>
          <label className="cp-popv__col">
            <span>{t('compas.screen.glass')}</span>
            <input
              type="range"
              min={5}
              max={70}
              value={Math.round(display.glass * 100)}
              disabled={display.outdoor}
              onChange={(e) => updateDisplay({ ...display, glass: Number(e.target.value) / 100 })}
            />
            <span className="cp-popv__lbl">
              <span>{t('compas.screen.glassClear')}</span>
              <span>{t('compas.screen.glassSolid')}</span>
            </span>
          </label>
          <label className="cp-popv__col">
            <span>{t('compas.screen.toastDuration')}</span>
            <select
              className="cp-popv__sel"
              value={display.undoS}
              onChange={(e) => updateDisplay({ ...display, undoS: Number(e.target.value) })}
            >
              {UNDO_CHOICES.map((c) => (
                <option key={c} value={c}>
                  {secondsText(c, c === DEFAULT_UNDO_S, t, locale)}
                </option>
              ))}
            </select>
          </label>
          <p className="cp-popv__note">
            {offlineSavedAt ? (
              <>
                {t('compas.screen.offlineReady').split('{link}')[0]}
                <a href="/hors-ligne">{t('compas.screen.offlineLink')}</a>
                {t('compas.screen.offlineReady').split('{link}')[1]}
              </>
            ) : (
              t('compas.screen.offlinePreparing')
            )}
          </p>
          <InstallApp />
        </div>
      )}

      {top && (
        <CompasSheet
          key={stack.length}
          title={sheetTitle(top.sheet, ctl, t)}
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
            setPrep({ stage: 'stopped', at: prepAt(), message: t('compas.screen.stoppedKept') });
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
            setStep('ou'); // i18n-ok : identifiant
            setStack([]);
            open({ kind: 'step', step: 'ou', flow: 'activite', ...(startSay ? { hint: { say: startSay, start: true } } : {}) }); // i18n-ok
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
              {t('compas.screen.undo')}
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

/** Durée d'une annonce dans le choix « Affichage » : « 15 secondes (par défaut) ». */
function secondsText(seconds: number, isDefault: boolean, t: CompasT, locale: Locale): string {
  const text = countText(t, locale, seconds, 'compas.screen.secondsOne', 'compas.screen.secondsOther');
  return isDefault ? t('compas.screen.secondsDefault', { seconds: text }) : text;
}
