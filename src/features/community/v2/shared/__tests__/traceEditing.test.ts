import { describe, expect, it } from 'vitest';
import {
  createTraceHistory,
  deleteTraceSegment,
  moveItemBetweenDays,
  moveTracePoint,
  traceCommit,
  traceRedo,
  traceSegmentCount,
  traceUndo,
  type TracePoint,
} from '../traceEditing';

const TRACE: TracePoint[] = [
  [5.72, 45.19],
  [5.75, 45.21],
  [5.78, 45.24],
  [5.8, 45.26],
];

describe('traceEditing (FID-068)', () => {
  it('déplace un point intermédiaire sans muter la liste', () => {
    const next = moveTracePoint(TRACE, 1, [5.76, 45.22]);
    expect(next[1]).toEqual([5.76, 45.22]);
    expect(next).toHaveLength(TRACE.length);
    expect(TRACE[1]).toEqual([5.75, 45.21]);
  });

  it('ignore un point non fini ou un index hors bornes', () => {
    expect(moveTracePoint(TRACE, 1, [Number.NaN, 45])).toEqual(TRACE);
    expect(moveTracePoint(TRACE, 9, [5.7, 45.2])).toEqual(TRACE);
  });

  it('supprime le segment N en retirant le point N+1 (maquette n-seg-del)', () => {
    expect(deleteTraceSegment(TRACE, 0)).toEqual([
      [5.72, 45.19],
      [5.78, 45.24],
      [5.8, 45.26],
    ]);
    expect(traceSegmentCount(TRACE)).toBe(3);
    expect(traceSegmentCount([])).toBe(0);
  });

  it('conserve le départ et l’arrivée quand un segment intérieur disparaît', () => {
    const next = deleteTraceSegment(TRACE, 1);
    expect(next[0]).toEqual(TRACE[0]);
    expect(next[next.length - 1]).toEqual(TRACE[TRACE.length - 1]);
  });

  it('undo/redo rejoue un geste, pas une frame', () => {
    let history = createTraceHistory(TRACE);
    history = traceCommit(history, moveTracePoint(history.present, 1, [5.76, 45.22]));
    history = traceCommit(history, deleteTraceSegment(history.present, 1));
    expect(history.past).toHaveLength(2);

    history = traceUndo(history);
    expect(history.present).toHaveLength(4);
    history = traceUndo(history);
    expect(history.present[1]).toEqual(TRACE[1]);
    history = traceRedo(history);
    expect(history.present[1]).toEqual([5.76, 45.22]);
  });

  it('ignore un commit identique (pas d’entrée d’historique vide)', () => {
    const history = traceCommit(createTraceHistory(TRACE), TRACE);
    expect(history.past).toHaveLength(0);
  });

  it('glisse un moment entre deux jours', () => {
    const days = [
      ['a', 'b'],
      ['c'],
      [],
    ];
    expect(moveItemBetweenDays(days, 0, 1, 1, 1)).toEqual([['a'], ['c', 'b'], []]);
    expect(moveItemBetweenDays(days, 0, 0, 2, 99)).toEqual([['b'], ['c'], ['a']]);
    expect(moveItemBetweenDays(days, 0, 9, 1, 0)).toEqual(days);
  });
});
