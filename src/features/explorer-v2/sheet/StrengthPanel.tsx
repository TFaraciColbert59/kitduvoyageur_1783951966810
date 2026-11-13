'use client';

/**
 * Carnet musculation — S2.32.
 *
 * Saisie manuelle uniquement : exercice nommé par l’utilisateur, puis séries
 * avec répétitions et charge. Aucun catalogue d’exercices, aucune estimation
 * de charge, aucune lecture de capture. Le brouillon est écrit localement
 * d’abord, puis synchronisé avec le compte quand l’utilisateur est connecté.
 * Hors ligne, il reste sur l’appareil et sera repoussé plus tard.
 */

import React from 'react';
import { useExplorerStore } from '../state/store';
import type {
  StrengthExercise,
  StrengthLoadUnit,
  StrengthLog,
  StrengthSet,
} from '../state/types';
import {
  adoptLegacyStrengthState,
  claimLegacyStrengthDeletions,
  clearStrengthDraft,
  enqueueStrengthDeletion,
  getStrengthStorageOwner,
  hasPendingStrengthDeletion,
  readLegacyStrengthDraft,
  readStrengthDraft,
  removeStrengthDeletion,
  setStrengthStorageOwner,
} from '../strength/storage';
import { buildStrengthExport, strengthExportFileName } from '../strength/export';
import {
  deleteRemoteStrengthLog,
  fetchRemoteStrengthLog,
  flushStrengthDeletions,
  queueStrengthPush,
  waitForStrengthWrites,
  type StrengthSyncReason,
} from '../strength/sync';
import {
  addStrengthExercise,
  addStrengthSet,
  createStrengthLog,
  formatStrengthLoad,
  formatStrengthVolume,
  MAX_STRENGTH_EXERCISE_NAME,
  MAX_STRENGTH_LOAD,
  MAX_STRENGTH_REPS,
  removeStrengthExercise,
  removeStrengthSet,
  isStrengthActivitySessionId,
  strengthExerciseTotals,
  strengthLogTotals,
  strengthSetVolumeKg,
  updateStrengthSet,
  type StrengthSetInput,
} from '../strength/model';
import { XpChips, XpEmpty, XpEyebrow, XpMetrics, XpRow, XpRows } from './blocks';
import { SPORT_META } from './context';

type SyncState =
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'local'
  | 'unauthenticated'
  | 'offline'
  | 'delete-pending'
  | 'error';

