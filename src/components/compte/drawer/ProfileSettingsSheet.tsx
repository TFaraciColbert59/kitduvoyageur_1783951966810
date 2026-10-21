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
import {
  PROFILE_VISIBILITY_EVENT,
  toAccountVisibility,
  type ProfileVisibilityEventDetail,
} from '@/features/compte/data/accountVisibility';

/** Visibilité de l'empreinte réellement exposée par le runtime (`S.vis`). */
type SignatureVisibility = Visibility | 'communaute';
type SettingsSection =
  | 'signature'
  | 'account'
  | 'orientation'
  | 'identity'
  | 'matrix'
  | 'export'
  | 'signout';
type MatrixValue = boolean | 'conditional' | 'unknown';

export interface ProfileSettingsSheetProps {
  viewer: Viewer;
  /** Confidentialité du compte issue du bootstrap (`profile_visibility`). */
  visibility?: Visibility;
}

interface SettingsStatus {
  kind: 'info' | 'success' | 'error';
  message: string;
}

interface SheetMemory {
  open: boolean;
  section: SettingsSection;
  status: SettingsStatus | null;
}

interface RawRuntimeState {
  vis?: unknown;
  /** Confidentialité du compte (`user_profiles.profile_visibility`). */
  profileVisibility?: unknown;
  orient?: unknown;
  traveller?: unknown;
  sh?: unknown;
}

interface RuntimeWindow extends Window {
  __lkdvCompteAct?: (action: string, value?: unknown) => void;
  __lkdvGetState?: () => { S?: RawRuntimeState } | undefined;
  __lkdvOpenSlot?: (slotId: string) => void;
  /** Pont de persistance installé par l'hôte (réel ou secours). */
  __lkdvOnMutate?: (key: string, value: unknown, state?: unknown, meta?: unknown) => unknown;
}

interface RuntimeSnapshot {
  visibility: SignatureVisibility | null;
  /** Confidentialité du compte, distincte de la visibilité de l'empreinte. */
  accountVisibility: Visibility | null;
  orient: Record<string, string> | null;
  nationality: string | null;
  home: string | null;
  currency: string | null;
}

const DEFAULT_SECTION: SettingsSection = 'signature';

const SIGNATURE_STATES: ReadonlyArray<SignatureVisibility> = [
  'prive',
  'communaute',
  'public',
];

const SIGNATURE_LABELS: Record<SignatureVisibility, string> = {
  prive: 'Privé',
  communaute: 'Communauté',
  public: 'Public',
};

const SIGNATURE_DETAILS: Record<SignatureVisibility, string> = {
  prive: 'toi seul·e',
  communaute: 'membres de la communauté',
  public: 'tout le monde',
};

const ACCOUNT_LABELS: Record<Visibility, string> = {
  public: 'Public',
  prive: 'Privé (sur invitation)',
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

/**
 * Chaque mutation du runtime reconstruit `#lkdv-slot-root` et remonte le
 * portail React : sans mémoire externe, la feuille se fermerait avant
 * d'afficher son statut. La clé est l'état `S` du runtime, stable pendant
 * toute la session et utilisable en `WeakMap`.
 */
const sheetMemoryByRuntimeState = new WeakMap<object, SheetMemory>();

function runtimeWindow(): RuntimeWindow | null {
  return typeof window === 'undefined' ? null : (window as RuntimeWindow);
}

function readRuntimeState(): RawRuntimeState | null {
  const win = runtimeWindow();
  try {
    const state = win?.__lkdvGetState?.()?.S;
    return state && typeof state === 'object' ? state : null;
  } catch {
    return null;
  }
}

function readSheetMemory(): SheetMemory | null {
  const state = readRuntimeState();
  return state ? sheetMemoryByRuntimeState.get(state) ?? null : null;
}

function writeSheetMemory(patch: Partial<SheetMemory>): void {
  const state = readRuntimeState();
  if (!state) return;
  const previous =
    sheetMemoryByRuntimeState.get(state) ??
    ({ open: false, section: DEFAULT_SECTION, status: null } satisfies SheetMemory);
  sheetMemoryByRuntimeState.set(state, { ...previous, ...patch });
}

function toRuntimeVisibility(value: unknown): SignatureVisibility | null {
  if (value === 'public' || value === 2) return 'public';
  if (value === 'prive' || value === 0) return 'prive';
  if (value === 'communaute' || value === 1) return 'communaute';
  return null;
}

function readRuntimeSnapshot(): RuntimeSnapshot {
  const state = readRuntimeState();

  const visibility = state ? toRuntimeVisibility(state.vis) : null;
  const accountVisibility = state ? toAccountVisibility(state.profileVisibility) : null;

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
    accountVisibility,
    orient,
    nationality: typeof traveller?.nationality === 'string' ? traveller.nationality : null,
    home: typeof traveller?.home === 'string' ? traveller.home : null,
    currency: typeof traveller?.currency === 'string' ? traveller.currency : null,
  };
}

