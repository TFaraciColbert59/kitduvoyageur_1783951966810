'use client';

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import type { Viewer, Visibility } from './SlotShell';

/** Visibilité réellement appliquée par le runtime historique à trois états. */
export type SettingsVisibility = Visibility | 'communaute';
type VisibilityTarget = Visibility;

export interface ProfileSettingsSheetProps {
  viewer: Viewer;
  /** Visibilité issue du bootstrap : `public` = tout le monde, `prive` = invitation. */
  visibility?: Visibility;
  /**
   * Setter exact injecté par l'hôte. Prioritaire sur la détection runtime et
   * utile aux hôtes qui pilotent eux-mêmes la persistance de la visibilité.
   */
  onSetVisibility?: (visibility: Visibility) => void;
}

interface SettingsStatus {
  kind: 'info' | 'success' | 'error';
  message: string;
}

interface RawRuntimeState {
  vis?: unknown;
  orient?: unknown;
  traveller?: unknown;
}

interface RuntimeWindow extends Window {
  __lkdvCompteAct?: (action: string, value?: unknown) => void;
  __lkdvGetState?: () => { S?: RawRuntimeState } | undefined;
  __lkdvSetVisibility?: (visibility: Visibility) => void;
  __lkdvSupportsSetVis?: boolean;
}

interface RuntimeSnapshot {
  visibility: SettingsVisibility | null;
  orient: Record<string, string> | null;
  nationality: string | null;
  home: string | null;
  currency: string | null;
}

const VISIBILITY_LABELS: Record<SettingsVisibility, string> = {
  public: 'Public',
  prive: 'Privé',
  communaute: 'Communauté (hérité)',
};

const ORIENT_FIELDS: ReadonlyArray<{
  key: string;
  label: string;
  options: ReadonlyArray<readonly [string, string]>;
}> = [
  {
    key: 'terrain',
    label: 'Terrain principal',
    options: [
      ['sentier', 'Sentier'],
      ['montagne', 'Montagne'],
      ['hors_sentier', 'Hors sentier'],
      ['itinerance', 'Itinérance'],
    ],
  },
  {
    key: 'autonomy',
    label: 'Autonomie dehors',
    options: [
      ['journee', 'Journée'],
      ['bivouac_1_2', 'Bivouac 1–2 n.'],
      ['itinerance_longue', 'Itinérance longue'],
    ],
  },
  {
    key: 'priority',
    label: 'Priorité dans le sac',
    options: [
      ['legerete', 'Légèreté'],
      ['confort', 'Confort'],
      ['budget', 'Budget'],
      ['securite', 'Sécurité'],
    ],
  },
  {
    key: 'experience',
    label: 'Habitude',
    options: [
      ['debut', 'Débutant·e'],
      ['regulier', 'Régulier·ère'],
      ['aguerri', 'Aguerri·e'],
    ],
  },
];

/** Listes du runtime (`COUNTRIES` / `CURRENCIES`) : aucune valeur inventée. */
const NATIONALITIES = ['France', 'Italie', 'Suisse', 'Belgique', 'Canada', 'Espagne'];
const CURRENCIES = ['EUR (€)', 'CHF (CHF)', 'CAD ($)', 'USD ($)'];
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function runtimeWindow(): RuntimeWindow | null {
  return typeof window === 'undefined' ? null : (window as RuntimeWindow);
}

function toRuntimeVisibility(value: unknown): SettingsVisibility | null {
  if (value === 'public' || value === 2) return 'public';
  if (value === 'prive' || value === 0) return 'prive';
  if (value === 'communaute' || value === 1) return 'communaute';
  return null;
}