function syncStateForReason(reason: StrengthSyncReason): SyncState {
  if (reason === 'unauthenticated') return 'unauthenticated';
  if (reason === 'rejected' || reason === 'invalid' || reason === 'conflict') return 'error';
  return 'offline';
}

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function StrengthPanel() {
  const log = useExplorerStore((state) => state.strength ?? null);
  const storeStrengthLog = useExplorerStore((state) => state.storeStrengthLog);
  const clearStrengthLog = useExplorerStore((state) => state.clearStrengthLog);

  const activity = useExplorerStore((state) => state.activity ?? null);
  const mountedRef = React.useRef(true);
  const ownerRef = React.useRef<string | null | undefined>(undefined);
  const requestedOwnerRef = React.useRef<string | null | undefined>(undefined);
  const ownerSwitchRef = React.useRef<Promise<void>>(Promise.resolve());
  const [name, setName] = React.useState('');
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [reps, setReps] = React.useState('');
  const [load, setLoad] = React.useState('');
  const [unit, setUnit] = React.useState<StrengthLoadUnit>('kg');
  const [editingSetId, setEditingSetId] = React.useState<string | null>(null);
  const [setError, setSetError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [persistFailed, setPersistFailed] = React.useState(false);
  const [confirmClear, setConfirmClear] = React.useState(false);
  const [syncState, setSyncState] = React.useState<SyncState>('idle');
  const [legacyDraft, setLegacyDraft] = React.useState<StrengthLog | null>(null);

  const push = React.useCallback(
    async (next: StrengthLog, ownerId: string | null = getStrengthStorageOwner()) => {
      if (hasPendingStrengthDeletion(next.id, ownerId)) {
        setSyncState('delete-pending');
        return;
      }
      setSyncState('syncing');
      let result: Awaited<ReturnType<typeof queueStrengthPush>>;
      try {
        result = await queueStrengthPush(next, {}, ownerId);
      } catch {
        if (mountedRef.current && getStrengthStorageOwner() === ownerId) {
          setSyncState('offline');
        }
        return;
      }
      if (!mountedRef.current || getStrengthStorageOwner() !== ownerId) return;
      if (result.ok) {
        setSyncState(
          hasPendingStrengthDeletion(undefined, ownerId) ? 'delete-pending' : 'synced',
        );
        return;
      }
      setSyncState(
        hasPendingStrengthDeletion(undefined, ownerId)
          ? 'delete-pending'
          : syncStateForReason(result.reason),
      );
    },
    [],
  );

  const retrySync = React.useCallback(async () => {
    if (!mountedRef.current) return;
    const ownerAtStart = getStrengthStorageOwner();
    const stillOwner = () =>
      mountedRef.current && getStrengthStorageOwner() === ownerAtStart;
    setSyncState('syncing');

    const current = useExplorerStore.getState().strength;
    if (current) {
      if (hasPendingStrengthDeletion(current.id, ownerAtStart)) {
        clearStrengthLog();
        await waitForStrengthWrites();
        if (!stillOwner()) return;
        const flushed = await flushStrengthDeletions({}, ownerAtStart);
        if (!stillOwner()) return;
        setSyncState(flushed.pending > 0 ? 'delete-pending' : 'local');
        return;
      }
      await push(current, ownerAtStart);
      return;
    }

    await waitForStrengthWrites();
    if (!stillOwner()) return;
    const flushed = await flushStrengthDeletions({}, ownerAtStart);
    if (!stillOwner()) return;
    if (flushed.pending > 0) {
      setSyncState('delete-pending');
      return;
    }

    const remote = await fetchRemoteStrengthLog(undefined, {}, ownerAtStart);
    if (!stillOwner()) return;
    if (!remote.ok) {
      setSyncState(syncStateForReason(remote.reason));
      return;
    }
    if (!remote.log) {
      setSyncState('local');
      return;
    }
    if (hasPendingStrengthDeletion(remote.log.id, ownerAtStart)) {
      setSyncState('delete-pending');
      return;
    }

    const persisted = storeStrengthLog(remote.log);
    setPersistFailed(!persisted);
    setSyncState('synced');
  }, [clearStrengthLog, push, storeStrengthLog]);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Rattache le brouillon au compte courant avant toute lecture ou écriture.
   * Une déconnexion ne supprime rien : elle détache seulement l’état mémoire.
   * Le brouillon du compte précédent reste sous sa clé et ne peut pas être
   * poussé par le compte suivant.
   */
  React.useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | undefined;

    const applyOwner = (session: { user?: { id?: string } } | null) => {
      const nextOwner = session?.user?.id ?? null;
      // Les événements d’authentification peuvent arriver en rafale : une
      // seule bascule est appliquée, et toujours après les écritures en vol.
      requestedOwnerRef.current = nextOwner;
      ownerSwitchRef.current = ownerSwitchRef.current
        .then(async () => {
          if (cancelled || requestedOwnerRef.current !== nextOwner) return;
          if (ownerRef.current === nextOwner) return;

          await waitForStrengthWrites();
          if (cancelled || requestedOwnerRef.current !== nextOwner) return;

          useExplorerStore.setState({ strength: undefined });
          setLegacyDraft(null);
          setStrengthStorageOwner(nextOwner);
          ownerRef.current = nextOwner;

          if (nextOwner) {
            // Migration douce de l’ancienne file globale, une seule fois.
            claimLegacyStrengthDeletions(nextOwner);
          }

          const stored = readStrengthDraft();
          if (stored) {
            useExplorerStore.setState({ strength: stored });
            await retrySync();
            return;
          }

          if (nextOwner) {
            const legacy = readLegacyStrengthDraft();
            if (legacy) {
              // Ne pas restaurer le carnet distant tant que ce brouillon local
              // n’a pas été explicitement récupéré ou laissé de côté.
              setLegacyDraft(legacy);
              setSyncState('local');
              return;
            }
          }

          await retrySync();
        })
        .catch(() => undefined);
    };

    void import('@/lib/supabase/client')
      .then(({ createClient }) => {
        if (cancelled) return;
        const client = createClient();
        void client.auth.getSession().then(({ data }) => {
          void applyOwner(data.session);
        });
        const { data } = client.auth.onAuthStateChange((_event, session) => {
          void applyOwner(session);
        });
        subscription = data.subscription;
      })
      .catch(() => {
        void applyOwner(null);
      });

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [retrySync]);

  const handleAdoptLegacy = React.useCallback(() => {
    const owner = getStrengthStorageOwner();
    if (!owner || !legacyDraft) return;
    const adopted = adoptLegacyStrengthState(owner);
    if (!adopted) {
      setStatus('La récupération a échoué : le brouillon reste sur cet appareil.');
      return;
    }
    useExplorerStore.setState({ strength: adopted });
    setLegacyDraft(null);
    setStatus('Brouillon récupéré pour ce compte.');
    void push(adopted);
  }, [legacyDraft, push]);

  const handleDismissLegacy = React.useCallback(() => {
    setLegacyDraft(null);
    setStatus('Brouillon laissé sur cet appareil ; il reste disponible à la prochaine ouverture.');
    void retrySync();
  }, [retrySync]);

  const handleExport = React.useCallback(() => {
    const current = useExplorerStore.getState().strength ?? legacyDraft;
    if (!current) return;
    try {
      const bundle = buildStrengthExport(current);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = strengthExportFileName();
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setStatus('Carnet exporté sur cet appareil.');
    } catch {
      setStatus('Export impossible sur cet appareil.');
    }
  }, [legacyDraft]);

  React.useEffect(() => {
    const handleOnline = () => {
      void retrySync();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [retrySync]);

  const selectedExercise =
    log?.exercises.find((exercise) => exercise.id === selectedId) ??
    log?.exercises[0] ??
    null;

  React.useEffect(() => {
    if (!log) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (selectedId && log.exercises.some((exercise) => exercise.id === selectedId)) return;
    setSelectedId(log.exercises[0]?.id ?? null);
  }, [log, selectedId]);

  const resetSetForm = React.useCallback(() => {
    setReps('');
    setLoad('');
    setEditingSetId(null);
    setSetError(null);
  }, []);

  const commit = (next: StrengthLog, message: string) => {
    const persisted = storeStrengthLog(next);
    setPersistFailed(!persisted);
    setStatus(message);
    void push(next);
  };

  const activeSessionId = isStrengthActivitySessionId(activity?.sessionId)
    ? activity.sessionId
    : null;
  const linkedSessionId = log?.activitySessionId ?? null;
  const sessionLabel = activity ? SPORT_META[activity.sport]?.label ?? activity.sport : null;

  /**
   * Le contrat serveur vérifie déjà que `activity_sessions.user_id` est le
   * propriétaire du carnet. L’écran ne propose donc que la séance réellement
   * en cours dans le store, jamais une séance choisie par identifiant libre.
   * Un envoi vers null ne détache pas : le serveur conserve le lien existant.
   */
  const handleAttachSession = () => {
    if (!log || !activeSessionId) return;
    commit(
      { ...log, activitySessionId: activeSessionId, updatedAt: Date.now() },
      'Carnet rattaché à la séance en cours.',
    );
  };

  const handleAddExercise = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (legacyDraft) {
      setNameError(
        'Récupère ou laisse le brouillon non rattaché avant de créer un nouveau carnet.',
      );
      return;
    }
    const clean = cleanName(name);
    if (!clean) {
      setNameError('Nomme l’exercice réellement effectué.');
      return;
    }
    if (clean.length > MAX_STRENGTH_EXERCISE_NAME) {
      setNameError(
        `Le nom de l’exercice est limité à ${MAX_STRENGTH_EXERCISE_NAME} caractères.`,
      );
      return;
    }
    const base = log ?? createStrengthLog();
    const result = addStrengthExercise(base, clean);
    if (!result) {
      setNameError('Ce nom d’exercice n’est pas valide.');
      return;
    }
    commit(result.log, 'Exercice ajouté au carnet.');
    setSelectedId(result.exercise.id);
    setName('');
    setNameError(null);
    resetSetForm();
  };

  const readSetInput = (): StrengthSetInput | null => {
    const repsValue = Number(reps.trim());
    if (!Number.isInteger(repsValue) || repsValue < 1 || repsValue > MAX_STRENGTH_REPS) {
      setSetError(
        `Renseigne un nombre entier de répétitions entre 1 et ${MAX_STRENGTH_REPS}.`,
      );
      return null;
    }
    const rawLoad = load.trim().replace(',', '.');
    const loadValue = rawLoad === '' ? null : Number(rawLoad);
    if (
      loadValue !== null &&
      (!Number.isFinite(loadValue) || loadValue < 0 || loadValue > MAX_STRENGTH_LOAD)
    ) {
      setSetError('Renseigne une charge valide, ou laisse le champ vide.');
      return null;
    }
    return { reps: repsValue, load: loadValue, unit };
  };

  const handleSetSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!log || !selectedExercise) {
      setSetError('Choisis d’abord un exercice.');
      return;
    }
    const input = readSetInput();
    if (!input) return;

    if (editingSetId) {
      const next = updateStrengthSet(log, selectedExercise.id, editingSetId, input);
      if (next === log) {
        setSetError('Cette série n’existe plus dans le carnet.');
        return;
      }
      commit(next, 'Série modifiée. Le volume est recalculé.');
    } else {
      const result = addStrengthSet(log, selectedExercise.id, input);
      if (!result) {
        setSetError('La série n’a pas pu être ajoutée.');
        return;
      }
      commit(result.log, 'Série ajoutée. Le volume est recalculé.');
    }
    resetSetForm();
  };

  const beginEdit = (set: StrengthSet) => {
    setEditingSetId(set.id);
    setReps(String(set.reps));
    setLoad(set.load === null ? '' : String(set.load));
    setUnit(set.unit);
    setSetError(null);
    setStatus(null);
  };

  const handleRemoveSet = (setId: string) => {
    if (!log || !selectedExercise) return;
    const next = removeStrengthSet(log, selectedExercise.id, setId);
    if (next === log) return;
    if (editingSetId === setId) resetSetForm();
    commit(next, 'Série supprimée. Le volume est recalculé.');
  };

  const handleRemoveExercise = (exercise: StrengthExercise) => {
    if (!log) return;
    const next = removeStrengthExercise(log, exercise.id);
    if (next === log) return;
    if (selectedExercise?.id === exercise.id) resetSetForm();
    commit(next, 'Exercice et séries supprimés.');
  };

  const handleClear = async () => {
    const current = log;
    const ownerAtStart = getStrengthStorageOwner();
    const stillOwner = () =>
      mountedRef.current && getStrengthStorageOwner() === ownerAtStart;
    const clearOwnedDraft = () => {
      clearStrengthDraft(ownerAtStart);
      if (getStrengthStorageOwner() === ownerAtStart) {
        useExplorerStore.setState({ strength: undefined });
      }
    };
    setConfirmClear(false);

    if (!current) {
      clearOwnedDraft();
      setSelectedId(null);
      resetSetForm();
      setPersistFailed(false);
      setSyncState('local');
      setStatus('Carnet effacé de cet appareil.');
      return;
    }

    const queued = enqueueStrengthDeletion(current.id, Date.now(), ownerAtStart);

    // File locale indisponible : ne pas effacer le brouillon avant d’avoir la
    // preuve que le serveur a bien supprimé le carnet. Sinon un « Réessayer »
    // pourrait le restaurer depuis le compte.
    if (!queued) {
      setSyncState('syncing');
      // Une synchronisation déjà partie ne doit pas recréer le carnet après
      // l’effacement : on la laisse finir avant de supprimer côté serveur.
      await waitForStrengthWrites();
      if (!stillOwner()) return;
      const result = await deleteRemoteStrengthLog(current.id, {}, ownerAtStart);
      if (result.ok) {
        removeStrengthDeletion(current.id, ownerAtStart);
        clearOwnedDraft();
        if (!stillOwner()) return;
        setSelectedId(null);
        resetSetForm();
        setPersistFailed(false);
        setSyncState('local');
        setStatus('Carnet effacé de cet appareil et de ton compte.');
        return;
      }
      if (!stillOwner()) return;
      setSyncState(
        result.reason === 'unauthenticated' ? 'unauthenticated' : 'error',
      );
      setStatus(
        'Suppression du compte impossible et file locale indisponible : le carnet reste sur cet appareil. Réessaie après connexion.',
      );
      return;
    }

    // La tombe est écrite : le brouillon local peut être effacé sans risque de
    // résurrection, même si le serveur n’est pas joignable maintenant.
    clearOwnedDraft();
    setSelectedId(null);
    resetSetForm();
    setPersistFailed(false);
    setSyncState('syncing');

    // Même règle : une écriture déjà en vol se termine avant la suppression,
    // puis la tombe locale empêche toute recréation ultérieure.
    await waitForStrengthWrites();
    if (!stillOwner()) return;
    const result = await deleteRemoteStrengthLog(current.id, {}, ownerAtStart);

    if (result.ok) {
      removeStrengthDeletion(current.id, ownerAtStart);
      if (!stillOwner()) return;
      setSyncState('local');
      setStatus('Carnet effacé de cet appareil et de ton compte.');
      return;
    }

    if (!stillOwner()) return;
    setSyncState('delete-pending');
    setStatus(
      'Carnet effacé de cet appareil. La suppression du compte sera rejouée à la prochaine connexion.',
    );
  };

  const totals = strengthLogTotals(log);
  const legacyTotals = legacyDraft ? strengthLogTotals(legacyDraft) : null;
  const selectedTotals = selectedExercise ? strengthExerciseTotals(selectedExercise) : null;

  const syncLabel =
    syncState === 'syncing'
      ? 'Enregistrement…'
      : syncState === 'synced'
        ? 'Enregistré sur ton compte'
        : syncState === 'unauthenticated'
          ? 'Sur cet appareil · connecte-toi pour l’enregistrer sur ton compte'
          : syncState === 'delete-pending'
            ? 'Effacement du compte en attente · vérifie ta connexion'
            : syncState === 'error'
              ? 'Synchronisation refusée · réessaie'
              : syncState === 'offline'
                ? 'Sur cet appareil · serveur indisponible'
                : syncState === 'local'
                  ? 'Sur cet appareil'
                  : null;
  const syncTone =
    syncState === 'synced'
      ? 'good'
      : syncState === 'delete-pending' || syncState === 'error'
        ? 'warn'
        : 'neutral';
  const syncRetryable =
    syncState === 'offline' ||
    syncState === 'error' ||
    syncState === 'delete-pending' ||
    syncState === 'unauthenticated';
  const showSync =
    Boolean(log) ||
    syncState === 'syncing' ||
    syncState === 'delete-pending' ||
    syncState === 'error';

  return (
    <div className="xp-strength">
      <div className="xp-strength-note" role="note">
        <strong>Carnet privé, conservé d’abord sur cet appareil.</strong>
        <span>
          Connecté, il est synchronisé avec ton compte. Hors ligne, le brouillon reste ici et
          sera renvoyé à la prochaine connexion. Il est rattaché au compte : une déconnexion ne
          l’efface pas et un autre compte sur cet appareil ne le voit pas. Aucun import
          partenaire n’est simulé.
        </span>
      </div>

      {showSync && syncLabel ? (
        <div className="xp-strength-sync" data-tone={syncTone}>
          <span role="status">{syncLabel}</span>
          {syncRetryable ? (
            <button
              type="button"
              className="xp-chip"
              onClick={() => {
                void retrySync();
              }}
            >
              Réessayer
            </button>
          ) : null}
        </div>
      ) : null}

      {persistFailed ? (
        <p className="xp-strength-warn" role="alert">
          Stockage local indisponible : ce brouillon reste en mémoire et sera perdu au
          rechargement.
        </p>
      ) : null}

      {legacyDraft && legacyTotals ? (
        <div className="xp-strength-legacy" role="note">
          <strong>Brouillon non rattaché sur cet appareil</strong>
          <span>
            {legacyTotals.exercises} exercice{legacyTotals.exercises > 1 ? 's' : ''} ·{' '}
            {legacyTotals.sets} série{legacyTotals.sets > 1 ? 's' : ''}. Il n’a pas été envoyé à
            ce compte. La récupération le rattache à ce compte et remplacera le carnet distant
            à la prochaine synchronisation.
          </span>
          <div className="xp-strength-legacy-actions">
            <button type="button" className="xp-primary" onClick={handleAdoptLegacy}>
              Récupérer pour ce compte
            </button>
            <button type="button" className="xp-secondary" onClick={handleDismissLegacy}>
              Laisser sur l’appareil
            </button>
          </div>
        </div>
      ) : null}

      {log && (activeSessionId || linkedSessionId) ? (
        <div className="xp-strength-link" role="note">
          {activeSessionId && linkedSessionId === activeSessionId ? (
            <span>
              Rattaché à la séance en cours{sessionLabel ? ` · ${sessionLabel}` : ''}.
            </span>
          ) : (
            <>
              <span>
                {linkedSessionId
                  ? 'Rattaché à une séance enregistrée.'
                  : `Une séance${sessionLabel ? ` ${sessionLabel}` : ''} est en cours.`}
              </span>
              {activeSessionId ? (
                <button type="button" className="xp-chip" onClick={handleAttachSession}>
                  {linkedSessionId
                    ? 'Rattacher à la séance en cours'
                    : 'Rattacher à cette séance'}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {log ? (
        <XpMetrics
          items={[
            { label: 'Exercices', value: String(totals.exercises) },
            { label: 'Séries', value: String(totals.sets) },
            { label: 'Répétitions', value: String(totals.reps) },
            { label: 'Volume calculé', value: formatStrengthVolume(totals.volumeKg) },
          ]}
        />
      ) : (
        <XpEmpty
          title="Aucune série saisie"
          hint="Ajoute un exercice, puis les séries réellement effectuées. Rien n’est prérempli."
        />
      )}

      <XpEyebrow>Ajouter un exercice</XpEyebrow>
      <form className="xp-form" onSubmit={handleAddExercise} noValidate>
        <label htmlFor="xp-strength-name">
          Nom de l’exercice
          <input
            id="xp-strength-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (nameError) setNameError(null);
            }}
            placeholder="Ex. développé couché"
            maxLength={MAX_STRENGTH_EXERCISE_NAME}
            autoComplete="off"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? 'xp-strength-name-error' : undefined}
          />
        </label>
        {nameError ? (
          <p className="xp-strength-error" id="xp-strength-name-error" role="alert">
            {nameError}
          </p>
        ) : null}
        <button type="submit" className="xp-primary" disabled={Boolean(legacyDraft)}>
          Ajouter l’exercice
        </button>
      </form>

      {log && log.exercises.length > 0 ? (
        <>
          <XpEyebrow>Exercices du carnet</XpEyebrow>
          <XpRows>
            {log.exercises.map((exercise) => {
              const exerciseTotals = strengthExerciseTotals(exercise);
              const active = selectedExercise?.id === exercise.id;
              return (
                <XpRow
                  key={exercise.id}
                  icon="dumbbell"
                  title={exercise.name}
                  sub={`${exerciseTotals.sets} série${exerciseTotals.sets > 1 ? 's' : ''} · ${exerciseTotals.reps} répétition${exerciseTotals.reps > 1 ? 's' : ''} · ${formatStrengthVolume(exerciseTotals.volumeKg)}`}
                  badge={active ? { label: 'Actif', tone: 'good' } : undefined}
                  ariaPressed={active}
                  ariaLabel={`${exercise.name}${active ? ', exercice actif' : ''}`}
                  onClick={() => {
                    setSelectedId(exercise.id);
                    resetSetForm();
                    setStatus(null);
                  }}
                />
              );
            })}
          </XpRows>
        </>
      ) : null}

      {selectedExercise && selectedTotals ? (
        <>
          <XpEyebrow>
            Séries · {selectedExercise.name} · {selectedTotals.reps} répétition
            {selectedTotals.reps > 1 ? 's' : ''}
          </XpEyebrow>

          {selectedExercise.sets.length === 0 ? (
            <XpEmpty
              title="Aucune série pour cet exercice"
              hint="Saisis les répétitions et, si elle existe, la charge réellement utilisée."
            />
          ) : (
            <div className="xp-strength-sets">
              {selectedExercise.sets.map((set, index) => {
                const volume = strengthSetVolumeKg(set);
                return (
                  <div className="xp-strength-set" key={set.id}>
                    <div className="xp-strength-set-main">
                      <span className="xp-strength-set-title">Série {index + 1}</span>
                      <span className="xp-strength-set-value">
                        {set.reps} × {formatStrengthLoad(set)}
                      </span>
                      <span className="xp-strength-set-sub">
                        {volume === null
                          ? 'Volume non calculé : charge non saisie'
                          : `${formatStrengthVolume(volume)} de volume`}
                      </span>
                    </div>
                    <div className="xp-strength-set-actions">
                      <button
                        type="button"
                        className="xp-chip"
                        onClick={() => beginEdit(set)}
                        aria-label={`Modifier la série ${index + 1} de ${selectedExercise.name}`}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="xp-chip"
                        onClick={() => handleRemoveSet(set.id)}
                        aria-label={`Supprimer la série ${index + 1} de ${selectedExercise.name}`}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <form className="xp-form xp-strength-setform" onSubmit={handleSetSubmit} noValidate>
            <div className="xp-strength-setform-row">
              <label htmlFor="xp-strength-reps">
                Répétitions
                <input
                  id="xp-strength-reps"
                  value={reps}
                  onChange={(event) => {
                    setReps(event.target.value);
                    if (setError) setSetError(null);
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="8"
                  autoComplete="off"
                  aria-invalid={setError ? true : undefined}
                  aria-describedby={setError ? 'xp-strength-set-error' : undefined}
                />
              </label>
              <label htmlFor="xp-strength-load">
                Charge ({unit})
                <input
                  id="xp-strength-load"
                  value={load}
                  onChange={(event) => {
                    setLoad(event.target.value);
                    if (setError) setSetError(null);
                  }}
                  inputMode="decimal"
                  placeholder="60"
                  autoComplete="off"
                  aria-invalid={setError ? true : undefined}
                  aria-describedby={setError ? 'xp-strength-set-error' : undefined}
                />
              </label>
            </div>
            <div className="xp-strength-unit">
              <span className="xp-strength-unit-label">Unité de charge</span>
              <XpChips
                items={[
                  { id: 'kg', label: 'kg' },
                  { id: 'lb', label: 'lb' },
                ]}
                value={unit}
                onChange={(id) => setUnit(id as StrengthLoadUnit)}
                ariaLabel="Unité de charge"
              />
            </div>
            {setError ? (
              <p className="xp-strength-error" id="xp-strength-set-error" role="alert">
                {setError}
              </p>
            ) : null}
            <button type="submit" className="xp-primary">
              {editingSetId ? 'Enregistrer la série' : 'Ajouter la série'}
            </button>
            {editingSetId ? (
              <button type="button" className="xp-secondary" onClick={resetSetForm}>
                Annuler la modification
              </button>
            ) : null}
          </form>

          <button
            type="button"
            className="xp-secondary xp-strength-remove-exercise"
            onClick={() => handleRemoveExercise(selectedExercise)}
          >
            Supprimer cet exercice et ses séries
          </button>
        </>
      ) : null}

      <XpEyebrow>Import</XpEyebrow>
      <XpRows>
        <XpRow
          icon="cam"
          title="Import partenaire ou capture"
          sub="Hors de cette tranche : aucun fichier n’est lu, aucune série n’est créée sans saisie et aucun import n’est simulé."
          badge={{ label: 'À venir', tone: 'muted' }}
        />
      </XpRows>

      <XpEyebrow>Export local</XpEyebrow>
      <div className="xp-strength-export">
        <p className="xp-strength-export-text">
          Télécharge le carnet complet (exercices, séries, charges) sans réseau. L’export RGPD
          du compte inclut aussi les carnets déjà synchronisés.
        </p>
        <button
          type="button"
          className="xp-secondary"
          onClick={handleExport}
          disabled={!log && !legacyDraft}
        >
          Télécharger le carnet
        </button>
      </div>

      {log ? (
        <div className="xp-strength-clear">
          {confirmClear ? (
            <>
              <p className="xp-strength-clear-text">
                Effacer ce carnet ? La suppression s’applique aussi au compte quand il est
                connecté.
              </p>
              <button type="button" className="xp-primary" onClick={() => void handleClear()}>
                Confirmer l’effacement
              </button>
              <button
                type="button"
                className="xp-secondary"
                onClick={() => setConfirmClear(false)}
              >
                Annuler
              </button>
            </>
          ) : (
            <button
              type="button"
              className="xp-secondary"
              onClick={() => setConfirmClear(true)}
            >
              Effacer le carnet
            </button>
          )}
        </div>
      ) : null}

      <p className="xp-strength-footnote">
        Chaque ligne correspond à une saisie réelle. Une charge laissée vide reste « poids du
        corps » et n’entre pas dans le volume. Les valeurs en livres sont converties en kg
        uniquement pour le volume affiché. Le brouillon local est conservé avant la
        synchronisation, rattaché au compte et jamais effacé par une simple déconnexion ; un
        effacement demandé hors ligne est rejoué à la reconnexion.
      </p>

      {status ? (
        <p className="xp-strength-status" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
