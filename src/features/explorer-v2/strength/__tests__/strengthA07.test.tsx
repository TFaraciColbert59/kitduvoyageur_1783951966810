// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createStrengthLog, addStrengthExercise, addStrengthSet, strengthLogTotals } from '../model';
import { computeMuscleHeatmap, resolveExerciseMuscles } from '../muscles';
import {
  applyParsedStrengthImport,
  deleteStrengthTemplate,
  parseStrengthImportText,
  readStrengthTemplates,
  saveStrengthTemplateFromLog,
} from '../importer';
import { StrengthPanel } from '../../sheet/StrengthPanel';
import { useExplorerStore } from '../../state/store';

describe('Strength A07 (S2.32, S2.33, S2.34, S2.35)', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    useExplorerStore.setState({ strength: undefined });
  });

  it('S2.32 & S2.33: calcule le volume exact et cartographie les groupes musculaires principaux/secondaires', () => {
    let log = createStrengthLog(1000);
    const sq = addStrengthExercise(log, 'Squat', { now: 1001 });
    if (!sq) throw new Error('expected exercise');
    log = sq.log;
    const s1 = addStrengthSet(log, sq.exercise.id, { reps: 8, load: 80, unit: 'kg' }, { now: 1002 });
    if (!s1) throw new Error('expected set');
    log = s1.log;

    const bench = addStrengthExercise(log, 'Développé couché', { now: 1003 });
    if (!bench) throw new Error('expected exercise');
    log = bench.log;
    const s2 = addStrengthSet(log, bench.exercise.id, { reps: 10, load: 60, unit: 'kg' }, { now: 1004 });
    if (!s2) throw new Error('expected set');
    log = s2.log;

    const totals = strengthLogTotals(log);
    expect(totals.volumeKg).toBe(1240);

    const sqMuscles = resolveExerciseMuscles('Squat');
    expect(sqMuscles.primary).toContain('quadriceps');
    expect(sqMuscles.primary).toContain('fessiers');

    const heatmap = computeMuscleHeatmap(log);
    expect(heatmap.scoreByMuscle.quadriceps).toBeGreaterThan(0);
    expect(heatmap.scoreByMuscle.pectoraux).toBeGreaterThan(0);
    expect(heatmap.scoreByMuscle.triceps).toBeGreaterThan(0);
  });

  it('S2.35: importe notes libres, CSV et JSON et sauvegarde des modèles gratuits sans limite', () => {
    const textResult = parseStrengthImportText(
      'Squat 4x8 @ 80kg\nDéveloppé couché 3x10 @ 60kg\nPompes 3x15'
    );
    expect(textResult.format).toBe('text');
    expect(textResult.exercises).toHaveLength(3);
    expect(textResult.exercises[0].sets).toHaveLength(4);
    expect(textResult.exercises[2].sets[0].load).toBeNull();

    const csvResult = parseStrengthImportText('Exercice,Series,Reps,Charge,Unite\nTractions,3,8,,kg');
    expect(csvResult.format).toBe('csv');
    expect(csvResult.exercises[0].name).toBe('Tractions');
    expect(csvResult.exercises[0].sets).toHaveLength(3);

    const log = applyParsedStrengthImport(null, textResult, 2000);
    expect(log.exercises).toHaveLength(3);

    const tpl = saveStrengthTemplateFromLog('Full Body Maison', log);
    expect(tpl).not.toBeNull();
    expect(readStrengthTemplates()).toHaveLength(1);
    expect(deleteStrengthTemplate(tpl!.id)).toHaveLength(0);
  });

  it('S2.33, S2.34 & S2.35 UI: affiche les onglets Muscles, Séances guidées et Modèles & Import dans StrengthPanel', () => {
    render(<StrengthPanel />);

    fireEvent.click(screen.getByRole('tab', { name: 'Séances guidées' }));
    expect(screen.getByTestId('strength-guided-section')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Charger cette séance dans le carnet' }));

    expect(screen.getAllByText(/Squat goblet/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('tab', { name: 'Muscles' }));
    expect(screen.getByTestId('strength-muscle-map')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Modèles & Import' }));
    expect(screen.getByTestId('strength-import-templates-section')).toBeTruthy();
  });
});