function MatrixCell({ value }: { value: MatrixValue }) {
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
  if (value === 'unknown') {
    return (
      <td className="lkdv-settings-cell">
        <span className="lkdv-settings-unknown" role="img" aria-label="Indisponible">
          ?
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
 * La visibilité de l'empreinte (`signature_visibility`, `S.vis`) et la
 * confidentialité du compte (`profile_visibility`, `S.profileVisibility`)
 * sont deux réglages distincts : la première est affichée depuis le runtime
 * et gérée dans la Vitrine (contrôle unique) ; la seconde est pilotée par
 * l'action exacte `setprofilevis`, puis confirmée (ou infirmée) par le pont
 * de persistance. Aucun succès n'est affiché avant l'écriture réelle.
 */
export function ProfileSettingsSheet({
  viewer,
  visibility = 'public',
}: ProfileSettingsSheetProps) {
  const [open, setOpen] = useState(false);
  const [runtimeChecked, setRuntimeChecked] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [signatureVisibility, setSignatureVisibility] = useState<SignatureVisibility | null>(
    null
  );
  const [accountVisibility, setAccountVisibility] = useState<Visibility>(visibility);
  const [orient, setOrient] = useState<Record<string, string> | null>(null);
  const [nationality, setNationality] = useState<string | null>(null);
  const [home, setHome] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [homeDraft, setHomeDraft] = useState('');
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>(DEFAULT_SECTION);

  const titleId = useId();
  const accountReasonId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const previousBodyOverflowRef = useRef<string | null>(null);
  const pendingRestoreRef = useRef<SettingsSection | null>(null);
  const sectionRefs = useRef<Partial<Record<SettingsSection, HTMLElement | null>>>({});
  /** Dernière valeur affichée avant une tentative, repli local au rollback. */
  const lastAccountVisibilityRef = useRef<Visibility>(visibility);

  const refreshRuntime = useCallback(() => {
    const win = runtimeWindow();
    setRuntimeReady(typeof win?.__lkdvCompteAct === 'function');
    setPersistenceReady(typeof win?.__lkdvOnMutate === 'function');
    setRuntimeChecked(true);
    const snapshot = readRuntimeSnapshot();
    setSignatureVisibility(snapshot.visibility);
    // État runtime réel s'il existe, sinon valeur du bootstrap hôte.
    setAccountVisibility(snapshot.accountVisibility ?? visibility);
    setOrient(snapshot.orient);
    setNationality(snapshot.nationality);
    setHome(snapshot.home);
    setCurrency(snapshot.currency);
    if (snapshot.home !== null) setHomeDraft(snapshot.home);
  }, [visibility]);

  const markSection = useCallback((section: SettingsSection) => {
    setActiveSection(section);
    writeSheetMemory({ section });
  }, []);

  const showStatus = useCallback((next: SettingsStatus) => {
    setStatus(next);
    writeSheetMemory({ status: next });
  }, []);

  // Restaure l'ouverture et la section après un remontage causé par le runtime.
  useEffect(() => {
    if (viewer !== 'owner') {
      setOpen(false);
      writeSheetMemory({ open: false, status: null });
      return;
    }
    const memory = readSheetMemory();
    if (!memory?.open) return;
    refreshRuntime();
    setActiveSection(memory.section);
    setStatus(memory.status);
    pendingRestoreRef.current = memory.section;
    setOpen(true);
  }, [viewer, refreshRuntime]);

  // Ouvre la feuille avec un état runtime déjà lu : aucun faux bandeau
  // « Runtime indisponible » au premier rendu.
  useEffect(() => {
    if (viewer !== 'owner') return;
    const onOpen = () => {
      refreshRuntime();
      setActiveSection(DEFAULT_SECTION);
      setStatus(null);
      pendingRestoreRef.current = null;
      setOpen(true);
      writeSheetMemory({
        open: true,
        section: DEFAULT_SECTION,
        status: null,
      });
    };
    window.addEventListener('lkdv:open-settings', onOpen);
    return () => window.removeEventListener('lkdv:open-settings', onOpen);
  }, [viewer, refreshRuntime]);

  // Le runtime restaure la section active après une mutation (scroll).
  useEffect(() => {
    if (!open) return;
    const section = pendingRestoreRef.current;
    if (!section) return;
    pendingRestoreRef.current = null;
    const node = sectionRefs.current[section];
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'start' });
    }
  }, [open]);

  // Un démontage pendant que le drawer est fermé ne doit pas rouvrir la feuille
  // à la prochaine ouverture du profil. Un remontage de mutation garde `S.sh`.
  useEffect(
    () => () => {
      const state = readRuntimeState();
      if (state && (state.sh === undefined || state.sh === null)) {
        sheetMemoryByRuntimeState.delete(state);
      }
    },
    []
  );

  const close = useCallback(() => {
    setOpen(false);
    setStatus(null);
    writeSheetMemory({ open: false, status: null });
  }, []);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    previousBodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(focusTimer);
      const previous = restoreFocusRef.current;
      if (previous?.isConnected) previous.focus();
      restoreFocusRef.current = null;
      if (previousBodyOverflowRef.current !== null) {
        document.body.style.overflow = previousBodyOverflowRef.current;
        previousBodyOverflowRef.current = null;
      }
    };
  }, [open]);

  // Échap ferme depuis n'importe quel élément du dialogue, pas seulement le scrim.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
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

  const goToVitrine = () => {
    const openSlot = runtimeWindow()?.__lkdvOpenSlot;
    if (typeof openSlot !== 'function') return;
    close();
    try {
      openSlot('vitrine');
    } catch {
      // La navigation a échoué après fermeture : la Vitrine reste la seule
      // source de vérité, aucun statut n'est inventé ici.
    }
  };

  const applyOrient = (key: string, value: string) => {
    const act = runtimeWindow()?.__lkdvCompteAct;
    if (!act) return;
    markSection('orientation');
    writeSheetMemory({ open: true, section: 'orientation', status: null });
    try {
      act('orient', `${key}:${value}`);
      const snapshot = readRuntimeSnapshot();
      if (snapshot.orient) setOrient(snapshot.orient);
      showStatus({ kind: 'info', message: 'Préférence de marche transmise au runtime.' });
    } catch {
      showStatus({
        kind: 'error',
        message: 'La préférence de marche n’a pas pu être transmise.',
      });
    }
  };

  const applyIdentity = (action: 'nat' | 'home' | 'curr', value: string) => {
    const act = runtimeWindow()?.__lkdvCompteAct;
    if (!act) return;
    markSection('identity');
    writeSheetMemory({ open: true, section: 'identity', status: null });
    try {
      act(action, value);
      const snapshot = readRuntimeSnapshot();
      if (action === 'nat' && snapshot.nationality) setNationality(snapshot.nationality);
      if (action === 'home' && snapshot.home) {
        setHome(snapshot.home);
        setHomeDraft(snapshot.home);
      }
      if (action === 'curr' && snapshot.currency) setCurrency(snapshot.currency);
      showStatus({ kind: 'info', message: 'Identité voyageur transmise au runtime.' });
    } catch {
      showStatus({
        kind: 'error',
        message: 'L’identité voyageur n’a pas pu être transmise.',
      });
    }
  };

  const applyHome = () => {
    const city = homeDraft.trim();
    if (!city) {
      showStatus({ kind: 'error', message: 'Saisis une ville de départ.' });
      return;
    }
    applyIdentity('home', city);
  };

  /**
   * Applique la confidentialité du compte. Le statut de succès n'est écrit
   * que par l'événement de persistance émis par l'hôte : entre-temps, seul un
   * statut « enregistrement » neutre est affiché.
   */
  const applyAccountVisibility = (next: Visibility) => {
    const win = runtimeWindow();
    const act = win?.__lkdvCompteAct;
    if (!act || next === accountVisibility) return;
    const previous = accountVisibility;

    // Re-vérification au clic : le pont a pu disparaître entre l'ouverture et
    // le clic (déconnexion, bootstrap en échec, démontage du runtime).
    if (typeof win?.__lkdvOnMutate !== 'function') {
      // Aucun pont : on garantit que le runtime reste sur la valeur d'avant
      // clic, puis on signale l'échec sans jamais afficher « Enregistrement… ».
      try {
        win?.__lkdvSetProfileVisibility?.(previous);
      } catch (_) {}
      lastAccountVisibilityRef.current = previous;
      setAccountVisibility(previous);
      showStatus({
        kind: 'error',
        message:
          'Persistance indisponible : aucune modification de la confidentialité n’a été appliquée.',
      });
      return;
    }

    lastAccountVisibilityRef.current = previous;
    markSection('account');
    writeSheetMemory({
      open: true,
      section: 'account',
      status: { kind: 'info', message: 'Enregistrement de la confidentialité du compte…' },
    });
    setAccountVisibility(next);
    try {
      act('setprofilevis', next);
      showStatus({ kind: 'info', message: 'Enregistrement de la confidentialité du compte…' });
    } catch {
      setAccountVisibility(previous);
      showStatus({
        kind: 'error',
        message: 'La confidentialité du compte n’a pas pu être enregistrée.',
      });
    }
  };

  // Le pont de persistance confirme (ou infirme) l'écriture réelle.
  useEffect(() => {
    if (viewer !== 'owner') return;
    const onPersisted = (event: Event) => {
      const detail = (event as CustomEvent<ProfileVisibilityEventDetail>).detail;
      if (!detail || (detail.value !== 'public' && detail.value !== 'prive')) return;
      if (detail.persisted) {
        lastAccountVisibilityRef.current = detail.value;
        setAccountVisibility(detail.value);
        showStatus({
          kind: 'success',
          message: `Confidentialité du compte enregistrée : ${ACCOUNT_LABELS[detail.value]}.`,
        });
        return;
      }
      // Le pont peut ne pas connaître la valeur précédente (démo, bootstrap
      // partiel) : la feuille se replie sur son propre état d'avant clic.
      const reverted =
        toAccountVisibility(detail.revertedTo) ?? lastAccountVisibilityRef.current;
      if (reverted) {
        try {
          runtimeWindow()?.__lkdvSetProfileVisibility?.(reverted);
        } catch (_) {}
        lastAccountVisibilityRef.current = reverted;
        setAccountVisibility(reverted);
      }
      showStatus({
        kind: 'error',
        message: reverted
          ? 'La confidentialité du compte n’a pas pu être enregistrée. L’état précédent a été rétabli.'
          : 'La confidentialité du compte n’a pas pu être enregistrée. Aucune modification n’a été conservée.',
      });
    };
    window.addEventListener(PROFILE_VISIBILITY_EVENT, onPersisted);
    return () => window.removeEventListener(PROFILE_VISIBILITY_EVENT, onPersisted);
  }, [viewer, showStatus]);

  const triggerExport = () => {
    const act = runtimeWindow()?.__lkdvCompteAct;
    if (!act) return;
    markSection('export');
    writeSheetMemory({ open: true, section: 'export', status: null });
    try {
      act('export', 'full');
      showStatus({
        kind: 'info',
        message: 'Demande d’export RGPD envoyée au runtime.',
      });
    } catch {
      showStatus({ kind: 'error', message: 'L’export RGPD n’a pas pu être demandé.' });
    }
  };

  const triggerSignout = () => {
    const act = runtimeWindow()?.__lkdvCompteAct;
    if (!act) return;
    markSection('signout');
    writeSheetMemory({ open: true, section: 'signout', status: null });
    try {
      act('signout');
      showStatus({ kind: 'info', message: 'Déconnexion demandée au runtime.' });
    } catch {
      showStatus({ kind: 'error', message: 'La déconnexion n’a pas pu être demandée.' });
    }
  };

  if (!open || viewer !== 'owner' || typeof document === 'undefined') return null;

  const canAct = runtimeReady;
  const canPersist = runtimeReady && persistenceReady;
  const canOpenVitrine = typeof runtimeWindow()?.__lkdvOpenSlot === 'function';
  const signatureKnown = signatureVisibility !== null;
  const signatureMembers: MatrixValue = signatureKnown
    ? signatureVisibility !== 'prive'
    : 'unknown';
  const signaturePublic: MatrixValue = signatureKnown
    ? signatureVisibility === 'public' && accountVisibility === 'public'
    : 'unknown';
  const matrixRows: ReadonlyArray<{
    label: string;
    members: MatrixValue;
    public: MatrixValue;
  }> = [
    { label: 'Accès au profil (compte)', members: true, public: accountVisibility === 'public' },
    { label: 'Empreinte (massifs ≥ 3)', members: signatureMembers, public: signaturePublic },
    { label: 'Carnets publiés', members: signatureMembers, public: signaturePublic },
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
        data-active-section={activeSection}
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

        {runtimeChecked && !runtimeReady ? (
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
          <section
            ref={(node) => {
              sectionRefs.current.signature = node;
            }}
            className="lkdv-settings-section"
            aria-labelledby={`${titleId}-signature`}
            onFocusCapture={() => markSection('signature')}
            onPointerDownCapture={() => markSection('signature')}
          >
            <h3 id={`${titleId}-signature`} className="lkdv-settings-h3">
              Visibilité de l’empreinte
            </h3>
            <p className="lkdv-settings-help">
              L’empreinte (massifs ≥ 3 sorties) et les carnets publiés. Ce réglage est distinct de
              la confidentialité du compte.
            </p>
            <ul className="lkdv-settings-states" aria-label="États de visibilité de l’empreinte">
              {SIGNATURE_STATES.map((state) => {
                const current = signatureVisibility === state;
                return (
                  <li
                    key={state}
                    className={current ? 'is-current' : ''}
                    aria-current={current ? 'true' : undefined}
                  >
                    <span className="lkdv-settings-state-label">{SIGNATURE_LABELS[state]}</span>
                    <span className="lkdv-settings-state-detail">
                      {SIGNATURE_DETAILS[state]}
                    </span>
                    {current ? <span className="lkdv-settings-state-current">Actuel</span> : null}
                  </li>
                );
              })}
            </ul>
            <p
              className="lkdv-settings-current"
              data-testid="settings-signature-state"
              aria-live="polite"
            >
              {signatureVisibility
                ? `État runtime : ${SIGNATURE_LABELS[signatureVisibility]} (${SIGNATURE_DETAILS[signatureVisibility]})`
                : 'État runtime indisponible.'}
            </p>
            <button
              type="button"
              className="lkdv-settings-primary"
              disabled={!canOpenVitrine}
              onClick={goToVitrine}
            >
              Gérer dans la Vitrine
            </button>
            {!canOpenVitrine ? (
              <p className="lkdv-settings-note">
                Navigation vers la Vitrine indisponible : le runtime n’expose pas d’ouverture de
                slot.
              </p>
            ) : null}
            {runtimeChecked && !runtimeReady ? (
              <p className="lkdv-settings-note">
                Visibilité indisponible : le runtime du compte n’est pas chargé.
              </p>
            ) : null}
          </section>

          <section
            ref={(node) => {
              sectionRefs.current.account = node;
            }}
            className="lkdv-settings-section"
            aria-labelledby={`${titleId}-account`}
            onFocusCapture={() => markSection('account')}
            onPointerDownCapture={() => markSection('account')}
          >
            <h3 id={`${titleId}-account`} className="lkdv-settings-h3">
              Confidentialité du compte
            </h3>
            <p className="lkdv-settings-help">
              Public : tout le monde. Privé : uniquement sur invitation.
            </p>
            <div
              className="lkdv-settings-seg"
              role="group"
              aria-label="Confidentialité du compte"
              aria-describedby={accountReasonId}
              aria-disabled={!canPersist}
            >
              <button
                type="button"
                aria-pressed={accountVisibility === 'public'}
                disabled={!canPersist}
                onClick={() => applyAccountVisibility('public')}
              >
                Public
              </button>
              <button
                type="button"
                aria-pressed={accountVisibility === 'prive'}
                disabled={!canPersist}
                onClick={() => applyAccountVisibility('prive')}
              >
                Privé
              </button>
            </div>
            <p className="lkdv-settings-current" data-testid="settings-account-state">
              Profil actuel : {ACCOUNT_LABELS[accountVisibility]}
            </p>
            <p id={accountReasonId} className="lkdv-settings-note">
              {!canAct
                ? 'Réglage indisponible : le runtime du compte n’est pas chargé.'
                : !canPersist
                  ? 'Persistance indisponible : le pont de sauvegarde n’est pas chargé. Aucune modification n’est appliquée.'
                  : 'Le réglage est écrit dans user_profiles.profile_visibility et confirmé par l’hôte.'}
            </p>
          </section>

          <section
            ref={(node) => {
              sectionRefs.current.orientation = node;
            }}
            className="lkdv-settings-section"
            aria-labelledby={`${titleId}-orient`}
            onFocusCapture={() => markSection('orientation')}
            onPointerDownCapture={() => markSection('orientation')}
          >
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
                    disabled={!runtimeReady || !orient}
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
            {runtimeChecked && runtimeReady && !orient ? (
              <p className="lkdv-settings-note">
                Préférences indisponibles : le runtime n’expose pas l’état de marche.
              </p>
            ) : null}
          </section>

          <section
            ref={(node) => {
              sectionRefs.current.identity = node;
            }}
            className="lkdv-settings-section"
            aria-labelledby={`${titleId}-identity`}
            onFocusCapture={() => markSection('identity')}
            onPointerDownCapture={() => markSection('identity')}
          >
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
                disabled={!runtimeReady || nationality === null}
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
                  disabled={!runtimeReady || home === null}
                  autoComplete="address-level2"
                  onChange={(event) => setHomeDraft(event.target.value)}
                />
                <button
                  type="button"
                  className="lkdv-settings-secondary"
                  disabled={!runtimeReady || home === null || !homeDraft.trim()}
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
                disabled={!runtimeReady || currency === null}
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

            {runtimeChecked && runtimeReady && !nationality && !home && !currency ? (
              <p className="lkdv-settings-note">
                Identité indisponible : le runtime n’expose pas l’état du compte.
              </p>
            ) : null}
          </section>

          <section
            ref={(node) => {
              sectionRefs.current.matrix = node;
            }}
            className="lkdv-settings-section"
            aria-labelledby={`${titleId}-matrix`}
            onFocusCapture={() => markSection('matrix')}
            onPointerDownCapture={() => markSection('matrix')}
          >
            <h3 id={`${titleId}-matrix`} className="lkdv-settings-h3">
              Qui voit quoi ?
            </h3>
            <p className="lkdv-settings-help">
              Résumé des règles de visibilité : la ligne compte suit la confidentialité du profil,
              les lignes Empreinte et Carnets suivent la visibilité de l’empreinte dans le runtime.
            </p>
            <table className="lkdv-settings-table" aria-label="Qui voit quoi ?">
              <caption className="lkdv-settings-caption">
                Visibilité par type de donnée
              </caption>
              <thead>
                <tr>
                  <th scope="col">Donnée</th>
                  <th scope="col">Moi</th>
                  <th scope="col">Membres</th>
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
              « Membres » = invités d’un compte privé, ou communauté selon la visibilité de
              l’empreinte. La colonne Public croise les deux réglages. Les traces GPS brutes, la
              pratique et l’identité voyageur restent privées ; le matériel n’est visible que si un
              prêt est proposé.
            </p>
          </section>

          <section
            ref={(node) => {
              sectionRefs.current.export = node;
            }}
            className="lkdv-settings-section"
            aria-labelledby={`${titleId}-export`}
            onFocusCapture={() => markSection('export')}
            onPointerDownCapture={() => markSection('export')}
          >
            <h3 id={`${titleId}-export`} className="lkdv-settings-h3">
              Export RGPD
            </h3>
            <p className="lkdv-settings-help">
              Archive JSON de ton profil, tes sorties, tes carnets et tes kits (art. 20 RGPD).
            </p>
            <button
              type="button"
              className="lkdv-settings-primary"
              disabled={!canAct}
              onClick={triggerExport}
            >
              Exporter mes données (JSON)
            </button>
            {runtimeChecked && !runtimeReady ? (
              <p className="lkdv-settings-note">
                Export indisponible : le runtime du compte n’est pas chargé.
              </p>
            ) : null}
          </section>

          <section
            ref={(node) => {
              sectionRefs.current.signout = node;
            }}
            className="lkdv-settings-section"
            aria-labelledby={`${titleId}-signout`}
            onFocusCapture={() => markSection('signout')}
            onPointerDownCapture={() => markSection('signout')}
          >
            <h3 id={`${titleId}-signout`} className="lkdv-settings-h3">
              Déconnexion
            </h3>
            <p className="lkdv-settings-help">Ferme la session sur cet appareil.</p>
            <button
              type="button"
              className="lkdv-settings-danger"
              disabled={!canAct}
              onClick={triggerSignout}
            >
              Se déconnecter
            </button>
            {runtimeChecked && !runtimeReady ? (
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
const PROFILE_SETTINGS_CSS = `
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
.lkdv-settings-section{padding:16px 0;border-top:.5px solid var(--sep,rgba(23,43,36,.1));scroll-margin-top:8px;}
.lkdv-settings-section:first-child{border-top:0;}
.lkdv-settings-h3{margin:0 0 4px;font:700 15.5px/1.25 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);letter-spacing:-.01em;}
.lkdv-settings-help{margin:0 0 10px;font:400 12.5px/1.45 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);color:var(--label2,#56665D);}
.lkdv-settings-note{margin:8px 0 0;font:400 12px/1.45 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);color:var(--label2,#56665D);}
.lkdv-settings-current{margin:9px 0 0;font:600 12.5px/1.4 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);color:#17402C;}
.lkdv-settings-states{list-style:none;margin:0 0 10px;padding:0;display:flex;flex-direction:column;gap:4px;}
.lkdv-settings-states li{display:flex;align-items:center;gap:8px;min-height:36px;padding:0 10px;border-radius:10px;background:rgba(23,43,36,.04);color:#3E5047;font:500 12.5px/1.3 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);}
.lkdv-settings-states li.is-current{background:rgba(91,127,85,.16);color:#17402C;box-shadow:inset 0 0 0 .5px rgba(23,64,44,.18);}
.lkdv-settings-state-label{font-weight:700;}
.lkdv-settings-state-detail{color:#56665D;font-weight:400;}
.lkdv-settings-state-current{margin-left:auto;font:700 10.5px/1 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);letter-spacing:.05em;text-transform:uppercase;color:#17402C;}
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
.lkdv-settings-unknown{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:rgba(23,43,36,.06);box-shadow:inset 0 0 0 .5px rgba(23,43,36,.18);color:#56665D;font:700 11px/1 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif);}
@keyframes lkdv-settings-fade{from{opacity:0}to{opacity:1}}
@keyframes lkdv-settings-up{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
@media (min-width:640px){.lkdv-settings-scrim{align-items:center;padding:24px}.lkdv-settings-sheet{border-radius:26px;max-height:min(84dvh,780px)}}
@media (prefers-reduced-motion:reduce){.lkdv-settings-scrim,.lkdv-settings-sheet{animation:none!important;}.lkdv-settings-seg button,.lkdv-settings-scroll button{transition:none!important;}}
`;

export default ProfileSettingsSheet;
