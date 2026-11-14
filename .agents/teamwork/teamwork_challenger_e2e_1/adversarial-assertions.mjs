/**
 * Adversarial Assertion Stress Test Harness
 * Tests whether e2e-assertions.ts functions have real teeth
 */

import {
  parseColor,
  calculateRelativeLuminance,
  calculateContrastRatio,
  assertWcagContrast,
  assertNoPureBlack,
  assertAppleGrabber,
  assertZeroCollision,
  assertContinuousSquircle,
  assertMinTouchTarget,
  PROHIBITED_BLACK_VALUES,
} from '../../../tests/e2e/helpers/e2e-assertions.ts';

let passed = 0;
let failed = 0;

function check(testName, fn) {
  try {
    fn();
    console.log(`  PASS: ${testName}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL: ${testName} -> ${err.message}`);
    failed++;
  }
}

function expectThrows(testName, fn, expectedSubstring) {
  try {
    fn();
    console.error(`  FAIL: ${testName} -> Expected function to throw, but it succeeded`);
    failed++;
  } catch (err) {
    if (expectedSubstring && !err.message.includes(expectedSubstring)) {
      console.error(`  FAIL: ${testName} -> Threw error "${err.message}" but did not include "${expectedSubstring}"`);
      failed++;
    } else {
      console.log(`  PASS: ${testName} (caught expected error: ${err.message.slice(0, 60)}...)`);
      passed++;
    }
  }
}

console.log('=== 1. ADVERSARIAL STRESS: assertNoPureBlack ===');

// Valid LKDV colors should pass
check('Valid LKDV primary green #17402C passes', () => assertNoPureBlack('#17402C'));
check('Valid LKDV action green #226148 passes', () => assertNoPureBlack('#226148'));
check('Valid LKDV canvas #FBFAF6 passes', () => assertNoPureBlack('#FBFAF6'));
check('Valid LKDV dark green #0B1E16 passes', () => assertNoPureBlack('#0B1E16'));

// Pure black & dark injections MUST throw
expectThrows('Pure black #000000 throws', () => assertNoPureBlack('#000000'), 'Pure black injection');
expectThrows('Short pure black #000 throws', () => assertNoPureBlack('#000'), 'Pure black injection');
expectThrows('Audit dark flash #0d1117 throws', () => assertNoPureBlack('#0d1117'), 'Pure black injection');
expectThrows('RGB pure black rgb(0, 0, 0) throws', () => assertNoPureBlack('rgb(0, 0, 0)'), 'Pure black injection');
expectThrows('Named black throws', () => assertNoPureBlack('black'), 'Pure black injection');
expectThrows('RGB audit dark rgb(13, 17, 23) throws', () => assertNoPureBlack('rgb(13, 17, 23)'), 'Pure black injection');
expectThrows('Prohibited #101010 throws', () => assertNoPureBlack('#101010'), 'Pure black injection');
expectThrows('Prohibited #121815 throws', () => assertNoPureBlack('#121815'), 'Pure black injection');

// Case insensitivity & whitespace trimming
expectThrows('Uppercase #000000 throws', () => assertNoPureBlack('  #000000  '), 'Pure black injection');
expectThrows('Uppercase #0D1117 throws', () => assertNoPureBlack('#0D1117'), 'Pure black injection');


console.log('\n=== 2. ADVERSARIAL STRESS: assertAppleGrabber ===');

// Standard Apple grabber 36x5pt
check('Exact 36x5 numbers pass', () => assertAppleGrabber(36, 5));
check('Exact 36px x 5px strings pass', () => assertAppleGrabber('36px', '5px'));
check('Within tolerance 36.4 x 4.9 passes', () => assertAppleGrabber(36.4, 4.9));

