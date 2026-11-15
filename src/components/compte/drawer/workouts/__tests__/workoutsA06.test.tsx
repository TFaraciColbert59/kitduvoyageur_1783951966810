// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WorkoutsDrawer } from '../WorkoutsDrawer';
import { buildRunningPlan } from '@/features/workouts/domain/plans';
import {
  buildStructuredWorkoutJson,
  buildStructuredWorkoutTcx,
} from '@/features/workouts/domain/watchTransfer';
import { readAccountPractice } from '@/features/workouts/client/readAccountPractice';
import { buildWorkoutFocusContext } from '@/features/workouts/client/workoutFocus';
import { savePrepFocus } from '@/features/compte/progression/prepFocus';
import { SessionPlayer } from '../SessionPlayer';
import { createExecution } from '@/features/workouts/domain/sessionEngine';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe('Workouts A06 (S2.28, S2.29, S2.30, S2.31, S2.36)', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('S2.28: permet de suivre un plan et de cocher une séance faite avec persistance', () => {
    const storage = createMemoryStorage();
    render(
      <WorkoutsDrawer
        viewer="owner"
        payload={{ outings: [] }}
        storage={storage}
        now={() => Date.parse('2026-06-15T10:00:00Z')}
      />
    );

    const followBtns = screen.getAllByRole('button', { name: 'Suivre ce plan' });
    fireEvent.click(followBtns[0]);
    expect(screen.getAllByRole('button', { name: /Plan suivi/i })[0]).toBeTruthy();

    const markButtons = screen.getAllByRole('button', { name: 'Marquer faite' });
    fireEvent.click(markButtons[0]);
    expect(screen.getByRole('button', { name: /Séance faite/i })).toBeTruthy();
    expect(screen.getAllByTestId('plan-completion-summary')[0].textContent).toMatch(/1\/\d+ faites/);
  });

  it('S2.29 & S2.30: génère un export TCX/JSON valide et active le guidage audio du lecteur', () => {
    const plan = buildRunningPlan('10k', 'intermediaire');
    const session = plan.weeks[0].sessions[0];
    const tcx = buildStructuredWorkoutTcx(session);
    expect(tcx).toContain('<TrainingCenterDatabase');
    expect(tcx).toContain('Sport="Running"');
    expect(tcx).toContain('<Step xsi:type="Step_t">');

    const json = JSON.parse(buildStructuredWorkoutJson(session));
    expect(json.schema).toBe('lkdv.structured-workout.v1');
    expect(json.session.id).toBe(session.id);

    const exec = createExecution(session, Date.parse('2026-06-15T10:00:00Z'));
    render(
      <SessionPlayer
        session={session}
        execution={exec}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSkip={vi.fn()}
        onStop={vi.fn()}
      />
    );

    const audioBtn = screen.getByRole('button', { name: 'Guidage audio' });
    fireEvent.click(audioBtn);
    expect(screen.getByRole('button', { name: 'Audio actif' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Exporter \.TCX/i }));
    expect(screen.getByText(/\.tcx généré/i)).toBeTruthy();
  });

  it('S2.31: adapte le programme de récupération selon le ressenti / douleur déclarée et propose un chrono', () => {
    const storage = createMemoryStorage();
    const recentIso = '2026-06-15T08:00:00Z';
    render(
      <WorkoutsDrawer
        viewer="owner"
        payload={{
          outings: [{ id: 'o1', sport: 'course', endedAt: recentIso, durationS: 2400 }],
        }}
        storage={storage}
        now={() => Date.parse('2026-06-15T10:00:00Z')}
      />
    );

    const snapshot = readAccountPractice(
      { outings: [{ id: 'o1', sport: 'course', endedAt: recentIso }] },
      Date.parse('2026-06-15T10:00:00Z')
    );
    expect(snapshot.sport).toBe('course');
    expect(snapshot.sportStatus).toBe('known');

    fireEvent.click(screen.getByRole('tab', { name: 'Récupération' }));
    expect(screen.getByText('Récupération immédiate')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Chrono /i }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Douleur importante' }));
    expect(screen.getByRole('alert').textContent).toMatch(/Repos et avis professionnel/i);
  });

  it('S2.36: adapte les séances instantanées selon PrepFocus et la charge réelle (CTL/ATL/TSB)', () => {
    savePrepFocus('anonymous', {
      title: 'Semi de Paris',
      discipline: 'course',
      focus: 'vitesse',
      targetDate: '2026-07-30',
      weeklySessionsTarget: 4,
    });
    const nowMs = Date.parse('2026-06-15T10:00:00Z');
    const outings = [
      { id: '1', sport: 'course', startedAt: '2026-06-10T08:00:00Z', durationS: 3600, distanceKm: 12 },
      { id: '2', sport: 'course', startedAt: '2026-06-13T08:00:00Z', durationS: 5400, distanceKm: 18 },
      { id: '3', sport: 'course', startedAt: '2026-06-14T08:00:00Z', durationS: 4200, distanceKm: 14 },
    ];
    const ctx = buildWorkoutFocusContext({ outings }, undefined, 'anonymous', new Date(nowMs));
    expect(ctx.prepFocus?.title).toBe('Semi de Paris');
    expect(ctx.loadStatus).toBe('available');
    expect(ctx.rationale.length).toBeGreaterThan(10);

    render(
      <WorkoutsDrawer
        viewer="owner"
        payload={{ outings }}
        storage={createMemoryStorage()}
        now={() => nowMs}
      />
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Séances' }));
    expect(screen.getByTestId('workout-focus-banner')).toBeTruthy();
  });
});
