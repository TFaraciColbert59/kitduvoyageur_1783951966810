import { describe, expect, it } from 'vitest';
import {
  clampRatio,
  deltaDirection,
  describeAlert,
  directionLabel,
  formatClock,
  formatDelta,
  formatDeltaLabel,
  formatDistance,
  formatDuration,
  formatElevation,
  formatPercent,
  formatProjectedFinish,
  formatSignedDelta,
  ghostKindLabel,
  invalidationLabel,
  signalPresentation,
  sportLabel,
  statePresentation,
} from '../format';
import { makeAlert, makeSnapshot } from './fixtures';

describe('S03-UI — formatage des Live Segments', () => {
  it('formate le chrono court et long', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(252_000)).toBe('04:12');
    expect(formatClock(3_723_000)).toBe('1:02:03');
    expect(formatClock(-4)).toBe('00:00');
  });

  it('formate une durée lisible en français', () => {
    expect(formatDuration(12_000)).toBe('12 s');
    expect(formatDuration(64_000)).toBe('1 min 04 s');
    expect(formatDuration(3_720_000)).toBe('1 h 02');
    expect(formatDuration(Number.NaN)).toBe('—');
  });

  it('oriente le signe de l’écart fantôme', () => {
    expect(formatDelta(-18_000)).toBe('18 s');
    expect(formatSignedDelta(-18_000)).toBe('− 18 s');
    expect(formatSignedDelta(18_000)).toBe('+ 18 s');
    expect(formatSignedDelta(120)).toBe('Au niveau');
    expect(formatSignedDelta(null)).toBe('—');
    expect(deltaDirection(-600)).toBe('ahead');
    expect(deltaDirection(600)).toBe('behind');
    expect(deltaDirection(null)).toBe('none');
    expect(formatDeltaLabel(-600)).toBe('En avance');
    expect(formatDeltaLabel(600)).toBe('En retard');
  });

  it('formate distances, dénivelé et pourcentage', () => {
    expect(formatDistance(150)).toBe('150 m');
    expect(formatDistance(1_250)).toBe('1,25 km');
    expect(formatDistance(12_400)).toBe('12,4 km');
    expect(formatDistance(null)).toBe('—');
    expect(formatElevation(310)).toBe('310 m D+');
    expect(formatPercent(0.426)).toBe('43 %');
    expect(clampRatio(1.4)).toBe(1);
    expect(clampRatio(-1)).toBe(0);
    expect(clampRatio(Number.NaN)).toBe(0);
  });

  it('projette le temps final sans inventer de valeur', () => {
    expect(formatProjectedFinish(582_000)).toBe('Temps final estimé 9 min 42 s');
    expect(formatProjectedFinish(null)).toBeNull();
    expect(formatProjectedFinish(0)).toBeNull();
  });

  it('traduit sports, sens, fantômes et états', () => {
    expect(sportLabel('cycling')).toBe('Vélo');
    expect(sportLabel('hiking')).toBe('Randonnée');
    expect(sportLabel(null)).toBe('Sport');
    expect(directionLabel('forward')).toBe('Sens direct');
    expect(directionLabel('bidirectional')).toBe('Double sens');
    expect(directionLabel(null)).toBe('—');
    expect(ghostKindLabel('target')).toBe('Objectif');
    expect(ghostKindLabel('pr')).toBe('Mon record');
    expect(ghostKindLabel(null)).toBe('Fantôme');
    expect(statePresentation('off_route')).toMatchObject({ label: 'Hors tracé', tone: 'warning' });
    expect(signalPresentation('lost')).toMatchObject({ label: 'GPS perdu', tone: 'danger' });
    expect(invalidationLabel('gps_teleport_detected')).toContain('Saut GPS');
    expect(invalidationLabel(undefined)).toBeNull();
  });

  it('décrit l’approche avec la distance réelle du snapshot', () => {
    const snapshot = makeSnapshot({
      state: 'approaching',
      distanceToStartM: 132.4,
      deltaMs: null,
      deltaDistanceM: null,
      projectedFinishMs: null,
    });
    const presentation = describeAlert(makeAlert({ type: 'approach' }), snapshot);
    expect(presentation.title).toBe('Segment à 132 m');
    expect(presentation.description).toContain('Montée de test');
    expect(presentation.tone).toBe('info');
  });

  it('décrit le départ, l’arrivée et les incidents', () => {
    expect(describeAlert(makeAlert({ type: 'start' }), makeSnapshot()).title).toBe('Départ lancé');
    const finish = describeAlert(
      makeAlert({ type: 'finish', deltaMs: -12_000 }),
      makeSnapshot(),
    );
    expect(finish.title).toBe('Arrivée');
    expect(finish.description).toContain('12 s d’avance');
    expect(describeAlert(makeAlert({ type: 'off_route' }), makeSnapshot()).tone).toBe('warning');
    expect(describeAlert(makeAlert({ type: 'gps_lost' }), makeSnapshot()).tone).toBe('danger');
    expect(
      describeAlert(makeAlert({ type: 'aborted', reason: 'off_route_aborted' }), makeSnapshot())
        .description,
    ).toContain('hors du tracé');
  });
});
