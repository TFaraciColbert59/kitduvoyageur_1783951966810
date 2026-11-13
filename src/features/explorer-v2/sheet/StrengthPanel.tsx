'use client';

/**
 * Carnet musculation — première tranche (S2.32).
 *
 * Saisie manuelle uniquement : exercice nommé par l’utilisateur, puis séries
 * avec répétitions et charge. Aucun catalogue d’exercices, aucune estimation
 * de charge, aucune lecture de capture. Le brouillon est local ; il n’est pas
 * une sortie enregistrée tant qu’aucun contrat serveur de séries n’existe.
 */

import React from 'react';
import { useExplorerStore } from '../state/store';
import type {
  StrengthExercise,
  StrengthLoadUnit,
  StrengthLog,
  StrengthSet,
} from '../state/types';
import { readStrengthDraft } from '../strength/storage';
import {
  addStrengthExercise,
  addStrengthSet,
  createStrengthLog,
  formatStrengthLoad,
  formatStrengthVolume,
  removeStrengthExercise,
  removeStrengthSet,
  strengthExerciseTotals,
  strengthLogTotals,
  strengthSetVolumeKg,
  updateStrengthSet,
  type StrengthSetInput,
} from '../strength/model';
import { XpChips, XpEmpty, XpEyebrow, XpMetrics, XpRow, XpRows } from './blocks';

const MAX_REPS = 999;
const MAX_LOAD = 10_000;

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function StrengthPanel() {
  const log = useExplorerStore((state) => state.strength ?? null);
  const storeStrengthLog = useExplorerStore((state) => state.storeStrengthLog);
  const clearStrengthLog = useExplorerStore((state) => state.clearStrengthLog);

  const hydratedRef = React.useRef(false);
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

  React.useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (useExplorerStore.getState().strength) return;
    const stored = readStrengthDraft();
    if (stored) useExplorerStore.setState({ strength: stored });
  }, []);

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
  };

  const handleAddExercise = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = cleanName(name);
    if (!clean) {
      setNameError('Nomme l’exercice réellement effectué.');
      return;
    }
    if (clean.length > 80) {
      setNameError('Le nom de l’exercice est limité à 80 caractères.');
      return;
    }
    const base = log ?? createStrengthLog();
    const result = addStrengthExercise(base, clean);
    if (!result) {
      setNameError('Ce nom d’exercice n’est pas valide.');
      return;
    }
    commit(result.log, 'Exercice ajouté au brouillon local.');
    setSelectedId(result.exercise.id);
    setName('');
    setNameError(null);
    resetSetForm();
  };

  const readSetInput = (): StrengthSetInput | null => {
    const repsValue = Number(reps.trim());
    if (!Number.isInteger(repsValue) || repsValue < 1 || repsValue > MAX_REPS) {
      setSetError(`Renseigne un nombre entier de répétitions entre 1 et ${MAX_REPS}.`);
      return null;
    }
    const rawLoad = load.trim().replace(',', '.');
    const loadValue = rawLoad === '' ? null : Number(rawLoad);
    if (
      loadValue !== null &&
      (!Number.isFinite(loadValue) || loadValue < 0 || loadValue > MAX_LOAD)
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
        setSetError('Cette série n’existe plus dans le brouillon.');
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
    commit(next, 'Exercice et séries supprimés du brouillon local.');
  };

  const handleClear = () => {
    clearStrengthLog();
    setConfirmClear(false);
    setSelectedId(null);
    resetSetForm();
    setPersistFailed(false);
    setStatus('Brouillon local effacé.');
  };

  const totals = strengthLogTotals(log);
  const selectedTotals = selectedExercise ? strengthExerciseTotals(selectedExercise) : null;

  return (
    <div className="xp-strength">
      <div className="xp-strength-note" role="note">
        <strong>Brouillon local, pas une sortie enregistrée.</strong>
        <span>
          Le schéma actuel ne contient aucune table de séries. Ces exercices restent sur cet
          appareil et n’apparaissent pas dans une sortie du carnet.
        </span>
      </div>

      {persistFailed ? (
        <p className="xp-strength-warn" role="alert">
          Stockage local indisponible : ce brouillon reste en mémoire et sera perdu au
          rechargement.
        </p>
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
            maxLength={80}
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
        <button type="submit" className="xp-primary">
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
          sub="Hors de cette tranche : aucune capture n’est lue, aucune série n’est créée sans saisie."
          badge={{ label: 'À venir', tone: 'muted' }}
        />
      </XpRows>

      {log && log.exercises.length > 0 ? (
        <div className="xp-strength-clear">
          {confirmClear ? (
            <>
              <p className="xp-strength-clear-text">
                Effacer tous les exercices et séries de ce brouillon local ?
              </p>
              <button type="button" className="xp-primary" onClick={handleClear}>
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
              Effacer le brouillon
            </button>
          )}
        </div>
      ) : null}

      <p className="xp-strength-footnote">
        Chaque ligne correspond à une saisie réelle. Une charge laissée vide reste « poids du
        corps » et n’entre pas dans le volume. Les valeurs en livres sont converties en kg
        uniquement pour le volume affiché.
      </p>

      {status ? (
        <p className="xp-strength-status" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
