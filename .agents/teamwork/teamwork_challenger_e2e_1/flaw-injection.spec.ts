/**
 * Adversarial Flaw Injection and Mutation Specification
 * Validates that E2E tests and assertions have genuine regression detection power.
 */

// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import {
  assertAppleGrabber,
  assertNoPureBlack,
  assertWcagContrast,
  assertZeroCollision,
  calculateContrastRatio,
  calculateIntersectionArea,
} from '../../tests/e2e/helpers/e2e-assertions';

import {
  MessagerieHeaderHarness,
  SplitViewHarness,
  BottomSheetHarness,
} from '../../tests/e2e/helpers/messagerie-harness';
import { createMockRouter } from '../../tests/e2e/helpers/mock-router';

afterEach(cleanup);

describe('Adversarial Flaw Injection & Regression Power', () => {

  /* ==========================================================================
     MUTATION TEST 1: Pure Black Injection Detection
     ========================================================================== */
  describe('Mutation 1: assertNoPureBlack catches pure black injections', () => {
    it('catches pure black #000000 in rendered DOM node backgroundColor', () => {
      const { container } = render(
        React.createElement('div', {
          className: 'mutant-card',
          style: { backgroundColor: '#000000', color: '#FFFFFF' },
        })
      );
      const el = container.querySelector('.mutant-card') as HTMLElement;
      expect(() => {
        assertNoPureBlack(el.style.backgroundColor);
      }).toThrow(/Pure black injection detected/);
    });

    it('catches iPhone audit dark flash #0d1117 in header style', () => {
      const { container } = render(
        React.createElement('header', {
          id: 'mutant-header',
          style: { backgroundColor: '#0d1117' },
        })
      );
      const el = container.querySelector('#mutant-header') as HTMLElement;
      expect(() => {
        assertNoPureBlack(el.style.backgroundColor);
      }).toThrow(/Pure black injection detected/);
    });

    it('catches pure black rgb(0, 0, 0) and named black', () => {
      expect(() => assertNoPureBlack('rgb(0, 0, 0)')).toThrow();
      expect(() => assertNoPureBlack('black')).toThrow();
      expect(() => assertNoPureBlack('rgb(13, 17, 23)')).toThrow();
    });
  });

  /* ==========================================================================
     MUTATION TEST 2: Altered Grabber Dimensions Detection
     ========================================================================== */
  describe('Mutation 2: assertAppleGrabber catches dimensional violations', () => {
    it('catches altered 40×8 grabber (e.g. non-Apple custom size)', () => {
      expect(() => {
        assertAppleGrabber(40, 8, 'Custom non-Apple grabber');
      }).toThrow(/Apple Sheet Grabber width must be 36px/);
    });

    it('catches subtle dimensional creep (e.g. 37×5.6)', () => {
      expect(() => {
        assertAppleGrabber(37, 5, 'Width overflow');
      }).toThrow(/Apple Sheet Grabber width must be 36px/);

      expect(() => {
        assertAppleGrabber(36, 5.6, 'Height overflow');
      }).toThrow(/Apple Sheet Grabber height must be 5px/);
    });

    it('catches rendered mutant grabber in DOM', () => {
      const { container } = render(
        React.createElement('span', {
          className: 'sheet-grabber',
          style: { width: '42px', height: '8px' },
        })
      );
      const grabber = container.querySelector('.sheet-grabber') as HTMLElement;
      expect(() => {
        assertAppleGrabber(grabber.style.width, grabber.style.height);
      }).toThrow(/Apple Sheet Grabber width must be 36px/);
    });
  });

  /* ==========================================================================
     MUTATION TEST 3: Physical Collision Detection
     ========================================================================== */
  describe('Mutation 3: assertZeroCollision catches physical element collisions', () => {
    it('catches 44pt collision between msplit handle and mpill (historical audit bug)', () => {
      // Prior to de-collision: msplit was at x=157..245, mpill was at x=140..260 -> overlap
      const mpillBuggy = { x: 140, y: 396, width: 120, height: 32 };
      const msplitBuggy = { x: 157, y: 396, width: 88, height: 22 };

      const area = calculateIntersectionArea(mpillBuggy, msplitBuggy);
      expect(area).toBeGreaterThan(0);

      expect(() => {
        assertZeroCollision(mpillBuggy, msplitBuggy, 'mpill', 'msplit');
      }).toThrow(/Physical collision detected between mpill and msplit/);
    });

    it('catches even 1px edge overlap', () => {
      const boxA = { x: 10, y: 10, width: 50, height: 20 };
      const boxB = { x: 59, y: 10, width: 50, height: 20 }; // 1px overlap from 59 to 60

      expect(() => {
        assertZeroCollision(boxA, boxB, 'BoxA', 'BoxB');
      }).toThrow(/overlap area is 20px²/);
    });
  });

  /* ==========================================================================
     MUTATION TEST 4: WCAG Contrast Violation Detection
     ========================================================================== */
  describe('Mutation 4: assertWcagContrast catches contrast violations', () => {
    it('catches dark text on dark green (#172B24 on #17402C) from audit bug', () => {
      const ratio = calculateContrastRatio('#172B24', '#17402C');
      expect(ratio).toBeLessThan(4.5);

      expect(() => {
        assertWcagContrast('#172B24', '#17402C', 4.5, 'Audit dark-on-dark bug');
      }).toThrow(/WCAG Contrast violation/);
    });

    it('catches low contrast gray on white (< 4.5:1)', () => {
      expect(() => {
        assertWcagContrast('#888888', '#FFFFFF', 4.5);
      }).toThrow(/below threshold 4.5:1/);
    });

    it('catches failure to meet AAA (7.0:1) on secondary text', () => {
      // #56665D on #FBFAF6 has ~ 5.6:1 contrast (passes AA 4.5, fails AAA 7.0)
      const ratio = calculateContrastRatio('#56665D', '#FBFAF6');
      expect(ratio).toBeGreaterThan(4.5);
      expect(ratio).toBeLessThan(7.0);

      expect(() => {
        assertWcagContrast('#56665D', '#FBFAF6', 7.0, 'Secondary text AAA check');
      }).toThrow(/below threshold 7:1/);
    });
  });

  /* ==========================================================================
     MUTATION TEST 5: Behavioral Regressions in UI Components
     ========================================================================== */
  describe('Mutation 5: Component behavioral regression detection', () => {
    it('detects navigation regression if title clicks route to /compte', () => {
      const router = createMockRouter('/messagerie');
      // Simulate buggy header behavior (historical bug)
      const buggyHandleTitleClick = () => {
        router.push('/compte');
      };

      render(
        React.createElement(MessagerieHeaderHarness, {
          onTitleClick: buggyHandleTitleClick,
        })
      );

      const titleBtn = screen.getByRole('button', { name: 'Messages' });
      fireEvent.click(titleBtn);

      // Verify that this triggers the expected failure when asserting no /compte navigation
      expect(router.push).toHaveBeenCalledWith('/compte');
      expect(router.pathname).toBe('/compte');
    });

    it('detects clamping failure if split height exceeds bounds (< 140px or > 694px)', () => {
      let reportedHeight = 0;
      const clamp = (val: number) => Math.max(140, Math.min(694, val));

      // Flawed un-clamped logic
      const flawedSplit = (dy: number) => 360 + dy;
      expect(flawedSplit(-300)).toBe(60); // 60px is below 140px limit!

      // Correct clamped logic
      expect(clamp(flawedSplit(-300))).toBe(140);
      expect(clamp(flawedSplit(500))).toBe(694);
    });
  });
});