// Altered grabbers MUST throw
expectThrows('Altered dimensions 40x8 throws', () => assertAppleGrabber(40, 8));
expectThrows('Width too wide 37x5 throws', () => assertAppleGrabber(37, 5));
expectThrows('Width too narrow 35x5 throws', () => assertAppleGrabber(35, 5));
expectThrows('Height too tall 36x6 throws', () => assertAppleGrabber(36, 6));
expectThrows('Height too short 36x4 throws', () => assertAppleGrabber(36, 4));
expectThrows('String 40px x 8px throws', () => assertAppleGrabber('40px', '8px'));
expectThrows('Zero dimensions 0x0 throws', () => assertAppleGrabber(0, 0));


console.log('\n=== 3. ADVERSARIAL STRESS: assertZeroCollision ===');

// Non-colliding bounding boxes
check('Disjoint boxes pass', () => {
  assertZeroCollision(
    { x: 0, y: 0, width: 100, height: 40 },
    { x: 120, y: 0, width: 100, height: 40 },
    'Box1', 'Box2'
  );
});

check('Adjacent touching boxes (overlap = 0) pass', () => {
  assertZeroCollision(
    { x: 0, y: 0, width: 100, height: 40 },
    { x: 100, y: 0, width: 100, height: 40 },
    'Box1', 'Box2'
  );
});

// Colliding boxes MUST throw
expectThrows('Partial overlap (10px) throws', () => {
  assertZeroCollision(
    { x: 0, y: 0, width: 100, height: 40 },
    { x: 90, y: 0, width: 100, height: 40 },
    'Box1', 'Box2'
  );
}, 'Physical collision detected');

expectThrows('Complete containment overlap throws', () => {
  assertZeroCollision(
    { x: 0, y: 0, width: 200, height: 100 },
    { x: 10, y: 10, width: 50, height: 30 },
    'Parent', 'Child'
  );
}, 'Physical collision detected');

expectThrows('Historical audit collision (44pt overlap msplit / mpill) throws', () => {
  const msplit = { x: 157, y: 440, width: 88, height: 22 };
  const mpillColliding = { x: 140, y: 435, width: 120, height: 32 };
  assertZeroCollision(msplit, mpillColliding, 'msplit', 'mpillColliding');
}, 'Physical collision detected');


console.log('\n=== 4. ADVERSARIAL STRESS: assertWcagContrast ===');

// High contrast combinations
check('White on LKDV brand primary (#FFFFFF on #17402C, ratio > 10) passes AAA (7.0)', () => {
  const r = assertWcagContrast('#FFFFFF', '#17402C', 7.0);
  console.log(`    (Calculated ratio: ${r.toFixed(2)}:1)`);
});

check('Dark text on Sauge (#172B24 on #FBFAF6, ratio > 12) passes AAA (7.0)', () => {
  const r = assertWcagContrast('#172B24', '#FBFAF6', 7.0);
  console.log(`    (Calculated ratio: ${r.toFixed(2)}:1)`);
});

// Low contrast combinations MUST throw
expectThrows('Low contrast (<4.5:1, e.g. #777 on #888) throws at 4.5', () => {
  assertWcagContrast('#777777', '#888888', 4.5);
}, 'WCAG Contrast violation');

expectThrows('White on light gray (#FFFFFF on #D0D0D0, ratio ~ 1.5:1) throws at 4.5', () => {
  assertWcagContrast('#FFFFFF', '#D0D0D0', 4.5);
}, 'WCAG Contrast violation');

expectThrows('Black flash on dark green (#0d1117 on #17402C, ratio ~ 1.2:1) throws at 4.5', () => {
  assertWcagContrast('#0d1117', '#17402C', 4.5);
}, 'WCAG Contrast violation');

expectThrows('Audit bug: Dark text on dark green (#172B24 on #17402C, ratio ~ 1.1:1) throws at 4.5', () => {
  assertWcagContrast('#172B24', '#17402C', 4.5);
}, 'WCAG Contrast violation');


console.log('\n=== SUMMARY ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL ADVERSARIAL ASSERTION CHECKS PASSED WITH REAL TEETH!');
}
