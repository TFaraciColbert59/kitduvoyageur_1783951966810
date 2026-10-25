import { describe, expect, it } from 'vitest';
import * as matrix from '../../scripts/audit/measure_key_screens_matrix.mjs';

const matrixApi = matrix as typeof matrix & Record<string, any>;

describe('Task 1B fix round 2 — métadonnées des cellules', () => {
  it('conserve finalPath et httpStatus pour une cellule normale', () => {
    expect(typeof matrixApi.assignMatrixNavigationMetadata).toBe('function');
    if (typeof matrixApi.assignMatrixNavigationMetadata !== 'function') return;

    const cell = {
      routeId: 'hub',
      path: '/hub',
      theme: 'light',
      intensity: 0.2,
      measured: true,
      expected: false,
      status: 'measured',
    };
    const navigation = {
      expected: false,
      redirected: false,
      reason: null,
      status: 'ok',
      finalPath: '/hub',
      expectedFinalPath: null,
      expectedStatus: null,
      httpStatus: 200,
    };

    matrixApi.assignMatrixNavigationMetadata(cell, navigation);

    expect(cell).toMatchObject({
      measured: true,
      expected: false,
      status: 'measured',
      finalPath: '/hub',
      httpStatus: 200,
    });
  });
});
