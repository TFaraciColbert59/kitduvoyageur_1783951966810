// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { WorkoutsDrawer } from '../WorkoutsDrawer';
import { SessionPlayer } from '../SessionPlayer';
import { WORKOUT_SESSION_STORAGE_KEY } from '@/features/workouts/client/sessionStore';
import { buildRunningPlan } from '@/features/workouts/domain/plans';
import {
  advanceExecution,
  createExecution,
} from '@/features/workouts/domain/sessionEngine';
import type { DeviceConnector } from '@/features/workouts/domain/types';

afterEach(() => cleanup());

const NOW = Date.parse('2026-11-11T12:00:00.000Z');
const now = () => NOW;

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

function recentOuting(hoursAgo: number) {
  return {
    startedAt: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
    endedAt: new Date(NOW - (hoursAgo - 1) * 3_600_000).toISOString(),
    status: 'done',
  };
}

describe('WorkoutsDrawer — entrée Compte', () => {
  it('verrouille l’entraînement pour un visiteur', () => {
    render(<WorkoutsDrawer viewer="visitor" />);

    expect(screen.getByText('Entraînement privé')).toBeTruthy();
    expect(screen.queryByText('Plan LKDV')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('affiche les plans course et les quatre sections', () => {
    render(<WorkoutsDrawer now={now} storage={memoryStorage()} />);

    expect(screen.getByRole('heading', { name: 'Entraînement' })).toBeTruthy();
    expect(screen.getByText('Plan 10 km · Intermédiaire')).toBeTruthy();
    expect(screen.getByText(/Aucun accès Runna sous licence/)).toBeTruthy();
    const coursePanel = document.getElementById('lkdv-workout-panel-course');
    expect(coursePanel).not.toBeNull();
    expect(
      within(coursePanel as HTMLElement).getByText(/indisponible \(licence absente\)/)
    ).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Course' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Vélo' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Séances' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Récupération' })).toBeTruthy();
  });


  it('navigue entre les sections au clavier', () => {
    render(<WorkoutsDrawer now={now} storage={memoryStorage()} />);
    const course = screen.getByRole('tab', { name: 'Course' });
    course.focus();
    fireEvent.keyDown(course, { key: 'ArrowRight' });

    expect(
      screen.getByRole('tab', { name: 'Vélo' }).getAttribute('aria-selected')
    ).toBe('true');
    expect(document.activeElement).toBe(
      screen.getByRole('tab', { name: 'Vélo' })
    );
  });

  it('déplie les étapes et cibles d’une séance', () => {
    render(<WorkoutsDrawer now={now} storage={memoryStorage()} />);

    const session = screen.getAllByRole('article')[0];
    fireEvent.click(within(session).getByText('Voir les étapes'));

    expect(within(session).getAllByText('Échauffement').length).toBeGreaterThan(0);
    expect(within(session).getAllByText(/\/km/).length).toBeGreaterThan(0);
  });

  it('démarre, met en pause, reprend et guide les étapes', () => {
    render(<WorkoutsDrawer now={now} storage={memoryStorage()} />);

    fireEvent.click(screen.getAllByRole('button', { name: /^Démarrer / })[0]);
    const player = screen.getByRole('region', {
      name: 'Séance guidée en cours',
    });

    expect(
      within(player).getByRole('heading', { name: 'Échauffement' })
    ).toBeTruthy();
    fireEvent.click(within(player).getByRole('button', { name: /Pause/ }));
    expect(within(player).getByText('En pause')).toBeTruthy();

    fireEvent.click(within(player).getByRole('button', { name: /Reprendre/ }));
    expect(within(player).getByText('En cours')).toBeTruthy();

    fireEvent.click(
      within(player).getByRole('button', { name: /Étape suivante/ })
    );
    expect(
      within(player).getByRole('heading', { name: /Répétition 1\/\d/ })
    ).toBeTruthy();
  });

  it('affiche l’envoi montre indisponible sans connecteur', () => {
    render(<WorkoutsDrawer now={now} storage={memoryStorage()} />);
    fireEvent.click(screen.getAllByRole('button', { name: /^Démarrer / })[0]);

    const player = screen.getByRole('region', {
      name: 'Séance guidée en cours',
    });
    expect(within(player).getByText('Envoi indisponible')).toBeTruthy();
    fireEvent.click(
      within(player).getByRole('button', { name: /Envoyer vers montre/ })
    );
    expect(
      within(player).getByText(/Aucun connecteur montre enregistré/)
    ).toBeTruthy();
  });

  it('termine la séance après la dernière étape', () => {
    render(<WorkoutsDrawer now={now} storage={memoryStorage()} />);
    fireEvent.click(screen.getAllByRole('button', { name: /^Démarrer / })[0]);

    for (let index = 0; index < 30; index += 1) {
      const next = screen.queryByRole('button', { name: /Étape suivante/ });
      if (!next) break;
      fireEvent.click(next);
    }

    expect(screen.getByText('Séance terminée')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeTruthy();
  });

  it('restaure une séance interrompue depuis le stockage local', async () => {
    const storage = memoryStorage();
    const first = render(<WorkoutsDrawer now={now} storage={storage} />);
    fireEvent.click(screen.getAllByRole('button', { name: /^Démarrer / })[0]);
    expect(storage.getItem(WORKOUT_SESSION_STORAGE_KEY)).toBeTruthy();
    first.unmount();

    render(<WorkoutsDrawer now={now} storage={storage} />);
    expect(
      await screen.findByText(/Séance interrompue restaurée/)
    ).toBeTruthy();
    expect(
      screen.getByRole('region', { name: 'Séance guidée en cours' })
    ).toBeTruthy();
  });

  it('bascule vers le vélo et la récupération liée à une pratique réelle', () => {
    render(
      <WorkoutsDrawer
        now={now}
        storage={memoryStorage()}
        payload={{ outings: [recentOuting(2)] }}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Vélo' }));
    expect(screen.getByText('Plan vélo Endurance · Intermédiaire')).toBeTruthy();
    const bikePanel = document.getElementById('lkdv-workout-panel-velo');
    expect(bikePanel).not.toBeNull();
    expect(within(bikePanel as HTMLElement).getByText(/CTS/)).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Récupération' }));
    expect(screen.getByText('Récupération immédiate')).toBeTruthy();
    expect(
      screen.getByRole('checkbox', {
        name: /Marquer Respiration diaphragmatique comme fait/,
      })
    ).toBeTruthy();
  });

  it('affiche l’état vide de récupération sans pratique', () => {
    render(<WorkoutsDrawer now={now} storage={memoryStorage()} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Récupération' }));
    expect(screen.getByText('Aucune pratique récente lue')).toBeTruthy();
    expect(
      screen.getByText(/Aucune sortie terminée n’est lisible/)
    ).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('propose des séances instantanées et signale l’historique absent', () => {
    render(<WorkoutsDrawer now={now} storage={memoryStorage()} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Séances' }));
    expect(screen.getByText('Séances LKDV')).toBeTruthy();
    expect(screen.getByText('Historique absent')).toBeTruthy();
    expect(
      screen.getByText(/Historique indisponible : la proposition/)
    ).toBeTruthy();
  });
});

describe('SessionPlayer — envoi et fin', () => {
  const session = buildRunningPlan('5k', 'debutant').weeks[0].sessions[0];

  it('prépare un envoi seulement pour un appareil compatible', () => {
    const connector: DeviceConnector = {
      id: 'watch-test',
      label: 'Montre test',
      provider: 'garmin',
      status: 'connected',
      capabilities: ['structured_workout'],
    };
    const execution = createExecution(session, 0, 'exec-player');
    render(
      <SessionPlayer
        session={session}
        execution={execution}
        connectors={[connector]}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSkip={vi.fn()}
        onStop={vi.fn()}
      />
    );

    expect(screen.getByText('Prête à envoyer')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: /Envoyer vers montre/ })
    );
    expect(
      screen.getByText(/Séance structurée prête pour Montre test/)
    ).toBeTruthy();
  });

  it('affiche la fin de séance et ferme', () => {
    const execution = advanceExecution(
      createExecution(session, 0, 'exec-done'),
      session,
      session.totalDurationS * 1000
    );
    const onStop = vi.fn();
    render(
      <SessionPlayer
        session={session}
        execution={execution}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSkip={vi.fn()}
        onStop={onStop}
      />
    );

    expect(screen.getByText('Séance terminée')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