function readRuntimeSnapshot(): RuntimeSnapshot {
  const win = runtimeWindow();
  let state: RawRuntimeState | undefined;
  try {
    state = win?.__lkdvGetState?.()?.S;
  } catch {
    state = undefined;
  }

  const visibility = state ? toRuntimeVisibility(state.vis) : null;

  let orient: Record<string, string> | null = null;
  if (state && state.orient && typeof state.orient === 'object') {
    const entries = Object.entries(state.orient).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    );
    orient = entries.length > 0 ? Object.fromEntries(entries) : null;
  }

  const traveller =
    state && state.traveller && typeof state.traveller === 'object'
      ? (state.traveller as Record<string, unknown>)
      : null;

  return {
    visibility,
    orient,
    nationality: typeof traveller?.nationality === 'string' ? traveller.nationality : null,
    home: typeof traveller?.home === 'string' ? traveller.home : null,
    currency: typeof traveller?.currency === 'string' ? traveller.currency : null,
  };
}

/**
 * `setvis('public' | 'prive')` est le contrat exact exposé par le runtime
 * courant. On vérifie la fonction pure `resolveSetVis` du module (public → 2,
 * privé → 0) : si elle n'est pas là, le module est l'ancien runtime et on
 * utilisera `cyclevis` avec un affichage honnête de l'état résultant.
 */
async function supportsExactSetVis(): Promise<boolean> {
  try {
    const runtime = (await import('../compte-liquid-glass-v8-runtime')) as unknown as {
      resolveSetVis?: (value: unknown) => number | null;
    };
    const resolve = runtime.resolveSetVis;
    return (
      typeof resolve === 'function' && resolve('public') === 2 && resolve('prive') === 0
    );
  } catch {
    return false;
  }
}

function MatrixCell({ value }: { value: boolean | 'conditional' }) {
  if (value === true) {
    return (
      <td className="lkdv-settings-cell">
        <span className="lkdv-settings-yes" role="img" aria-label="Visible">
          ✓
        </span>
      </td>
    );
  }
  if (value === 'conditional') {
    return (
      <td className="lkdv-settings-cell">
        <span className="lkdv-settings-conditional" role="img" aria-label="Selon le prêt">
          ◐
        </span>
      </td>
    );
  }
  return (
    <td className="lkdv-settings-cell">
      <span className="lkdv-settings-no" role="img" aria-label="Non visible">
        —
      </span>
    </td>
  );
}

/**
 * Réglages du propriétaire, re-homing des anciens onglets `S.step === 0`
 * (Pratique, Voyageur, Vie privée) sans créer un sixième slot.
 *
 * La feuille est montée par `SlotShell` pour le propriétaire uniquement et
 * s'ouvre sur l'événement `lkdv:open-settings`. Toutes les actions passent par
 * `window.__lkdvCompteAct` ; aucune valeur n'est inventée : si le runtime ou
 * l'état du compte manque, l'action est désactivée avec sa raison.
 */
export function ProfileSettingsSheet({
  viewer,
  visibility = 'public',
  onSetVisibility,
}: ProfileSettingsSheetProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [exactVisibility, setExactVisibility] = useState<boolean | null>(null);
  const [currentVisibility, setCurrentVisibility] = useState<SettingsVisibility>(visibility);
  const [orient, setOrient] = useState<Record<string, string> | null>(null);
  const [nationality, setNationality] = useState<string | null>(null);
  const [home, setHome] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [homeDraft, setHomeDraft] = useState('');
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [pendingVisibility, setPendingVisibility] = useState<VisibilityTarget | null>(null);

  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const previousBodyOverflowRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const refreshRuntime = useCallback(() => {
    const win = runtimeWindow();
    setRuntimeReady(typeof win?.__lkdvCompteAct === 'function');
    const snapshot = readRuntimeSnapshot();
    setOrient(snapshot.orient);
    setNationality(snapshot.nationality);
    setHome(snapshot.home);
    setCurrency(snapshot.currency);
    if (snapshot.home !== null) setHomeDraft(snapshot.home);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (viewer !== 'owner') {
      setOpen(false);
      return;
    }
    const onOpen = () => setOpen(true);
    window.addEventListener('lkdv:open-settings', onOpen);
    return () => window.removeEventListener('lkdv:open-settings', onOpen);
  }, [viewer]);

  useEffect(() => {
    setCurrentVisibility(visibility);
  }, [visibility]);

  useEffect(() => {
    if (!open) return;
    refreshRuntime();
  }, [open, refreshRuntime]);

  useEffect(() => {
    if (!open || !runtimeReady) {
      setExactVisibility(null);
      return;
    }
    if (
      onSetVisibility ||
      typeof runtimeWindow()?.__lkdvSetVisibility === 'function' ||
      runtimeWindow()?.__lkdvSupportsSetVis === true
    ) {
      setExactVisibility(true);
      return;
    }
    let cancelled = false;
    void supportsExactSetVis().then((supported) => {
      if (!cancelled) setExactVisibility(supported);
    });
    return () => {
      cancelled = true;
    };
  }, [open, runtimeReady, onSetVisibility]);

  const close = useCallback(() => {
    setOpen(false);
    setPendingVisibility(null);
    setStatus(null);
    clearTimer();
  }, [clearTimer]);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    previousBodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(focusTimer);
      restoreFocusRef.current?.focus?.();
      restoreFocusRef.current = null;
      if (previousBodyOverflowRef.current !== null) {
        document.body.style.overflow = previousBodyOverflowRef.current;
        previousBodyOverflowRef.current = null;
      }
      clearTimer();
    };
  }, [open, clearTimer]);

  const applyVisibility = async (target: VisibilityTarget) => {
    const win = runtimeWindow();
    const act = win?.__lkdvCompteAct;
    if (!act && !onSetVisibility) return;
    if (pendingVisibility) return;
    if (currentVisibility === target) {
      setStatus({
        kind: 'info',
        message: `La visibilité est déjà ${target === 'public' ? 'publique' : 'privée'}.`,
      });
      return;
    }

    setStatus(null);
    setPendingVisibility(target);

    const exact =
      Boolean(onSetVisibility) ||
      typeof win?.__lkdvSetVisibility === 'function' ||
      win?.__lkdvSupportsSetVis === true ||
      (await supportsExactSetVis());

    try {
      if (exact) {
        if (onSetVisibility) onSetVisibility(target);
        else if (typeof win?.__lkdvSetVisibility === 'function') win.__lkdvSetVisibility(target);
        else act?.('setvis', target);

        clearTimer();
        timerRef.current = window.setTimeout(() => {
          const snapshot = readRuntimeSnapshot();
          if (snapshot.visibility) {
            setCurrentVisibility(snapshot.visibility);
            setStatus({
              kind: snapshot.visibility === target ? 'success' : 'error',
              message:
                snapshot.visibility === target
                  ? `Visibilité ${target === 'public' ? 'publique' : 'privée'} appliquée.`
                  : `Le runtime a appliqué « ${VISIBILITY_LABELS[snapshot.visibility]} » : la visibilité exacte n’est pas garantie.`,
            });
          } else {
            setCurrentVisibility(target);
            setStatus({
              kind: 'info',
              message: `Visibilité ${target === 'public' ? 'publique' : 'privée'} demandée au runtime.`,
            });
          }
          setPendingVisibility(null);
        }, 340);
        return;
      }

      act?.('cyclevis');
      const snapshot = readRuntimeSnapshot();
      if (snapshot.visibility) {
        setCurrentVisibility(snapshot.visibility);
        setStatus({
          kind: snapshot.visibility === target ? 'success' : 'info',
          message:
            snapshot.visibility === target
              ? `Visibilité ${target === 'public' ? 'publique' : 'privée'} appliquée par le cycle.`
              : `Le cycle hérité a appliqué « ${VISIBILITY_LABELS[snapshot.visibility]} ».`,
        });
      } else {
        setStatus({
          kind: 'info',
          message: 'Cycle de visibilité envoyé ; le runtime ne fournit pas l’état résultant.',
        });
      }
      setPendingVisibility(null);
    } catch {
      setPendingVisibility(null);
      setStatus({ kind: 'error', message: 'La visibilité n’a pas pu être appliquée.' });
    }
  };

  const applyOrient = (key: string, value: string) => {
    const act = runtimeWindow()?.__lkdvCompteAct;
    if (!act) return;
    try {
      act('orient', `${key}:${value}`);
      const snapshot = readRuntimeSnapshot();
      if (snapshot.orient) setOrient(snapshot.orient);
      setStatus({ kind: 'info', message: 'Préférence de marche transmise au runtime.' });
    } catch {
      setStatus({ kind: 'error', message: 'La préférence de marche n’a pas pu être transmise.' });
    }
  };

  const applyIdentity = (action: 'nat' | 'home' | 'curr', value: string) => {
    const act = runtimeWindow()?.__lkdvCompteAct;
    if (!act) return;
    try {
      act(action, value);
      const snapshot = readRuntimeSnapshot();
      if (action === 'nat' && snapshot.nationality) setNationality(snapshot.nationality);
      if (action === 'home' && snapshot.home) {
        setHome(snapshot.home);
        setHomeDraft(snapshot.home);
      }
      if (action === 'curr' && snapshot.currency) setCurrency(snapshot.currency);
      setStatus({ kind: 'info', message: 'Identité voyageur transmise au runtime.' });
    } catch {
      setStatus({ kind: 'error', message: 'L’identité voyageur n’a pas pu être transmise.' });
    }
  };

  const applyHome = () => {
    const city = homeDraft.trim();
    if (!city) {
      setStatus({ kind: 'error', message: 'Saisis une ville de départ.' });
      return;
    }
    applyIdentity('home', city);
  };

  const triggerExport = () => {
    const act = runtimeWindow()?.__lkdvCompteAct;
    if (!act) return;
    try {
      act('export', 'full');
      setStatus({ kind: 'info', message: 'Demande d’export RGPD envoyée au runtime.' });
    } catch {
      setStatus({ kind: 'error', message: 'L’export RGPD n’a pas pu être demandé.' });
    }
  };

  const triggerSignout = () => {
    const act = runtimeWindow()?.__lkdvCompteAct;
    if (!act) return;
    try {
      act('signout');
      setStatus({ kind: 'info', message: 'Déconnexion demandée au runtime.' });
    } catch {
      setStatus({ kind: 'error', message: 'La déconnexion n’a pas pu être demandée.' });
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'Tab' || !sheetRef.current) return;
    const focusable = Array.from(
      sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!mounted || !open || viewer !== 'owner') return null;

  const canAct = runtimeReady || Boolean(onSetVisibility);
  const middleColumn = currentVisibility === 'communaute' ? 'Communauté' : 'Invités';
  const publicVisible = currentVisibility === 'public';
  const matrixRows: ReadonlyArray<{
    label: string;
    members: boolean | 'conditional';
    public: boolean;
  }> = [
    { label: 'Empreinte (massifs ≥ 3)', members: true, public: publicVisible },
    { label: 'Carnets publiés', members: true, public: publicVisible },
    { label: 'Traces GPS brutes', members: false, public: false },
    { label: 'Matériel & prêts', members: 'conditional', public: false },
    { label: 'Pratique & voyageur', members: false, public: false },
  ];

  return createPortal(
    <div
      className="lkdv-settings-scrim"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      onKeyDown={handleKeyDown}
    >
      <style>{PROFILE_SETTINGS_CSS}</style>
      <section
        ref={sheetRef}
        className="lkdv-settings-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-viewer="owner"
      >
        <header className="lkdv-settings-head">
          <div className="lkdv-settings-head-txt">
            <p className="lkdv-settings-kicker">Propriétaire</p>
            <h2 id={titleId} className="lkdv-settings-title">
              Réglages du profil
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="lkdv-settings-close"
            aria-label="Fermer les réglages"
            onClick={close}
          >
            ×
          </button>
        </header>

        {!runtimeReady && !onSetVisibility ? (
          <p className="lkdv-settings-banner" role="alert">
            Runtime du compte indisponible : les actions sont désactivées.
          </p>
        ) : null}

        {status ? (
          <p
            className={`lkdv-settings-status is-${status.kind}`}
            role={status.kind === 'error' ? 'alert' : 'status'}
          >
            {status.message}
          </p>
        ) : null}

        <div className="lkdv-settings-scroll">
          <section className="lkdv-settings-section" aria-labelledby={`${titleId}-visibility`}>
            <h3 id={`${titleId}-visibility`} className="lkdv-settings-h3">
              Visibilité du compte
            </h3>
            <p className="lkdv-settings-help">
              Public : tout le monde. Privé : uniquement sur invitation.
            </p>
            <div
              className="lkdv-settings-seg"
              role="group"
              aria-label="Visibilité du compte"
              aria-busy={pendingVisibility !== null}
            >
              <button
                type="button"
                aria-pressed={currentVisibility === 'public'}
                disabled={!canAct || pendingVisibility !== null}
                onClick={() => void applyVisibility('public')}
              >
                Public
              </button>
              <button
                type="button"
                aria-pressed={currentVisibility === 'prive'}
                disabled={!canAct || pendingVisibility !== null}
                onClick={() => void applyVisibility('prive')}
              >
                Privé
              </button>
            </div>
            <p
              className="lkdv-settings-current"
              data-testid="settings-visibility-state"
              aria-live="polite"
            >
              État actuel : {VISIBILITY_LABELS[currentVisibility]}
            </p>
            {currentVisibility === 'communaute' ? (
              <p className="lkdv-settings-note">
                État hérité du runtime historique. Choisis Public ou Privé pour en sortir.
              </p>
            ) : null}
            {runtimeReady && exactVisibility === false ? (
              <p className="lkdv-settings-note">
                Le runtime ne fournit pas d’action de visibilité exacte : le cycle hérité Privé →
                Communauté → Public est utilisé et l’état réel est affiché après l’action.
              </p>
            ) : null}
            {!runtimeReady && !onSetVisibility ? (
              <p className="lkdv-settings-note">
                Visibilité indisponible : le runtime du compte n’est pas chargé.
              </p>
            ) : null}
          </section>

          <section className="lkdv-settings-section" aria-labelledby={`${titleId}-orient`}>
            <h3 id={`${titleId}-orient`} className="lkdv-settings-h3">
              Préférences de marche
            </h3>
            <p className="lkdv-settings-help">
              Ces réponses pré-remplissent le Compas ; elles ne sont jamais affichées publiquement.
            </p>
            {ORIENT_FIELDS.map((field) => {
              const selectId = `${titleId}-orient-${field.key}`;
              const value = orient?.[field.key] ?? '';
              return (
                <div className="lkdv-settings-field" key={field.key}>
                  <label htmlFor={selectId}>{field.label}</label>
                  <select
                    id={selectId}
                    value={value}
                    disabled={!orient}
                    onChange={(event) => applyOrient(field.key, event.target.value)}
                  >
                    {value === '' ? <option value="">Indisponible</option> : null}
                    {field.options.map(([optionValue, optionLabel]) => (
                      <option key={optionValue} value={optionValue}>
                        {optionLabel}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
            {runtimeReady && !orient ? (
              <p className="lkdv-settings-note">
                Préférences indisponibles : le runtime n’expose pas l’état de marche.
              </p>
            ) : null}
          </section>

          <section className="lkdv-settings-section" aria-labelledby={`${titleId}-identity`}>
            <h3 id={`${titleId}-identity`} className="lkdv-settings-h3">
              Identité voyageur
            </h3>
            <p className="lkdv-settings-help">
              Le Compas retient ces informations pour les formalités et le budget. Le domicile est
              conservé à 1 km près.
            </p>

            <div className="lkdv-settings-field">
              <label htmlFor={`${titleId}-nationality`}>Nationalité</label>
              <select
                id={`${titleId}-nationality`}
                value={nationality ?? ''}
                disabled={!runtimeReady}
                onChange={(event) => applyIdentity('nat', event.target.value)}
              >
                {!nationality ? <option value="">Indisponible</option> : null}
                {nationality && !NATIONALITIES.includes(nationality) ? (
                  <option value={nationality}>{nationality}</option>
                ) : null}
                {NATIONALITIES.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </div>

            <div className="lkdv-settings-field">
              <label htmlFor={`${titleId}-home`}>Ville de départ habituelle</label>
              <div className="lkdv-settings-inline">
                <input
                  id={`${titleId}-home`}
                  type="text"
                  value={homeDraft}
                  disabled={!runtimeReady}
                  autoComplete="address-level2"
                  onChange={(event) => setHomeDraft(event.target.value)}
                />
                <button
                  type="button"
                  className="lkdv-settings-secondary"
                  disabled={!runtimeReady || !homeDraft.trim()}
                  onClick={applyHome}
                >
                  Enregistrer la ville
                </button>
              </div>
            </div>

            <div className="lkdv-settings-field">
              <label htmlFor={`${titleId}-currency`}>Devise d’affichage</label>
              <select
                id={`${titleId}-currency`}
                value={currency ?? ''}
                disabled={!runtimeReady}
                onChange={(event) => applyIdentity('curr', event.target.value)}
              >
                {!currency ? <option value="">Indisponible</option> : null}
                {currency && !CURRENCIES.includes(currency) ? (
                  <option value={currency}>{currency}</option>
                ) : null}
                {CURRENCIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {runtimeReady && !nationality && !home && !currency ? (
              <p className="lkdv-settings-note">
                Identité indisponible : le runtime n’expose pas l’état du compte.
              </p>
            ) : null}
          </section>

          <section className="lkdv-settings-section" aria-labelledby={`${titleId}-matrix`}>
            <h3 id={`${titleId}-matrix`} className="lkdv-settings-h3">
              Qui voit quoi ?
            </h3>
            <p className="lkdv-settings-help">
              Résumé des règles de visibilité appliquées par les politiques RLS.
            </p>
            <table className="lkdv-settings-table" aria-label="Qui voit quoi ?">
              <caption className="lkdv-settings-caption">
                Visibilité par type de donnée
              </caption>
              <thead>
                <tr>
                  <th scope="col">Donnée</th>
                  <th scope="col">Moi</th>
                  <th scope="col">{middleColumn}</th>
                  <th scope="col">Public</th>
                </tr>
              </thead>
              <tbody>
                {matrixRows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <MatrixCell value />
                    <MatrixCell value={row.members} />
                    <MatrixCell value={row.public} />
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="lkdv-settings-note">
              Les traces GPS brutes, la pratique et l’identité voyageur restent privées. Les invités
              voient l’empreinte et les carnets publiés ; le matériel seulement si un prêt est
              proposé.
            </p>
          </section>

          <section className="lkdv-settings-section" aria-labelledby={`${titleId}-export`}>
            <h3 id={`${titleId}-export`} className="lkdv-settings-h3">
              Export RGPD
            </h3>
            <p className="lkdv-settings-help">
              Archive JSON de ton profil, tes sorties, tes carnets et tes kits (art. 20 RGPD).
            </p>
            <button
              type="button"
              className="lkdv-settings-primary"
              disabled={!runtimeReady}
              onClick={triggerExport}
            >
              Exporter mes données (JSON)
            </button>
            {!runtimeReady ? (
              <p className="lkdv-settings-note">
                Export indisponible : le runtime du compte n’est pas chargé.
              </p>
            ) : null}
          </section>

          <section className="lkdv-settings-section" aria-labelledby={`${titleId}-signout`}>
            <h3 id={`${titleId}-signout`} className="lkdv-settings-h3">
              Déconnexion
            </h3>
            <p className="lkdv-settings-help">Ferme la session sur cet appareil.</p>
            <button
              type="button"
              className="lkdv-settings-danger"
              disabled={!runtimeReady}
              onClick={triggerSignout}
            >
              Se déconnecter
            </button>
            {!runtimeReady ? (
              <p className="lkdv-settings-note">
                Déconnexion indisponible : le runtime du compte n’est pas chargé.
              </p>
            ) : null}
          </section>
        </div>
      </section>
    </div>,
    document.body
  );
}

/**
 * Styles de la feuille. Elle est portalée dans `document.body` : les variables
 * du `.phone` ne sont plus héritées, on reprend donc les tokens Liquid Glass
 * avec un repli explicite pour rester identique dans et hors du drawer.
 */
export const PROFILE_SETTINGS_CSS = `
.lkdv-settings-scrim{position:fixed;inset:0;z-index:1200;display:flex;align-items:flex-end;justify-content:center;background:rgba(12,24,19,.34);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);animation:lkdv-settings-fade .18s ease-out;}
.lkdv-settings-sheet{width:100%;max-width:430px;max-height:min(88dvh,780px);display:flex;flex-direction:column;overflow:hidden;border-radius:26px 26px 0 0;background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(247,249,245,.98));color:var(--label,#172B24);font:400 14px/1.35 var(--sf,-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif);box-shadow:0 -12px 40px rgba(23,43,36,.22),inset 0 1px 0 #fff;animation:lkdv-settings-up .28s cubic-bezier(.16,1,.3,1);}
.lkdv-settings-head{display:flex;align-items:center;gap:12px;flex:none;padding:18px 18px 12px;border-bottom:.5px solid var(--sep,rgba(23,43,36,.1));}
.lkdv-settings-head-txt{flex:1;min-width:0;}
.lkdv-settings-kicker{margin:0 0 2px;font:600 11px/1.2 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);letter-spacing:.04em;text-transform:uppercase;color:var(--accent,#5B7F55);}
.lkdv-settings-title{margin:0;font:700 22px/1.15 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);letter-spacing:-.02em;}
.lkdv-settings-close{width:44px;height:44px;flex:none;display:grid;place-items:center;border:0;border-radius:50%;background:rgba(23,43,36,.06);color:var(--label,#172B24);font:500 22px/1 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);cursor:pointer;}
.lkdv-settings-close:focus-visible,.lkdv-settings-scroll button:focus-visible,.lkdv-settings-scroll select:focus-visible,.lkdv-settings-scroll input:focus-visible{outline:2px solid rgba(23,64,44,.55);outline-offset:2px;}
.lkdv-settings-banner{margin:10px 18px 0;padding:10px 12px;border-radius:12px;background:#FBF1DC;color:#7A5A16;font:500 12.5px/1.4 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);}
.lkdv-settings-status{margin:10px 18px 0;padding:10px 12px;border-radius:12px;font:500 12.5px/1.4 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);}
.lkdv-settings-status.is-info{background:rgba(91,127,85,.12);color:#17402C;}
.lkdv-settings-status.is-success{background:rgba(61,122,82,.14);color:#17402C;}
.lkdv-settings-status.is-error{background:#F5DDD9;color:#7A2E26;}
.lkdv-settings-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:4px 18px calc(18px + env(safe-area-inset-bottom,0px));}
.lkdv-settings-section{padding:16px 0;border-top:.5px solid var(--sep,rgba(23,43,36,.1));}
.lkdv-settings-section:first-child{border-top:0;}
.lkdv-settings-h3{margin:0 0 4px;font:700 15.5px/1.25 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);letter-spacing:-.01em;}
.lkdv-settings-help{margin:0 0 10px;font:400 12.5px/1.45 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);color:var(--label2,#56665D);}
.lkdv-settings-note{margin:8px 0 0;font:400 12px/1.45 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);color:var(--label2,#56665D);}
.lkdv-settings-current{margin:9px 0 0;font:600 12.5px/1.4 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);color:#17402C;}
.lkdv-settings-seg{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-radius:14px;background:rgba(23,43,36,.06);}
.lkdv-settings-seg button{min-height:44px;border:0;border-radius:11px;background:transparent;color:#56665D;font:600 13.5px/1 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);cursor:pointer;}
.lkdv-settings-seg button[aria-pressed="true"]{background:#fff;color:#17402C;box-shadow:0 1px 3px rgba(23,43,36,.16),inset 0 0 0 .5px rgba(23,43,36,.08);}
.lkdv-settings-seg button:disabled{opacity:.55;cursor:not-allowed;}
.lkdv-settings-field{display:flex;flex-direction:column;gap:5px;margin-top:10px;}
.lkdv-settings-field label{font:600 12px/1.3 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);color:#3E5047;}
.lkdv-settings-field select,.lkdv-settings-field input{width:100%;min-height:44px;padding:0 12px;border:.5px solid rgba(23,43,36,.18);border-radius:12px;background:#fff;color:var(--label,#172B24);font:500 13.5px/1.2 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);}
.lkdv-settings-field select:disabled,.lkdv-settings-field input:disabled{opacity:.55;cursor:not-allowed;}
.lkdv-settings-inline{display:flex;gap:8px;align-items:stretch;}
.lkdv-settings-inline input{flex:1;min-width:0;}
.lkdv-settings-secondary,.lkdv-settings-primary,.lkdv-settings-danger{min-height:44px;padding:0 16px;border:0;border-radius:999px;font:600 13.5px/1.1 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);cursor:pointer;}
.lkdv-settings-secondary{flex:none;background:rgba(91,127,85,.16);color:#17402C;}
.lkdv-settings-primary{width:100%;background:#17402C;color:#fff;}
.lkdv-settings-danger{width:100%;background:#F5DDD9;color:#7A2E26;}
.lkdv-settings-secondary:disabled,.lkdv-settings-primary:disabled,.lkdv-settings-danger:disabled{opacity:.5;cursor:not-allowed;}
.lkdv-settings-table{width:100%;border-collapse:collapse;overflow:hidden;border-radius:14px;background:rgba(255,255,255,.62);box-shadow:inset 0 0 0 .5px rgba(23,43,36,.1);font:500 12px/1.3 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);}
.lkdv-settings-caption{caption-side:top;text-align:left;padding:0 0 6px;font:600 11.5px/1.3 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);color:#56665D;}
.lkdv-settings-table th,.lkdv-settings-table td{padding:8px 7px;border-top:.5px solid rgba(23,43,36,.09);text-align:center;}
.lkdv-settings-table thead th{border-top:0;font:700 11px/1.25 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);color:#56665D;}
.lkdv-settings-table thead th:first-child,.lkdv-settings-table tbody th{text-align:left;}
.lkdv-settings-table tbody th{font-weight:500;color:#172B24;}
.lkdv-settings-yes{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#3D7A52;color:#fff;font:700 11px/1 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);}
.lkdv-settings-no{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;box-shadow:inset 0 0 0 1.4px rgba(23,43,36,.28);color:#56665D;font:700 11px/1 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);}
.lkdv-settings-conditional{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:rgba(91,127,85,.22);color:#17402C;font:700 11px/1 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);}
@keyframes lkdv-settings-fade{from{opacity:0}to{opacity:1}}
@keyframes lkdv-settings-up{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
@media (min-width:640px){.lkdv-settings-scrim{align-items:center;padding:24px}.lkdv-settings-sheet{border-radius:26px;max-height:min(84dvh,780px)}}
@media (prefers-reduced-motion:reduce){.lkdv-settings-scrim,.lkdv-settings-sheet{animation:none!important;}.lkdv-settings-seg button,.lkdv-settings-scroll button{transition:none!important;}}
`;

export default ProfileSettingsSheet;
